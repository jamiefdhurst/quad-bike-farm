// The weather, picked at random each game (from the game's seed, so ?seed=N
// repeats it, and ?weather=<kind> forces one). Each kind has a look (sky
// colours, cloud, fog, light), how showery it is, and how windy. Within a game,
// showers come and go: the rain eases towards a level that's picked afresh
// every few minutes, and the sky darkens and the fog thickens with it. The
// ground gets wet with rain and dries slowly after, which makes the grass and
// track slipperier and the mud worse. Pure logic.

export const SNOW_AT_START = 0.45; // cover on the ground when a snowy game starts: it has been snowing a while
export const SNOW_SETTLE_SECONDS = 150; // seconds of heavy snow (1) to cover the ground
export const SNOW_MELT_ABOVE_C = 3; // above this the snow starts to go
export const SNOW_MELT_SECONDS = 400; // seconds to melt from full cover at 5 degrees above that, and the rain washes it away at its own rate

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** How each kind looks, and its weather. `rain`, `snow` (left out for none) and `showers` are 0..1; `wind` scales the breeze. */
export const WEATHER_KINDS = {
  sunny: {
    name: 'sunny',
    weight: 0.64,
    sky: { horizonColor: '#d6e3ea', zenithColor: '#6c9ccd', cloudColor: '#f6f7f8', cloudShadowColor: '#b9c4ce', cloudCover: 0.22, fogDensity: 0.0032, sunIntensity: 2.6, hemiIntensity: 1.35, exposure: 1.05 },
    rain: 0,
    showers: 0,
    wind: 0.6,
    wet: 0,
  },
  fair: {
    name: 'sunny intervals',
    weight: 0.15,
    sky: { horizonColor: '#d3dbe0', zenithColor: '#88a5c0', cloudColor: '#eef0f1', cloudShadowColor: '#a2abb3', cloudCover: 0.45, fogDensity: 0.004, sunIntensity: 1.9, hemiIntensity: 1.5, exposure: 1.02 },
    rain: 0,
    showers: 0.15,
    wind: 0.9,
    wet: 0.1,
  },
  overcast: {
    name: 'overcast',
    weight: 0.07,
    sky: { horizonColor: '#cfd3d4', zenithColor: '#9aa3ab', cloudColor: '#e4e6e6', cloudShadowColor: '#8c949b', cloudCover: 0.62, fogDensity: 0.0055, sunIntensity: 1.25, hemiIntensity: 1.7, exposure: 1.0 },
    rain: 0,
    showers: 0.3,
    wind: 1,
    wet: 0.25,
  },
  drizzle: {
    name: 'drizzly',
    weight: 0.03,
    sky: { horizonColor: '#bdc2c4', zenithColor: '#8e959b', cloudColor: '#c9cccd', cloudShadowColor: '#7d8388', cloudCover: 0.85, fogDensity: 0.009, sunIntensity: 0.7, hemiIntensity: 1.35, exposure: 0.93 },
    rain: 0.35,
    showers: 0.6,
    wind: 1,
    wet: 0.6,
  },
  rain: {
    name: 'raining',
    weight: 0.03,
    sky: { horizonColor: '#aab0b3', zenithColor: '#7b8288', cloudColor: '#b4b8ba', cloudShadowColor: '#6a7076', cloudCover: 0.95, fogDensity: 0.012, sunIntensity: 0.4, hemiIntensity: 1.15, exposure: 0.86 },
    rain: 0.85,
    showers: 0.8,
    wind: 1.5,
    wet: 1,
  },
  snow: {
    name: 'snowing',
    weight: 0.06,
    sky: { horizonColor: '#dde1e4', zenithColor: '#aeb6bd', cloudColor: '#e8eaeb', cloudShadowColor: '#a3aab0', cloudCover: 0.9, fogDensity: 0.013, sunIntensity: 0.7, hemiIntensity: 1.6, exposure: 0.98 },
    rain: 0,
    snow: 0.7, // 0..1 how hard it falls
    showers: 0.5,
    wind: 0.5,
    wet: 0.3,
  },
  storm: {
    name: 'thundery',
    weight: 0.03, // about one game in thirty: half as rare as snow
    sky: { horizonColor: '#6d7479', zenithColor: '#3d444c', cloudColor: '#6f767c', cloudShadowColor: '#2f353b', cloudCover: 1, fogDensity: 0.016, sunIntensity: 0.18, hemiIntensity: 0.8, exposure: 0.95 },
    rain: 0.95,
    showers: 0.3,
    wind: 1.9,
    wet: 1,
  },
  fog: {
    name: 'foggy',
    weight: 0.02,
    sky: { horizonColor: '#d2d5d4', zenithColor: '#b8bdbf', cloudColor: '#dfe1e1', cloudShadowColor: '#a9aeb0', cloudCover: 0.8, fogDensity: 0.028, sunIntensity: 0.6, hemiIntensity: 1.65, exposure: 1.0 },
    rain: 0,
    showers: 0.05,
    wind: 0.3,
    wet: 0.4,
  },
};

// The day's temperature in degrees C, picked with the kind: the bands it falls in and how likely each is for that kind. Frost needs a dry
// day and a warm one needs sun (a warm day of rain would be nice but it is not in the weather yet).
export const TEMPERATURE_BANDS = {
  frosty: [-5, 0],
  cold: [2, 6],
  mild: [8, 14],
  warm: [16, 22],
  hot: [22, 29], // only a summer day (seasons.js)
};
const TEMPERATURE_ODDS = {
  sunny: { frosty: 0.15, cold: 0.2, mild: 0.3, warm: 0.35, hot: 0.15 },
  fair: { frosty: 0.1, cold: 0.25, mild: 0.35, warm: 0.3, hot: 0.08 },
  overcast: { frosty: 0.1, cold: 0.35, mild: 0.55 },
  drizzle: { cold: 0.35, mild: 0.65 },
  rain: { cold: 0.35, mild: 0.65 },
  fog: { frosty: 0.35, cold: 0.4, mild: 0.25 },
  snow: { frosty: 0.6, cold: 0.4 },
  storm: { cold: 0.25, mild: 0.55, warm: 0.2 }, // close, thundery air
};
export const MILD_C = 12; // at and above this the cold doesn't bother an engine
export const COLDEST_C = -5; // the coldest day there is: chill 1

/** The day's temperature (a band, then a value in it to the nearest half degree) for a weather kind. */
export function pickTemperature(kind, random = Math.random, season = {}) {
  const base = TEMPERATURE_ODDS[kind] ?? TEMPERATURE_ODDS.overcast;
  const odds = Object.fromEntries(Object.entries(base).map(([b, o]) => [b, o * (season[b] ?? (b === 'hot' ? 0 : 1))]));
  if (!Object.values(odds).some((o) => o > 0)) odds[Object.keys(base)[0]] = 1; // a season that rules out every band the kind has
  let r = random() * Object.values(odds).reduce((a, b) => a + b, 0);
  let band = Object.keys(odds)[0];
  for (const [b, o] of Object.entries(odds)) {
    if (o <= 0) continue;
    band = b;
    if ((r -= o) <= 0) break;
  }
  const [lo, hi] = TEMPERATURE_BANDS[band];
  return Math.round((lo + (hi - lo) * random()) * 2) / 2;
}

/** How far into the cold an engine is, 0 (mild or warmer) to 1 (the coldest day). */
export function chillOf(celsius) {
  return clamp01((MILD_C - celsius) / (MILD_C - COLDEST_C));
}

/** Which band a temperature is in, for what the girls say. */
export function bandOf(celsius) {
  return celsius <= 0.5 ? 'frosty' : celsius <= 6.5 ? 'cold' : celsius >= 15.5 ? 'warm' : 'mild';
}

/** The rainy look the sky moves towards while it rains, whatever the kind. */
const RAIN_SKY = WEATHER_KINDS.rain.sky;

/** A kind at random, by weight (and by the season's multipliers on it). */
export function pickWeatherKind(random = Math.random, season = {}) {
  const kinds = Object.keys(WEATHER_KINDS);
  const w = (k) => WEATHER_KINDS[k].weight * (season[k] ?? 1); // the season's multipliers (seasons.js)
  const total = kinds.reduce((s, k) => s + w(k), 0);
  let r = random() * total;
  for (const k of kinds) {
    r -= w(k);
    if (r <= 0) return k;
  }
  return kinds[kinds.length - 1];
}

function mixColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p, s) => (p >> s) & 255;
  const c = [16, 8, 0].map((s) => Math.round(lerp(ch(pa, s), ch(pb, s), t)));
  return `#${((c[0] << 16) | (c[1] << 8) | c[2]).toString(16).padStart(6, '0')}`;
}

export class Weather {
  constructor(kind = 'overcast', random = Math.random, celsius = MILD_C) {
    this.kind = WEATHER_KINDS[kind] ? kind : 'overcast';
    this.peak = celsius; // degrees C: the day's warmest (mid-afternoon)
    this.temperature = celsius; // degrees C now: the game moves it with the time of day (daylight.js)
    this.sunUp = 1; // 0..1 how far the sun is up (daylight.js): no sunshine to warm anything at night
    this.random = random;
    const k = WEATHER_KINDS[this.kind];
    this.rain = k.rain; // 0..1 falling now
    this.target = k.rain;
    this.groundWet = 0; // the least the ground dries to (the season's: seasons.js), set by the game
    this.wet = k.wet; // 0..1 how wet the ground is
    this.snow = k.snow ?? 0; // 0..1 falling now
    this.snowTarget = this.snow;
    this.cover = this.snow > 0 ? SNOW_AT_START : 0; // 0..1 how far the ground is under snow: it settles while snow falls and melts slowly when it warms
    this.nextChange = this.spell();
    this.from = null; // the kind the sky is turning from, while the weather changes over (beginShift)
    this.mix = 1; // 0..1 how far the changeover has got
    this.shiftSeconds = 1;
    this.peakDelta = 0; // degrees the day's warmest is still to move over the changeover
    this.turning = null; // the turn the day has taken ({ from, to, worse, told }), for the girls to notice
    this.promise = null; // what the forecast board says the day holds ({ worse, to }) or null, for the girls to read
  }

  get def() {
    return WEATHER_KINDS[this.kind];
  }

  /** Changes the day's weather at once (the console): the rain and the wet ground jump to what that kind is. Returns false if there is no such kind. */
  setKind(kind) {
    const k = WEATHER_KINDS[kind];
    if (!k) return false;
    this.kind = kind;
    this.rain = this.target = k.rain;
    this.wet = Math.max(this.wet, k.wet);
    this.snow = this.snowTarget = k.snow ?? 0;
    if (this.snow > 0) this.cover = Math.max(this.cover, SNOW_AT_START);
    this.nextChange = this.spell();
    this.from = null;
    this.mix = 1;
    this.peakDelta = 0;
    return true;
  }

  /**
   * The weather turns to another kind over `seconds`: the sky blends across, the rain follows part-way through and the day's warmest
   * moves by `warmth` degrees. `turning` is left for the girls to notice.
   */
  beginShift(to, seconds, { warmth = 0, note = null } = {}) {
    if (!WEATHER_KINDS[to] || to === this.kind) return false;
    this.from = this.kind;
    this.kind = to;
    this.mix = 0;
    this.shiftSeconds = Math.max(1, seconds);
    this.peakDelta = warmth;
    this.nextChange = this.shiftSeconds * 0.4;
    this.turning = note;
    return true;
  }

  /** The kind's sky, or the blend of the old and the new while the weather changes over. */
  get baseSky() {
    if (!this.from || this.mix >= 1) return this.def.sky;
    const a = WEATHER_KINDS[this.from].sky;
    const b = this.def.sky;
    const out = {};
    for (const key of Object.keys(b)) out[key] = typeof b[key] === 'string' ? mixColor(a[key], b[key], this.mix) : lerp(a[key], b[key], this.mix);
    return out;
  }

  get name() {
    return this.def.name;
  }

  /** 0..1 how thundery it is now: 1 in a storm, easing in and out as the weather turns to it or from it. */
  get storm() {
    if (this.kind === 'storm') return this.from && this.mix < 1 ? this.mix : 1;
    return this.from === 'storm' && this.mix < 1 ? 1 - this.mix : 0;
  }

  /** 0..1 how warm the day is for an engine in the sun: the sunshine, taken off by rain. */
  get warmth() {
    // The temperature nudges it: a frosty day takes the edge off the sun, a warm one adds to a dull day.
    return clamp01(clamp01(this.baseSky.sunIntensity / 2.6) * (1 - 0.8 * this.rain) * (1 - 0.5 * this.snow) * this.sunUp + (this.temperature - MILD_C) * 0.01);
  }

  /** 0..1 how damp the air is: a little always, more with rain and wet ground (an engine's air thins with it). */
  get damp() {
    return clamp01(0.2 + 0.5 * this.rain + 0.3 * this.wet);
  }

  /** 0..1 how cold it is for an engine (see chillOf). */
  get chill() {
    return chillOf(this.temperature);
  }

  /** 0..1 how white a seat should be: frosty, or snowed on (the snow only lies on a seat in the open, so a bit less than the ground). */
  get seatFrost() {
    return Math.max(this.frost, this.cover * 0.85);
  }

  /** 0..1 how frosty: nothing above freezing, white seats at a few degrees below. */
  get frost() {
    return this.temperature > 0.5 ? 0 : 0.4 + 0.6 * clamp01((0.5 - this.temperature) / 4);
  }

  get band() {
    return bandOf(this.temperature);
  }

  get wind() {
    const wind = this.from && this.mix < 1 ? lerp(WEATHER_KINDS[this.from].wind, this.def.wind, this.mix) : this.def.wind;
    return wind * (1 + this.rain * 0.4);
  }

  /** Seconds until the rain changes again. */
  spell() {
    return 120 + this.random() * 240;
  }

  update(dt) {
    const k = this.def;
    if (this.from) {
      const before = this.mix;
      this.mix = Math.min(1, this.mix + dt / this.shiftSeconds);
      this.peak += this.peakDelta * (this.mix - before);
      if (this.mix >= 1) this.from = null;
    }
    this.nextChange -= dt;
    if (this.nextChange <= 0) {
      this.nextChange = this.spell();
      // A shower, a heavier spell, or it easing off, more often the showerier it is.
      const r = this.random();
      if (r < k.showers * 0.5) this.target = clamp01(Math.max(k.rain, 0.3) + this.random() * 0.6);
      else if (r < k.showers) this.target = k.rain * this.random();
      else this.target = k.rain;
      // Snow falls in flurries: heavy for a bit, then lighter.
      this.snowTarget = (k.snow ?? 0) * (0.3 + 0.7 * this.random());
    }
    // Rain comes on over half a minute or so and eases off a bit slower.
    const rate = this.target > this.rain ? 1 / 30 : 1 / 50;
    this.rain += Math.sign(this.target - this.rain) * Math.min(Math.abs(this.target - this.rain), rate * dt);
    // Snow comes and goes over a minute or so, settles while it falls and melts when it is mild or rains.
    this.snow += Math.sign(this.snowTarget - this.snow) * Math.min(Math.abs(this.snowTarget - this.snow), dt / 60);
    const melt = Math.max(0, this.temperature - SNOW_MELT_ABOVE_C) / (5 * SNOW_MELT_SECONDS) + this.rain / 300;
    this.cover = clamp01(this.cover + (this.snow * 0.9 / SNOW_SETTLE_SECONDS - melt) * dt);
    // The ground soaks up rain quickly and dries over ten minutes or so.
    if (this.rain > this.wet) this.wet = Math.min(1, this.wet + this.rain * dt / 40);
    else this.wet = Math.max(k.wet * 0.5, this.groundWet, this.wet - dt / 600);
    return this;
  }

  /** The sky's params for now: the kind's look, darkened towards a rainy sky while it rains. */
  skyParams() {
    const base = this.baseSky;
    const t = clamp01((this.rain - this.def.rain) / Math.max(0.2, 1 - this.def.rain));
    const out = {};
    for (const [key, v] of Object.entries(base)) {
      out[key] = typeof v === 'string' ? mixColor(v, RAIN_SKY[key], t) : lerp(v, RAIN_SKY[key], t);
    }
    return out;
  }
}
