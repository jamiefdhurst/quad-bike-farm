// Frost on a quad's seat on a freezing day (Weather.frost): white until someone sits on it, when their warmth takes it off over a few
// seconds. As the day warms it thaws, and as the night cools it forms again on a seat nobody is sat on. Pure logic; quad.js tints the
// seat material from it.

export const DEFAULT_FROST_PARAMS = {
  clearSeconds: 4, // seconds someone sat on a frosted seat takes to clear it
  formSeconds: 240, // seconds for frost to cover a bare seat once the night is cold enough for it
  thawSeconds: 150, // seconds for a white seat to thaw once the day has warmed past frost
  frostColour: 0xdfe9ee, // the frost, a bluish white
  frostRoughness: 0.9, // frost is matte
  bumpScale: 1.2, // how coarse the ice grain looks at full frost
  glow: 0x1c2428, // the faint cold light of frost, so it reads in the shade (scaled by the frost)
};

export const FROST_PARAM_RANGES = {
  clearSeconds: [0.5, 20, 0.5],
  formSeconds: [10, 1200, 10],
  thawSeconds: [10, 1200, 10],
};

/**
 * The frost left after dt seconds: it clears while the seat is sat on; otherwise it creeps towards the day's frost now (`day`,
 * Weather.frost), forming as the night cools and thawing as the day warms. With `day` left out it stays.
 */
export function frostAfter(frost, occupied, dt, P = DEFAULT_FROST_PARAMS, day = null) {
  if (occupied) return Math.max(0, frost - dt / P.clearSeconds);
  if (day === null) return frost;
  return day > frost ? Math.min(day, frost + dt / P.formSeconds) : Math.max(day, frost - dt / P.thawSeconds);
}

const mix = (a, b, t) => {
  const ch = (c, s) => (c >> s) & 255;
  return [16, 8, 0].reduce((out, s) => out | (Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t) << s), 0);
};

/** The seat colour under this much frost (0 bare, 1 white over). */
export function frostedColour(base, frost, P = DEFAULT_FROST_PARAMS) {
  return mix(base, P.frostColour, Math.min(1, Math.max(0, frost)));
}
