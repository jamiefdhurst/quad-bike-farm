// Dust. A quad moving fast over dry stubble throws up a cloud that hangs behind it. Whoever is in it, the quad itself or one
// following, breathes it into the air filter several times faster than mud clogs it. Pure; the game says where the quads are.

import { inPlume } from '../npc/smokeSense.js';

export const DEFAULT_DUST_PARAMS = {
  maxWet: 0.25, // ground wetness (0..1) at which the dust stops altogether; it thins out from bone dry up to here
  minSpeed: 3, // m/s: slower than this it hardly lifts any
  fullSpeed: 10, // m/s: at this the cloud is at its fullest
  cloudLength: 16, // metres it trails behind a quad
  cloudWidth: 1.4, // half-width at the quad
  cloudSpread: 0.12, // metres wider per metre behind
  minLevel: 0.25, // how much dust (0..1) the girls count as a cloud worth minding
  filterBoost: 1, // how much of the full dust rate a quad in a full cloud takes, 1 being as in its own dust
  puffRate: 90, // particles a second at a full cloud
  puffSize: 1.1, // metres across when it first lifts (it grows as it spreads)
  puffLife: 3.2, // seconds before a puff has thinned away
  puffAlpha: 0.32, // how opaque a fresh puff is
};

export const DUST_PARAM_RANGES = {
  maxWet: [0, 1, 0.01],
  minSpeed: [0, 10, 0.5],
  fullSpeed: [1, 25, 0.5],
  cloudLength: [2, 40, 0.5],
  cloudWidth: [0.2, 5, 0.1],
  cloudSpread: [0, 1, 0.01],
  minLevel: [0, 1, 0.05],
  filterBoost: [0, 3, 0.05],
  puffRate: [0, 400, 5],
  puffSize: [0.2, 4, 0.1],
  puffLife: [0.5, 10, 0.1],
  puffAlpha: [0, 1, 0.01],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** How much dust a quad is throwing up, 0..1: `stubble` (0..1) under it, `wet` the ground's wetness, `speed` its ground speed in m/s. */
export function dustLevel(p, stubble, wet, speed) {
  const dry = clamp01(1 - wet / Math.max(1e-6, p.maxWet));
  const fast = clamp01((Math.abs(speed) - p.minSpeed) / Math.max(1e-6, p.fullSpeed - p.minSpeed));
  return clamp01(stubble) * dry * fast;
}

/** Whether a point is in the cloud behind a quad (x, z, yaw): straight behind it, for `cloudLength` metres, widening. */
export function inCloud(point, q, p) {
  return inPlume(point, q, { x: 0, z: 0 }, { plumeLength: p.cloudLength, plumeWidth: p.cloudWidth, plumeSpread: p.cloudSpread, calmWind: 1, pipeBehind: 0.5 });
}

/** The thickest dust a point is in from other quads' clouds, 0..1. Each of `quads` is { x, z, yaw, dust }; `self` is skipped. */
export function dustExposure(point, quads, p, self = null) {
  let worst = 0;
  for (const q of quads) {
    if (q === self || q.dust <= worst) continue;
    if (inCloud(point, q, p)) worst = q.dust;
  }
  return worst;
}
