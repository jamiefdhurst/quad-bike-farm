import * as THREE from 'three';
import { cabinBox } from './cabinMud.js';
import { bakeModelSteps } from '../vehicle/detail/wear.js';
import { wearKind, wearColourGlsl, WEAR_VERTEX_DECL, WEAR_VERTEX, WEAR_FRAGMENT_DECL, WEAR_ROUGHNESS, WEAR_METALNESS } from './wearLayer.js';

// Mud caked on a quad. Each quad gets its own copies of its materials with a
// shader blend on top: a procedural mud mask that starts on the tyres, the
// wheel arches, undersides and lower parts and creeps up the bodywork as the
// coat builds. Fresh mud is dark and glossy; it dries lighter and matt.
//
// The mask is worked out in the quad's own frame (y = 0 is the ground under
// it), so it stays put on the bodywork as the quad moves, and in each wheel's
// own frame for the wheels, so it turns with them.
//
// The same shader carries the vehicle's wear (wearLayer.js): scuffs, fading, rust and grime drawn under the mud, and the mud
// gathers first in the nooks the wear bake finds.

const noiseGlsl = /* glsl */ `
  float mudHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float mudNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(mudHash(i), mudHash(i + vec3(1, 0, 0)), f.x), mix(mudHash(i + vec3(0, 1, 0)), mudHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(mudHash(i + vec3(0, 0, 1)), mudHash(i + vec3(1, 0, 1)), f.x), mix(mudHash(i + vec3(0, 1, 1)), mudHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
`;

// Wheel centres in the quad's frame, at rest: x, y, z.
const WHEEL_CENTRES = /* glsl */ `
  const vec3 mudWheels[4] = vec3[4](vec3(0.48, 0.3, 0.62), vec3(-0.48, 0.3, 0.62), vec3(0.48, 0.3, -0.62), vec3(-0.48, 0.3, -0.62));
`;

function patchMaterial(material, uniforms, wheel, kind) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform mat4 uMudFrame;
        varying vec3 vMudPos;
        varying vec3 vMudNormal;
        ${WEAR_VERTEX_DECL}`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        ${wheel
          ? 'vMudPos = position; vMudNormal = objectNormal;'
          : `vMudPos = (uMudFrame * modelMatrix * vec4(transformed, 1.0)).xyz;
        vMudNormal = normalize(mat3(uMudFrame) * mat3(modelMatrix) * objectNormal);`}
        ${WEAR_VERTEX}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uMudBody;
        uniform float uMudWheels;
        uniform float uMudWet;
        uniform float uWashed;
        uniform vec3 uCabinMin;
        uniform vec3 uCabinMax;
        varying vec3 vMudPos;
        varying vec3 vMudNormal;
        ${WEAR_FRAGMENT_DECL}
        ${noiseGlsl}
        ${WHEEL_CENTRES}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        ${wearColourGlsl(kind)}
        vec3 mp = vMudPos;
        float blot = mudNoise(mp * 9.0) * 0.6 + mudNoise(mp * 23.0) * 0.28 + mudNoise(mp * 61.0) * 0.12;
        float cover;
        ${wheel
          ? `// Tyres first, then into the rims; more towards the tread.
        float rad = length(mp.yz) / 0.3;
        cover = uMudWheels * mix(0.75, 1.35, smoothstep(0.45, 0.85, rad));`
          : `// Low down, round the wheels and underneath, creeping higher as it builds up.
        float reach = mix(0.5, 1.3, uMudBody);
        float low = 1.0 - smoothstep(reach * 0.3, reach, mp.y);
        // Tops of panels catch less than their sides and undersides.
        float top = smoothstep(0.35, 0.95, vMudNormal.y);
        float arch = 0.0;
        for (int k = 0; k < 4; k++) {
          vec3 d = (mp - mudWheels[k]) * vec3(1.6, 1.0, 1.0);
          arch = max(arch, 1.0 - smoothstep(0.28, 0.62, length(d)));
        }
        float under = smoothstep(0.1, -0.6, vMudNormal.y);
        cover = uMudBody * ((0.95 * low + 0.7 * arch) * (1.0 - 0.25 * top) + 0.45 * under) + uMudBody * uMudBody * 0.3;
        // The cab's inside (a surface in the cabin box facing its middle) stays clean: see cabinMud.js.
        vec3 cabMid = (uCabinMin + uCabinMax) * 0.5;
        vec3 inBox = step(uCabinMin, mp) * step(mp, uCabinMax);
        cover *= 1.0 - inBox.x * inBox.y * inBox.z * step(0.0, dot(vMudNormal, cabMid - mp));`}
        // Mud stays in the nooks first, and an old vehicle has dried mud in them however clean the rest is.
        cover += wearNook * (0.9 * ${wheel ? 'uMudWheels' : 'uMudBody'} + 0.6 * uWear);
        float mudMask = smoothstep(blot - 0.06, blot + 0.06, cover * 1.25);
        // Flecks flung a bit higher than the main coat.
        float fleck = step(0.8 - 0.14 * cover, mudNoise(mp * 95.0)) * step(0.05, cover);
        mudMask = max(mudMask, fleck * 0.9);
        float thick = smoothstep(0.0, 0.5, cover - blot);
        // Patches of lighter clay and darker earth.
        float tone = mudNoise(mp * 3.1 + 7.0);
        vec3 wetMud = mix(vec3(0.085, 0.058, 0.034), vec3(0.045, 0.031, 0.019), max(thick, tone));
        vec3 dryMud = mix(mix(vec3(0.3, 0.235, 0.155), vec3(0.2, 0.15, 0.095), tone), vec3(0.14, 0.1, 0.064), thick * 0.7);
        // Drying starts at the thin edges.
        float wetHere = clamp(uMudWet * (1.2 + 0.6 * thick) - 0.2 * blot, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(dryMud, wetMud, wetHere), mudMask);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        ${WEAR_ROUGHNESS}
        roughnessFactor = mix(roughnessFactor, mix(0.92, 0.3, wetHere), mudMask);
        // Just hosed down: the clean paint is wet and shiny.
        roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.35, uWashed * (1.0 - mudMask));`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          // Lumpy: a bump map from the same noise, thicker where it's caked on.
          float hh = mudMask * (0.4 + thick) * (0.6 * mudNoise(vMudPos * 38.0) + 0.4 * mudNoise(vMudPos * 90.0)) * 0.006;
          vec3 sx = dFdx(-vViewPosition);
          vec3 sy = dFdy(-vViewPosition);
          vec3 r1 = cross(sy, normal);
          vec3 r2 = cross(normal, sx);
          float det = dot(sx, r1) * faceDirection;
          vec3 grad = sign(det) * (dFdx(hh) * r1 + dFdy(hh) * r2);
          normal = normalize(abs(det) * normal - grad);
        }`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        ${WEAR_METALNESS}
        metalnessFactor = mix(metalnessFactor, 0.0, mudMask);`,
      );
  };
  material.customProgramCacheKey = () => `${wheel ? 'mudCoatWheel' : 'mudCoatBody'}|${kind}`;
}

/** The Vehicles tab's "Wear" for each vehicle. */
export const WEAR_LOOK_RANGES = { wear: [0, 1, 0.01] };

export class MudCoat {
  /**
   * @param {Quad} quad
   */
  constructor(quad) {
    this.quad = quad;
    this.uniforms = {
      uMudFrame: { value: new THREE.Matrix4() },
      uMudBody: { value: 0 },
      uMudWheels: { value: 0 },
      uMudWet: { value: 1 },
      uWashed: { value: 0 },
      uCabinMin: { value: new THREE.Vector3() },
      uCabinMax: { value: new THREE.Vector3() },
      uWear: { value: 0 },
    };
    this.look = { wear: 0 }; // how worn it is, 0 new to 1 derelict (the spec's bodyWear; "Wear" on the Vehicles tab)
    const model = quad.model;
    const cabin = cabinBox(model.userData.cabin);
    this.uniforms.uCabinMin.value.set(...cabin.min);
    this.uniforms.uCabinMax.value.set(...cabin.max);
    const signals = model.userData.signalMaterials; // the indicator and reverse lenses light up, so they keep their own materials
    // A model's `cleanMaterials`: its inside (the seats, the dash, the carpet in a cab), which mud on the outside never reaches.
    const skip = new Set([model.userData.lensMaterial, model.userData.tailMaterial, ...(signals ? Object.values(signals) : []), model.getObjectByName('hazardSwitch')?.userData.mat, ...(model.userData.cleanMaterials ?? [])]);
    const bodyCopies = new Map();
    const wheelCopies = new Map();
    const bars = model.getObjectByName('handlebars');
    const wheelGroups = new Set(quad.wheels.map((w) => w.object));
    const visit = (o, wheel) => {
      // The bars, dash and rider's hands stay clean: well above the mud, and the dash changes its own materials.
      if (o === bars) return;
      if (wheelGroups.has(o)) wheel = true;
      if (o.isMesh && o.material?.isMeshStandardMaterial && !skip.has(o.material) && !o.material.emissive?.getHex()) {
        const copies = wheel ? wheelCopies : bodyCopies;
        if (!copies.has(o.material)) {
          const copy = o.material.clone();
          const kind = wearKind(o.material, { metalBody: !!model.userData.metalBody });
          patchMaterial(copy, this.uniforms, wheel, kind);
          copy.userData.wearKind = kind;
          copies.set(o.material, copy);
        }
        o.material = copies.get(o.material);
      }
      for (const c of o.children) visit(c, wheel);
    };
    visit(model, false);
    this.bodyCopies = bodyCopies; // original material -> the muddy copy the meshes really use, so others can tint it
    this.materialCount = bodyCopies.size + wheelCopies.size;
    this.frame = model.getObjectByName('bodyRoot');
    // The meshes the wear bake (vehicle/detail/wear.js) works through, in the background: everything this coat patched.
    const patched = new Set([...bodyCopies.values(), ...wheelCopies.values()]);
    this.wearBake = bakeModelSteps(model, (o) => !patched.has(o.material));
    this.wearBaked = false;
  }

  /** One piece of the wear bake; false once it's all done. */
  bakeStep() {
    if (this.wearBaked) return false;
    if (this.wearBake.next().done) this.wearBaked = true;
    return !this.wearBaked;
  }

  /** @param {{ body: number, wheels: number, wet: number }} state  0..1 each. */
  update(state) {
    const u = this.uniforms;
    u.uMudBody.value = state.body;
    u.uMudWheels.value = state.wheels;
    u.uMudWet.value = state.wet;
    u.uWashed.value = state.washed ?? 0;
    u.uWear.value = this.look.wear;
    this.frame.updateWorldMatrix(true, false);
    u.uMudFrame.value.copy(this.frame.matrixWorld).invert();
  }
}
