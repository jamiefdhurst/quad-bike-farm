// The throttle and brake on keys. A key is either down or up, but a twist-grip or a lever isn't snatched wide open: holding the key
// squeezes it in from `start` to full over `rise` seconds, and letting go releases it at once (a throttle springs shut). A tap is a
// little and holding it is the lot. Pure; the quad steps one for each pedal for whoever is at the controls on the keyboard (the girls
// set their own throttle and brake).

export const DEFAULT_THROTTLE_KEY_PARAMS = {
  start: 0.25, // how much throttle the first instant of a press gives (0..1)
  rise: 1.2, // seconds from that to full throttle while the key is held
};

export const DEFAULT_BRAKE_KEY_PARAMS = {
  start: 0.3, // how much brake the first instant of a press gives (0..1)
  rise: 1, // seconds from that to full brake while the key is held
};

export const PEDAL_KEY_PARAM_RANGES = {
  start: [0, 1, 0.05],
  rise: [0, 3, 0.05],
};

/** How far the pedal is in (0..1) after `dt` seconds, from `level` now and whether its key is held. */
export function stepPedalKey(level, held, dt, p) {
  if (!held) return 0;
  if (level <= 0) return Math.max(p.start, p.rise <= 0 ? 1 : 0);
  if (p.rise <= 0) return 1;
  return Math.min(1, level + ((1 - p.start) / p.rise) * dt);
}
