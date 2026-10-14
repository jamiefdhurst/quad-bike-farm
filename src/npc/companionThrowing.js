import * as THREE from 'three';
import { solveTwoBone } from './armIK.js';

// Her throwing a conker at you (conkers.js decides when): the right hand goes back behind her shoulder for `windup` seconds, swings forward
// and stays out a moment, then comes down. As Companion methods, mixed in by companion.js. Only while she's stood about; anything else she
// does cuts it short. She turns to face where she's throwing (`facing`) while it lasts.

const smooth = (t) => t * t * (3 - 2 * t);
const FOLLOW_THROUGH = 0.7; // seconds the hand stays out after the throw
const _head = new THREE.Vector3();
const _target = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _shoulder = new THREE.Vector3();

export const throwingMethods = {
  /** Starts winding up to throw towards the heading `facing`: the hand is back for `windup` seconds, then it throws. */
  throwConker(facing, windup) {
    if (!this.fsm.is('idle')) return false;
    this.waving = null;
    this.throwing = { t: 0, windup, facing, total: windup + FOLLOW_THROUGH };
    return true;
  },

  /** Right hand back and up, then forward. Runs as a rig poser. */
  poseThrowing(dt) {
    const w = this.throwing;
    if (w && (!this.fsm.is('idle') || (w.t += dt) >= w.total)) this.throwing = null;
    const want = this.throwing ? 1 : 0;
    this.throwReach = (this.throwReach ?? 0) + (want - (this.throwReach ?? 0)) * Math.min(1, dt * 9);
    if (this.throwReach < 0.01) return;
    const t = this.throwing?.t ?? 0;
    const windup = this.throwing?.windup ?? 1;
    // 0 with the hand back, 1 out in front: the swing takes a quarter of a second after the windup.
    const swing = smooth(Math.max(0, Math.min(1, (t - windup) / 0.25)));
    const b = this.rig.bones;
    const root = this.root;
    root.updateMatrixWorld(true);
    // In her own frame: x to her left, y up, z forward.
    const head = root.worldToLocal(b.Head.getWorldPosition(_head));
    _target.set(head.x - 0.24 + 0.14 * swing, head.y + 0.06 - 0.22 * swing, head.z - 0.2 + 0.78 * swing);
    root.localToWorld(_target);
    root.worldToLocal(b.RightArm.getWorldPosition(_shoulder));
    _pole.set(_shoulder.x - 0.3, _shoulder.y - 0.05, _shoulder.z - 0.25);
    root.localToWorld(_pole);
    solveTwoBone(b.RightArm, b.RightForeArm, b.RightHand, _target, _pole, smooth(Math.min(1, this.throwReach)));
  },
};
