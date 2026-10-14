import { WEAR_DIST_RANGE } from '../vehicle/detail/wear.js';

// The wear layer (TODO 87): scuffed paint and whitened plastic along a vehicle's sharp edges, sun-faded colour, rust in the folds
// of its metal and dried mud and grime in its nooks. It reads the attributes `vehicle/detail/wear.js` bakes and the vehicle's
// `uWear` (0 new, 1 derelict), and is spliced into the mud coat's shader (mudCoat.js) so the mud can sit deeper in the same nooks.
// Until a mesh is baked its attributes read as zero and it shows only the fading.

export const WEAR_KINDS = ['finish', 'painted', 'metal', 'rubber'];

/**
 * Which way a material wears: 'rubber' (perishes and greys), 'metal' (bare or plated: rust in the folds, bright worn edges),
 * 'painted' (painted metal: chips to grey steel at the edges, rust in the folds) or 'finish' (plastic or vinyl: fades chalky and
 * whitens where scuffed, grime in the folds). `metalBody` says the vehicle's coloured panels are painted steel, not plastic.
 */
export function wearKind(material, { metalBody = false } = {}) {
  const metal = material.metalness ?? 0;
  if (metal >= 0.5) return 'metal';
  if (metal >= 0.3) return 'painted';
  const c = material.color;
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  if (max < 0.05 && (material.roughness ?? 0.5) >= 0.85) return 'rubber';
  return metalBody && max - min > 0.08 ? 'painted' : 'finish';
}

export const WEAR_VERTEX_DECL = /* glsl */ `
  attribute vec3 wearCrease;
  attribute vec3 wearDist;
  attribute float wearNook;
  varying vec3 vWearCrease;
  varying vec3 vWearDist;
  varying float vWearNook;
`;

export const WEAR_VERTEX = /* glsl */ `
  vWearCrease = wearCrease;
  vWearDist = wearDist * ${WEAR_DIST_RANGE.toFixed(1)};
  vWearNook = wearNook;
`;

export const WEAR_FRAGMENT_DECL = /* glsl */ `
  uniform float uWear;
  varying vec3 vWearCrease;
  varying vec3 vWearDist;
  varying float vWearNook;
`;

/**
 * The colour part, after the base colour is known and before the mud goes on. Leaves `wearScuff`, `wearRust` and `wearNook` (all
 * 0..1) for the roughness and metalness parts and for the mud. Needs `mudNoise` and `vMudPos` (the mud coat's).
 */
export function wearColourGlsl(kind) {
  const k = WEAR_KINDS.indexOf(kind);
  return /* glsl */ `
  float wearScuff = 0.0;
  float wearRust = 0.0;
  float wearNook = 0.0;
  {
    // How near this point is to a convex edge and to a concave fold, from each side of its triangle.
    float edgeBand = 0.003 + 0.012 * uWear;
    float foldBand = 0.006 + 0.02 * uWear;
    float convex = 0.0;
    float concave = 0.0;
    for (int i = 0; i < 3; i++) {
      float c = vWearCrease[i];
      convex = max(convex, max(c, 0.0) * (1.0 - smoothstep(0.0, edgeBand, vWearDist[i])));
      concave = max(concave, max(-c, 0.0) * (1.0 - smoothstep(0.0, foldBand, vWearDist[i])));
    }
    wearNook = max(concave, vWearNook);
    // Chips and scratches, never a clean line.
    float chip = mudNoise(vMudPos * 140.0) * 0.55 + mudNoise(vMudPos * 31.0) * 0.45;
    wearScuff = smoothstep(chip - 0.08, chip + 0.08, convex * (0.25 + 0.9 * uWear)) * step(0.001, uWear);
    float patchy = mudNoise(vMudPos * 4.0);
    float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    #if ${k} == 0
      // Plastic and vinyl: sun-faded towards chalky, whitened where scuffed, grime in the folds.
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum) * 1.15 + 0.05, uWear * (0.25 + 0.2 * patchy));
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.6 + 0.12, wearScuff * 0.7);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.1, 0.07), wearNook * min(1.0, 0.25 + uWear) * 0.8);
    #elif ${k} == 1
      // Painted steel: faded, chipped to grey metal at the edges, rust starting in the folds and creeping out in patches.
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum) * 1.05 + 0.03, uWear * (0.15 + 0.15 * patchy));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.33, 0.32, 0.31), wearScuff * 0.85);
      wearRust = clamp(wearNook * (0.2 + 1.1 * uWear) + wearScuff * uWear * 0.6, 0.0, 1.0);
      wearRust *= smoothstep(0.25, 0.6, mudNoise(vMudPos * 47.0) + wearRust * 0.5);
    #elif ${k} == 2
      // Bare or plated metal: bright where rubbed, rust in the folds, a bloom of surface rust when it's really old.
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.25 + 0.04, wearScuff * 0.5);
      wearRust = clamp(wearNook * (0.15 + 1.0 * uWear) + smoothstep(0.55, 0.95, patchy) * max(0.0, uWear - 0.5) * 1.4, 0.0, 1.0);
      wearRust *= smoothstep(0.25, 0.6, mudNoise(vMudPos * 47.0) + wearRust * 0.5);
      wearScuff = 0.0;
    #else
      // Rubber: perishes towards a dull grey-brown.
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.12, 0.105), uWear * 0.45 * (0.6 + 0.4 * patchy));
      wearScuff = 0.0;
    #endif
    vec3 rust = mix(vec3(0.36, 0.17, 0.07), vec3(0.2, 0.09, 0.04), mudNoise(vMudPos * 19.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, rust, wearRust);
  }
`;
}

/** After `roughnessmap_fragment`: rust and scuffs are matt. */
export const WEAR_ROUGHNESS = /* glsl */ `
  roughnessFactor = mix(roughnessFactor, 0.92, max(wearRust, wearScuff * 0.6));
`;

/** After `metalnessmap_fragment`: rust isn't shiny metal; a paint chip is. */
export const WEAR_METALNESS = /* glsl */ `
  metalnessFactor = mix(metalnessFactor, 0.0, wearRust);
`;
