import * as THREE from 'three';
import { REGIONS, stillShake, shakeStep, shakeOffsets, shakeWeights, jolt, DEFAULT_BODY_SHAKE_PARAMS } from './bodyShake.js';

// Her body giving with the shake (bodyShake.js) on the model: each of her skinned meshes, her body and every garment made from it,
// gets a weight per region from where it is in her bind pose, and its material is patched to add each region's offset to its
// vertices before skinning, so her clothes move with her and nothing comes through. The offsets are worked out once a frame in
// world metres and carried into each region's bone, and shared by every material she wears. Run by the rig after her posing.

const _at = new THREE.Vector3();
const _raw = new THREE.Vector3();
const _a = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _m3 = new THREE.Matrix3();
const _d = new THREE.Vector3();
const ACCEL = [0, 0, 0];

export class BodyShake {
  /**
   * `rig`: her CharacterRig (her body the first skinned mesh in it). `figure`: returns her figure.js amounts. `params`: the shared tuning.
   */
  constructor(rig, { figure = () => ({}), params = DEFAULT_BODY_SHAKE_PARAMS } = {}) {
    this.rig = rig;
    this.figure = figure;
    this.params = params;
    this.state = stillShake();
    this.heave = 0; // the seat's heave while she sits on something running (metres, up), set by the companion
    this.offsets = {};
    this.uniform = { value: REGIONS.map(() => new THREE.Vector3()) };
    this.meshes = new Set();
    this.parts = null;
    this.partCount = -1;
    this.prev = null;
    this.vel = new THREE.Vector3();
    this.accel = new THREE.Vector3();
  }

  /** A jolt from nowhere, to watch her settle. */
  jolt(speed) {
    jolt(this.state, speed);
  }

  /** How far her bust is moved now, in centimetres (the panel's watch). */
  get bustCm() {
    const o = this.offsets.bust;
    return o ? Math.hypot(o[0], o[1], o[2]) * 100 : 0;
  }

  update(dt) {
    const body = this.body();
    if (!body) return;
    this.dress(body);
    // How her chest is being thrown about, from where it has been (as the ponytail's band).
    const chest = this.rig.bones.Spine1 ?? this.rig.bones.Spine;
    chest.updateWorldMatrix(true, false);
    const at = _at.setFromMatrixPosition(chest.matrixWorld);
    if (dt > 1e-4) {
      if (!this.prev || this.prev.distanceToSquared(at) > 1) {
        this.prev = at.clone();
        this.vel.set(0, 0, 0);
        this.accel.set(0, 0, 0);
      } else {
        _a.subVectors(at, this.prev).divideScalar(dt);
        const raw = _raw.copy(_a).sub(this.vel).divideScalar(dt);
        this.vel.copy(_a);
        this.prev.copy(at);
        if (raw.length() > 60) raw.setLength(60); // a jolt, not a teleport
        this.accel.lerp(raw, Math.min(1, dt * 25)); // smoothed a little: frame to frame her bones jitter
      }
      this.accel.toArray(ACCEL);
      shakeStep(this.state, ACCEL, Math.min(dt, 0.1), this.params);
    }
    shakeOffsets(this.state, this.heave, this.params, this.figure(), this.offsets);
    // Each region's offset carried from the world into her bind pose through its bone, so the skinning carries it back out.
    body.updateWorldMatrix(true, false);
    const sk = body.skeleton;
    REGIONS.forEach((r, i) => {
      const out = this.uniform.value[i];
      const bone = this.rig.bones[r.bone];
      const k = bone ? sk.bones.indexOf(bone) : -1;
      if (k < 0) return out.set(0, 0, 0);
      bone.updateWorldMatrix(false, false);
      _m.copy(body.matrixWorld).multiply(body.bindMatrixInverse).multiply(bone.matrixWorld).multiply(sk.boneInverses[k]).multiply(body.bindMatrix);
      _m3.setFromMatrix4(_m).invert();
      out.copy(_d.fromArray(this.offsets[r.spring])).applyMatrix3(_m3);
    });
  }

  body() {
    if (this.bodyMesh) return this.bodyMesh;
    this.rig.model.traverse((o) => {
      if (o.isSkinnedMesh && !this.bodyMesh) this.bodyMesh = o;
    });
    return this.bodyMesh;
  }

  /** Weights and a patched material for her body and any garment not seen before (a refit replaces them all). */
  dress(body) {
    const parts = this.rig.outfitParts ?? [];
    if (parts === this.parts && parts.length === this.partCount && this.meshes.has(body)) return;
    this.parts = parts;
    this.partCount = parts.length;
    const frame = bodyFrame(body, this.figure());
    if (!frame) return;
    const meshes = [body];
    for (const p of parts) p.traverse((o) => o.isSkinnedMesh && o.skeleton === body.skeleton && meshes.push(o));
    // All weighed again, her body as well: a refit may have come from her figure changing.
    for (const m of meshes) {
      this.meshes.add(m);
      weigh(m, frame);
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) patch(mat, this.uniform);
    }
    for (const m of this.meshes) if (!m.parent) this.meshes.delete(m);
  }
}

/** figure.js's body frame from her skeleton, and what shakeWeights needs from it. Null if her bones aren't all there. */
function bodyFrame(body, figure) {
  const sk = body.skeleton;
  const bind = (name) => {
    const i = sk.bones.findIndex((b) => b.name === name);
    return i < 0 ? null : new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[i].clone().invert());
  };
  const names = ['Hips', 'Neck', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'LeftUpLeg', 'LeftLeg'];
  const b = Object.fromEntries(names.map((n) => [n, bind(n)]));
  if (names.some((n) => !b[n])) return null;
  const unit = b.Neck.distanceTo(b.Hips);
  const up = b.Neck.clone().sub(b.Hips).normalize();
  const left = b.LeftArm.clone().sub(b.RightArm);
  left.addScaledVector(up, -left.dot(up)).normalize();
  const front = new THREE.Vector3().crossVectors(left, up);
  const p = new THREE.Vector3();
  const toBody = (v) => {
    p.copy(v).sub(b.Hips);
    return { x: p.dot(left) / unit, y: p.dot(up) / unit, z: p.dot(front) / unit };
  };
  // The bust's apex, as figure.js finds it: the frontmost point of her chest on her left.
  const pos = body.geometry.attributes.position;
  const v = new THREE.Vector3();
  let apex = null;
  for (let i = 0; i < pos.count; i++) {
    const q = toBody(v.fromBufferAttribute(pos, i));
    if (q.x > 0.02 && q.x < 0.4 && q.y > 0.55 && q.y < 0.9 && (!apex || q.z > apex.z)) apex = q;
  }
  if (!apex) return null;
  const mid = (a, c) => {
    const q = toBody(a.clone().lerp(c, 0.5));
    return { y: q.y, z: q.z };
  };
  const bones = (re) => new Set(sk.bones.map((x, i) => (re.test(x.name) ? i : -1)).filter((i) => i >= 0));
  return {
    toBody,
    apex,
    bust: figure.bust ?? 1,
    arms: { L: mid(b.LeftArm, b.LeftForeArm), R: mid(b.RightArm, b.RightForeArm) },
    hip: toBody(b.LeftUpLeg),
    knee: toBody(b.LeftLeg),
    skinOf: { armL: bones(/^LeftArm$/), armR: bones(/^RightArm$/), legL: bones(/^LeftUpLeg$/), legR: bones(/^RightUpLeg$/) },
  };
}

/**
 * Each vertex's region weights, as three attributes: bust, belly and seat; her arms; her thighs. None is a vec4, because a mesh
 * drawn without them (anything sharing a patched material) reads a missing vec4's fourth as 1, and a vec3 or vec2 as all 0.
 */
function weigh(mesh, frame) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const si = geo.attributes.skinIndex;
  const sw = geo.attributes.skinWeight;
  const A = new Float32Array(pos.count * 3);
  const B = new Float32Array(pos.count * 2);
  const C = new Float32Array(pos.count * 2);
  const v = new THREE.Vector3();
  const skin = { armL: 0, armR: 0, legL: 0, legR: 0 };
  for (let i = 0; i < pos.count; i++) {
    for (const k in skin) skin[k] = 0;
    for (let c = 0; c < 4; c++) {
      const bone = si.getComponent(i, c);
      const w = sw.getComponent(i, c);
      for (const k in skin) if (frame.skinOf[k].has(bone)) skin[k] += w;
    }
    const w = shakeWeights(frame.toBody(v.fromBufferAttribute(pos, i)), skin, frame);
    const [bust, belly, armL, armR, seat, thighL, thighR] = w;
    A.set([bust, belly, seat], i * 3);
    B.set([armL, armR], i * 2);
    C.set([thighL, thighR], i * 2);
  }
  geo.setAttribute('shakeA', new THREE.BufferAttribute(A, 3));
  geo.setAttribute('shakeB', new THREE.BufferAttribute(B, 2));
  geo.setAttribute('shakeC', new THREE.BufferAttribute(C, 2));
}

/** Adds the regions' offsets to the vertices before skinning, after anything the material already does (the plaid, mud). */
function patch(material, uniform) {
  if (material.userData.bodyShake) return;
  material.userData.bodyShake = true;
  const before = material.onBeforeCompile;
  const key = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    shader.uniforms.shakeOff = uniform;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `attribute vec3 shakeA;\nattribute vec2 shakeB;\nattribute vec2 shakeC;\nuniform vec3 shakeOff[${REGIONS.length}];\nvoid main() {`)
      .replace(
        '#include <skinning_vertex>',
        `transformed += shakeA.x * shakeOff[0] + shakeA.y * shakeOff[1] + shakeB.x * shakeOff[2] + shakeB.y * shakeOff[3]
          + shakeA.z * shakeOff[4] + shakeC.x * shakeOff[5] + shakeC.y * shakeOff[6];
        #include <skinning_vertex>`,
      );
  };
  material.customProgramCacheKey = () => `${key.call(material)}bodyShake`;
  material.needsUpdate = true;
}

