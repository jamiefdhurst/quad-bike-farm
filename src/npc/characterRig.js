import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { BONES, EMPTY_POSE } from './poseMoves.js';
import { rotateBoneWorld, solveTwoBone, orientHand } from './armIK.js';

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const HAND_BONES = {
  left: ['LeftArm', 'LeftForeArm', 'LeftHand', 'LeftHandIndex1', 'LeftHandThumb1'],
  right: ['RightArm', 'RightForeArm', 'RightHand', 'RightHandIndex1', 'RightHandThumb1'],
};
const _fingers = new THREE.Vector3();
const _palm = new THREE.Vector3();
const _e = new THREE.Euler(0, 0, 0, 'XZY');
const _qe = new THREE.Quaternion();
const _qa = new THREE.Quaternion();
const _qr = new THREE.Quaternion();
const _qri = new THREE.Quaternion();
const _origin = new THREE.Vector3();
const _target = new THREE.Vector3();
const _pole = new THREE.Vector3();

/**
 * Wraps a skinned glTF character: scaling, animation cross-fades by short clip
 * name, and small procedural adjustments layered on top of the clips.
 */
export class CharacterRig {
  constructor(gltf, height) {
    this.root = new THREE.Group();
    this.root.name = 'characterRoot';
    // Her own copy of the model, so two characters can share one glTF: shaping
    // her figure edits the geometry and her outfit recolours the material.
    this.model = cloneSkinned(gltf.scene);
    this.root.add(this.model);

    this.model.traverse((o) => {
      if (o.isMesh) {
        o.geometry = o.geometry.clone();
        o.material = o.material.clone();
        if (o.isSkinnedMesh) o.boundingBox = o.boundingSphere = null; // recomputed once she's posed
        o.castShadow = true;
        o.receiveShadow = true;
        // Skinned meshes move outside their bind-pose bounds.
        o.frustumCulled = false;
      }
    });

    // Measured on the original: a fresh clone's skeleton hasn't been posed yet.
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const scale = height / (box.max.y - box.min.y);
    this.model.scale.multiplyScalar(scale);
    this.model.position.y -= box.min.y * scale;

    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const clip of gltf.animations) {
      const short = clip.name.split('|').pop();
      this.actions[short] = this.mixer.clipAction(clip);
    }
    this.currentAction = null;

    this.bones = {};
    this.model.traverse((o) => {
      if (o.isBone) this.bones[o.name] = o;
    });
    // The pose she loads in, before any clip has played; garments are fitted to it.
    this.restPose = Object.values(this.bones).map((b) => [b, b.position.clone(), b.quaternion.clone(), b.scale.clone()]);

    this.legSpread = 0;
    this.spineSway = { pitch: 0, roll: 0 };
    // Head turn toward a world point, blended in and out by lookWeight (0..1).
    this.lookTarget = new THREE.Vector3();
    this.lookWeight = 0;
    this.lookLimits = { yaw: 1.3, pitch: 0.5 };
    // Extra procedural offsets in radians about the character's own axes, set by behaviour code.
    this.offsets = { headYaw: 0, spineRoll: 0, spinePitch: 0, leftArmOut: 0, rightArmOut: 0, leftElbow: 0, rightElbow: 0 };
    // Bone turns and hand placings (poseMoves.js) set by behaviour code each frame, applied before the offsets; `poseSeat` is the
    // seat a 'seat' frame hand is placed against.
    this.pose = EMPTY_POSE;
    this.poseSeat = null;
    this.carried = new Map();
    // Further posing layered on by behaviour modules, each called as fn(dt) after the offsets.
    this.posers = [];
    this.tmpQ = new THREE.Quaternion();
    this.tmpQ2 = new THREE.Quaternion();
    this.up = new THREE.Vector3();
  }

  has(name) {
    return !!this.actions[name];
  }

  /**
   * Cross-fades to a clip.
   * @param {string} name
   * @param {object} [opts]
   * @param {number} [opts.fade]      seconds
   * @param {boolean} [opts.once]     play once and hold the last frame
   * @param {number} [opts.timeScale] negative plays it backwards
   */
  play(name, { fade = 0.3, once = false, timeScale = 1 } = {}) {
    const next = this.actions[name];
    if (!next) return;
    // Already blended in by mix(): carry on from where it is and let the rest fade, rather than starting it again from nothing.
    if (this.mixed && this.mixed.includes(next) && !once && next.isRunning()) {
      this.mixed = null;
      next.stopFading();
      next.setEffectiveWeight(1);
      next.timeScale = timeScale;
      for (const a of Object.values(this.actions)) if (a !== next && a.isRunning()) a.fadeOut(fade);
      this.currentAction = next;
      return;
    }
    this.mixed = null;
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.timeScale = timeScale;
    if (timeScale < 0) next.time = next.getClip().duration;
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.play();
    if (this.currentAction && this.currentAction !== next) this.currentAction.crossFadeTo(next, fade, false);
    this.currentAction = next;
  }

  /**
   * Holds two looping clips blended by `w` (0 all of `a`, 1 all of `b`), as getting on blends standing into sitting. Anything else
   * playing fades out. A later play() of either carries on from the blend.
   */
  mix(a, b, w) {
    const A = this.actions[a];
    const B = this.actions[b];
    if (!A || !B) return;
    if (!this.mixed || this.mixed[0] !== A || this.mixed[1] !== B) {
      for (const act of Object.values(this.actions)) if (act !== A && act !== B && act.isRunning()) act.fadeOut(0.25);
      for (const act of [A, B]) {
        if (!act.isRunning() || act.loop !== THREE.LoopRepeat) {
          act.reset();
          act.setLoop(THREE.LoopRepeat, Infinity);
          act.clampWhenFinished = false;
          act.play();
        }
        act.timeScale = 1;
        act.stopFading();
        act.enabled = true;
      }
      this.mixed = [A, B];
    }
    A.setEffectiveWeight(1 - w);
    B.setEffectiveWeight(w);
    this.currentAction = w < 0.5 ? A : B;
  }

  setTimeScale(s) {
    if (this.currentAction) this.currentAction.timeScale = s;
  }

  /** Root-local position of the hips in a given clip's pose. */
  measureHips(clipName, time = 0) {
    const action = this.actions[clipName];
    const hips = this.bones.Hips;
    if (!action || !hips) return new THREE.Vector3();
    const prev = this.currentAction;
    this.mixer.stopAllAction();
    action.reset().play();
    action.time = time;
    this.mixer.update(0);
    this.root.updateMatrixWorld(true);
    const p = hips.getWorldPosition(new THREE.Vector3());
    this.root.worldToLocal(p);
    action.stop();
    this.currentAction = null;
    if (prev) this.play(prev.getClip().name.split('|').pop(), { fade: 0 });
    return p;
  }

  /** Runs fn with the skeleton in its rest pose, then puts the current pose back. */
  withRestPose(fn) {
    const current = this.restPose.map(([b]) => [b, b.position.clone(), b.quaternion.clone(), b.scale.clone()]);
    const apply = (pose) => {
      for (const [b, p, q, s] of pose) {
        b.position.copy(p);
        b.quaternion.copy(q);
        b.scale.copy(s);
      }
      this.root.updateMatrixWorld(true);
    };
    apply(this.restPose);
    try {
      fn();
    } finally {
      apply(current);
    }
  }

  update(dt) {
    this.mixer.update(dt);
    this.applyProcedural(dt);
  }

  applyProcedural(dt = 0) {
    // Swing the thighs out about the body's vertical so she straddles the seat.
    if (this.legSpread > 0.001) {
      this.root.getWorldQuaternion(this.tmpQ);
      for (const [name, sign] of [
        ['LeftUpLeg', 1],
        ['RightUpLeg', -1],
      ]) {
        const bone = this.bones[name];
        if (!bone) continue;
        bone.parent.getWorldQuaternion(this.tmpQ2);
        this.up.set(0, 1, 0).applyQuaternion(this.tmpQ).applyQuaternion(this.tmpQ2.invert());
        bone.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(this.up, sign * this.legSpread));
      }
    }
    // Upper body follows the bike's shake a little.
    const spine = this.bones.Spine1 ?? this.bones.Spine;
    if (spine && (this.spineSway.pitch || this.spineSway.roll)) {
      spine.rotateX(this.spineSway.pitch);
      spine.rotateZ(this.spineSway.roll);
    }

    this.applyPose(this.pose);

    const o = this.offsets;
    const b = this.bones;
    this.rotateAboutRootAxis(b.Spine1, AXIS_Z, o.spineRoll);
    this.rotateAboutRootAxis(b.Spine1, AXIS_X, o.spinePitch);
    // Arms swing out sideways from the shoulder; elbows bend forward.
    this.rotateAboutRootAxis(b.LeftArm, AXIS_Z, o.leftArmOut);
    this.rotateAboutRootAxis(b.RightArm, AXIS_Z, -o.rightArmOut);
    this.rotateAboutRootAxis(b.LeftForeArm, AXIS_X, -o.leftElbow);
    this.rotateAboutRootAxis(b.RightForeArm, AXIS_X, -o.rightElbow);
    for (const fn of this.posers) fn(dt);
    this.applyLook();
  }

  /**
   * Layers a pose (poseMoves.js) on: each bone turned about her own axes as its parents' turns left them, then the hands placed.
   */
  applyPose(pose) {
    if (pose === EMPTY_POSE) return;
    const bones = pose.bones ?? {};
    const hands = pose.hands ?? {};
    const any = Object.keys(bones).length || Object.values(hands).some((h) => h.w > 1e-3);
    if (!any) return;
    this.root.updateMatrixWorld(true);
    this.root.getWorldQuaternion(_qr);
    _qri.copy(_qr).invert();
    const carried = this.carried;
    carried.clear();
    for (const name of BONES) {
      const bone = this.bones[name];
      const turn = bones[name];
      if (!bone) continue;
      const parent = carried.get(bone.parent);
      if (!turn || (Math.abs(turn[0]) < 1e-5 && Math.abs(turn[1]) < 1e-5 && Math.abs(turn[2]) < 1e-5)) {
        if (parent) carried.set(bone, parent);
        continue;
      }
      _qe.setFromEuler(_e.set(turn[0], turn[1], turn[2], 'XZY'));
      // In her own frame, the turn about the axes as the parents left them: P * e * P^-1; then into the world.
      _qa.copy(_qe);
      if (parent) _qa.premultiply(parent).multiply(_qe.clone().copy(parent).invert());
      _qa.premultiply(_qr).multiply(_qri);
      rotateBoneWorld(bone, _qa);
      const own = new THREE.Quaternion().setFromEuler(_e);
      carried.set(bone, parent ? parent.clone().multiply(own) : own);
    }
    for (const [side, h] of Object.entries(hands)) {
      if (!h || h.w <= 1e-3 || !HAND_BONES[side]) continue;
      const [arm, fore, hand, finger, thumb] = HAND_BONES[side].map((n) => this.bones[n]);
      if (!arm || !fore || !hand) continue;
      const frame = this.handFrame(h.frame);
      if (!frame) continue;
      _target.set(...h.at).applyQuaternion(frame.q).add(frame.origin);
      _pole.set(...h.pole).applyQuaternion(frame.q).add(frame.origin);
      solveTwoBone(arm, fore, hand, _target, _pole, Math.min(1, h.w));
      if (h.fingers && h.palm && finger && thumb) {
        _fingers.set(...h.fingers).applyQuaternion(frame.q);
        _palm.set(...h.palm).applyQuaternion(frame.q);
        orientHand(hand, finger, thumb, _fingers, _palm, side === 'left' ? 1 : -1, Math.min(1, h.w));
      }
    }
  }

  /** Where a hand frame is in the world: its origin and its turn. */
  handFrame(name) {
    if (name === 'seat') {
      if (!this.poseSeat) return null;
      this.poseSeat.getWorldPosition(_origin);
      return { origin: _origin, q: this.poseSeat.getWorldQuaternion(new THREE.Quaternion()) };
    }
    const bone = this.bones[name === 'chest' ? 'Spine2' : 'Hips'];
    if (!bone) return null;
    bone.getWorldPosition(_origin);
    return { origin: _origin, q: _qr };
  }

  /** Turns neck and head toward lookTarget, shared between them, plus any headYaw offset. */
  applyLook() {
    const neck = this.bones.Neck;
    const head = this.bones.Head;
    if (!neck || !head) return;
    let yaw = this.offsets.headYaw;
    let pitch = 0;
    if (this.lookWeight > 0.001) {
      const from = this.root.worldToLocal(head.getWorldPosition(new THREE.Vector3()));
      const to = this.root.worldToLocal(this.lookTarget.clone()).sub(from);
      const ly = THREE.MathUtils.clamp(Math.atan2(to.x, to.z), -this.lookLimits.yaw, this.lookLimits.yaw);
      const lp = THREE.MathUtils.clamp(Math.atan2(to.y, Math.hypot(to.x, to.z)), -this.lookLimits.pitch, this.lookLimits.pitch);
      yaw += ly * this.lookWeight;
      pitch += lp * this.lookWeight;
    }
    if (Math.abs(yaw) < 1e-4 && Math.abs(pitch) < 1e-4) return;
    this.rotateAboutRootAxis(neck, AXIS_Y, yaw * 0.4);
    this.rotateAboutRootAxis(head, AXIS_Y, yaw * 0.6);
    // Positive pitch means looking up, which is a negative turn about the side axis.
    this.rotateAboutRootAxis(neck, AXIS_X, -pitch * 0.4);
    this.rotateAboutRootAxis(head, AXIS_X, -pitch * 0.6);
  }

  /** Rotates a bone about one of the character root's axes, in the bone's parent space. */
  rotateAboutRootAxis(bone, axis, angle) {
    if (!bone || Math.abs(angle) < 1e-5) return;
    this.root.getWorldQuaternion(this.tmpQ);
    bone.parent.getWorldQuaternion(this.tmpQ2);
    this.up.copy(axis).applyQuaternion(this.tmpQ).applyQuaternion(this.tmpQ2.invert());
    bone.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(this.up, angle));
    bone.updateMatrixWorld(true);
  }
}
