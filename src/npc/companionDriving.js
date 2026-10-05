import * as THREE from 'three';
import { driveMood, pickConfidence, afterDrive } from './driveMood.js';
import { HerDrive } from './herDriving.js';
import { solveTwoBone, orientHand } from './armIK.js';

// Her driving a quad herself, as Companion states and methods: getting on the
// front, driving (the logic is HerDrive in herDriving.js), shuffling between
// the front seat and the back, and her hands on the grips. Mixed into
// Companion by companion.js.

const smooth = (t) => t * t * (3 - 2 * t);
const SHUFFLE_DURATION = 0.9; // seconds to slide between the front seat and the back

const _target = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _fingers = new THREE.Vector3();
const _palm = new THREE.Vector3();
const _q = new THREE.Quaternion();
const AXIS_X = new THREE.Vector3(1, 0, 0);
const ARMS = [
  { side: 1, arm: 'LeftArm', fore: 'LeftForeArm', hand: 'LeftHand', finger: 'LeftHandIndex1', thumb: 'LeftHandThumb1', grip: 'gripLeft' },
  { side: -1, arm: 'RightArm', fore: 'RightForeArm', hand: 'RightHand', finger: 'RightHandIndex1', thumb: 'RightHandThumb1', grip: 'gripRight' },
];

export const drivingStates = {
  // On the front seat with the quad hers: starting it, driving, stopping.
  driving: {
    enter() {
      const q = this.quad;
      this.setColliderEnabled(false);
      q.riderAnchor.add(this.root);
      this.root.position.copy(this.seatOffset(true));
      this.root.quaternion.identity();
      this.rig.play('SitIdle', { fade: 0.4 });
      this.rig.legSpread = this.params.legSpread;
      this.driveExit = null;
      // How she feels about it this time: careful, confident or somewhere between.
      this.driveConfidence ??= this.params.driveConfidence;
      this.driveMood = pickConfidence(this.driveConfidence, this.params.driveMoodSwing);
      // Giving you a ride: bigger loops, and she waits for you to get on.
      const ride = this.giveRide;
      this.giveRide = false;
      const following = this.followWanted;
      this.followWanted = false;
      const params = driveMood(this.params, this.driveMood);
      params.driveSpeedMaxBase = this.params.driveSpeedMax;
      if (following) {
        // Keeping up with you takes more throttle than pottering about, and she minds speed less.
        params.driveMaxThrottle = Math.min(1, this.params.followMaxThrottle * (params.driveSpeedMax / this.params.driveSpeedMax));
        params.driveScareSpeed = this.params.followScareSpeed;
      }
      if (ride || q.passenger) {
        params.driveLoopRadiusMin *= this.params.rideLoopScale;
        params.driveLoopRadiusMax *= this.params.rideLoopScale;
      }
      this.drive = new HerDrive(q, {
        params,
        passenger: () => !!q.passenger,
        friend: () => this.friendOnBack(),
        waitForPassenger: ride,
        follow: following ? () => {
          const lead = this.followTarget?.();
          return lead && lead !== q ? lead : null;
        } : null,
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
        if (q.hasPillion && !this.takenByOther(q, 'pillion')) this.fsm.transition('shuffling', { to: 'pillion' });
        else this.fsm.transition('dismounting');
        return;
      }
      if (q.isTipped) {
        q.setDriver(null);
        this.driveEvents.push('done:scared');
        this.fsm.transition('dismounting');
        return;
      }

      this.probeIgnore = d.follow?.()?.physics.collider.handle ?? null;
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
      // You've got on while she was sliding forward: back she goes.
      if (data.to === 'rider' && q.rider) {
        data.to = 'pillion';
        this.shuffleFrom = this.root.position.clone();
        this.fsm.time = 0;
      }
      const front = data.to === 'rider';
      const t = Math.min(1, this.fsm.time / SHUFFLE_DURATION);
      const k = smooth(t);
      const anchor = front ? q.riderAnchor : q.pillionAnchor;
      const end = anchor.position.clone().add(this.seatOffset(front));
      this.root.position.lerpVectors(this.shuffleFrom, end, k);
      this.root.position.y += Math.sin(Math.PI * k) * 0.06;
      this.root.quaternion.identity();
      if (t >= 1) {
        // Climbed forward to stop a runaway: once it's stopped, key off and get down.
        if (front && !q.rider && this.takeOverPlan === 'stop') {
          if (q.speed > 0.4) return;
          this.takeOverPlan = null;
          q.engine.setIgnition(false);
          this.fsm.transition('dismounting');
          return;
        }
        this.takeOverPlan = null;
        this.fsm.transition(front && !q.rider ? 'driving' : 'seated');
      }
    },
  },
};

export const drivingMethods = {
  /** Walks to the front of a quad, gets on and has a little drive; with `giveRide`, waits for you on the back. */
  requestDrive(quad, { giveRide = false, follow = false } = {}) {
    this.giveRide = giveRide;
    this.followWanted = follow;
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
    this.driveConfidence = afterDrive(this.driveConfidence ?? p.driveConfidence, d.result);
    let how = exit?.how;
    if (!how) how = d.result === 'gaveUp' || d.result === 'noRoom' || Math.random() >= p.driveBackChance ? 'off' : 'back';
    q.setDriver(null);
    if (how === 'back' && q.hasPillion && !q.passenger && !this.takenByOther(q, 'pillion')) {
      if (!exit) this.driveEvents.push('toBack');
      this.seatedByChoice = !exit; // moved back by herself: she can get bored of it too
      this.fsm.transition('shuffling', { to: 'pillion' });
      return;
    }
    if (!exit) this.driveEvents.push('getOff');
    // Getting off, she nearly always leaves it running.
    if (q.engine.isRunning && Math.random() < p.driveKeyOffChance) q.engine.setIgnition(false);
    this.afterDismount = exit?.next ?? null;
    this.fsm.transition('dismounting');
  },

  /** Her friend on the back of the quad she's driving: 'on', 'coming' (on her way to get on), or null. */
  friendOnBack() {
    const o = this.others().find((o) => o.claimedQuad === this.quad && o.claimedSeat === 'pillion');
    if (!o) return null;
    if (o.fsm.is('seated')) return 'on';
    return o.fsm.is('walking', 'mounting') ? 'coming' : null;
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
      // Following you, your quad isn't an obstacle: she keeps her gap from it anyway.
      return c.handle !== terrain && c.handle !== own && c.handle !== bike && c.handle !== this.probeIgnore;
    });
    return hit ? (hit.timeOfImpact ?? hit.toi) : Infinity;
  },

  /** Leans her in a touch and puts her hands on the grips, following the bars. Runs as a rig poser. */
  poseDriving(dt) {
    const q = this.quad;
    const s = this.fsm;
    const front = s.is('driving') || (s.is('shuffling') && s.data.to === 'rider' && s.time > 0.4);
    const mountingFront = s.is('mounting') && s.data.seat === 'rider' && s.time > this.params.mountDuration * 0.6;
    this.gripReach += ((front || mountingFront ? 1 : 0) - this.gripReach) * Math.min(1, dt * 4);
    if (this.gripReach < 0.01) return;
    const k = smooth(Math.min(1, this.gripReach));
    const rig = this.rig;
    const b = rig.bones;
    rig.rotateAboutRootAxis(b.Spine1, AXIS_X, 0.18 * k);
    const model = q.model;
    model.updateMatrixWorld(true);
    const modelQ = model.getWorldQuaternion(_q);
    for (const a of ARMS) {
      const grip = (q.grips ??= {})[a.grip] ??= model.getObjectByName(a.grip);
      if (!grip || !b[a.arm]) continue;
      grip.localToWorld(_target.set(0, 0.055, 0));
      // Elbows a little out and down, as you'd hold the bars.
      b[a.arm].getWorldPosition(_pole);
      model.worldToLocal(_pole).add(_fingers.set(a.side * 0.35, -0.25, -0.1));
      model.localToWorld(_pole);
      solveTwoBone(b[a.arm], b[a.fore], b[a.hand], _target, _pole, k);
      // Fingers over the front of the grip, palm down on it.
      if (b[a.finger] && b[a.thumb]) {
        _fingers.set(-a.side * 0.25, -0.45, 0.85).normalize().applyQuaternion(modelQ);
        _palm.set(0, -1, 0.15).normalize().applyQuaternion(modelQ);
        orientHand(b[a.hand], b[a.finger], b[a.thumb], _fingers, _palm, a.side, k);
      }
    }
  },
};
