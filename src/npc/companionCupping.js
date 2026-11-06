import * as THREE from 'three';
import { solveTwoBone, orientHand } from './armIK.js';
import { cupLift, patStroke, steamParams } from './steam.js';

// Her hands on something at a sit-down moment (steam.js says when). As Companion methods, mixed in by companion.js:
//  - a mug of tea in both hands at her chest, lifted to drink now and then, while she sits at the flask;
//  - a hand laid flat on the tank and patted, when Jess tells a quad that won't start to come on.

const smooth = (t) => t * t * (3 - 2 * t);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _target = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _palm = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _tilt = new THREE.Quaternion();
const _box = new THREE.Box3();
const AXIS_X = new THREE.Vector3(1, 0, 0);
const ARMS = [
  { side: 1, arm: 'LeftArm', fore: 'LeftForeArm', hand: 'LeftHand', finger: 'LeftHandIndex1', thumb: 'LeftHandThumb1' },
  { side: -1, arm: 'RightArm', fore: 'RightForeArm', hand: 'RightHand', finger: 'RightHandIndex1', thumb: 'RightHandThumb1' },
];
const PAT_SECONDS = 1.7;
const HOLD = [0, -0.1, 0.2]; // her local frame, from her chest bone: the mug held in both hands
const MOUTH = [0, -0.1, 0.14]; // from her head bone: the mug at her lips
const HALF_MUG = 0.045; // the hands are at the middle of its height

export const cuppingMethods = {
  /** She takes this mug in both hands (it is poured, she is sat down). */
  startCup(mug) {
    if (this.cup) return false;
    this.scene.attach(mug);
    this.cup = { mug, t: 0, k: 0 };
    return true;
  },

  /** Lets go of the mug, and returns it for the caller to put somewhere or take away. */
  stopCup() {
    const mug = this.cup?.mug ?? null;
    this.cup = null;
    return mug;
  },

  /** Whether the mug is up at her mouth now. */
  get drinking() {
    return !!this.cup && cupLift(this.cup.t, steamParams).drinking;
  },

  /** Both hands round the mug at her chest, lifting it to her mouth to drink. Runs as a rig poser. */
  poseCupping(dt) {
    const c = this.cup;
    if (!c) return;
    const sat = this.fsm.is('resting') && this.restPhase === 'sat';
    c.k += ((sat ? 1 : 0) - c.k) * Math.min(1, dt * 3);
    if (c.k < 0.01) return;
    const k = smooth(Math.min(1, c.k));
    if (sat) c.t += dt;
    const { lift, drinking } = cupLift(c.t, steamParams);
    const b = this.rig.bones;
    const chest = b.Spine2 ?? b.Spine1;
    if (!chest || !b.Head) return;
    this.root.updateMatrixWorld(true);
    // Where the mug is, in her frame: at her chest, or at her lips.
    this.root.worldToLocal(chest.getWorldPosition(_a)).add(_b.set(...HOLD));
    this.root.worldToLocal(b.Head.getWorldPosition(_target)).add(_b.set(...MOUTH));
    _a.lerp(_target, lift);
    if (drinking) this.attend(this.root.localToWorld(_target.set(0, _a.y + 0.1, 1.5)), { weight: 0.5, seconds: 0.5 });
    const tilt = -0.75 * lift;
    this.root.localToWorld(_a);
    c.mug.position.set(_a.x, _a.y - HALF_MUG, _a.z);
    this.root.getWorldQuaternion(_q);
    c.mug.quaternion.copy(_q).multiply(_tilt.setFromAxisAngle(AXIS_X, tilt));
    for (const a of ARMS) {
      if (!b[a.arm]) continue;
      // The wrists either side of the mug, the elbows out and down.
      _target.set(a.side * 0.052, 0, 0).applyQuaternion(_q).add(_a);
      b[a.arm].getWorldPosition(_pole);
      _pole.add(_b.set(a.side * 0.25, -0.4, -0.05).applyQuaternion(_q));
      solveTwoBone(b[a.arm], b[a.fore], b[a.hand], _target, _pole, k);
      if (b[a.finger] && b[a.thumb]) {
        _dir.set(0, 0.35 + lift * 0.4, 1).normalize().applyQuaternion(_q);
        _palm.set(-a.side, 0, 0).applyQuaternion(_q);
        orientHand(b[a.hand], b[a.finger], b[a.thumb], _dir, _palm, a.side, k);
      }
    }
  },

  /** She lays her right hand flat on the tank and pats it, three times. Only while a quad is being started. Returns whether she did. */
  patTank() {
    const q = this.attempt ? this.quad : this.drive?.attempt ? this.quad : null;
    if (!q || this.pat) return false;
    this.pat = { t: 0, quad: q };
    return true;
  },

  /** The tank's top, in the world, or null when the model has none to find. */
  tankTop(quad, out) {
    const tank = quad.model?.getObjectByName('tank');
    if (!tank) return null;
    quad.model.updateMatrixWorld(true);
    _box.setFromObject(tank);
    return _box.isEmpty() ? null : out.set((_box.min.x + _box.max.x) / 2, _box.max.y, (_box.min.z + _box.max.z) / 2);
  },

  /** Her right hand down flat on the tank and up again, leaning in a little. Runs as a rig poser. */
  posePatting(dt) {
    const p = this.pat;
    if (!p) return;
    p.t += dt / PAT_SECONDS;
    if (p.t >= 1 || !this.tankTop(p.quad, _target)) {
      this.pat = null;
      return;
    }
    const b = this.rig.bones;
    if (!b.RightArm) return;
    const { press, reach } = patStroke(p.t, 3);
    const rig = this.rig;
    rig.rotateAboutRootAxis(b.Spine, AXIS_X, 0.18 * reach);
    // The palm lands on the metal and lifts a few centimetres between pats.
    _target.y += 0.045 * (1 - press) * reach + 0.035 * (1 - reach);
    b.RightArm.getWorldPosition(_pole);
    _pole.add(_b.set(-0.3, -0.3, 0).applyQuaternion(this.root.getWorldQuaternion(_q)));
    solveTwoBone(b.RightArm, b.RightForeArm, b.RightHand, _target, _pole, smooth(Math.min(1, reach * 2)));
    if (b.RightHandIndex1 && b.RightHandThumb1) {
      _dir.set(Math.sin(p.quad.yaw), 0, Math.cos(p.quad.yaw));
      _palm.set(0, -1, 0);
      orientHand(b.RightHand, b.RightHandIndex1, b.RightHandThumb1, _dir, _palm, -1, reach);
    }
  },
};
