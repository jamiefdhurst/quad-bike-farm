// The yard's own sound (#817): the loose tin on the barn's roof and its gutter rattling in the wind, and a tap dripping into a bucket, heard in the yard and
// fading over `YARD_FADE` m beyond the concrete, silent inside the barn (its own sounds are the barn's). Pure: where you are in, how loud and how often; the audio is
// `EngineAudio.setYard`, which follows the way `rainHeard` (barn.js) feeds the rain on the tin.

/** Metres beyond the slab's edge over which the yard's sound fades out. */
export const YARD_FADE = 14;

/** 0..1: how much of the yard's bed to play for a listener at (x, z), `indoor` (0..1) how far inside the barn they are: 1 on the concrete, fading to 0 `YARD_FADE` m outside it. */
export function yardHeard(layout, x, z, indoor = 0, fade = YARD_FADE) {
  const s = layout.farmstead?.slab;
  if (!s) return 0; // today's farm has no yard of its own
  const dx = Math.max(s.minX - x, 0, x - s.maxX);
  const dz = Math.max(s.minZ - z, 0, z - s.maxZ);
  const out = Math.hypot(dx, dz);
  const near = Math.max(0, 1 - out / fade);
  return near * (1 - Math.min(1, Math.max(0, indoor)));
}

/**
 * What to play for `level` (`yardHeard`), the wind (0..1) and the rain (0..1): `tin` the rattle's share (it rises with the wind and a little with rain on it) and
 * `dripEvery` the seconds between drips (a tap that drips every few seconds, faster once the gutter is running), Infinity when the yard is out of earshot.
 */
export function yardBed(level, wind, rain) {
  const w = Math.min(1, Math.max(0, wind));
  const r = Math.min(1, Math.max(0, rain));
  return {
    tin: level * (0.15 + 0.85 * w) * (1 + 0.4 * r),
    dripEvery: level < 0.02 ? Infinity : 3.2 - 2.4 * r,
  };
}
