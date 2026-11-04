import * as THREE from 'three';

// Mud and dust on a girl (npc/muddiness.js says how much). A shader blend on her body material, like the quads' (mudCoat.js): mud splashed on
// her legs from the boots up, creeping higher as she gets muddier, and flecks on her face; dust dulls her hair, face and shirt. It is worked
// out from the body's own bind-pose position, so it stays put on her as she moves. Her clothes are separate garments (npc/outfit.js) and get the
// same treatment, each by its own rule: wellies caked at the foot and splashed higher, and the shorts, coat and tops sprayed on the back, the
// stripe from the back wheel, with the front much cleaner. Their vertices carry the same body-space position in a `girlPos` attribute
// (a welly hangs from a bone, so its own position is not in body space), made when she is dressed.

const noiseGlsl = /* glsl */ `
  float gmHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float gmNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(gmHash(i), gmHash(i + vec3(1, 0, 0)), f.x), mix(gmHash(i + vec3(0, 1, 0)), gmHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(gmHash(i + vec3(0, 0, 1)), gmHash(i + vec3(1, 0, 1)), f.x), mix(gmHash(i + vec3(0, 1, 1)), gmHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
`;

const KINDS = {
  // The body: mud from the boots up, flecks on the face and shirt, dust on the head and shoulders.
  body: `
        float blot = gmNoise(gn * 14.0) * 0.6 + gmNoise(gn * 38.0) * 0.28 + gmNoise(gn * 90.0) * 0.12;
        // Boots upward: the knee at light mud, the hips when she is plastered.
        float reach = mix(0.12, 0.5, uGirlMud);
        float cover = uGirlMud * (1.0 - smoothstep(reach * 0.35, reach, gh));
        float gMask = smoothstep(blot - 0.07, blot + 0.07, cover * 1.3);
        // Flecks on the face and shirt once she is badly splashed.
        float fleck = step(0.86 - 0.12 * uGirlMud, gmNoise(gn * 130.0)) * smoothstep(0.35, 0.8, uGirlMud) * smoothstep(0.6, 0.85, gh) * 0.9;
        gMask = max(gMask, fleck);
        diffuseColor.rgb = mix(diffuseColor.rgb, mudCol, gMask);
        // Dust: pale and patchy on the head and shoulders, a little over the rest.
        float dustHere = uGirlDust * mix(0.25, 0.75, smoothstep(0.62, 0.88, gh)) * (0.6 + 0.6 * gmNoise(gn * 45.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.52, 0.36), clamp(dustHere, 0.0, 0.85) * (1.0 - gMask));`,
  // A welly: caked thick round the foot as soon as she has any on her, splashed up the shin as she gets muddier.
  welly: `
        float blot = gmNoise(gn * 22.0) * 0.6 + gmNoise(gn * 60.0) * 0.4;
        float m = clamp(uGirlMud * uGirlBoots, 0.0, 1.0);
        float reach = mix(0.05, 0.3, m);
        float cover = smoothstep(0.02, 0.18, m) * (1.0 - smoothstep(reach * 0.4, reach, gh));
        float gMask = smoothstep(blot - 0.08, blot + 0.08, cover * 1.5);
        // Splashes up the shin above the caking, sparser the higher.
        float splash = step(0.8 - 0.25 * m, gmNoise(gn * 150.0)) * smoothstep(0.1, 0.5, m) * (1.0 - smoothstep(reach, reach * 2.2, gh));
        gMask = max(gMask, splash * 0.9);
        diffuseColor.rgb = mix(diffuseColor.rgb, mudCol, gMask);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5, 0.45, 0.36), clamp(uGirlDust * 0.5, 0.0, 0.5) * (1.0 - gMask));`,
  // Shorts, coat, tops: the spray from the back wheel hits the back and the backs of the legs, thickest low and in a stripe up the middle.
  cloth: `
        vec3 centre = uGirlMin + uGirlSize * 0.5;
        vec3 off = vGirlPos - centre;
        float height = dot(uGirlSize, uGirlUp);
        float depth = dot(off, uGirlFwd) / height;
        float side = dot(off, cross(uGirlUp, uGirlFwd)) / height;
        float back = smoothstep(-0.02, 0.05, -depth);
        float facing = mix(uGirlBack, 1.0, back);
        float stripe = mix(0.65, 1.0, exp(-side * side * 90.0));
        float reach = mix(0.45, 0.85, uGirlMud);
        float cover = uGirlMud * facing * stripe * (1.0 - smoothstep(reach * 0.2, reach, gh));
        float spots = gmNoise(gn * 55.0) * 0.55 + gmNoise(gn * 120.0) * 0.45;
        float gMask = smoothstep(spots - 0.06, spots + 0.06, cover * 1.15);
        diffuseColor.rgb = mix(diffuseColor.rgb, mudCol, gMask);
        // Dust on dark cloth is a dull grey bloom, more on the back and shoulders.
        float dustHere = uGirlDust * mix(0.35, 0.8, smoothstep(0.55, 0.85, gh)) * mix(0.4, 1.0, back) * (0.6 + 0.6 * gmNoise(gn * 40.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.52, 0.49, 0.44), clamp(dustHere, 0.0, 0.7) * (1.0 - gMask));`,
};

function patch(material, uniforms, kind) {
  if (material.userData.girlMud) return; // wellies share one material between the two boots
  material.userData.girlMud = true;
  const before = material.onBeforeCompile; // the plaid has its own, which runs first
  const key = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n        varying vec3 vGirlPos;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n        vGirlPos = ${kind === 'body' ? 'position' : 'girlPos'};`)
      .replace('void main() {', `${kind === 'body' ? '' : 'attribute vec3 girlPos;'}\nvoid main() {`);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uGirlMud;
        uniform float uGirlDust;
        uniform float uGirlWet;
        uniform vec3 uGirlMin;
        uniform vec3 uGirlSize;
        uniform vec3 uGirlUp;
        uniform vec3 uGirlFwd;
        uniform float uGirlBack;
        uniform float uGirlBoots;
        varying vec3 vGirlPos;
        ${noiseGlsl}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 gn = (vGirlPos - uGirlMin) / uGirlSize;
        float gh = dot(gn, uGirlUp);
        float gTone = gmNoise(gn * 6.0 + 3.0);
        float crack = (1.0 - uGirlWet) * smoothstep(0.045, 0.0, abs(gmNoise(gn * 70.0) - 0.5)) * 0.3;
        vec3 wetMud = mix(vec3(0.085, 0.058, 0.034), vec3(0.045, 0.031, 0.019), gTone);
        vec3 dryMud = mix(vec3(0.3, 0.235, 0.155), vec3(0.2, 0.15, 0.095), gTone) * (1.0 - crack);
        vec3 mudCol = mix(dryMud, wetMud, uGirlWet);
        ${KINDS[kind]}`
      );
  };
  material.customProgramCacheKey = () => `${key.call(material)}girlMud-${kind}`;
}

/** Which of her dressed parts take mud, and how: the wellies, and the cloth of the shorts, coat and tops; not buttons, stitching, logo or tie. */
export function mudKindOfPart(name, skinned) {
  if (/Welly(Foot)?$/.test(name)) return 'welly';
  if (!skinned || /Buttons|Placket|Logo|Vee|Groove|tie$/i.test(name)) return null;
  return 'cloth';
}

export class GirlMud {
  /** @param {CharacterRig} rig */
  constructor(rig) {
    this.rig = rig;
    this.uniforms = {
      uGirlMud: { value: 0 },
      uGirlDust: { value: 0 },
      uGirlWet: { value: 0 },
      uGirlMin: { value: new THREE.Vector3() },
      uGirlSize: { value: new THREE.Vector3(1, 1, 1) },
      uGirlUp: { value: new THREE.Vector3(0, 1, 0) },
      uGirlFwd: { value: new THREE.Vector3(0, 0, 1) },
      uGirlBack: { value: 0.15 },
      uGirlBoots: { value: 2.5 },
    };
    let body = null;
    rig.model.traverse((o) => {
      if (o.isSkinnedMesh && !body) body = o;
    });
    this.body = body;
    this.ok = !!body && !Array.isArray(body.material) && body.material.isMeshStandardMaterial;
    if (!this.ok) return;
    // The bind-pose box, and which way is up in it (the longest side of a standing figure).
    const box = new THREE.Box3().setFromBufferAttribute(body.geometry.attributes.position);
    const size = box.getSize(new THREE.Vector3());
    const axis = size.x > size.y && size.x > size.z ? 0 : size.z > size.y ? 2 : 1;
    this.uniforms.uGirlMin.value.copy(box.min);
    this.uniforms.uGirlSize.value.copy(size).max(new THREE.Vector3(1e-6, 1e-6, 1e-6));
    this.uniforms.uGirlUp.value.set(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0);
    this.uniforms.uGirlFwd.value.copy(this.forward(body));
    patch(body.material, this.uniforms, 'body');
    body.material.needsUpdate = true;
    rig.onDressed = () => this.dressed();
  }

  /** Which way she faces in the body's own space: from her heel to her toe in the bind pose, flattened. */
  forward(body) {
    const { bones, boneInverses } = body.skeleton;
    const at = (name) => {
      const i = bones.findIndex((b) => b.name === name);
      return i < 0 ? null : new THREE.Vector3().setFromMatrixPosition(boneInverses[i].clone().invert());
    };
    const foot = at('LeftFoot');
    const toe = at('LeftToeBase') ?? at('LeftToe_End');
    const up = this.uniforms.uGirlUp.value;
    const fwd = foot && toe ? toe.sub(foot) : new THREE.Vector3(0, 0, 1);
    fwd.addScaledVector(up, -fwd.dot(up));
    return fwd.lengthSq() > 1e-8 ? fwd.normalize() : new THREE.Vector3(0, 0, 1).addScaledVector(up, -up.z).normalize();
  }

  /**
   * Called as her clothes have been fitted, in her rest pose: gives each garment its body-space position per vertex (a skinned one already
   * has it; a welly hangs from a bone, so its own is carried across) and the mud shader.
   */
  dressed() {
    if (!this.ok) return;
    const toBody = new THREE.Matrix4();
    this.rig.root.updateMatrixWorld(true);
    toBody.copy(this.body.matrixWorld).invert();
    for (const part of this.rig.outfitParts ?? []) {
      const kind = mudKindOfPart(part.name, !!part.isSkinnedMesh);
      if (!kind || !part.isMesh || !part.material.isMeshStandardMaterial) continue;
      const pos = part.geometry.attributes.position;
      if (part.isSkinnedMesh) {
        part.geometry.setAttribute('girlPos', pos.clone());
      } else {
        const m = toBody.clone().multiply(part.matrixWorld);
        const out = new THREE.Float32BufferAttribute(pos.count * 3, 3);
        const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) out.setXYZ(i, ...v.fromBufferAttribute(pos, i).applyMatrix4(m).toArray());
        part.geometry.setAttribute('girlPos', out);
      }
      patch(part.material, this.uniforms, kind);
      part.material.needsUpdate = true;
    }
  }

  /** @param {{ mud: number, dust: number, wet: number }} state  0..1 each. @param {{ backBias: number, wellyBoost: number }} [p] */
  update(state, p) {
    if (!this.ok) return;
    this.uniforms.uGirlMud.value = state.mud;
    this.uniforms.uGirlDust.value = state.dust;
    this.uniforms.uGirlWet.value = state.wet;
    if (p) {
      this.uniforms.uGirlBack.value = p.backBias;
      this.uniforms.uGirlBoots.value = p.wellyBoost;
    }
  }
}
