import * as THREE from 'three';
import { DEFAULT_PLAYER_PARAMS } from './playerParams.js';
import { standing } from './standing.js';

const CAPSULE_HALF_HEIGHT = 0.55;
const CAPSULE_RADIUS = 0.3;
const FEET_TO_CENTRE = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS;
const DEG = Math.PI / 180;
// Springs that settle the camera after jumping off a moving quad.
const CAM_SPRING = 9; // rad/s
const CAM_DAMPING = 0.55;
const CAM_KICK = 2.1; // a kick of size * CAM_SPRING * CAM_KICK peaks at about that size
const ALL_GROUPS = 0xffffffff;
const NO_CONTACT_FORCES = 0xffff0000; // in every group, pushes against none

/**
 * First-person player. On foot it drives a Rapier kinematic character
 * controller; when riding it hands movement to the vehicle and only looks
 * around from the seat.
 */
export class Player {
  constructor({ physics, RAPIER, camera, input, world, params = { ...DEFAULT_PLAYER_PARAMS } }) {
    this.physics = physics;
    this.RAPIER = RAPIER;
    this.camera = camera;
    this.input = input;
    this.world = world;
    this.params = params;

    const s = world.spawn.player;
    const feetY = world.heightAt(s.x, s.z) + 0.05;
    this.body = physics.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(s.x, feetY + FEET_TO_CENTRE, s.z),
    );
    this.collider = physics.createCollider(RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS), this.body);

    this.controller = physics.createCharacterController(0.03);
    this.controller.setUp({ x: 0, y: 1, z: 0 });
    this.controller.enableAutostep(0.35, 0.2, false);
    this.controller.enableSnapToGround(0.4);
    this.controller.setMaxSlopeClimbAngle(50 * DEG);
    this.controller.setMinSlopeSlideAngle(60 * DEG);
    // Walking into the quad shouldn't shove it; it's an obstacle, not a toy.
    this.controller.setApplyImpulsesToDynamicBodies(false);

    this.yaw = s.yaw;
    this.pitch = 0;
    this.velocity = new THREE.Vector3();
    this.verticalSpeed = 0;
    this.grounded = false;
    this.bobPhase = 0;
    this.bobAmount = 0;

    // Jumping off a moving quad: a moment off balance, and the quad you left
    // can't touch you (or be shoved by you) until you're clear of it.
    this.stumbleLeft = 0;
    this.stumble = 0;
    this.landing = false;
    this.ignoreCollider = null;
    this.ignoreLeft = 0;
    this.ignoreFilter = (c) => c.handle !== this.ignoreCollider.handle;
    this.eyeDrop = 0; // metres the eyes are lowered, eased towards eyeDropTarget (crouching in the hay)
    this.eyeDropTarget = 0;
    this.camDip = 0;
    this.camDipVel = 0;
    this.camRoll = 0;
    this.camRollVel = 0;

    this.prevPos = new THREE.Vector3(s.x, feetY, s.z);
    this.currPos = this.prevPos.clone();

    this.mode = 'foot';
    this.vehicle = null;
    this.seat = 'rider'; // or 'pillion', riding on the back while she drives
    this.rideYaw = 0;
    this.ridePitch = 0;
    this.lookEnabled = true;
    this.moveEnabled = true;
    // Turning round on the seat to look back over a shoulder (0 facing forward, 1 turned round).
    this.lookBackTurn = 0;
    this.lookBackSide = 1; // +1 over the left shoulder, -1 the right
    this.lookBackYaw = 0; // mouse look while turned round
    this.lookBackPitch = 0;
    // Holding V leans in to look closely at the dash (0 normal view, 1 right in).
    this.dashZoom = 0;
    this.baseFov = camera.fov;

    this.tmpQuat = new THREE.Quaternion();
    this.tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.tmpVec = new THREE.Vector3();
  }

  get isRiding() {
    return this.mode === 'riding';
  }

  /** How far round you're turned to look back, eased, 0..1. */
  get lookBack() {
    const t = this.lookBackTurn;
    return t * t * (3 - 2 * t);
  }

  /** Feet position, interpolated for rendering. */
  get position() {
    return this.renderPos ?? this.currPos;
  }

  // On foot ------------------------------------------------------------

  fixedUpdate(dt) {
    if (this.mode !== 'foot') return;
    const p = this.params;
    const input = this.input;

    this.updateIgnore(dt);
    const stumbling = this.stumbleLeft > 0;
    if (stumbling) this.stumbleLeft -= dt;

    let fx = 0;
    let fz = 0;
    if (this.moveEnabled && !stumbling) {
      if (input.isDown('KeyW')) fz += 1;
      if (input.isDown('KeyS')) fz -= 1;
      if (input.isDown('KeyD')) fx += 1;
      if (input.isDown('KeyA')) fx -= 1;
    }
    const len = Math.hypot(fx, fz);
    const jogging = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = len > 0 ? (jogging ? p.jogSpeed : p.walkSpeed) : 0;
    if (len > 0) {
      fx /= len;
      fz /= len;
    }
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // Camera looks down -Z at yaw 0.
    const targetX = (fx * cos - fz * sin) * speed;
    const targetZ = (-fx * sin - fz * cos) * speed;
    if (stumbling) {
      // No control while you find your feet; the ground takes the speed off you.
      if (this.grounded) {
        const v = Math.hypot(this.velocity.x, this.velocity.z);
        const scale = v > 0 ? Math.max(0, v - p.stumbleDecel * dt) / v : 0;
        this.velocity.x *= scale;
        this.velocity.z *= scale;
      }
    } else {
      const k = Math.min(1, p.acceleration * dt);
      this.velocity.x += (targetX - this.velocity.x) * k;
      this.velocity.z += (targetZ - this.velocity.z) * k;
    }

    // Stood still on the ground: held where you are, not pressed into the slope, which would slide you down it (standing.js).
    const stand = standing({ moving: len > 0, speed: Math.hypot(this.velocity.x, this.velocity.z), grounded: this.grounded, stumbling });
    if (stand.still) {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }
    this.verticalSpeed = this.grounded ? stand.pressDown : this.verticalSpeed - p.gravity * dt;

    const desired = {
      x: this.velocity.x * dt,
      y: this.verticalSpeed * dt,
      z: this.velocity.z * dt,
    };
    const filter = this.ignoreCollider ? this.ignoreFilter : undefined;
    this.controller.computeColliderMovement(this.collider, desired, undefined, undefined, filter);
    const move = this.controller.computedMovement();
    if (stand.still && this.controller.computedGrounded()) {
      move.x = 0;
      move.z = 0;
    }
    const wasGrounded = this.grounded;
    this.grounded = this.controller.computedGrounded();
    if (this.landing && this.grounded && !wasGrounded) this.land();

    const t = this.body.translation();
    const next = { x: t.x + move.x, y: t.y + move.y, z: t.z + move.z };
    // Never fall through the terrain if something goes wrong.
    const ground = this.world.heightAt(next.x, next.z);
    if (next.y - FEET_TO_CENTRE < ground - 0.5) next.y = ground + FEET_TO_CENTRE;
    this.body.setNextKinematicTranslation(next);

    this.prevPos.copy(this.currPos);
    this.currPos.set(next.x, next.y - FEET_TO_CENTRE, next.z);

    const horiz = Math.hypot(move.x, move.z);
    this.bobPhase += horiz * p.headBobRate * Math.PI;
    const bobTarget = horiz / dt > 0.3 && this.grounded ? (jogging ? p.headBobJog : p.headBobWalk) : 0;
    this.bobAmount += (bobTarget - this.bobAmount) * Math.min(1, 8 * dt);
  }

  // Every frame -----------------------------------------------------------

  update(dt, alpha, vibration) {
    const p = this.params;
    const mouse = this.input.takeMouseDelta();
    if (this.lookEnabled) {
      const dx = mouse.x * p.mouseSensitivity;
      const dy = mouse.y * p.mouseSensitivity;
      if (this.mode === 'foot') {
        this.yaw -= dx;
        this.pitch = THREE.MathUtils.clamp(this.pitch - dy, -88 * DEG, 88 * DEG);
      } else if (this.lookBackTurn > 0.5) {
        const free = p.lookBackFreedom * DEG;
        this.lookBackYaw = THREE.MathUtils.clamp(this.lookBackYaw - dx, -free, free);
        this.lookBackPitch = THREE.MathUtils.clamp(this.lookBackPitch - dy, -free, free);
      } else {
        this.rideYaw = THREE.MathUtils.clamp(this.rideYaw - dx, -p.rideYawLimit * DEG, p.rideYawLimit * DEG);
        this.ridePitch = THREE.MathUtils.clamp(this.ridePitch - dy, -p.ridePitchDown * DEG, p.ridePitchUp * DEG);
      }
    }
    this.updateLookBack(dt);
    this.updateDashZoom(dt);

    if (this.mode === 'foot') {
      this.renderPos = this.tmpVec.lerpVectors(this.prevPos, this.currPos, alpha);
      const bob = Math.sin(this.bobPhase) * this.bobAmount;
      const sway = Math.cos(this.bobPhase * 0.5) * this.bobAmount * 0.5;
      this.updateCameraSprings(dt);
      this.eyeDrop += (this.eyeDropTarget - this.eyeDrop) * Math.min(1, dt * 6);
      this.camera.position.set(this.renderPos.x, this.renderPos.y + p.eyeHeight + bob + this.camDip - this.eyeDrop, this.renderPos.z);
      // Dipping on landing also tips the view down a little.
      this.camera.rotation.set(this.pitch + this.camDip * 0.8, this.yaw, sway * 0.15 + this.camRoll, 'YXZ');
    } else {
      this.updateRidingCamera(vibration);
    }
  }

  /** Holding C or the middle mouse button turns you round on the seat to look back. */
  updateLookBack(dt) {
    const p = this.params;
    const held = this.isRiding && this.lookEnabled && (this.input.isDown('KeyC') || this.input.isMouseDown?.(1));
    // Turn over the shoulder you're already looking toward, the left if straight ahead.
    if (held && this.lookBackTurn === 0) this.lookBackSide = this.rideYaw < -5 * DEG ? -1 : 1;
    const step = dt / Math.max(0.01, p.lookBackTime);
    this.lookBackTurn = THREE.MathUtils.clamp(this.lookBackTurn + (held ? step : -step), 0, 1);
    if (!held) {
      // Mouse look while turned round lets go as you face forward again.
      const k = Math.min(1, dt * 8);
      this.lookBackYaw -= this.lookBackYaw * k;
      this.lookBackPitch -= this.lookBackPitch * k;
    }
  }

  /** Holding V leans in to the dash, as a rider at the controls. Looking back wins over it. */
  updateDashZoom(dt) {
    const p = this.params;
    const held = this.isRiding && this.seat === 'rider' && this.lookEnabled && this.lookBack === 0 && this.input.isDown('KeyV');
    const step = dt / Math.max(0.01, p.dashZoomTime);
    this.dashZoom = THREE.MathUtils.clamp(this.dashZoom + (held ? step : -step), 0, 1);
    const fov = this.baseFov + (p.dashZoomFov - this.baseFov) * THREE.MathUtils.smoothstep(this.dashZoom, 0, 1);
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Where your eyes move to as you twist round to look back, relative to the camera anchor. */
  lookBackOffset(out = new THREE.Vector3()) {
    const back = this.lookBack;
    // Out over the shoulder and a touch forward.
    return out.set(this.lookBackSide * this.params.lookBackShift * back, -0.02 * back, 0.1 * back);
  }

  updateRidingCamera(vibration) {
    const p = this.params;
    const anchor = this.seat === 'pillion' ? this.vehicle.pillionCameraAnchor : this.vehicle.cameraAnchor;
    anchor.updateWorldMatrix(true, false);
    anchor.getWorldPosition(this.camera.position);
    anchor.getWorldQuaternion(this.tmpQuat);

    let yaw = this.rideYaw;
    let pitch = this.ridePitch;
    let roll = 0;
    const back = this.lookBack;
    if (back > 0) {
      const side = this.lookBackSide;
      this.camera.position.add(this.lookBackOffset(this.tmpVec).applyQuaternion(this.tmpQuat));
      yaw += (side * p.lookBackYaw * DEG + this.lookBackYaw - yaw) * back;
      pitch += (p.lookBackPitch * DEG + this.lookBackPitch - pitch) * back;
      roll += side * 4 * DEG * back;
    }
    if (vibration) {
      const c = vibration.camera;
      const k = this.params.rideCameraShake;
      this.camera.position.add(this.tmpVec.set(c.x * k, c.y * k, c.z * k).applyQuaternion(this.tmpQuat));
      pitch += c.pitch * k;
      roll += c.roll * k;
    }
    // On a leaning bike the view stays part way level (leaning left is a roll the other way about the camera's own axis).
    if (this.seat === 'rider' && this.vehicle.bike) roll -= this.vehicle.bike.lean * p.bikeCameraLevel;
    // The camera looks down -Z; the bike faces +Z.
    this.tmpEuler.set(pitch, yaw + Math.PI, roll, 'YXZ');
    this.camera.quaternion.copy(this.tmpQuat).multiply(new THREE.Quaternion().setFromEuler(this.tmpEuler));
    if (this.dashZoom > 0 && this.seat === 'rider') this.leanToDash(THREE.MathUtils.smoothstep(this.dashZoom, 0, 1));
  }

  /** Moves the eyes in towards the middle of the dash (and the pod above it) and turns to face it, by `k` of the way. */
  leanToDash(k) {
    const v = this.vehicle;
    const dash = v.model.userData.dash?.group;
    if (!dash) return;
    const mid = dash.getWorldPosition(new THREE.Vector3());
    const dashQuat = dash.getWorldQuaternion(new THREE.Quaternion());
    if (v.pod) {
      const podAt = v.pod.group.getWorldPosition(new THREE.Vector3());
      // The pod's origin is its foot; its face is about 9 cm up it.
      podAt.add(new THREE.Vector3(0, 0.09, 0).applyQuaternion(v.pod.group.getWorldQuaternion(new THREE.Quaternion())));
      mid.lerp(podAt, 0.5);
    }
    // Stand in front of the dash's face (it looks along -Z, towards the rider), a bit above, and look at its middle.
    const to = new THREE.Vector3(0, 0.05, -1).normalize().applyQuaternion(dashQuat).multiplyScalar(this.params.dashZoomDistance * (v.pod ? 1 : v.scale ?? 1)).add(mid);
    const m = new THREE.Matrix4().lookAt(to, mid, new THREE.Vector3(0, 1, 0));
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    this.camera.position.lerp(to, k);
    this.camera.quaternion.slerp(q, k);
  }

  // Riding -----------------------------------------------------------------

  /** Gets on: at the controls ('rider') or on the back ('pillion'). */
  mount(vehicle, seat = 'rider') {
    this.mode = 'riding';
    this.seat = seat;
    this.stumbleLeft = 0;
    this.landing = false;
    this.camDip = this.camDipVel = this.camRoll = this.camRollVel = 0;
    if (this.ignoreCollider) {
      this.ignoreCollider = null;
      this.collider.setSolverGroups(ALL_GROUPS);
    }
    this.vehicle = vehicle;
    this.rideYaw = 0;
    this.ridePitch = -12 * DEG;
    this.lookBackTurn = this.lookBackYaw = this.lookBackPitch = 0;
    this.collider.setEnabled(false);
    this.velocity.set(0, 0, 0);
  }

  /** Puts you at `feet` (a world position) on foot, as if you'd stepped there, keeping which way you're looking. */
  moveTo(feet) {
    const centre = { x: feet.x, y: feet.y + FEET_TO_CENTRE, z: feet.z };
    this.velocity.set(0, 0, 0);
    this.body.setTranslation(centre, true);
    this.body.setNextKinematicTranslation(centre);
    this.currPos.set(feet.x, feet.y, feet.z);
    this.prevPos.copy(this.currPos);
    this.verticalSpeed = 0;
  }

  /** Steps off at `feet` (a world position) facing `yaw`. */
  dismount(feet, yaw) {
    this.velocity.set(0, 0, 0);
    this.mode = 'foot';
    this.vehicle = null;
    this.lookBackTurn = 0;
    const centre = { x: feet.x, y: feet.y + FEET_TO_CENTRE, z: feet.z };
    this.body.setTranslation(centre, true);
    this.body.setNextKinematicTranslation(centre);
    this.collider.setEnabled(true);
    this.currPos.set(feet.x, feet.y, feet.z);
    this.prevPos.copy(this.currPos);
    this.yaw = yaw;
    this.pitch = 0;
    this.verticalSpeed = 0;
    this.grounded = false;
  }

  /**
   * Jumps off a moving quad and lands at speed.
   * @param {THREE.Vector3} feet  Where to start, beside the quad (a little off the ground is fine).
   * @param {object} leap
   * @param {number} leap.yaw, leap.pitch   Which way to look (keep looking where you were).
   * @param {{x,y,z}} leap.carry   The quad's velocity; you keep some of it.
   * @param {THREE.Vector3} leap.push  Horizontal unit vector, the way you jump.
   * @param {number} leap.speed  The quad's speed, for how hard the landing is.
   * @param {object} [leap.collider]  The quad's collider, ignored until you're clear of it.
   */
  leapOff(feet, { yaw, pitch, carry, push, speed, collider }) {
    const p = this.params;
    this.dismount(feet, yaw);
    this.pitch = THREE.MathUtils.clamp(pitch, -60 * DEG, 60 * DEG);
    this.velocity.set(carry.x * p.leapCarry + push.x * p.leapSideSpeed, 0, carry.z * p.leapCarry + push.z * p.leapSideSpeed);
    this.verticalSpeed = p.leapHop;
    const k = THREE.MathUtils.clamp((speed - p.dismountSpeed) / Math.max(0.1, p.stumbleFullSpeed - p.dismountSpeed), 0, 1);
    this.stumble = k;
    this.stumbleLeft = p.stumbleTime * (0.4 + 0.6 * k);
    this.landing = true;
    if (collider) {
      this.ignoreCollider = collider;
      this.ignoreLeft = this.stumbleLeft + 0.6;
      this.collider.setSolverGroups(NO_CONTACT_FORCES);
    }
    // Lean into the jump: roll towards the side you're jumping to.
    const right = Math.cos(yaw) * push.x - Math.sin(yaw) * push.z;
    this.camRollVel = -right * p.stumbleRoll * DEG * CAM_SPRING * CAM_KICK * (0.3 + 0.7 * k);
  }

  /** Touching down after jumping off: the knees give and the view lurches. */
  land() {
    const p = this.params;
    this.landing = false;
    const k = this.stumble;
    this.camDipVel -= p.stumbleDip * CAM_SPRING * CAM_KICK * (0.25 + 0.75 * k);
    this.camRollVel += (this.camRoll >= 0 ? 1 : -1) * p.stumbleRoll * DEG * CAM_SPRING * CAM_KICK * 0.4 * k;
  }

  /** Stops ignoring the quad you jumped off once you're well clear of it. */
  updateIgnore(dt) {
    if (!this.ignoreCollider) return;
    this.ignoreLeft -= dt;
    if (this.ignoreLeft > 0) return;
    const q = this.ignoreCollider.translation();
    const t = this.body.translation();
    if (Math.hypot(q.x - t.x, q.z - t.z) < 1.8) return; // still alongside it
    this.ignoreCollider = null;
    this.collider.setSolverGroups(ALL_GROUPS);
  }

  updateCameraSprings(dt) {
    const w = CAM_SPRING;
    const c = 2 * CAM_DAMPING * w;
    this.camDipVel += (-w * w * this.camDip - c * this.camDipVel) * dt;
    this.camDip += this.camDipVel * dt;
    this.camRollVel += (-w * w * this.camRoll - c * this.camRollVel) * dt;
    this.camRoll += this.camRollVel * dt;
  }

  /** Ray from the eye through the centre of the screen. */
  getViewRay(target = new THREE.Ray()) {
    this.camera.getWorldPosition(target.origin);
    this.camera.getWorldDirection(target.direction);
    return target;
  }
}

export const PLAYER_CAPSULE = { halfHeight: CAPSULE_HALF_HEIGHT, radius: CAPSULE_RADIUS, feetToCentre: FEET_TO_CENTRE };
