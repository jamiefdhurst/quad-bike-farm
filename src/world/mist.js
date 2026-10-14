// Ground mist and rainbows. On a damp, still, cool morning mist lies in the north field's hollow, where the wet collects, and burns
// off as the sun climbs and the day warms; a shower that passes while the sun is out can leave a rainbow opposite the sun.
// Pure logic: the game says what the day is like; this keeps the mist level and the rainbow's strength, and works out where the arc is.

export const DEFAULT_MIST_PARAMS = {
  chance: 0.6, // how many games have a mist morning at all (a dew drawn from the seed, so ?seed=N repeats it)
  fullUntil: 1, // hours after sunrise that it stays at its thickest
  burnHours: 2.5, // hours after that it takes to burn off on a day that is cool all through
  warmBurn: 0.5, // a warm day burns it off this much sooner (0.5 is half the time at 20 degrees)
  coolBelow: 14, // degrees C: it forms in air cooler than this
  coolFull: 4, // and is thickest at this
  windClears: 1.2, // the weather's wind multiplier at which it is blown away (0.3 foggy, 1 overcast)
  rainClears: 0.3, // rain at which it is gone
  dampWeight: 0.4, // how much a wet ground adds to a dew (the rest is the dew itself)
  rise: 90, // seconds for it to form fully
  fall: 120, // seconds for it to clear
  maxOpacity: 0.34, // of each blob at full level
};

export const MIST_PARAM_RANGES = {
  chance: [0, 1, 0.05],
  fullUntil: [0, 4, 0.25],
  burnHours: [0.25, 8, 0.25],
  warmBurn: [0, 0.9, 0.05],
  coolBelow: [4, 25, 0.5],
  coolFull: [-5, 12, 0.5],
  windClears: [0.3, 3, 0.05],
  rainClears: [0.05, 1, 0.05],
  dampWeight: [0, 1, 0.05],
  rise: [5, 600, 5],
  fall: [5, 600, 5],
  maxOpacity: [0.05, 0.8, 0.01],
};

export const DEFAULT_RAINBOW_PARAMS = {
  needed: 0.25, // how hard it must have rained for a rainbow to follow
  endsAt: 0.12, // the rain has eased to this or less
  window: 300, // seconds after the rain that one can still appear
  minSun: 0.5, // sunshine (0..1, the sky's sun and the sun being up) needed to make it
  maxSunElevation: 0.6, // radians: with the sun higher than this (about 34 degrees) the bow is under the horizon
  fadeIn: 15, // seconds to come up
  fadeOut: 150, // seconds to fade
  maxOpacity: 0.55,
  innerDegrees: 40, // the bow's violet edge, in degrees from the point opposite the sun
  outerDegrees: 43.5, // and its red edge
};

export const RAINBOW_PARAM_RANGES = {
  needed: [0, 1, 0.05],
  endsAt: [0, 0.5, 0.01],
  window: [10, 1200, 10],
  minSun: [0, 1, 0.05],
  maxSunElevation: [0.1, 1.3, 0.01],
  fadeIn: [1, 120, 1],
  fadeOut: [5, 600, 5],
  maxOpacity: [0.05, 1, 0.01],
  innerDegrees: [30, 45, 0.5],
  outerDegrees: [35, 50, 0.5],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * How thick the mist wants to be, 0..1. `ctx`: { hour, sunrise, temperature, wet (0..1), wind (the weather's multiplier), rain, snow }.
 * `dew` is the game's own draw (0..1).
 */
export function mistTarget(ctx, dew, p = DEFAULT_MIST_PARAMS) {
  if (dew <= 0 || ctx.rain >= p.rainClears || (ctx.snow ?? 0) > 0.05) return 0;
  // It burns off sooner the warmer the day is.
  const warm = clamp01((ctx.temperature - p.coolBelow) / 10 + 0.5);
  const burn = p.burnHours * (1 - p.warmBurn * warm);
  const sinceSunrise = ctx.hour - ctx.sunrise;
  const dawn = 1 - smoothstep(p.fullUntil, p.fullUntil + burn, sinceSunrise);
  const cool = clamp01((p.coolBelow - ctx.temperature) / Math.max(1, p.coolBelow - p.coolFull));
  const still = 1 - smoothstep(p.windClears * 0.4, p.windClears, ctx.wind);
  const thick = dew * (1 - p.dampWeight) + clamp01(ctx.wet) * p.dampWeight;
  return clamp01(dawn * (0.3 + 0.7 * cool) * still * thick);
}

/** The mist in the barley hollow: one level, 0..1, easing towards what the morning wants. */
export class Mist {
  constructor(dew = 1, params = { ...DEFAULT_MIST_PARAMS }) {
    this.p = params;
    this.dew = dew;
    this.level = 0;
    this.target = 0;
    this.forced = null; // the debug panel and console hold it at a level (null lets the day decide)
  }

  /** A dew for the game from a random stream: none in some games, a thin one or a thick one in the rest. */
  static drawDew(random, p = DEFAULT_MIST_PARAMS) {
    return random() < p.chance ? 0.5 + 0.5 * random() : 0;
  }

  update(dt, ctx) {
    this.target = this.forced ?? mistTarget(ctx, this.dew, this.p);
    const rate = this.target > this.level ? 1 / this.p.rise : 1 / this.p.fall;
    this.level += Math.sign(this.target - this.level) * Math.min(Math.abs(this.target - this.level), rate * dt);
    return this;
  }

  get visible() {
    return this.level > 0.02;
  }
}

/** A rainbow after a shower while the sun is out: `strength` 0..1, up when the rain has gone and the sun is low enough to throw one. */
export class Rainbow {
  constructor(params = { ...DEFAULT_RAINBOW_PARAMS }) {
    this.p = params;
    this.strength = 0;
    this.since = Infinity; // seconds since it rained hard enough
    this.forced = null; // held at a strength by the debug panel
  }

  /** `ctx`: { rain, sunElevation (radians), sunshine (0..1: the sky's sun and the sun being up) }. */
  update(dt, ctx) {
    const p = this.p;
    if (ctx.rain >= p.needed) this.since = 0;
    else this.since += dt;
    const afterRain = this.since < p.window && ctx.rain <= p.endsAt;
    const sunny = ctx.sunshine >= p.minSun && ctx.sunElevation > 0.03 && ctx.sunElevation < p.maxSunElevation;
    const want = this.forced ?? (afterRain && sunny ? 1 - smoothstep(p.window * 0.4, p.window, this.since) : 0);
    const rate = want > this.strength ? 1 / p.fadeIn : 1 / p.fadeOut;
    this.strength += Math.sign(want - this.strength) * Math.min(Math.abs(want - this.strength), rate * dt);
    return this;
  }

  get visible() {
    return this.strength > 0.01;
  }
}

/** The direction to the point opposite the sun, from the sun's direction (the bow is a circle round it). */
export function antisolar(sunDir) {
  return { x: -sunDir.x, y: -sunDir.y, z: -sunDir.z };
}

/**
 * The bow as unit directions: `steps` + 1 rows (round the circle), each with `bands` + 1 points across the arc from `innerDegrees` to
 * `outerDegrees`. A row with any point below the horizon is null, so only the part in the sky is drawn.
 */
export function rainbowRows(axis, steps, bands, innerDegrees, outerDegrees) {
  const len = Math.hypot(axis.x, axis.y, axis.z) || 1;
  const a = { x: axis.x / len, y: axis.y / len, z: axis.z / len };
  // Two directions at right angles to the axis and each other.
  const ref = Math.abs(a.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  let u = { x: a.y * ref.z - a.z * ref.y, y: a.z * ref.x - a.x * ref.z, z: a.x * ref.y - a.y * ref.x };
  const ul = Math.hypot(u.x, u.y, u.z);
  u = { x: u.x / ul, y: u.y / ul, z: u.z / ul };
  const v = { x: a.y * u.z - a.z * u.y, y: a.z * u.x - a.x * u.z, z: a.x * u.y - a.y * u.x };
  const rows = [];
  for (let i = 0; i <= steps; i++) {
    const phi = (i / steps) * Math.PI * 2;
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    const row = [];
    let up = true;
    for (let j = 0; j <= bands; j++) {
      const theta = ((innerDegrees + ((outerDegrees - innerDegrees) * j) / bands) * Math.PI) / 180;
      const ct = Math.cos(theta);
      const st = Math.sin(theta);
      const d = { x: a.x * ct + (u.x * c + v.x * s) * st, y: a.y * ct + (u.y * c + v.y * s) * st, z: a.z * ct + (u.z * c + v.z * s) * st };
      if (d.y < 0.01) up = false;
      row.push(d);
    }
    rows.push(up ? row : null);
  }
  return rows;
}
