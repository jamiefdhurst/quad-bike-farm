// The night sky's stars and moon, for a time of day and a phase. Pure; sky.js draws them and daylight.js's skyAt lends them to the
// light. The moon keeps the sun's arc in miniature: it rises in the east, crosses the south and sets in the west, twelve hours up, but
// its rise slips later with its phase, so a full moon comes up at sunset (right for riding home by), a half one near midnight and a
// new one is up with the sun and not seen at all.

export const MOON_PHASE_NAMES = ['new', 'waxing crescent', 'first quarter', 'waxing gibbous', 'full', 'waning gibbous', 'last quarter', 'waning crescent'];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** The name of a phase (0 new, 0.5 full, back to 1 new). */
export function moonPhaseName(phase) {
  const i = Math.round((((phase % 1) + 1) % 1) * 8) % 8;
  return MOON_PHASE_NAMES[i];
}

/** How much of the moon's face is lit: 0 at new, 1 at full. */
export function moonIllumination(phase) {
  return 0.5 - 0.5 * Math.cos(2 * Math.PI * phase);
}

/**
 * The moon at `hour` (hours after midnight, past 24 is the same night going on) in phase `phase`: { elevation (radians, negative below
 * the horizon), dir ({ x, y, z } towards it, north -z and east +x as in daylight.js), up (0..1, fading in as it clears the horizon),
 * illumination }. `high` is how far up it gets (radians).
 */
export function moonAt(hour, phase, high = 0.75) {
  const t = ((((hour - phase * 24 - 6) % 24) + 24) % 24) / 12; // 0 at moonrise, 1 at moonset, then below the horizon until 2
  const elevation = t <= 1 ? high * Math.sin(Math.PI * t) : -0.5 * Math.sin(Math.PI * (t - 1));
  const azimuth = -Math.PI / 2 + Math.PI * t; // on round under the ground to the east again, so the direction never jumps
  const ce = Math.cos(elevation);
  return {
    elevation,
    dir: { x: -Math.sin(azimuth) * ce, y: Math.sin(elevation), z: Math.cos(azimuth) * ce },
    up: smoothstep(-0.02, 0.12, elevation),
    illumination: moonIllumination(phase),
  };
}

/**
 * How many stars show (0..1): none by day, all of them in full dark, fewer under cloud (a thick overcast hides them), and washed out by
 * a bright moon.
 */
export function starLevel(night, cloudCover, moon) {
  const dark = smoothstep(0.55, 0.95, night);
  const clear = 1 - smoothstep(0.25, 0.85, cloudCover ?? 0.5);
  const wash = 1 - 0.55 * moon.up * moon.illumination;
  return dark * clear * wash;
}

/** How bright the moon's disc is drawn (0..1): up, and in the dark of the sky (it is not drawn in the daytime). */
export function moonDisc(night, moon) {
  return smoothstep(0.35, 0.8, night) * moon.up;
}

/**
 * The night light's strength as a multiple of `moonLight`: a floor of starlight and sky glow, and up to `boost` more from a bright
 * moon that is up. Cloud takes most of the moon's share.
 */
export function moonlightFactor(moon, cloudCover, boost = 0.9, floor = 0.7) {
  const clear = 1 - 0.7 * clamp01(cloudCover ?? 0.5);
  return floor + boost * moon.up * moon.illumination * clear;
}
