// The neighbour's milking day (#965): twice a day her herd walks down the lane to the collecting yard, waits there while she milks, then walks
// back to the field. Pure: `milkingAt(hour)` says where in it the day is. The parlour's sounds follow it, and the herd's walk on the lane (#714)
// is to read the same phases rather than keep its own times.

export const DEFAULT_MILKING_PARAMS = {
  morning: 5.5, // hours: the herd sets off down the lane for the morning milking (#714)
  afternoon: 15.5, // hours: and for the afternoon's
  walkMinutes: 15, // minutes the walk in, and the walk back, takes
  milkMinutes: 75, // minutes from the first cow in the parlour to the last out
};

export const MILKING_PARAM_RANGES = {
  morning: [4, 8, 0.25],
  afternoon: [13, 18, 0.25],
  walkMinutes: [5, 40, 1],
  milkMinutes: [30, 150, 5],
};

/**
 * Where the milking is at `hour` (hours after midnight; past 24 wraps round): `phase` is 'walkIn', 'milking', 'walkOut' or 'none', `which`
 * the milking ('morning', 'afternoon' or null), `minutes` how far into that phase, and `sinceMilking` hours since the last milking ended
 * (0 while one runs). The herd is in the collecting yard for all of 'milking'.
 */
export function milkingAt(hour, p = DEFAULT_MILKING_PARAMS) {
  const h = ((hour % 24) + 24) % 24;
  const walk = p.walkMinutes / 60;
  const milk = p.milkMinutes / 60;
  let sinceMilking = Infinity;
  for (const which of ['morning', 'afternoon']) {
    const start = p[which];
    const t = h - start;
    if (t >= 0 && t < walk) return { phase: 'walkIn', which, minutes: t * 60, sinceMilking: 0 };
    if (t >= walk && t < walk + milk) return { phase: 'milking', which, minutes: (t - walk) * 60, sinceMilking: 0 };
    if (t >= walk + milk && t < 2 * walk + milk) return { phase: 'walkOut', which, minutes: (t - walk - milk) * 60, sinceMilking: t - walk - milk };
    const end = start + walk + milk;
    const since = (((h - end) % 24) + 24) % 24;
    sinceMilking = Math.min(sinceMilking, since);
  }
  return { phase: 'none', which: null, minutes: 0, sinceMilking };
}
