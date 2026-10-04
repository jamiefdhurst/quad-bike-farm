import * as THREE from 'three';
import { StateMachine } from './stateMachine.js';
import { CharacterRig } from './characterRig.js';
import { DEFAULT_COMPANION_PARAMS } from './companionParams.js';
import { applyOutfit, OUTFITS } from './outfit.js';

const CAPSULE_HALF_HEIGHT = 0.55;
const CAPSULE_RADIUS = 0.25;
const UP = new THREE.Vector3(0, 1, 0);
const smooth = (t) => t * t * (3 - 2 * t);

function angleTo(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/**
 * The companion NPC. Behaviour is a small state machine:
 *
 *   idle ──walk──▶ walking ──arrive──▶ idle | mounting ──▶ seated ──▶ dismounting ──▶ idle
 *
 * Requests (the menu options) are methods that pick the next state, and
 * getActions() lists only the ones that make sense right now. New requests
 * slot in as another method plus an entry in getActions().
 */
export class Companion {
  constructor({ scene, physics, RAPIER, world, quad, gltf, params = { ...DEFAULT_COMPANION_PARAMS } }) {
    this.scene = scene;
    this.physics = physics;
    this.RAPIER = RAPIER;
    this.world = world;
    this.quad = quad;
    this.params = params;

    this.rig = new CharacterRig(gltf, params.height);
    applyOutfit(this.rig, OUTFITS[params.outfit] ?? OUTFITS.original);
    this.root = this.rig.root;
    this.root.name = 'companion';
    scene.add(this.root);

    // Where her hips sit in the sitting pose, so she can be placed on the seat.
    this.sitHips = this.rig.measureHips('SitIdle', 0);
    this.rig.play('Idle', { fade: 0 });

    // Invisible proxy for "look at her and press E".
    this.proxy = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 1.0, 4, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.proxy.position.y = 0.85;
    this.root.add(this.proxy);

    this.body = physics.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    this.collider = physics.createCollider(RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS), this.body);

    this.tmpV = new THREE.Vector3();
    this.avoidSide = 1;
    this.avoidTimer = 0;
    this.stuckTimer = 0;

    // Start beside the quad on its left, facing it.
    const stand = this.standPoint(1);
    this.root.position.copy(stand.position);
    this.heading = stand.facing;
    this.root.rotation.y = this.heading;
    this.setColliderEnabled(true);
    this.lastPos = this.root.position.clone();

    this.fsm = new StateMachine(this, STATES, 'idle');

    this.glanceTimer = this.randomBetween(params.glanceEveryMin, params.glanceEveryMax);
    this.glanceLeft = 0;
    this.fidgetTimer = this.randomBetween(params.fidgetEveryMin, params.fidgetEveryMax);
    this.fidget = null;
  }

  randomBetween(a, b) {
    return a + Math.random() * Math.max(0, b - a);
  }

  get state() {
    return this.fsm.name;
  }

  get isSeated() {
    return this.fsm.is('seated');
  }

  // Requests ----------------------------------------------------------------

  /**
   * Menu options that make sense right now. With several quads, each gets its
   * own options, nearest to her first.
   */
  getActions(quads = [this.quad]) {
    const s = this.fsm;
    const here = this.root.getWorldPosition(new THREE.Vector3());
    const sorted = [...quads].sort((a, b) => a.position.distanceTo(here) - b.position.distanceTo(here));
    // Only quads with a pillion seat can carry her.
    const rideable = (q) => q.hasPillion && !q.isTipped;
    const actions = [];
    const boarding = s.is('seated', 'mounting') || (s.is('walking') && s.data?.goal === 'mount');
    if (boarding) {
      actions.push({ label: `Stand next to the ${this.quad.label}`, run: () => this.requestStandBeside(this.quad) });
      for (const q of sorted) {
        if (q !== this.quad && rideable(q)) actions.push({ label: `Get on the ${q.label}`, run: () => this.requestMount(q) });
      }
      return actions;
    }
    if (s.is('dismounting')) return actions;
    for (const q of sorted) {
      if (rideable(q)) actions.push({ label: `Get on the ${q.label}`, run: () => this.requestMount(q) });
      if (!this.isStandingBeside(q)) actions.push({ label: `Stand next to the ${q.label}`, run: () => this.requestStandBeside(q) });
    }
    return actions;
  }

  requestMount(quad = this.quad) {
    if (!quad.hasPillion) return;
    if (this.fsm.is('seated', 'mounting') && quad !== this.quad) {
      // Off this one first, then over to the other.
      this.afterDismount = () => this.requestMount(quad);
      this.fsm.transition('dismounting');
      return;
    }
    if (this.fsm.is('seated')) return;
    this.quad = quad;
    this.fsm.transition('walking', { goal: 'mount', target: () => this.mountPoint() });
  }

  requestStandBeside(quad = this.quad) {
    if (this.fsm.is('seated', 'mounting')) {
      this.afterDismount = quad !== this.quad ? () => this.requestStandBeside(quad) : null;
      this.fsm.transition('dismounting');
    } else {
      this.quad = quad;
      this.fsm.transition('walking', { goal: 'stand', target: () => this.standPoint() });
    }
  }

  // Positions around the quad ---------------------------------------------

  /** Side of the bike (+1 left, -1 right) nearer to her. */
  nearSide(quad = this.quad) {
    const local = quad.model.worldToLocal(this.root.getWorldPosition(this.tmpV));
    return local.x >= 0 ? 1 : -1;
  }

  /** Standing spot beside the pillion seat, facing the bike. */
  standPoint(side, quad = this.quad) {
    if (side === undefined) side = this.root.parent === this.scene ? this.nearSide(quad) : 1;
    const p = quad.localToWorld(side * this.params.standOffset, 0, -0.35);
    p.y = this.world.heightAt(p.x, p.z);
    const c = quad.position;
    return { position: p, facing: Math.atan2(c.x - p.x, c.z - p.z) };
  }

  /** Where she climbs on from, just beside the pillion footrest. */
  mountPoint() {
    const side = this.nearSide();
    const p = this.quad.localToWorld(side * 0.85, 0, -0.5);
    p.y = this.world.heightAt(p.x, p.z);
    return { position: p, facing: this.quad.yaw, side };
  }

  isStandingBeside(quad = this.quad) {
    if (!this.fsm.is('idle')) return false;
    const s = this.standPoint(undefined, quad);
    return s.position.distanceTo(this.root.position) < 0.6 && Math.abs(angleTo(this.heading, s.facing)) < 0.6;
  }

  /** Root-local transform that puts her hips on the pillion seat. */
  seatOffset() {
    const p = this.params;
    return new THREE.Vector3(-this.sitHips.x, -this.sitHips.y + p.seatRaise, -this.sitHips.z + p.seatForward);
  }

  // Movement ------------------------------------------------------------------

  /** Walks toward `target`; returns true on arrival. */
  walkToward(dt, target) {
    const p = this.params;
    const pos = this.root.position;
    const to = this.tmpV.set(target.x - pos.x, 0, target.z - pos.z);
    const dist = to.length();
    if (dist < p.arriveRadius) return true;
    to.divideScalar(dist);

    let desired = Math.atan2(to.x, to.z);
    this.avoidTimer -= dt;
    if (this.stuckTimer < 5 && this.blocked(desired, Math.min(p.probeDistance, dist - 0.1))) {
      // Try angles either side, keeping to one side for a while so she doesn't dither.
      const offsets = [0.5, 1.0, 1.5, 2.0, 2.5];
      let found = null;
      for (const o of offsets) {
        for (const side of [this.avoidSide, -this.avoidSide]) {
          if (found === null && !this.blocked(desired + side * o, p.probeDistance)) {
            found = desired + side * o;
            if (side !== this.avoidSide && this.avoidTimer <= 0) {
              this.avoidSide = side;
              this.avoidTimer = 1.5;
            }
          }
        }
      }
      if (found !== null) desired = found;
    }

    this.heading += angleTo(this.heading, desired) * Math.min(1, p.turnRate * dt);
    // Slow down when turning sharply and near the end.
    const turnFactor = Math.max(0.2, Math.cos(angleTo(this.heading, desired)));
    const speed = p.walkSpeed * turnFactor * Math.min(1, dist / 0.6 + 0.3);
    pos.x += Math.sin(this.heading) * speed * dt;
    pos.z += Math.cos(this.heading) * speed * dt;
    pos.y = this.world.heightAt(pos.x, pos.z);
    this.root.rotation.y = this.heading;
    this.rig.setTimeScale(speed / p.walkAnimSpeed);

    // Track progress so she can push through if she gets wedged.
    if (pos.distanceTo(this.lastPos) < 0.3 * dt) this.stuckTimer += dt;
    else this.stuckTimer = Math.max(0, this.stuckTimer - dt);
    this.lastPos.copy(pos);
    return false;
  }

  blocked(angle, distance) {
    if (distance <= 0.05) return false;
    const pos = this.root.position;
    const ray = new this.RAPIER.Ray(
      { x: pos.x, y: pos.y + 0.5, z: pos.z },
      { x: Math.sin(angle), y: 0, z: Math.cos(angle) },
    );
    const terrain = this.world.terrain.collider.handle;
    const own = this.collider.handle;
    const hit = this.physics.castRay(ray, distance, true, undefined, undefined, undefined, undefined, (c) => {
      return c.handle !== terrain && c.handle !== own;
    });
    return !!hit;
  }

  turnToward(dt, facing) {
    this.heading += angleTo(this.heading, facing) * Math.min(1, this.params.turnRate * dt);
    this.root.rotation.y = this.heading;
  }

  syncCollider() {
    const p = this.root.position;
    this.body.setNextKinematicTranslation({ x: p.x, y: p.y + CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS, z: p.z });
  }

  setColliderEnabled(on) {
    this.collider.setEnabled(on);
    if (on) {
      const p = this.root.position;
      this.body.setTranslation({ x: p.x, y: p.y + CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS, z: p.z }, true);
    }
  }

  /**
   * @param {number} dt
   * @param {VibrationModel} vibration
   * @param {object} viewer  { position: world position of the player's eyes, isRiding, talking }
   */
  update(dt, vibration, viewer) {
    this.fsm.update(dt);
    if (viewer) this.updateGlance(dt, viewer);
    this.updateFidget(dt);
    if (this.root.parent === this.scene) this.syncCollider();

    // Seated riders shake with the bike; the rig adds a little upper-body lag.
    if (this.isSeated && vibration) {
      const k = this.params.rideBounce;
      this.rig.spineSway.pitch = vibration.camera.pitch * 2 * k + vibration.body.pitch * 0.8 * k;
      this.rig.spineSway.roll = vibration.camera.roll * 2 * k;
    } else {
      this.rig.spineSway.pitch = 0;
      this.rig.spineSway.roll = 0;
    }
    this.rig.update(dt);
  }
}

// Idle behaviour -------------------------------------------------------------

Companion.prototype.updateGlance = function (dt, viewer) {
  const p = this.params;
  const rig = this.rig;
  // Riding together she's behind you, so there's nothing to look at.
  const ridingTogether = viewer.isRiding && this.isSeated;
  const near = this.root.getWorldPosition(this.tmpV).distanceTo(viewer.position) < p.glanceRange;
  let want = 0;
  if (viewer.talking && near) {
    want = 1; // looks at you while you're talking to her
  } else if (!ridingTogether && near && !this.fsm.is('mounting', 'dismounting')) {
    if (this.glanceLeft > 0) {
      this.glanceLeft -= dt;
      want = 1;
    } else if ((this.glanceTimer -= dt) <= 0) {
      this.glanceLeft = this.randomBetween(p.glanceHoldMin, p.glanceHoldMax);
      this.glanceTimer = this.randomBetween(p.glanceEveryMin, p.glanceEveryMax);
    }
  }
  rig.lookTarget.copy(viewer.position);
  rig.lookWeight += (want - rig.lookWeight) * Math.min(1, p.lookSpeed * dt);
};

// Small movements, each with a shape over its life (0..1) and offsets to apply.
const FIDGETS = {
  // Lifts one arm out and bends the elbow, as if adjusting her grip or hair.
  arm: (k, side) => (side > 0 ? { leftArmOut: 0.55 * k, leftElbow: 0.9 * k } : { rightArmOut: 0.55 * k, rightElbow: 0.9 * k }),
  // Shifts her weight to one side.
  lean: (k, side) => ({ spineRoll: 0.24 * k * side, headYaw: -0.2 * k * side }),
  // Stretches back with both arms out a little.
  stretch: (k) => ({ spinePitch: -0.18 * k, leftArmOut: 0.35 * k, rightArmOut: 0.35 * k, leftElbow: 0.3 * k, rightElbow: 0.3 * k }),
  // Looks out over the field to one side.
  lookAround: (k, side) => ({ headYaw: 1.05 * k * side, spineRoll: 0.05 * k * side }),
};
const SEATED_FIDGETS = ['arm', 'lean', 'stretch', 'lookAround', 'arm', 'lookAround'];
const STANDING_FIDGETS = ['lean', 'lookAround'];

Companion.prototype.updateFidget = function (dt) {
  const p = this.params;
  const offsets = this.rig.offsets;
  for (const key in offsets) offsets[key] = 0;

  const seated = this.isSeated;
  const standing = this.fsm.is('idle');
  if (!this.fidget && (seated || standing)) {
    if ((this.fidgetTimer -= dt) <= 0) {
      const list = seated ? SEATED_FIDGETS : STANDING_FIDGETS;
      this.fidget = {
        type: list[Math.floor(Math.random() * list.length)],
        side: Math.random() < 0.5 ? -1 : 1,
        t: 0,
        duration: 1.6 + Math.random() * 1.6,
      };
      // Standing, she fidgets less often.
      this.fidgetTimer = this.randomBetween(p.fidgetEveryMin, p.fidgetEveryMax) * (seated ? 1 : 2);
    }
  }
  if (!this.fidget) return;
  const f = this.fidget;
  f.t += dt / f.duration;
  if (f.t >= 1 || !(seated || standing)) {
    this.fidget = null;
    return;
  }
  // Ease in, hold, ease out.
  const k = smooth(Math.min(1, f.t / 0.3)) * smooth(Math.min(1, (1 - f.t) / 0.3)) * p.fidgetScale;
  Object.assign(offsets, FIDGETS[f.type](k, f.side));
};

// State definitions. `this` is the Companion.
const STATES = {
  idle: {
    enter() {
      this.rig.play('Idle');
    },
    update(dt, data) {
      if (data.facing !== undefined) this.turnToward(dt, data.facing);
    },
  },

  walking: {
    enter() {
      this.rig.play('Walking', { fade: 0.25 });
      this.stuckTimer = 0;
    },
    update(dt, data) {
      const t = data.target();
      // Hold back near a moving quad until it stops.
      if (data.goal === 'mount' && this.quad.speed > this.params.maxMountSpeed) {
        if (t.position.distanceTo(this.root.position) < 1.2) {
          this.rig.setTimeScale(0);
          return;
        }
      }
      if (this.walkToward(dt, t.position)) {
        if (data.goal === 'mount') this.fsm.transition('mounting', { side: t.side });
        else this.fsm.transition('idle', { facing: t.facing });
      }
    },
  },

  mounting: {
    enter() {
      this.setColliderEnabled(false);
      this.startPos = this.root.position.clone();
      this.startHeading = this.heading;
      this.rig.play('Sitting', { once: true, fade: 0.3 });
    },
    update(dt) {
      const p = this.params;
      const t = Math.min(1, this.fsm.time / p.mountDuration);
      const k = smooth(t);
      // Blend from the ground to the seat, swinging round to face forward.
      const seat = this.quad.pillionAnchor.localToWorld(this.seatOffset());
      this.root.position.lerpVectors(this.startPos, seat, k);
      // Lift over the seat rather than sliding through it.
      this.root.position.y += Math.sin(Math.PI * k) * 0.15;
      this.heading = this.startHeading + angleTo(this.startHeading, this.quad.yaw) * k;
      this.root.rotation.y = this.heading;
      this.rig.legSpread = p.legSpread * k;
      if (t >= 1) this.fsm.transition('seated');
    },
  },

  seated: {
    enter() {
      this.quad.pillionAnchor.add(this.root);
      this.root.position.copy(this.seatOffset());
      this.root.quaternion.identity();
      this.rig.play('SitIdle', { fade: 0.4 });
      this.rig.legSpread = this.params.legSpread;
    },
    update() {
      // Pick up live tuning of the seat position.
      this.root.position.copy(this.seatOffset());
      this.rig.legSpread = this.params.legSpread;
    },
  },

  dismounting: {
    enter() {
      // Back into the world, keeping her current world transform.
      this.scene.attach(this.root);
      this.startPos = this.root.position.clone();
      const e = new THREE.Euler().setFromQuaternion(this.root.quaternion, 'YXZ');
      this.root.rotation.set(0, e.y, 0);
      this.startHeading = e.y;
      this.target = this.standPoint(1);
      this.rig.play('Sitting', { once: true, timeScale: -1, fade: 0.2 });
    },
    update() {
      const p = this.params;
      const t = Math.min(1, this.fsm.time / p.dismountDuration);
      const k = smooth(t);
      this.target = this.standPoint(1);
      this.root.position.lerpVectors(this.startPos, this.target.position, k);
      this.root.position.y += Math.sin(Math.PI * k) * 0.12;
      this.heading = this.startHeading + angleTo(this.startHeading, this.target.facing) * k;
      this.root.rotation.y = this.heading;
      this.rig.legSpread = p.legSpread * (1 - k);
      if (t >= 1) {
        this.rig.legSpread = 0;
        this.setColliderEnabled(true);
        this.fsm.transition('idle', { facing: this.target.facing });
        // A request that needed her off this quad first (e.g. getting on the other one).
        const next = this.afterDismount;
        this.afterDismount = null;
        next?.();
      }
    },
  },
};
