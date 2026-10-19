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
  /** Waves an arm over her head until it is stopped: she is stuck and wants you to see her (stranded.js). Stood about, or up on her quad. */
  startCalling() {
    this.waving = { left: Infinity, total: Infinity, t: 0, call: true };
  },

  /** Starts waving a hand in front of her face for `seconds`. */
  waveOff(seconds) {
    if (this.fsm.is('idle')) this.waving = { left: seconds, total: seconds, t: 0 };
  },

  /** Holds her right arm out at `at` ({ x, y, z }) for `seconds`, and looks at it: showing you something (sights.js). Driving or stood about. */
  startPointing(at, seconds) {
    this.pointing = { at, left: seconds, t: 0 };
    this.attend(at, { weight: 4, seconds });
  },

  /** Right arm out at what she's showing you, hand and arm following the line from her shoulder. Runs as a rig poser. */
  posePointing(dt) {
    const w = this.pointing;
    if (w && (!(this.fsm.is('idle') || this.fsm.is('driving')) || (w.left -= dt) <= 0)) this.pointing = null;
    const want = this.pointing ? 1 : 0;
    this.pointReach = (this.pointReach ?? 0) + (want - (this.pointReach ?? 0)) * Math.min(1, dt * 5);
    if (this.pointReach < 0.01) return;
    if (this.pointing) this.pointAt = this.pointing.at;
    const b = this.rig.bones;
    const root = this.root;
    root.updateMatrixWorld(true);
    b.RightArm.getWorldPosition(_shoulder);
    _target.set(this.pointAt.x, this.pointAt.y, this.pointAt.z).sub(_shoulder).setY(0).normalize().multiplyScalar(0.62).add(_shoulder);
    _target.y += 0.12; // a little above the shoulder, like a point
    // Elbow out and down, away from her body.
    _pole.copy(_shoulder);
    _pole.y -= 0.3;
    solveTwoBone(b.RightArm, b.RightForeArm, b.RightHand, _target, _pole, smooth(Math.min(1, this.pointReach)));
  },

  /** Right hand swinging to and fro in front of her face. Runs as a rig poser. */
  poseWaving(dt) {
    const w = this.waving;
    if (w && (!(this.fsm.is('idle') || (w.call && this.fsm.is('driving'))) || (w.left -= dt) <= 0)) this.waving = null;
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
    const swing = Math.sin((this.waving?.t ?? 0) * (this.waving?.call ? 6 : 13));
    if (this.waving?.call) _target.set(head.x - 0.2 + 0.18 * swing, head.y + 0.42, head.z + 0.05); // up and over her head, to be seen
    else _target.set(head.x - 0.12 + 0.14 * swing, head.y - 0.08, head.z + 0.36);
    root.localToWorld(_target);
    root.worldToLocal(b.RightArm.getWorldPosition(_shoulder));
    _pole.set(_shoulder.x - 0.25, _shoulder.y - 0.1, _shoulder.z - 0.05);
    root.localToWorld(_pole);
    solveTwoBone(b.RightArm, b.RightForeArm, b.RightHand, _target, _pole, k);
  },
};
