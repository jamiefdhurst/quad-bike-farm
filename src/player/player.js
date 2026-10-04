import * as THREE from 'three';
import { DEFAULT_PLAYER_PARAMS } from './playerParams.js';

const CAPSULE_HALF_HEIGHT = 0.55;
const CAPSULE_RADIUS = 0.3;
const FEET_TO_CENTRE = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS;
const DEG = Math.PI / 180;

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
    this.controller.setApplyImpulsesToDynamicBodies(true);
    this.controller.setCharacterMass(80);

    this.yaw = s.yaw;
    this.pitch = 0;
    this.velocity = new THREE.Vector3();
    this.verticalSpeed = 0;
    this.grounded = false;
    this.bobPhase = 0;
    this.bobAmount = 0;

    this.prevPos = new THREE.Vector3(s.x, feetY, s.z);
    this.currPos = this.prevPos.clone();

    this.mode = 'foot';
    this.vehicle = null;
    this.rideYaw = 0;
    this.ridePitch = 0;
    this.lookEnabled = true;
    this.moveEnabled = true;

    this.tmpQuat = new THREE.Quaternion();
    this.tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.tmpVec = new THREE.Vector3();
  }

  get isRiding() {
    return this.mode === 'riding';
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

    let fx = 0;
    let fz = 0;
    if (this.moveEnabled) {
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
    const k = Math.min(1, p.acceleration * dt);
    this.velocity.x += (targetX - this.velocity.x) * k;
    this.velocity.z += (targetZ - this.velocity.z) * k;

    this.verticalSpeed = this.grounded ? -1 : this.verticalSpeed - p.gravity * dt;

    const desired = {
      x: this.velocity.x * dt,
      y: this.verticalSpeed * dt,
      z: this.velocity.z * dt,
    };
    this.controller.computeColliderMovement(this.collider, desired);
    const move = this.controller.computedMovement();
    this.grounded = this.controller.computedGrounded();

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
      } else {
        this.rideYaw = THREE.MathUtils.clamp(this.rideYaw - dx, -p.rideYawLimit * DEG, p.rideYawLimit * DEG);
        this.ridePitch = THREE.MathUtils.clamp(this.ridePitch - dy, -p.ridePitchDown * DEG, p.ridePitchUp * DEG);
      }
    }

    if (this.mode === 'foot') {
      this.renderPos = this.tmpVec.lerpVectors(this.prevPos, this.currPos, alpha);
      const bob = Math.sin(this.bobPhase) * this.bobAmount;
      const sway = Math.cos(this.bobPhase * 0.5) * this.bobAmount * 0.5;
      this.camera.position.set(this.renderPos.x, this.renderPos.y + p.eyeHeight + bob, this.renderPos.z);
      this.camera.rotation.set(this.pitch, this.yaw, sway * 0.15, 'YXZ');
    } else {
      this.updateRidingCamera(vibration);
    }
  }

  updateRidingCamera(vibration) {
    const anchor = this.vehicle.cameraAnchor;
    anchor.updateWorldMatrix(true, false);
    anchor.getWorldPosition(this.camera.position);
    anchor.getWorldQuaternion(this.tmpQuat);

    let pitch = this.ridePitch;
    let roll = 0;
    if (vibration) {
      const c = vibration.camera;
      const k = this.params.rideCameraShake;
      this.camera.position.add(this.tmpVec.set(c.x * k, c.y * k, c.z * k).applyQuaternion(this.tmpQuat));
      pitch += c.pitch * k;
      roll += c.roll * k;
    }
    // The camera looks down -Z; the bike faces +Z.
    this.tmpEuler.set(pitch, this.rideYaw + Math.PI, roll, 'YXZ');
    this.camera.quaternion.copy(this.tmpQuat).multiply(new THREE.Quaternion().setFromEuler(this.tmpEuler));
  }

  // Riding -----------------------------------------------------------------

  mount(vehicle) {
    this.mode = 'riding';
    this.vehicle = vehicle;
    this.rideYaw = 0;
    this.ridePitch = -12 * DEG;
    this.collider.setEnabled(false);
    this.velocity.set(0, 0, 0);
  }

  /** Steps off at `feet` (a world position) facing `yaw`. */
  dismount(feet, yaw) {
    this.mode = 'foot';
    this.vehicle = null;
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

  /** Ray from the eye through the centre of the screen. */
  getViewRay(target = new THREE.Ray()) {
    this.camera.getWorldPosition(target.origin);
    this.camera.getWorldDirection(target.direction);
    return target;
  }
}

export const PLAYER_CAPSULE = { halfHeight: CAPSULE_HALF_HEIGHT, radius: CAPSULE_RADIUS, feetToCentre: FEET_TO_CENTRE };
