// Frost on a quad's seat on a freezing day (Weather.frost): white until someone sits on it, when their warmth takes it off over a few
// seconds. Pure logic; quad.js tints the seat material from it.

export const DEFAULT_FROST_PARAMS = {
  clearSeconds: 4, // seconds someone sat on a frosted seat takes to clear it
  frostColour: 0xdfe9ee, // the frost, a bluish white
  frostRoughness: 0.9, // frost is matte
  bumpScale: 1.2, // how coarse the ice grain looks at full frost
  glow: 0x1c2428, // the faint cold light of frost, so it reads in the shade (scaled by the frost)
};

export const FROST_PARAM_RANGES = {
  clearSeconds: [0.5, 20, 0.5],
};

/** The frost left after dt seconds: it clears while the seat is sat on and otherwise stays. */
export function frostAfter(frost, occupied, dt, P = DEFAULT_FROST_PARAMS) {
  return occupied ? Math.max(0, frost - dt / P.clearSeconds) : frost;
}

const mix = (a, b, t) => {
  const ch = (c, s) => (c >> s) & 255;
  return [16, 8, 0].reduce((out, s) => out | (Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t) << s), 0);
};

/** The seat colour under this much frost (0 bare, 1 white over). */
export function frostedColour(base, frost, P = DEFAULT_FROST_PARAMS) {
  return mix(base, P.frostColour, Math.min(1, Math.max(0, frost)));
}
