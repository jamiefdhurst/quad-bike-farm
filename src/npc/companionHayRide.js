import * as THREE from 'three';
import { attachKeepingSize } from './attachKeepingSize.js';

// A girl on the bale trailer (hayRide.js decides when): walking over, climbing on, sitting up on the bales and holding on, lying back,
// and going off the side into the mud. As Companion states and methods, mixed in by companion.js.

const smooth = (t) => t * t * (3 - 2 * t);
const UP = new THREE.Vector3(0, 1, 0);

export const DEFAULT_HAYSEAT_PARAMS = {
  seatRaise: 0.06, // metres: fine-tunes how high she sits on the bales
  climbSeconds: 1.8, // climbing up onto the bed, an arch or the bales, or down again
  stepSeconds: 2.0, // stepping into the UTV's or Land Rover's bench, or out again
  backStepScale: 1.4, // into the 200TDi's back bench takes this much longer, past the tipped front seat
  climbLift: 0.55, // how high she lifts over the edge on the way, unless the seat says otherwise
  leanBack: 1.15, // radians she lies back from sitting
  leanSpeed: 1.6, // how fast she goes down or comes up, per second
  chaseSpeed: 1.7, // times her walking speed, after a trailer she's fallen off
  fallSeconds: 0.75,
  fallOut: 3.2, // metres from the middle of the trailer to her feet where she lands: feet first, so she lies with her head toward the trailer
  lieSeconds: 1.5, // how long she lies there in the mud
  riseSeconds: 0.8,
};

export const HAYSEAT_PARAM_RANGES = {
  seatRaise: [-0.3, 0.3, 0.005],
  climbSeconds: [0.2, 4, 0.05],
  stepSeconds: [0.2, 4, 0.05],
  backStepScale: [1, 3, 0.05],
  climbLift: [0, 1.2, 0.05],
  leanBack: [0, 1.5, 0.05],
  leanSpeed: [0.3, 6, 0.1],
  chaseSpeed: [1, 3, 0.1],
  fallSeconds: [0.2, 2, 0.05],
  fallOut: [2.2, 5, 0.1],
  lieSeconds: [0, 6, 0.1],
  riseSeconds: [0.2, 3, 0.05],
};

export const hayRideMethods = {
  /** Where her root goes so her hips are on the seat anchor (the root is a child of her pivot there). */
  haySeatOffset() {
    const p = this.hay;
    return new THREE.Vector3(-this.sitHips.x, -this.sitHips.y + p.seatRaise, -this.sitHips.z);
  },

  /** Where her root goes sat on the seat she's riding, and the way it faces (world), for getting on and off. */
  haySeatEnd() {
    const anchor = this.traSlot.anchor;
    const root = anchor.localToWorld(this.haySeatOffset());
    const heading = new THREE.Euler().setFromQuaternion(anchor.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y;
    return { root, heading };
  },

  /** Starts climbing onto (`dir` 1) or off (-1) her seat: stepping into a bench, or climbing up onto anything else (companionMoves.js). */
  beginBoardMove(dir) {
    const slot = this.traSlot;
    const kind = slot.move ?? 'climbUp';
    const stand = () => this.trailer.standPoint(slot.side, slot);
    // Which side of it she's on, so the move is mirrored to suit.
    const local = this.trailer.model.worldToLocal(stand().position.clone());
    const side = local.x >= 0 ? 1 : -1;
    const bench = kind === 'stepIn' || kind === 'stepInBack';
    this.movingSeatPose = bench ? 'bench' : null;
    this.beginMove({
      kind, side, dir, seat: slot.anchor, seatEnd: () => this.haySeatEnd(), standEnd: stand,
      duration: kind === 'stepInBack' ? this.hay.stepSeconds * this.hay.backStepScale : bench ? this.hay.stepSeconds : this.hay.climbSeconds,
      lift: kind === 'climbUp' ? slot.lift ?? this.hay.climbLift : undefined,
    });
  },

  /** Walks over to the trailer to climb on. Only when she's stood about; returns whether she set off. */
  boardTrailer(trailer, slot, { chase = false } = {}) {
    if (!this.fsm.is('idle') || !slot || slot.girl) return false;
    slot.girl = this;
    this.trailer = trailer;
    this.traSlot = slot;
    this.paceBoost = chase ? this.hay.chaseSpeed : 1;
    this.fsm.transition('walking', { goal: 'board', target: () => trailer.standPoint(slot.side, slot) });
    return true;
  },

  /** She was on her way, or on, and now isn't: give the seat back. */
  freeTrailerSlot() {
    if (this.traSlot?.girl === this) this.traSlot.girl = null;
    this.traSlot = null;
    this.paceBoost = 1;
  },

  /** She's walking over or aboard (so the game counts her in the ride). */
  get onHayRide() {
    return this.fsm.is('boarding', 'onTrailer') || (this.fsm.is('walking') && this.fsm.data?.goal === 'board');
  },

  /** Stops her walking over, if you've driven off. */
  abortBoarding() {
    if (this.fsm.is('walking') && this.fsm.data?.goal === 'board') {
      this.freeTrailerSlot();
      this.fsm.transition('idle', { facing: this.heading });
    }
  },

  /** Climbs down, if she's up there. */
  leaveTrailer() {
    if (!this.fsm.is('onTrailer')) return false;
    this.fsm.data.leaving = true;
    return true;
  },

  /** Lies back on the bales (true) or sits up again. */
  hayLie(on) {
    if (this.fsm.is('onTrailer')) this.fsm.data.lie = on;
  },

  /** A bump: arms up for a moment. */
  hayFlail() {
    if (this.fsm.is('onTrailer')) this.hayFlailT = 0.7;
  },

  /** Off the side into the mud, on `side` (+1 left). `out` is which way she goes in the trailer's own frame, if not straight out sideways (off the back of the UTV's bed). */
  slideOffTrailer(side, out = null) {
    if (!this.fsm.is('onTrailer')) return false;
    this.fsm.transition('sliding', { side, out });
    return true;
  },

  /** Arms for the pose: up and out when she's flailing, behind her head when she's lying back. */
  poseHayRide(dt) {
    if (!this.fsm.is('onTrailer')) return;
    const d = this.fsm.data;
    const lie = d.leanK ?? 0;
    const flail = Math.max(0, this.hayFlailT ?? 0);
    const out = Math.max(flail > 0 ? 1.2 * Math.min(1, flail / 0.3) : 0, 1.5 * lie);
    const elbow = Math.max(flail > 0 ? 0.5 * Math.min(1, flail / 0.3) : 0, 1.4 * lie);
    if (out < 0.01) return;
    const rig = this.rig;
    rig.rotateAboutRootAxis(rig.bones.LeftArm, new THREE.Vector3(0, 0, 1), out);
    rig.rotateAboutRootAxis(rig.bones.RightArm, new THREE.Vector3(0, 0, 1), -out);
    rig.rotateAboutRootAxis(rig.bones.LeftForeArm, new THREE.Vector3(1, 0, 0), -elbow);
    rig.rotateAboutRootAxis(rig.bones.RightForeArm, new THREE.Vector3(1, 0, 0), -elbow);
  },
};

export const hayRideStates = {
  // Climbing from the ground up onto the bales.
  boarding: {
    look() {
      const t = this.trailer?.model?.position;
      return t ? { x: t.x, y: t.y + 0.6, z: t.z, weight: 2 } : null;
    },
    enter() {
      this.setColliderEnabled(false);
      this.paceBoost = 1;
      this.hayFell = false;
      this.beginBoardMove(1);
    },
    update(dt) {
      if (this.stepMove(dt)) this.fsm.transition('onTrailer');
    },
    exit() {
      this.endMove();
      this.movingSeatPose = null;
    },
  },

  // Sitting up on the bales (or lying back), bouncing with the trailer.
  onTrailer: {
    look: 'free',
    enter(data) {
      const anchor = this.traSlot.anchor;
      this.hayPivot ??= new THREE.Object3D();
      anchor.add(this.hayPivot);
      this.hayPivot.position.set(0, 0, 0);
      this.hayPivot.rotation.set(0, 0, 0);
      this.hayPivot.add(this.root);
      this.root.position.copy(this.haySeatOffset());
      this.root.quaternion.identity();
      this.rig.play('SitIdle', { fade: 0.4 });
      this.rig.legSpread = 0;
      this.sittingPose = this.traSlot.move === 'stepIn' || this.traSlot.move === 'stepInBack' ? 'bench' : null;
      data.leanK = 0;
      data.lie = false;
      data.phase = 'up';
      this.hayFlailT = 0;
    },
    update(dt, data) {
      const p = this.hay;
      if (data.fromWorld) return this.climbDown(data, dt); // on her way down
      this.hayFlailT = Math.max(0, (this.hayFlailT ?? 0) - dt);
      this.root.position.copy(this.haySeatOffset());
      const want = data.lie && !data.leaving ? 1 : 0;
      data.leanK += Math.sign(want - data.leanK) * Math.min(Math.abs(want - data.leanK), p.leanSpeed * dt);
      // Thrown about with the trailer: the body's springs already move the anchor, so this is a little more, from how hard it's going.
      const jolt = Math.min(1, (this.trailer?.motion.jolt ?? 0) * 0.8);
      const sway = (this.trailer?.motion.omega ?? 0) * -0.4;
      this.hayPivot.rotation.x = -p.leanBack * smooth(data.leanK) + jolt * 0.08 * Math.sin(this.fsm.time * 21);
      this.hayPivot.rotation.z = sway + jolt * 0.1 * Math.sin(this.fsm.time * 17 + 1);
      this.hayPivot.position.y = jolt * 0.05 * Math.abs(Math.sin(this.fsm.time * 13));
      this.rig.spineSway.pitch = 0;
      this.rig.spineSway.roll = 0;
      if (data.leaving && data.leanK < 0.02) {
        this.climbDown(data, dt);
      }
    },
    exit() {
      this.hayPivot.rotation.set(0, 0, 0);
      this.hayPivot.position.set(0, 0, 0);
      this.rig.legSpread = 0;
      this.sittingPose = null;
      if (this.moving) this.endMove();
      this.movingSeatPose = null;
    },
  },

  // Off the side: a slide, a tumble, a moment in the mud, and up again.
  sliding: {
    look: 'free',
    enter(data) {
      attachKeepingSize(this.scene, this.root); // keeps where she is
      this.hayPivot?.rotation.set(0, 0, 0);
      this.startPos = this.root.position.clone();
      const e = new THREE.Euler().setFromQuaternion(this.root.quaternion, 'YXZ');
      this.startHeading = this.heading = e.y;
      this.root.rotation.set(0, e.y, 0);
      // Where she lands: out from the middle of the trailer on her side.
      const side = data.side;
      const out = (data.out ? data.out.clone() : new THREE.Vector3(side, 0, 0)).applyQuaternion(this.trailer.model.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize();
      const mid = this.trailer.model.position;
      this.landing = new THREE.Vector3(mid.x + out.x * this.hay.fallOut, 0, mid.z + out.z * this.hay.fallOut);
      this.landing.y = this.world.heightAt(this.landing.x, this.landing.z);
      this.fallOut = out;
      data.phase = 'fall';
      this.rig.play('Idle', { fade: 0.15 });
      this.rig.legSpread = 0;
      this.freeTrailerSlot();
      this.hayFell = true;
    },
    update(dt, data) {
      const p = this.hay;
      const side = data.side;
      const roll = (k) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), side * (Math.PI / 2) * k);
      const yawQ = new THREE.Quaternion().setFromAxisAngle(UP, this.heading);
      if (data.phase === 'fall') {
        const t = Math.min(1, this.fsm.time / p.fallSeconds);
        const k = smooth(t);
        this.root.position.lerpVectors(this.startPos, this.landing, k);
        // Over the edge in an arc: up a touch, then down.
        this.root.position.y += Math.sin(Math.PI * k) * 0.25;
        this.root.position.y = Math.max(this.root.position.y, this.landing.y + 0.18 * k);
        this.root.quaternion.copy(yawQ).multiply(roll(k));
        if (t >= 1) {
          data.phase = 'lie';
          data.lieFor = p.lieSeconds * (0.8 + Math.random() * 0.4);
          this.hayLanded = true;
        }
        return;
      }
      if (data.phase === 'lie') {
        this.root.position.copy(this.landing);
        this.root.position.y = this.landing.y + 0.18;
        this.root.quaternion.copy(yawQ).multiply(roll(1));
        data.lieFor -= dt;
        if (data.lieFor <= 0) {
          data.phase = 'rise';
          data.riseAt = this.fsm.time;
        }
        return;
      }
      const t = Math.min(1, (this.fsm.time - data.riseAt) / p.riseSeconds);
      const k = smooth(t);
      this.root.position.copy(this.landing);
      this.root.position.y = this.landing.y + 0.18 * (1 - k);
      this.root.quaternion.copy(yawQ).multiply(roll(1 - k));
      if (t >= 1) {
        this.root.rotation.set(0, this.heading, 0);
        this.setColliderEnabled(true);
        this.hayLanded = false;
        this.fsm.transition('idle', { facing: this.heading });
      }
    },
  },
};

/** Leaving: off the seat and down beside it, run back through the move she got on with, then she's stood about. */
export function finishClimbDown(c, data, dt) {
  if (!data.fromWorld) {
    data.fromWorld = true;
    c.hayPivot?.rotation.set(0, 0, 0);
    attachKeepingSize(c.scene, c.root);
    const e = new THREE.Euler().setFromQuaternion(c.root.quaternion, 'YXZ');
    c.heading = e.y;
    c.root.rotation.set(0, e.y, 0);
    c.beginBoardMove(-1);
    return;
  }
  if (!c.stepMove(dt)) return;
  c.endMove();
  c.movingSeatPose = null;
  c.setColliderEnabled(true);
  const facing = c.trailer.standPoint(c.traSlot.side, c.traSlot).facing;
  c.freeTrailerSlot();
  c.fsm.transition('idle', { facing });
}

hayRideMethods.climbDown = function (data, dt) {
  finishClimbDown(this, data, dt);
};
