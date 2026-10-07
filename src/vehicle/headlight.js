// What a headlamp looks like. The old quads' lights run straight off the engine: dim and yellow at idle, bright when it's revved,
// flickering when the engine runs rough, faint while the starter turns it and out when it stalls. The loan quad (and the tractor) have a
// battery, so theirs are steady. Pure logic, so it is tested without Three.js; `setHeadlights` (quadModel.js) applies it.

export const DEFAULT_HEADLIGHT_PARAMS = {
  idleLevel: 0.3, // brightness at idle (1 is full)
  fullAt: 0.55, // how far up the rev range (0 idle, 1 flat out) it is at full brightness
  crankLevel: 0.15, // faint while the starter turns it over
  flickerFrom: 0.2, // roughness (plus erratic) above which the light starts to flicker
  flickerSpan: 0.6, // how far above that it is at its worst
  flickerDepth: 0.7, // how far it dips at its worst
  flickerRate: 16, // flicker speed, rad/s
  warmColour: 0xffb347, // dim: yellow
  coolColour: 0xfff2cc, // bright: nearly white
};

export const HEADLIGHT_PARAM_RANGES = {
  idleLevel: [0, 1, 0.01],
  fullAt: [0.05, 1, 0.01],
  crankLevel: [0, 1, 0.01],
  flickerFrom: [0, 1, 0.01],
  flickerSpan: [0.05, 1, 0.01],
  flickerDepth: [0, 1, 0.01],
  flickerRate: [1, 60, 1],
};

export const HEADLIGHT_PARAMS = { ...DEFAULT_HEADLIGHT_PARAMS }; // shared by every quad, registered once in the tuning panel

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

const mixColour = (a, b, t) => [16, 8, 0].reduce((out, s) => out | (Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t) << s), 0);

/**
 * @param {object} s
 * @param {boolean} s.keyOn      the light switch is on (the key, here)
 * @param {boolean} s.running
 * @param {boolean} s.cranking
 * @param {number} s.rpm
 * @param {number} s.idle        warm idle rpm
 * @param {number} s.max         full-throttle rpm
 * @param {number} s.roughness   engine roughness, 0..1
 * @param {number} s.erratic     0..1
 * @param {boolean} s.steady     has a battery: the light doesn't follow the engine
 * @param {number} s.time        seconds, for the flicker
 * @returns {{ level: number, colour: number }}  level 0..1 of the lamp's full brightness
 */
export function headlightLook(s, P = HEADLIGHT_PARAMS) {
  if (!s.keyOn) return { level: 0, colour: P.coolColour };
  if (s.steady) return { level: 1, colour: P.coolColour };
  if (s.cranking && !s.running) return { level: P.crankLevel, colour: P.warmColour };
  if (!s.running) return { level: 0, colour: P.warmColour }; // stalled: the magneto has nothing to give
  const t = clamp((s.rpm - s.idle) / Math.max(1, (s.max - s.idle) * P.fullAt), 0, 1);
  let level = P.idleLevel + (1 - P.idleLevel) * t;
  const rough = clamp((s.roughness + s.erratic - P.flickerFrom) / P.flickerSpan, 0, 1);
  if (rough > 0) {
    // Two wobbles that don't line up, so it stutters rather than pulses.
    const wobble = 0.5 + 0.25 * Math.sin(s.time * P.flickerRate) + 0.25 * Math.sin(s.time * P.flickerRate * 1.73 + 1.3);
    level *= 1 - P.flickerDepth * rough * wobble * wobble;
  }
  return { level, colour: mixColour(P.warmColour, P.coolColour, t) };
}
