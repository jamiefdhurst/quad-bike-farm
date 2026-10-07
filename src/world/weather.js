// The weather, picked at random each game (from the game's seed, so ?seed=N
// repeats it, and ?weather=<kind> forces one). Each kind has a look (sky
// colours, cloud, fog, light), how showery it is, and how windy. Within a game,
// showers come and go: the rain eases towards a level that's picked afresh
// every few minutes, and the sky darkens and the fog thickens with it. The
// ground gets wet with rain and dries slowly after, which makes the grass and
// track slipperier and the mud worse. Pure logic.

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** How each kind looks, and its weather. `rain` and `showers` are 0..1; `wind` scales the breeze. */
export const WEATHER_KINDS = {
  sunny: {
    name: 'sunny',
    weight: 0.7,
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
};
const TEMPERATURE_ODDS = {
  sunny: { frosty: 0.15, cold: 0.2, mild: 0.3, warm: 0.35 },
  fair: { frosty: 0.1, cold: 0.25, mild: 0.35, warm: 0.3 },
  overcast: { frosty: 0.1, cold: 0.35, mild: 0.55 },
  drizzle: { cold: 0.35, mild: 0.65 },
  rain: { cold: 0.35, mild: 0.65 },
  fog: { frosty: 0.35, cold: 0.4, mild: 0.25 },
};
export const MILD_C = 12; // at and above this the cold doesn't bother an engine
export const COLDEST_C = -5; // the coldest day there is: chill 1

/** The day's temperature (a band, then a value in it to the nearest half degree) for a weather kind. */
export function pickTemperature(kind, random = Math.random) {
  const odds = TEMPERATURE_ODDS[kind] ?? TEMPERATURE_ODDS.overcast;
  let r = random() * Object.values(odds).reduce((a, b) => a + b, 0);
  let band = Object.keys(odds)[0];
  for (const [b, o] of Object.entries(odds)) {
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

/** A kind at random, by weight. */
export function pickWeatherKind(random = Math.random) {
  const kinds = Object.keys(WEATHER_KINDS);
  const total = kinds.reduce((s, k) => s + WEATHER_KINDS[k].weight, 0);
  let r = random() * total;
  for (const k of kinds) {
    r -= WEATHER_KINDS[k].weight;
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
    this.temperature = celsius; // degrees C; fixed for the game for now
    this.random = random;
    const k = WEATHER_KINDS[this.kind];
    this.rain = k.rain; // 0..1 falling now
    this.target = k.rain;
    this.wet = k.wet; // 0..1 how wet the ground is
    this.nextChange = this.spell();
  }

  get def() {
    return WEATHER_KINDS[this.kind];
  }

  get name() {
    return this.def.name;
  }

  /** 0..1 how warm the day is for an engine in the sun: the sunshine, taken off by rain. */
  get warmth() {
    // The temperature nudges it: a frosty day takes the edge off the sun, a warm one adds to a dull day.
    return clamp01(clamp01(this.def.sky.sunIntensity / 2.6) * (1 - 0.8 * this.rain) + (this.temperature - MILD_C) * 0.01);
  }

  /** 0..1 how cold it is for an engine (see chillOf). */
  get chill() {
    return chillOf(this.temperature);
  }

  /** 0..1 how frosty: nothing above freezing, white seats at a few degrees below. */
  get frost() {
    return this.temperature > 0.5 ? 0 : 0.4 + 0.6 * clamp01((0.5 - this.temperature) / 4);
  }

  get band() {
    return bandOf(this.temperature);
  }

  get wind() {
    return this.def.wind * (1 + this.rain * 0.4);
  }

  /** Seconds until the rain changes again. */
  spell() {
    return 120 + this.random() * 240;
  }

  update(dt) {
    const k = this.def;
    this.nextChange -= dt;
    if (this.nextChange <= 0) {
      this.nextChange = this.spell();
      // A shower, a heavier spell, or it easing off, more often the showerier it is.
      const r = this.random();
      if (r < k.showers * 0.5) this.target = clamp01(Math.max(k.rain, 0.3) + this.random() * 0.6);
      else if (r < k.showers) this.target = k.rain * this.random();
      else this.target = k.rain;
    }
    // Rain comes on over half a minute or so and eases off a bit slower.
    const rate = this.target > this.rain ? 1 / 30 : 1 / 50;
    this.rain += Math.sign(this.target - this.rain) * Math.min(Math.abs(this.target - this.rain), rate * dt);
    // The ground soaks up rain quickly and dries over ten minutes or so.
    if (this.rain > this.wet) this.wet = Math.min(1, this.wet + this.rain * dt / 40);
    else this.wet = Math.max(k.wet * 0.5, this.wet - dt / 600);
    return this;
  }

  /** The sky's params for now: the kind's look, darkened towards a rainy sky while it rains. */
  skyParams() {
    const base = this.def.sky;
    const t = clamp01((this.rain - this.def.rain) / Math.max(0.2, 1 - this.def.rain));
    const out = {};
    for (const [key, v] of Object.entries(base)) {
      out[key] = typeof v === 'string' ? mixColor(v, RAIN_SKY[key], t) : lerp(v, RAIN_SKY[key], t);
    }
    return out;
  }
}
