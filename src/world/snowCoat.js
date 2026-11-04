// Snow on everything that faces up, not only the ground (#95): roofs, the tops of walls, rails and posts, hedges, branches, props, the
// outer ring and a parked vehicle. The ground has its own in the terrain shader (terrain.js); this is the same white laid over the
// world's other lit materials by a patch to their shader, so one weather value (`cover`, weather.js) whitens all of it.
//
// Pure apart from the shader strings: `SnowLook` and `vehicleSnowAfter` take numbers, `coatable` takes a plain description of a mesh,
// and `coatMaterial` only edits the material it is given.

export const DEFAULT_SNOW_COAT_PARAMS = {
  topsRate: 1.45, // how much sooner roofs, hedge tops and branches whiten than the ground does (their cover is the ground's times this)
  holdEdge: 0.3, // how upright a surface can be, as the up-part of its normal, before snow stops lying on it (0 would hold it on walls)
  wetEase: 45, // seconds the damp look of melting takes to come and to go
  wetMeltRate: 0.0012, // cover lost a second that counts as a full melt (a mild day at 8 degrees loses 0.0025)
  carSettle: 90, // seconds of heavy snow to cover a vehicle standing in it
  carShedSpeed: 3, // m/s: faster than this and a vehicle's snow slides off at the full rate; half of it sheds at half the rate
  carShedSeconds: 6, // seconds at that speed to clear a vehicle
  carWarmSeconds: 150, // seconds for a vehicle standing indoors to lose its snow
  indoorRoof: 2.4, // m: a mesh under a roof and lower than this is indoors (a floor, a bench, a bale) and gets no snow
};

export const SNOW_COAT_PARAM_RANGES = {
  topsRate: [1, 2.5, 0.05],
  holdEdge: [0, 0.8, 0.01],
  wetEase: [5, 200, 1],
  wetMeltRate: [0.0002, 0.005, 0.0001],
  carSettle: [20, 400, 5],
  carShedSpeed: [0.5, 10, 0.1],
  carShedSeconds: [1, 30, 0.5],
  carWarmSeconds: [20, 600, 10],
  indoorRoof: [1.5, 4, 0.1],
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** How far the tops of things are under snow when the ground is under `cover`: they whiten sooner and are the last to go. */
export function topsCover(cover, p = DEFAULT_SNOW_COAT_PARAMS) {
  return clamp01(cover * p.topsRate);
}

/**
 * What the world's snow looks like now: `tops` (the shader's cover for roofs and the rest) and `wet`, how much the bare surfaces left by
 * a melt show dark and damp. It melts when the ground's cover is falling, fast on a mild day and faster in rain, and the damp fades once it stops.
 */
export class SnowLook {
  constructor(params = DEFAULT_SNOW_COAT_PARAMS) {
    this.p = params;
    this.tops = 0;
    this.wet = 0;
    this.lastCover = null;
  }

  update(dt, cover) {
    const p = this.p;
    this.tops = topsCover(cover, p);
    if (this.lastCover === null) this.lastCover = cover; // the first frame has nothing to compare with
    const lost = dt > 0 ? Math.max(0, this.lastCover - cover) / dt : 0;
    this.lastCover = cover;
    const target = cover > 0.02 ? clamp01(lost / p.wetMeltRate) : 0;
    this.wet += (target - this.wet) * (1 - Math.exp(-dt / Math.max(1, p.wetEase)));
    if (this.wet < 0.001) this.wet = 0;
  }
}

/**
 * A vehicle's own snow, 0..1. It settles while it snows and the vehicle is out in it, can't be more than the tops have, goes when the
 * snow melts, slides off as it moves, and thaws indoors. `c`: `snow` falling 0..1, `cover` the ground's, `speed` m/s, `indoors`.
 */
export function vehicleSnowAfter(level, dt, c, p = DEFAULT_SNOW_COAT_PARAMS) {
  const ceiling = topsCover(c.cover, p);
  let v = level;
  if (c.indoors) v -= dt / p.carWarmSeconds;
  else if (c.snow > 0.05) v += (c.snow * dt) / p.carSettle;
  v = Math.min(v, ceiling);
  const slide = clamp01((c.speed - p.carShedSpeed * 0.3) / (p.carShedSpeed * 0.7));
  v -= (slide * dt) / p.carShedSeconds;
  return clamp01(v);
}

/**
 * Whether a mesh should take snow. `mesh`: `{ skinned, owned, indoors }` and the material's `kind` ('standard', 'lambert', 'phong' or
 * other), `transparent`, `emissive` (it gives light). Glass, water, decals, lamps, the girls and the ground (which has its own) get none.
 */
export function coatable({ kind, skinned = false, owned = false, indoors = false, transparent = false, emissive = false }) {
  if (skinned || owned || indoors || transparent || emissive) return false;
  return kind === 'standard' || kind === 'lambert' || kind === 'phong';
}

/** The kind of material, for `coatable`. */
export function materialKind(m) {
  if (m.isMeshStandardMaterial) return 'standard';
  if (m.isMeshLambertMaterial) return 'lambert';
  if (m.isMeshPhongMaterial) return 'phong';
  return 'other';
}

const FRAG_HEAD = `
uniform float uSnowTops;
uniform float uSnowWet;
uniform float uSnowEdge;
varying vec3 vSnowPos;
float snowHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float snowNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(snowHash(i), snowHash(i + vec3(1,0,0)), f.x), mix(snowHash(i + vec3(0,1,0)), snowHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(snowHash(i + vec3(0,0,1)), snowHash(i + vec3(1,0,1)), f.x), mix(snowHash(i + vec3(0,1,1)), snowHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;

/** The fragment block: whitens what faces up (patchily at first), then darkens the rest where a melt has left it wet. */
function fragBlock(pbr) {
  return `#include <normal_fragment_maps>
{
  vec3 snowN = inverseTransformDirection(normal, viewMatrix);
  float snowUp = smoothstep(uSnowEdge, uSnowEdge + 0.45, snowN.y);
  float n1 = snowNoise(vSnowPos * 0.8);
  float n2 = snowNoise(vSnowPos * 5.3);
  float snowPatch = n1 * 0.6 + n2 * 0.4;
  float snowLay = smoothstep(0.0, 0.3, uSnowTops * 1.6 - (snowPatch - 0.2) * 1.0);
  float snowAmt = snowLay * snowUp;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.98) * (0.94 + 0.1 * n2), snowAmt * 0.94);
  float snowDamp = uSnowWet * (1.0 - snowAmt) * smoothstep(0.3, 0.7, n1 + 0.25 * (1.0 - snowN.y));
  diffuseColor.rgb *= 1.0 - 0.3 * snowDamp;${
    pbr
      ? `
  roughnessFactor = mix(roughnessFactor, 0.85, snowAmt * 0.7);
  roughnessFactor = mix(roughnessFactor, 0.35, snowDamp * 0.6);
  metalnessFactor *= 1.0 - snowAmt;`
      : ''
  }
}`;
}

/** The shader's three uniforms, for a group of meshes that whiten together: the cover on their tops, the damp of a melt and the steepest surface that holds snow. */
export function snowUniforms(p = DEFAULT_SNOW_COAT_PARAMS) {
  return { uSnowTops: { value: 0 }, uSnowWet: { value: 0 }, uSnowEdge: { value: p.holdEdge } };
}

/**
 * Lays the snow shader over `material`, after whatever patch it already has. `uniforms`: from `snowUniforms`, shared by
 * everything that should whiten together. Returns false (and leaves it alone) if it has already been coated or its shader isn't one we know.
 */
export function coatMaterial(material, uniforms, p = DEFAULT_SNOW_COAT_PARAMS) {
  if (material.userData?.snowCoat) return false;
  const kind = materialKind(material);
  if (kind === 'other') return false;
  material.userData = material.userData ?? {};
  material.userData.snowCoat = true;
  const prior = material.onBeforeCompile;
  // The cache key stands for every patch before ours (three's own default is the patch function's source, which ours would hide).
  const baseKey = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
  material.onBeforeCompile = (shader, renderer) => {
    prior?.call(material, shader, renderer);
    const vs = shader.vertexShader;
    const fs = shader.fragmentShader;
    if (!vs.includes('#include <project_vertex>') || !fs.includes('#include <normal_fragment_maps>')) return;
    shader.uniforms.uSnowTops = uniforms.uSnowTops;
    shader.uniforms.uSnowWet = uniforms.uSnowWet;
    shader.uniforms.uSnowEdge = uniforms.uSnowEdge;
    shader.vertexShader = vs
      .replace('#include <common>', '#include <common>\nvarying vec3 vSnowPos;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
{
  vec4 snowWp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  snowWp = instanceMatrix * snowWp;
  #endif
  vSnowPos = (modelMatrix * snowWp).xyz;
}`,
      );
    shader.fragmentShader = fs.replace('#include <common>', `#include <common>${FRAG_HEAD}`).replace('#include <normal_fragment_maps>', fragBlock(kind === 'standard'));
  };
  material.customProgramCacheKey = () => `${baseKey}|snow${kind}`;
  material.needsUpdate = true;
  return true;
}
