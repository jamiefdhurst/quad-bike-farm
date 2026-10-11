// The day running on. Each game starts at its own time, morning or afternoon, and the clock runs on faster than real time: the sun
// climbs and crosses the south, goes low and orange in the west, sets, and the dusk fades into a blue night that then stays (no
// second morning). The temperature follows: coldest at dawn, warmest mid-afternoon, falling by the day's own amount into the night.
// This works out the sun, the light, the sky's colours and the temperature for a time of day; world.js and game.js apply them. Pure.
//
// Directions: north is -z, east +x (the barn's workbench is on its north wall), so the sun rises in the east (+x), is in the south (+z)
// at noon and sets in the west (-x).

export const DEFAULT_DAYLIGHT_PARAMS = {
  clockRate: 12, // game seconds per real second: a morning start reaches dusk in about 40 minutes, an afternoon one in ten or so
  startEarliest: 8, // the earliest a game starts, hours after midnight
  startLatest: 15.5, // and the latest
  sunrise: 7.25, // hours: an October day's
  sunset: 17.25,
  sunHigh: 0.5, // radians: the sun at its highest, in the south at noon (about 29 degrees, as in October)
  nightLight: 0.14, // the sky's light at full dark, as a fraction of the day's
  moonLight: 0.35, // a faint blue light from above at night, so the farm is still just there (stars and a moon are README TODO item 68)
  duskGlow: 0.75, // how orange the low sun turns the sky (less on a cloudy day)
  peakHour: 14.5, // the warmest time of day
  coolHours: 9, // hours after the warmest for the night's cold to set in
  coolMin: 4, // degrees the day falls from its warmest to the night's coldest (a random amount between these each game)
  coolMax: 8,
};

export const DAYLIGHT_PARAM_RANGES = {
  clockRate: [1, 240, 1],
  startEarliest: [0, 23, 0.25],
  startLatest: [0, 23, 0.25],
  sunrise: [4, 10, 0.25],
  sunset: [15, 21, 0.25],
  sunHigh: [0.1, 1.3, 0.01],
  nightLight: [0, 0.5, 0.01],
  moonLight: [0, 1, 0.01],
  duskGlow: [0, 1, 0.01],
  peakHour: [11, 17, 0.25],
  coolHours: [2, 16, 0.5],
  coolMin: [0, 15, 0.5],
  coolMax: [0, 15, 0.5],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Mixes two '#rrggbb' colours, t of the way from a to b. */
export function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p, s) => (p >> s) & 255;
  const c = [16, 8, 0].map((s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * clamp01(t)));
  return `#${((c[0] << 16) | (c[1] << 8) | c[2]).toString(16).padStart(6, '0')}`;
}

/**
 * The sun at `hour` (hours after midnight; past 24 is the same night going on): { elevation (radians above the horizon), azimuth
 * (radians from south, east negative), dir ({ x, y, z } towards it), light (0 night to 1 day), glow (0..1 how low, orange and golden),
 * night (0..1) }. After sunset it sinks and stays down: the night doesn't end.
 */
export function sunAt(hour, p = DEFAULT_DAYLIGHT_PARAMS) {
  const day = p.sunset - p.sunrise;
  const u = Math.min(1.5, Math.max(-0.5, (hour - p.sunrise) / day));
  const elevation = Math.max(-0.35, p.sunHigh * Math.sin(Math.PI * u));
  const azimuth = -Math.PI / 2 + Math.PI * Math.min(1.1, Math.max(-0.1, u));
  const ce = Math.cos(elevation);
  const dir = { x: -Math.sin(azimuth) * ce, y: Math.sin(elevation), z: Math.cos(azimuth) * ce };
  const light = smoothstep(-0.12, 0.12, elevation);
  const glow = smoothstep(0.3, 0.04, elevation) * smoothstep(-0.1, 0, elevation);
  return { elevation, azimuth, dir, light, glow, night: 1 - light };
}

const DUSK = { horizon: '#f2a066', zenith: '#5b6a98', cloud: '#e8a47e', shadow: '#6e5264', sun: '#ff9a52' };
const NIGHT = { horizon: '#141b2b', zenith: '#05080f', cloud: '#1a2030', shadow: '#0c1018', sun: '#8ea4d4' };
const DAY_SUN = '#fff3e2';
const DAY_HEMI = '#dfe4e8';
const NIGHT_HEMI = '#6f86b8';

/**
 * The sky for this time of day: the weather's sky params (`base`, weather.js) turned golden as the sun gets low and dark blue at
 * night, with the sun's light and colour, the sky's fill and the sun's direction. Returns a new params object (as SKY_PARAMS, with
 * sunColor and hemiColor) and `sunDir`.
 */
export function skyAt(base, sun, p = DEFAULT_DAYLIGHT_PARAMS) {
  const glow = sun.glow * p.duskGlow * (1 - 0.6 * (base.cloudCover ?? 0.5));
  const n = sun.night;
  const tint = (key, dusk, night, g = 1) => mixHex(mixHex(base[key], dusk, glow * g), night, n);
  const sunPower = (base.sunIntensity ?? 1.25) * sun.light * (1 - 0.3 * glow);
  return {
    ...base,
    horizonColor: tint('horizonColor', DUSK.horizon, NIGHT.horizon),
    zenithColor: tint('zenithColor', DUSK.zenith, NIGHT.zenith, 0.6),
    cloudColor: tint('cloudColor', DUSK.cloud, NIGHT.cloud, 0.8),
    cloudShadowColor: tint('cloudShadowColor', DUSK.shadow, NIGHT.shadow, 0.6),
    // By day the sun; by night a faint blue light from above in its place.
    sunIntensity: sunPower + p.moonLight * n,
    sunColor: mixHex(mixHex(DAY_SUN, DUSK.sun, glow), NIGHT.sun, n),
    hemiIntensity: (base.hemiIntensity ?? 1.7) * (p.nightLight + (1 - p.nightLight) * sun.light),
    hemiColor: mixHex(DAY_HEMI, NIGHT_HEMI, n),
    envLevel: p.nightLight + (1 - p.nightLight) * sun.light, // how bright the baked reflections are
    exposure: (base.exposure ?? 1) * (1 + 0.1 * n),
    sunDir: sun.light > 0.02 ? sun.dir : { x: 0.3, y: 0.85, z: -0.4 }, // at night the light comes from high up, not from under the ground
  };
}

/**
 * The temperature at `hour` for a day whose warmest is `peak` degrees and that falls `drop` degrees to its coldest: coldest at dawn,
 * warming to the peak mid-afternoon, then falling away into the night (most of the fall in the first few hours).
 */
export function temperatureAt(hour, peak, drop, p = DEFAULT_DAYLIGHT_PARAMS) {
  let warm;
  if (hour <= p.sunrise) warm = 0;
  else if (hour <= p.peakHour) warm = 0.5 - 0.5 * Math.cos((Math.PI * (hour - p.sunrise)) / (p.peakHour - p.sunrise));
  else {
    const t = Math.min(1, (hour - p.peakHour) / p.coolHours);
    warm = 1 - (1 - Math.exp(-2.5 * t)) / (1 - Math.exp(-2.5));
  }
  return peak - drop * (1 - warm);
}

/** '14:05' style, for a time of day in hours (past midnight wraps round). */
export function clockText(hour) {
  const mins = Math.floor((((hour % 24) + 24) % 24) * 60);
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

/** The angles of a clock's hands (radians clockwise from twelve) for a time of day in hours: { hour, minute }. */
export function clockHands(hour) {
  const h = ((hour % 12) + 12) % 12;
  return { hour: (h / 12) * Math.PI * 2, minute: ((hour % 1) + 1) % 1 * Math.PI * 2 };
}

/**
 * The day's clock: the time now, moving on at `clockRate`, and the day's warmest and how far it falls. Start it with `start` (hours),
 * or let it draw one; `random` draws the start and the fall.
 */
export class Daylight {
  constructor(p = { ...DEFAULT_DAYLIGHT_PARAMS }, { start = null, random = Math.random } = {}) {
    this.p = p;
    this.hour = start ?? p.startEarliest + (p.startLatest - p.startEarliest) * random();
    this.startHour = this.hour;
    this.drop = p.coolMin + (p.coolMax - p.coolMin) * random();
  }

  update(dt) {
    this.hour += (dt * this.p.clockRate) / 3600;
  }

  get sun() {
    return sunAt(this.hour, this.p);
  }

  /** How dark it is, 0 (day) to 1 (night). */
  get darkness() {
    return this.sun.night;
  }

  /** Seconds after midnight, for the dashboards' clocks. */
  seconds() {
    return (this.hour * 3600) % 86400;
  }

  text() {
    return clockText(this.hour);
  }

  /** The temperature now, on a day whose warmest is `peak`. */
  temperature(peak) {
    return temperatureAt(this.hour, peak, this.drop, this.p);
  }

  /** The day's warmest for which it is `now` degrees at this time of day (?temp= sets the temperature as it is when the game starts). */
  peakFor(now) {
    return now - temperatureAt(this.hour, 0, this.drop, this.p);
  }
}
