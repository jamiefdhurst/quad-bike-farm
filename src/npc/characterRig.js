import * as THREE from 'three';

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

/**
 * Wraps a skinned glTF character: scaling, animation cross-fades by short clip
 * name, and small procedural adjustments layered on top of the clips.
 */
export class CharacterRig {
  constructor(gltf, height) {
    this.root = new THREE.Group();
    this.root.name = 'characterRoot';
    this.model = gltf.scene;
    this.root.add(this.model);

    this.model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        // Skinned meshes move outside their bind-pose bounds.
        o.frustumCulled = false;
      }
    });

    const box = new THREE.Box3().setFromObject(this.model);
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
    this.lookLimits = { yaw: 1.2, pitch: 0.5 };
    // Extra procedural offsets in radians about the character's own axes, set by behaviour code.
    this.offsets = { headYaw: 0, spineRoll: 0, spinePitch: 0, leftArmOut: 0, rightArmOut: 0, leftElbow: 0, rightElbow: 0 };
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
    this.applyProcedural();
  }

  applyProcedural() {
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

    const o = this.offsets;
    const b = this.bones;
    this.rotateAboutRootAxis(b.Spine1, AXIS_Z, o.spineRoll);
    this.rotateAboutRootAxis(b.Spine1, AXIS_X, o.spinePitch);
    // Arms swing out sideways from the shoulder; elbows bend forward.
    this.rotateAboutRootAxis(b.LeftArm, AXIS_Z, o.leftArmOut);
    this.rotateAboutRootAxis(b.RightArm, AXIS_Z, -o.rightArmOut);
    this.rotateAboutRootAxis(b.LeftForeArm, AXIS_X, -o.leftElbow);
    this.rotateAboutRootAxis(b.RightForeArm, AXIS_X, -o.rightElbow);
    this.applyLook();
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
