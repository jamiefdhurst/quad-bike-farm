import * as THREE from 'three';

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

    this.legSpread = 0;
    this.spineSway = { pitch: 0, roll: 0 };
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
  }
}
