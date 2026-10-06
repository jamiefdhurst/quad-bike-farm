import * as THREE from 'three';
import { solveTwoBone } from './armIK.js';

// Her waving smoke away from her face with her right hand (smokeSense.js decides when). As Companion methods, mixed
// in by companion.js. Only while she's stood about: anything else she does cuts it short.

const smooth = (t) => t * t * (3 - 2 * t);
const _head = new THREE.Vector3();
const _target = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _shoulder = new THREE.Vector3();

export const wavingMethods = {
  /** Starts waving a hand in front of her face for `seconds`. */
  waveOff(seconds) {
    if (this.fsm.is('idle')) this.waving = { left: seconds, total: seconds, t: 0 };
  },

  /** Right hand swinging to and fro in front of her face. Runs as a rig poser. */
  poseWaving(dt) {
    const w = this.waving;
    if (w && (!this.fsm.is('idle') || (w.left -= dt) <= 0)) this.waving = null;
    const want = this.waving ? 1 : 0;
    this.waveReach = (this.waveReach ?? 0) + (want - (this.waveReach ?? 0)) * Math.min(1, dt * 6);
    if (this.waveReach < 0.01) return;
    if (this.waving) this.waving.t += dt;
    const k = smooth(Math.min(1, this.waveReach));
    const b = this.rig.bones;
    const root = this.root;
    root.updateMatrixWorld(true);
    // In her own frame: x to her left, y up, z forward.
    const head = root.worldToLocal(b.Head.getWorldPosition(_head));
    const swing = Math.sin((this.waving?.t ?? 0) * 13);
    _target.set(head.x - 0.12 + 0.14 * swing, head.y - 0.08, head.z + 0.36);
    root.localToWorld(_target);
    root.worldToLocal(b.RightArm.getWorldPosition(_shoulder));
    _pole.set(_shoulder.x - 0.25, _shoulder.y - 0.1, _shoulder.z - 0.05);
    root.localToWorld(_pole);
    solveTwoBone(b.RightArm, b.RightForeArm, b.RightHand, _target, _pole, k);
  },
};
