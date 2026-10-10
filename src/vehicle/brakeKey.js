// The brake on a key. A key is either down or up, but a lever isn't snatched full on: holding the brake key squeezes it in from
// `start` to full over `rise` seconds, and letting go releases it at once. A tap is a little brake and holding it is a proper stop.
// Pure; the quad steps it each frame for whoever is at the controls on the keyboard (the girls set their own brake).

export const DEFAULT_BRAKE_KEY_PARAMS = {
  start: 0.35, // how much brake the first instant of a press gives (0..1)
  rise: 0.6, // seconds from that to full brake while the key is held
};

export const BRAKE_KEY_PARAM_RANGES = {
  start: [0, 1, 0.05],
  rise: [0, 3, 0.05],
};

/** The brake (0..1) after `dt` seconds, from `level` now and whether the key is held. */
export function stepBrakeKey(level, held, dt, p = DEFAULT_BRAKE_KEY_PARAMS) {
  if (!held) return 0;
  if (level <= 0) return Math.max(p.start, p.rise <= 0 ? 1 : 0);
  if (p.rise <= 0) return 1;
  return Math.min(1, level + ((1 - p.start) / p.rise) * dt);
}
