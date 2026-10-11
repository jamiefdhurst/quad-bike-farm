import * as THREE from 'three';

// Mud and dust on a girl (npc/muddiness.js says how much). A shader blend on her body material, like the quads' (mudCoat.js): mud splashed on
// her legs from the boots up, creeping higher as she gets muddier, and flecks on her face; dust dulls her hair, face and shirt. It is worked
// out from the body's own bind-pose position, so it stays put on her as she moves. Her wellies and shorts are separate garments and stay as they are.

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

function patch(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n        varying vec3 vGirlPos;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n        vGirlPos = position;`);
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
        varying vec3 vGirlPos;
        ${noiseGlsl}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 gn = (vGirlPos - uGirlMin) / uGirlSize;
        float gh = dot(gn, uGirlUp);
        float blot = gmNoise(gn * 14.0) * 0.6 + gmNoise(gn * 38.0) * 0.28 + gmNoise(gn * 90.0) * 0.12;
        // Boots upward: the knee at light mud, the hips when she is plastered.
        float reach = mix(0.12, 0.5, uGirlMud);
        float cover = uGirlMud * (1.0 - smoothstep(reach * 0.35, reach, gh));
        float gMask = smoothstep(blot - 0.07, blot + 0.07, cover * 1.3);
        // Flecks on the face and shirt once she is badly splashed.
        float fleck = step(0.86 - 0.12 * uGirlMud, gmNoise(gn * 130.0)) * smoothstep(0.35, 0.8, uGirlMud) * smoothstep(0.6, 0.85, gh) * 0.9;
        gMask = max(gMask, fleck);
        float gTone = gmNoise(gn * 6.0 + 3.0);
        vec3 wetMud = mix(vec3(0.085, 0.058, 0.034), vec3(0.045, 0.031, 0.019), gTone);
        vec3 dryMud = mix(vec3(0.3, 0.235, 0.155), vec3(0.2, 0.15, 0.095), gTone);
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(dryMud, wetMud, uGirlWet), gMask);
        // Dust: pale and patchy on the head and shoulders, a little over the rest.
        float dustHere = uGirlDust * mix(0.25, 0.75, smoothstep(0.62, 0.88, gh)) * (0.6 + 0.6 * gmNoise(gn * 45.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.52, 0.36), clamp(dustHere, 0.0, 0.85) * (1.0 - gMask));`,
      );
  };
  material.customProgramCacheKey = () => 'girlMud';
}

export class GirlMud {
  /** @param {CharacterRig} rig */
  constructor(rig) {
    this.uniforms = {
      uGirlMud: { value: 0 },
      uGirlDust: { value: 0 },
      uGirlWet: { value: 0 },
      uGirlMin: { value: new THREE.Vector3() },
      uGirlSize: { value: new THREE.Vector3(1, 1, 1) },
      uGirlUp: { value: new THREE.Vector3(0, 1, 0) },
    };
    let body = null;
    rig.model.traverse((o) => {
      if (o.isSkinnedMesh && !body) body = o;
    });
    this.ok = !!body && !Array.isArray(body.material) && body.material.isMeshStandardMaterial;
    if (!this.ok) return;
    // The bind-pose box, and which way is up in it (the longest side of a standing figure).
    const box = new THREE.Box3().setFromBufferAttribute(body.geometry.attributes.position);
    const size = box.getSize(new THREE.Vector3());
    const axis = size.x > size.y && size.x > size.z ? 0 : size.z > size.y ? 2 : 1;
    this.uniforms.uGirlMin.value.copy(box.min);
    this.uniforms.uGirlSize.value.copy(size).max(new THREE.Vector3(1e-6, 1e-6, 1e-6));
    this.uniforms.uGirlUp.value.set(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0);
    patch(body.material, this.uniforms);
    body.material.needsUpdate = true;
  }

  /** @param {{ mud: number, dust: number, wet: number }} state  0..1 each. */
  update(state) {
    if (!this.ok) return;
    this.uniforms.uGirlMud.value = state.mud;
    this.uniforms.uGirlDust.value = state.dust;
    this.uniforms.uGirlWet.value = state.wet;
  }
}
