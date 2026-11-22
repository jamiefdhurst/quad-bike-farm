// The Moor's sound (#821): the wind is always stronger up on the open common, and curlews and skylarks call over it in spring. Pure: where you are and the date in,
// how much of each out; the audio is `EngineAudio.setMoor` (`audio/moorAudio.js`), which follows the way `yardHeard` (yardBed.js) feeds the yard's tin.

/** Metres east of the lane over which the Moor's sound fades out, on the farm's side of it. */
export const MOOR_FADE = 40;

/** Farm months (0 for January) the curlews and skylarks are calling: March to June (the larks sing on into July). */
export const CURLEW_MONTHS = [2, 5];
export const LARK_MONTHS = [2, 6];

/** 0..1: how much of the Moor's open sky to play for a listener at (x, z): 1 on the common, fading to 0 over `fade` m past the lane's edge (`moor.laneEdge`), or past its north and south ends. */
export function moorHeard(moor, x, z, fade = MOOR_FADE) {
  if (!moor) return 0; // today's farm has no Moor
  const b = moor.bounds;
  const east = Math.max(0, x - moor.laneEdge(z));
  const ends = Math.max(b.minZ - z, 0, z - b.maxZ);
  const west = Math.max(0, b.minX - x);
  return Math.max(0, 1 - Math.hypot(east, ends, west) / fade);
}

const inMonths = ([a, b], month) => month >= a && month <= b;

/** How much the birds are calling on this date and at this darkness (0 night, 1 full dark): none out of season, fewer at dusk and none at night. */
export function moorBirds(date, darkness = 0) {
  const day = 1 - Math.min(1, Math.max(0, (darkness - 0.2) / 0.4));
  return { curlew: inMonths(CURLEW_MONTHS, date.month) ? day : 0, lark: inMonths(LARK_MONTHS, date.month) ? day : 0 };
}

/**
 * What to play for `level` (`moorHeard`), `birds` (`moorBirds`) and the weather's wind (0..1): `wind` the extra share of wind (never none, even in a calm: the Moor is open),
 * and `curlewEvery` and `larkEvery`, the seconds between their calls, Infinity when out of earshot or season.
 */
export function moorBed(level, birds, wind) {
  const w = Math.min(1, Math.max(0, wind));
  const heard = level > 0.05;
  return {
    wind: level * (0.5 + 0.5 * w),
    curlewEvery: heard && birds.curlew > 0.05 ? 14 / birds.curlew : Infinity,
    larkEvery: heard && birds.lark > 0.05 ? 9 / birds.lark : Infinity,
  };
}
