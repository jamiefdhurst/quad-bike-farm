import * as THREE from 'three';
import { solveTwoBone, orientHand } from './armIK.js';

// Her holding her hands over a running engine to warm them (warming.js decides when). As Companion methods, mixed in
// by companion.js. She stays in the idle state, so everything that works on a girl stood about still does; the pose
// goes the moment she does anything else.

const smooth = (t) => t * t * (3 - 2 * t);
const _target = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _palm = new THREE.Vector3();
const _q = new THREE.Quaternion();
const ARMS = [
  { side: 1, arm: 'LeftArm', fore: 'LeftForeArm', hand: 'LeftHand', finger: 'LeftHandIndex1', thumb: 'LeftHandThumb1', along: 0.12 },
  { side: -1, arm: 'RightArm', fore: 'RightForeArm', hand: 'RightHand', finger: 'RightHandIndex1', thumb: 'RightHandThumb1', along: -0.12 },
];

export const warmingMethods = {
  /** Where she stands to warm her hands at this quad: beside the engine, on the side nearer her (the other if her friend's there). */
  warmPoint(quad) {
    let side = this.nearSide(quad);
    const spot = (s) => quad.localToWorld(s * 0.95, 0, 0.3);
    let p = spot(side);
    if (this.others().some((o) => o.root.position.distanceTo(p) < 0.9 || (o.warmingAt === quad && o.warmSide === side))) {
      side = -side;
      p = spot(side);
    }
    p.y = this.world.heightAt(p.x, p.z);
    const c = quad.position;
    return { position: p, facing: Math.atan2(c.x - p.x, c.z - p.z), side };
  },

  /** Walks over to a running quad and holds her hands over its engine. Only when she's stood about; returns whether she set off. */
  goWarm(quad) {
    if (!this.fsm.is('idle')) return false;
    this.quad = quad;
    const t = this.warmPoint(quad);
    this.warmSide = t.side;
    this.fsm.transition('walking', { goal: 'warm', quad, side: t.side, target: () => ({ position: t.position, facing: t.facing }) });
    return true;
  },

  /** She's arrived: hands out. */
  startWarming(quad, side) {
    this.warmingAt = quad;
    this.warmSide = side;
  },

  /** Hands down, and she's free to do something else. */
  stopWarming() {
    this.warmingAt = null;
  },

  /** The quad she's on her way to, or at, to warm her hands, if any. */
  get warmingQuad() {
    const s = this.fsm;
    return this.warmingAt ?? (s.is('walking') && s.data?.goal === 'warm' ? s.data.quad : null);
  },

  /** Both hands out over the engine, palms down, elbows in. Runs as a rig poser. */
  poseWarming(dt) {
    const q = this.warmingAt;
    const want = q && this.fsm.is('idle') && q.engine.isRunning ? 1 : 0;
    this.warmReach = (this.warmReach ?? 0) + (want - (this.warmReach ?? 0)) * Math.min(1, dt * 3);
    if (this.warmReach < 0.01) return;
    // Watching her hands over the engine (attention.js), though a bang or a word still turns her head.
    if (q && want) this.attend({ x: q.position.x, y: q.position.y + 0.7, z: q.position.z }, { weight: 1.5 });
    const k = smooth(Math.min(1, this.warmReach));
    const b = this.rig.bones;
    const model = q?.model ?? this.lastWarmModel;
    if (!model) return;
    this.lastWarmModel = model;
    model.updateMatrixWorld(true);
    for (const a of ARMS) {
      if (!b[a.arm]) continue;
      // Over the engine, a little to the near side of it, one hand either side of centre.
      model.localToWorld(_target.set(this.warmSide * 0.3, 0.78, 0.3 + a.along));
      b[a.arm].getWorldPosition(_pole);
      _pole.y -= 0.3;
      solveTwoBone(b[a.arm], b[a.fore], b[a.hand], _target, _pole, k);
      if (b[a.finger] && b[a.thumb]) {
        // Fingers pointing in towards the engine, palm facing down at it.
        _dir.set(-this.warmSide, 0, 0).applyQuaternion(model.getWorldQuaternion(_q));
        _palm.set(0, -1, 0);
        orientHand(b[a.hand], b[a.finger], b[a.thumb], _dir, _palm, a.side, k);
      }
    }
  },
};
