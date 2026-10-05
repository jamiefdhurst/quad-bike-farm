import * as THREE from 'three';
import { HerDrive } from './herDriving.js';

// Her driving a quad herself, as Companion states and methods: getting on the
// front, driving (the logic is HerDrive in herDriving.js), shuffling between
// the front seat and the back, and her hands on the grips. Mixed into
// Companion by companion.js.

const smooth = (t) => t * t * (3 - 2 * t);
const SHUFFLE_DURATION = 0.9; // seconds to slide between the front seat and the back

const S = new THREE.Vector3();
const E = new THREE.Vector3();
const H = new THREE.Vector3();
const goal = new THREE.Vector3();
const u = new THREE.Vector3();
const v = new THREE.Vector3();
const n = new THREE.Vector3();
const rot = new THREE.Quaternion();
const parentQ = new THREE.Quaternion();
const AXIS_X = new THREE.Vector3(1, 0, 0);

/** Rotates a bone by a world-space rotation, keeping its parent where it is. */
function rotateBoneWorld(bone, q) {
  bone.parent.getWorldQuaternion(parentQ);
  // local' = parent^-1 * q * parent * local
  bone.quaternion.premultiply(parentQ).premultiply(q).premultiply(parentQ.invert());
  bone.updateMatrixWorld(true);
}

/**
 * Two-bone reach: bends the elbow so the hand can get to `target`, then swings
 * the upper arm to point it there. `weight` 0..1 blends from where the clip
 * has the hand.
 */
function reachArm(rig, side, target, weight) {
  const upper = rig.bones[`${side}Arm`];
  const fore = rig.bones[`${side}ForeArm`];
  const hand = rig.bones[`${side}Hand`];
  if (!upper || !fore || !hand || weight <= 0.001) return;
  upper.getWorldPosition(S);
  fore.getWorldPosition(E);
  hand.getWorldPosition(H);
  goal.lerpVectors(H, target, weight);
  const a = S.distanceTo(E);
  const b = E.distanceTo(H);
  const d = THREE.MathUtils.clamp(S.distanceTo(goal), Math.abs(a - b) + 1e-3, a + b - 1e-3);

  // Elbow: the angle at the elbow that puts the hand d from the shoulder.
  u.subVectors(S, E);
  v.subVectors(H, E);
  const current = u.angleTo(v);
  const wanted = Math.acos(THREE.MathUtils.clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
  n.crossVectors(u, v);
  if (n.lengthSq() > 1e-10) {
    rot.setFromAxisAngle(n.normalize(), wanted - current);
    rotateBoneWorld(fore, rot);
  }

  // Shoulder: swing the whole arm so the hand points at the goal.
  hand.getWorldPosition(H);
  u.subVectors(H, S).normalize();
  v.subVectors(goal, S).normalize();
  rot.setFromUnitVectors(u, v);
  rotateBoneWorld(upper, rot);
}

export const drivingStates = {
  // On the front seat with the quad hers: starting it, driving, stopping.
  driving: {
    enter() {
      const q = this.quad;
      q.riderAnchor.add(this.root);
      this.root.position.copy(this.seatOffset(true));
      this.root.quaternion.identity();
      this.rig.play('SitIdle', { fade: 0.4 });
      this.rig.legSpread = this.params.legSpread;
      this.driveExit = null;
      this.drive = new HerDrive(q, {
        params: this.params,
        probe: (heading, distance) => this.driveProbe(heading, distance),
        isClear: (a, b) => this.driveClear(a, b),
      });
      q.setDriver(this.drive);
    },
    update(dt) {
      const q = this.quad;
      const d = this.drive;
      this.root.position.copy(this.seatOffset(true));
      this.rig.legSpread = this.params.legSpread;

      // You've got on: she moves onto the back (or off, if there's no back).
      if (q.rider) {
        d.stop('taken');
        q.setDriver(null);
        this.driveEvents.push('taken');
        if (q.hasPillion) this.fsm.transition('shuffling', { to: 'pillion' });
        else this.fsm.transition('dismounting');
        return;
      }
      if (q.isTipped) {
        q.setDriver(null);
        this.driveEvents.push('done:scared');
        this.fsm.transition('dismounting');
        return;
      }

      for (const e of d.update(dt)) {
        if (e.startsWith('start:')) this.startEvents.push(e.slice(6));
        else this.driveEvents.push(e);
      }
      if (d.done) this.endDrive();
    },
    exit() {
      if (this.quad.driver === this.drive) this.quad.setDriver(null);
    },
  },

  // Sliding back onto the pillion, or forward onto the front seat.
  shuffling: {
    enter(data) {
      const q = this.quad;
      if (data.to === 'pillion' && q.driver === this.drive) q.setDriver(null);
      q.model.attach(this.root);
      this.shuffleFrom = this.root.position.clone();
    },
    update(dt, data) {
      const q = this.quad;
      const front = data.to === 'rider';
      const t = Math.min(1, this.fsm.time / SHUFFLE_DURATION);
      const k = smooth(t);
      const anchor = front ? q.riderAnchor : q.pillionAnchor;
      const end = anchor.position.clone().add(this.seatOffset(front));
      this.root.position.lerpVectors(this.shuffleFrom, end, k);
      this.root.position.y += Math.sin(Math.PI * k) * 0.06;
      this.root.quaternion.identity();
      if (t >= 1) this.fsm.transition(front && !q.rider ? 'driving' : 'seated');
    },
  },
};

export const drivingMethods = {
  /** Walks to the front of a quad, gets on and has a little drive. */
  requestDrive(quad) {
    if (this.fsm.is('driving')) {
      if (quad !== this.quad) this.stopDriving('off', () => this.requestDrive(quad));
      return;
    }
    if (this.fsm.is('shuffling', 'dismounting')) return;
    if (this.fsm.is('seated') && quad === this.quad) {
      this.fsm.transition('shuffling', { to: 'rider' });
      return;
    }
    if (this.fsm.is('seated', 'mounting')) {
      this.afterDismount = () => this.requestDrive(quad);
      this.fsm.transition('dismounting');
      return;
    }
    this.quad = quad;
    this.fsm.transition('walking', { goal: 'drive', target: () => this.driveMountPoint() });
  },

  /**
   * If she's driving, she pulls up and then gets off (and does `next`) or
   * moves onto the back. Returns whether she was driving.
   */
  stopDriving(how, next = null) {
    if (!this.fsm.is('driving')) return false;
    this.driveExit = { how, next };
    this.drive.stop('asked');
    return true;
  },

  /** Stopped, and had enough: onto the back to wait, or off to stand beside it. */
  endDrive() {
    const q = this.quad;
    const d = this.drive;
    const p = this.params;
    const exit = this.driveExit;
    this.driveExit = null;
    this.driveEvents.push(`done:${d.result}`);
    let how = exit?.how;
    if (!how) how = d.result === 'gaveUp' || d.result === 'noRoom' || Math.random() >= p.driveBackChance ? 'off' : 'back';
    q.setDriver(null);
    if (how === 'back' && q.hasPillion) {
      if (!exit) this.driveEvents.push('toBack');
      this.fsm.transition('shuffling', { to: 'pillion' });
      return;
    }
    if (!exit) this.driveEvents.push('getOff');
    if (q.engine.isRunning && !exit && Math.random() < p.driveKeyOffChance) q.engine.setIgnition(false);
    this.afterDismount = exit?.next ?? null;
    this.fsm.transition('dismounting');
  },

  /** Menu while she's driving. */
  drivingActions() {
    const q = this.quad;
    const actions = [{ kind: 'stopDrive', label: `Stop and get off the ${q.label}`, run: () => this.requestStandBeside(q) }];
    if (q.hasPillion) actions.push({ kind: 'back', label: 'Stop and move onto the back', run: () => this.requestMount(q) });
    return actions;
  },

  /** A quad she could have a drive on: nobody on it, upright and parked. */
  canDrive(q) {
    return !q.rider && !q.isTipped && !q.isGhostRiding && q.speed < 0.5;
  },

  /** Where she climbs onto the front seat from, beside the footboard on her nearer side. */
  driveMountPoint() {
    const side = this.root.parent === this.scene ? this.nearSide() : 1;
    const p = this.quad.localToWorld(side * 0.85, 0, -0.1);
    p.y = this.world.heightAt(p.x, p.z);
    return { position: p, facing: this.quad.yaw, side };
  },

  /** Distance to the nearest thing in front of her quad along a heading, or Infinity. */
  driveProbe(heading, distance) {
    const q = this.quad;
    const pos = q.position;
    const y = this.world.heightAt(pos.x, pos.z) + 0.55;
    const dx = Math.sin(heading);
    const dz = Math.cos(heading);
    let best = Infinity;
    // Down the middle and either side, about the width of the quad.
    for (const off of [-0.6, 0, 0.6]) {
      const hit = this.castFrom(pos.x + dz * off, y, pos.z - dx * off, dx, dz, distance, q);
      if (hit < best) best = hit;
    }
    return best;
  },

  /** Whether she could drive straight from a to b: inside the hedges, nothing in the way. */
  driveClear(a, b) {
    const limit = this.world.layout.fieldHalf - 6;
    if (Math.abs(b.x) > limit || Math.abs(b.z) > limit) return false;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return true;
    const ux = dx / len;
    const uz = dz / len;
    const y = this.world.heightAt(a.x, a.z) + 0.55;
    for (const off of [-0.9, 0, 0.9]) {
      if (this.castFrom(a.x + uz * off, y, a.z - ux * off, ux, uz, len + 1.5, this.quad) < Infinity) return false;
    }
    // Not over a steep bank.
    return Math.abs(this.world.heightAt(b.x, b.z) - this.world.heightAt(a.x, a.z)) < len * 0.25 + 0.3;
  },

  castFrom(x, y, z, dx, dz, distance, quad) {
    const ray = new this.RAPIER.Ray({ x, y, z }, { x: dx, y: 0, z: dz });
    const terrain = this.world.terrain.collider.handle;
    const own = this.collider.handle;
    const bike = quad.physics.collider.handle;
    const hit = this.physics.castRay(ray, distance, true, undefined, undefined, undefined, undefined, (c) => {
      return c.handle !== terrain && c.handle !== own && c.handle !== bike;
    });
    return hit ? (hit.timeOfImpact ?? hit.toi) : Infinity;
  },

  /** Leans her in a touch and puts her hands on the grips, following the bars. */
  poseDriving(dt) {
    const q = this.quad;
    const front = this.fsm.is('driving') || (this.fsm.is('shuffling') && this.fsm.data.to === 'rider' && this.fsm.time > 0.4);
    const mountingFront = this.fsm.is('mounting') && this.fsm.data.seat === 'rider' && this.fsm.time > this.params.mountDuration * 0.6;
    const want = front || mountingFront ? 1 : 0;
    this.gripReach += (want - this.gripReach) * Math.min(1, dt * 4);
    if (this.gripReach < 0.01 || !q.model) return;
    const k = smooth(Math.min(1, this.gripReach));
    q.grips ??= { left: q.model.getObjectByName('gripLeft'), right: q.model.getObjectByName('gripRight') };
    if (!q.grips.left || !q.grips.right) return;
    this.rig.rotateAboutRootAxis(this.rig.bones.Spine1, AXIS_X, 0.18 * k);
    q.model.updateMatrixWorld(true);
    reachArm(this.rig, 'Left', q.grips.left.localToWorld(goal.set(0, 0.055, 0)).clone(), k);
    reachArm(this.rig, 'Right', q.grips.right.localToWorld(goal.set(0, 0.055, 0)).clone(), k);
  },
};
