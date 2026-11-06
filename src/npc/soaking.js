// How wet and cold a girl is from the rain. Pure logic, no Three.js. Caught out in the rain without a coat she soaks through (the longer and
// the harder it rains the wetter), and once she is soaked she gets cold: she shivers, wants a heater, a jumper or the stove, and a warm
// place dries her. Mud is muddiness.js (the hose and a splash wet that too); this is water. The look is effects/girlMud.js, on her skin,
// her hair and her clothes; her hair dries last.

import { isOpenVehicle } from '../effects/lensMud.js';

/** Out of the rain: in the barn, the hut or a cab she has sheltered in, or aboard a vehicle with a cab or a roof (`aboardSpec` is its spec id, null on foot). */
export function underCover({ inBarn = false, inCab = false, inHut = false, aboardSpec = null }) {
  return inBarn || inCab || inHut || (aboardSpec !== null && !isOpenVehicle(aboardSpec));
}

export const DEFAULT_SOAK_PARAMS = {
  rainAbove: 0.1, // rain (0..1) above which it gets through to her
  soakRate: 0.012, // soaked a second in the hardest rain (about 80 s to be wet through)
  coatShare: 0.06, // how much of that gets past a wax jacket
  hoseRate: 0.5, // soaked a second under the hose
  dryOutside: 0.0015, // dried a second out in the open, not raining (a breeze; a long job)
  dryCovered: 0.006, // and in the barn, the hut or a cab
  dryWarm: 0.025, // and by the bonfire, the stove, a running cab's heater or an engine
  hairShare: 0.45, // her hair dries this much as fast as the rest of her
  hairSoak: 1.6, // and wets this much as fast
  coldAt: 0.35, // how soaked before she starts to feel it
  coldFloor: 0.2, // how cold she is when soaked on a mild day (against 1 on the coldest)
  jumperShare: 0.55, // how much of the cold a jumper leaves
  warmedShare: 0.15, // and being warmed (by a fire or heater, in the barn)
  noticeWet: 0.45, // how soaked before she says so
  noticeCold: 0.4, // how cold before she says so
  forgetAt: 0.12, // she is dry enough to say something again once she is below this
  remarkGap: 120, // seconds between her remarks about it
};

export const SOAK_PARAM_RANGES = {
  rainAbove: [0, 0.6, 0.01],
  soakRate: [0, 0.1, 0.001],
  coatShare: [0, 1, 0.01],
  hoseRate: [0, 2, 0.05],
  dryOutside: [0, 0.02, 0.0002],
  dryCovered: [0, 0.05, 0.0005],
  dryWarm: [0, 0.2, 0.001],
  hairShare: [0.05, 1, 0.05],
  hairSoak: [0.5, 4, 0.1],
  coldAt: [0, 0.9, 0.05],
  coldFloor: [0, 1, 0.05],
  jumperShare: [0, 1, 0.05],
  warmedShare: [0, 1, 0.05],
  noticeWet: [0.05, 1, 0.05],
  noticeCold: [0.05, 1, 0.05],
  forgetAt: [0, 0.5, 0.01],
  remarkGap: [10, 600, 10],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function createSoak() {
  return { soak: 0, hair: 0, cold: 0, noticedWet: false, noticedCold: false, sinceRemark: 1e9 };
}

/**
 * One step. `s`: the state, changed in place. `ctx`:
 *   rain: how hard it is raining where she is, 0..1 (0 under a roof or in a closed cab),
 *   coat: she has a wax jacket on, jumper: a jumper, warmed: a fire, a stove, a heater or the barn is warming her, covered: she is under a roof,
 *   chill: the day's cold where she is, 0..1, hosed: the hose is on her (0..1).
 */
export function updateSoak(s, dt, ctx, p) {
  s.sinceRemark += dt;
  const rain = ctx.rain > p.rainAbove ? ctx.rain : 0;
  const gain = rain * p.soakRate * (ctx.coat ? p.coatShare : 1) + (ctx.hosed ?? 0) * p.hoseRate;
  if (gain > 0) {
    s.soak = clamp01(s.soak + gain * (1 - s.soak * 0.3) * dt);
    s.hair = clamp01(s.hair + gain * p.hairSoak * dt);
  }
  if (gain === 0) {
    // Dries from the edges in, quicker in the warm, the hair last.
    const dry = (ctx.warmed ? p.dryWarm : ctx.covered ? p.dryCovered : p.dryOutside) * dt;
    s.soak = clamp01(s.soak - dry);
    s.hair = clamp01(s.hair - dry * p.hairShare);
    if (s.hair < s.soak) s.hair = s.soak; // her hair is never drier than the rest of her
  }
  const cold = smooth(p.coldAt, 1, s.soak) * (p.coldFloor + (1 - p.coldFloor) * clamp01(ctx.chill ?? 0));
  s.cold = clamp01(cold * (ctx.jumper ? p.jumperShare : 1) * (ctx.warmed ? p.warmedShare : 1));
  if (s.soak < p.forgetAt) s.noticedWet = false;
  if (s.cold < p.forgetAt * 0.5) s.noticedCold = false;
  return s;
}

/** Whether she has just noticed: 'wet', 'cold' or null; once per time she gets wet, and no more often than `remarkGap`. */
export function soakNoticing(s, p) {
  if (s.sinceRemark < p.remarkGap) return null;
  if (!s.noticedCold && s.cold >= p.noticeCold) return 'cold';
  if (!s.noticedWet && s.soak >= p.noticeWet) return 'wet';
  return null;
}

export function soakRemarked(s, kind) {
  if (kind === 'wet') s.noticedWet = true;
  if (kind === 'cold') s.noticedCold = s.noticedWet = true;
  s.sinceRemark = 0;
}

/** Dry her off (the debug panel's button). */
export function dryOff(s) {
  s.soak = s.hair = s.cold = 0;
  s.noticedWet = s.noticedCold = false;
  return s;
}
