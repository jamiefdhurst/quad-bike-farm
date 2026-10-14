// Dozing in the sun: a girl whose sleep need is up (needs.js) sits on the straw bales on a warm afternoon, nods off, and is woken
// gently (you talk to her), rudely (a rev, a horn, a bang near her) or by herself when she has slept enough or the sun goes in.
// Pure: places.js offers it, companionResting.js poses it, and this says when and how she wakes and how her head nods.

export const DEFAULT_DOZE_PARAMS = {
  dozeSunAbove: 0.45, // how bright and warm (0..1) the afternoon must be before she'll doze outside
  dozeDropSeconds: 7, // seconds sat nodding before she's properly asleep
  dozeStayMin: 90, // seconds she dozes for at most, if nothing wakes her and she isn't rested first
  dozeStayMax: 240,
  dozeWakeBelow: 0.08, // she wakes of her own accord once her sleep need is down to this
  dozeSnoreRange: 6, // metres you have to be within to hear her breathing
  dozeStartledFavour: 3, // favour lost with the girl you wake rudely, if she minds (Amy)
  dozeStartledSulk: 30, // and seconds of sulking after it
};

export const DOZE_PARAM_RANGES = {
  dozeSunAbove: [0, 1, 0.01],
  dozeDropSeconds: [1, 30, 1],
  dozeStayMin: [10, 600, 5],
  dozeStayMax: [10, 900, 5],
  dozeWakeBelow: [0, 0.5, 0.01],
  dozeSnoreRange: [1, 20, 0.5],
  dozeStartledFavour: [0, 10, 0.5],
  dozeStartledSulk: [0, 120, 5],
};

/** How near (metres) each kind of notice has to be to wake her from asleep, and how strong it has to be. */
export const WAKERS = {
  rev: { within: 14 },
  engineStart: { within: 10 },
  backfire: { within: 60 },
  pop: { within: 5 },
  horn: { within: 40 },
  bang: { within: 60 },
  tipped: { within: 40 },
  lurch: { within: 6 },
  zap: { within: 25 },
  thunder: { within: 400, minStrength: 0.9 },
  jump: { within: 8 },
};

/** Whether this notice (attention.js: { kind, strength }) wakes her from `distance` away. Drowsy she is lighter and wakes to anything in range. */
export function wakesHer(notice, distance, asleep = true) {
  const w = WAKERS[notice.kind];
  if (!w) return false;
  if ((notice.strength ?? 1) < (w.minStrength ?? 0)) return false;
  return distance <= w.within * (asleep ? 1 : 1.5);
}

/** Why she'd wake now by herself, or null: 'rested', 'time' (her stay is up), or 'sun' (it's gone in, or dark, or raining). */
export function wakesOf({ sleep, stayLeft, sunny }, p) {
  if (!sunny) return 'sun';
  if (sleep <= p.dozeWakeBelow) return 'rested';
  if (stayLeft <= 0) return 'time';
  return null;
}

/** How long she doses for at most. */
export function dozeStay(p, random = Math.random) {
  return p.dozeStayMin + random() * Math.max(0, p.dozeStayMax - p.dozeStayMin);
}

/**
 * Her head and back at `t` seconds into dozing, `k` (0..1) how far gone she is: { headDown, spinePitch }. Drowsy she nods
 * (down, a jerk back up, down again); asleep her head hangs, with a slow breathing swell and now and then a little start.
 */
export function dozePose(t, k, drop) {
  const nod = t < drop ? Math.max(0, Math.sin(t * 1.3)) ** 2 * (0.2 + 0.5 * (t / drop)) : 0;
  const asleep = t < drop ? 0 : Math.min(1, (t - drop) / 3);
  const breath = Math.sin(t * 1.7) * 0.03 * asleep;
  const bob = Math.sin(t * 0.37) > 0.96 ? Math.sin(t * 9) * 0.05 * asleep : 0; // a snort and a little start, now and then
  const headDown = (nod + asleep * (0.75 + breath) + bob) * k;
  return { headDown, spinePitch: (0.06 * asleep + 0.1 * nod * 0.3 + breath * 0.5) * k };
}

/** Her breathing: seconds per breath, and where in it she is (0..1: in for the first 40%, out for the rest) at `t`. */
export const BREATH_SECONDS = 3.6;
export const breathPhase = (t) => (t / BREATH_SECONDS) % 1;
