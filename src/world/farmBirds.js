// The farm's birds by day (#124): a dawn chorus from the hedges round you as the light comes, thinning to the odd song by mid-morning, and rooks
// going over in a loose flock in the hour before sunset. Pure: the hour, the day's sunrise and sunset, the month and the rain in, which birds are
// due and how thick (`birdsDue`); then `FarmBirds` picks who sings where and when, and sends a flock across, as events for
// audio/farmBirdsAudio.js to play. The night's birds (#1248) and the barn's (#1246) join this schedule.

export const DEFAULT_FARM_BIRD_PARAMS = {
  volume: 1, // the farm's birds' loudness, on top of the wildlife's own
  chorusEvery: 0.8, // seconds between one bird starting a song and the next at the chorus's thickest (fewer as it thins)
  rookEvery: 200, // seconds between rook flocks going over at the thick of the evening
  maxVoices: 6, // birds sounding at once, at most, wherever you stand
  singerReach: 90, // metres: how far off a singing bird can be (beyond about 120 m nothing is started anyway)
};

export const FARM_BIRD_PARAM_RANGES = {
  volume: [0, 3, 0.05],
  chorusEvery: [0.2, 5, 0.1],
  rookEvery: [20, 900, 10],
  maxVoices: [2, 12, 1], // a passing flock is two voices, so fewer than two would keep the rooks away for good
  singerReach: [20, 120, 5],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export const ODD_SONG = 0.12; // how thick the morning's odd song is after the chorus has gone: a song every several seconds
export const ODD_SONG_UNTIL = 10; // the hour by which the odd song has stopped too (it fades over the half hour before)

/** How full the chorus is in a month (0 for January): spring is the thick of it; robins and wrens keep singing through the winter; late summer is the moult's quiet. */
export function chorusSeason(month) {
  if (month >= 2 && month <= 5) return 1;
  if (month === 6) return 0.6;
  if (month === 7 || month === 8) return 0.35;
  return 0.5;
}

/**
 * Which of the farm's birds are due at `hour` (hours after midnight, past 24 the same night going on), 0..1 each:
 * `chorus` from about half an hour before `sunrise` (rising from an hour before), full until three quarters of an hour after and thinning to
 * nothing two hours after, then the odd song (`ODD_SONG`) from sunrise until mid-morning by the clock (`ODD_SONG_UNTIL`), so a game that starts
 * at eight in a summer's morning, long after the chorus, still hears a bird or two; `rooks` in the hour before `sunset`. Rain quietens both, the chorus more.
 */
export function birdsDue(hour, { sunrise, sunset }, { month = 4, rain = 0 } = {}) {
  const r = clamp01(rain);
  const chorus = smooth(sunrise - 1, sunrise - 0.5, hour) * (1 - smooth(sunrise + 0.75, sunrise + 2, hour));
  const rooks = smooth(sunset - 1, sunset - 0.8, hour) * (1 - smooth(sunset - 0.1, sunset, hour));
  const odd = ODD_SONG * smooth(sunrise, sunrise + 0.25, hour) * (1 - smooth(ODD_SONG_UNTIL - 0.5, ODD_SONG_UNTIL, hour));
  return { chorus: Math.max(chorus * chorusSeason(month), odd) * (1 - 0.7 * r), rooks: rooks * (1 - 0.5 * r) };
}

/**
 * Where a bird can sing from: a point every `every` m along each hedge (fields.js's hedges, straight lines with gaps; none in a gap), and the
 * trees in `trees` ([x, z] each). [{ x, z }].
 */
export function songSpots(hedges, inGap, trees = [], every = 15) {
  const out = [];
  for (const h of hedges) {
    for (let s = every / 2; s < h.length; s += every) if (!inGap(h, s)) out.push({ x: h.x1 + h.dx * s, z: h.z1 + h.dz * s });
  }
  for (const [x, z] of trees) out.push({ x, z });
  return out;
}

/** The species of the chorus, each with how often it is the one to start a song and how long its songs run (seconds). */
export const SINGERS = {
  blackbird: { weight: 0.35, len: [2, 3.2] },
  robin: { weight: 0.35, len: [1.6, 2.6] },
  wren: { weight: 0.3, len: [3.5, 5] },
};

const ROOK_SPEED = 12; // m/s, a rook's easy flight
const ROOK_HALF_PATH = 100; // m either side of you that a flock's caws are placed along its line
const FORCED_CHORUS = 90; // seconds a forced chorus sings for

export class FarmBirds {
  /** `spots` from `songSpots`; `params` a DEFAULT_FARM_BIRD_PARAMS copy (read live, so the panel's changes take). */
  constructor({ spots, params = { ...DEFAULT_FARM_BIRD_PARAMS }, random = Math.random }) {
    this.spots = spots;
    this.p = params;
    this.random = random;
    this.t = 0;
    this.nextSong = 0;
    this.nextFlock = null; // seconds until the next flock while rooks are due; null until the evening starts
    this.voices = []; // when each sounding bird stops, in this.t's seconds
    this.chorusFor = 0; // seconds of forced chorus left (`force('chorus')`)
    this.flockNow = false; // a flock forced over on the next update
    this.last = { chorus: 0, rooks: 0 };
  }

  /** Starts one now, whatever the hour: 'chorus' sings round you for a minute and a half, 'rooks' sends one flock over. False for anything else. */
  force(kind) {
    if (kind === 'chorus') this.chorusFor = FORCED_CHORUS;
    else if (kind === 'rooks') this.flockNow = true;
    else return false;
    return true;
  }

  /** How many birds are sounding now. */
  sounding() {
    return this.voices.filter((end) => end > this.t).length;
  }

  /** A spot within `singerReach` of (x, z), at random, or null if there is none. */
  singerNear(x, z) {
    const r2 = this.p.singerReach * this.p.singerReach;
    const near = this.spots.filter((s) => (s.x - x) ** 2 + (s.z - z) ** 2 <= r2);
    return near.length ? near[Math.floor(this.random() * near.length)] : null;
  }

  pickSpecies() {
    let r = this.random();
    for (const [name, s] of Object.entries(SINGERS)) {
      r -= s.weight;
      if (r < 0) return name;
    }
    return 'wren';
  }

  /** A loose flock of rooks over you: a line across the sky passing 15 to 60 m to one side, its caws along it in the order they fly. */
  flock(you) {
    const { random } = this;
    const heading = random() * Math.PI * 2;
    const dx = Math.cos(heading);
    const dz = Math.sin(heading);
    const off = (15 + random() * 45) * (random() < 0.5 ? -1 : 1);
    const height = 30 + random() * 20;
    const from = { x: you.x - dx * ROOK_HALF_PATH - dz * off, z: you.z - dz * ROOK_HALF_PATH + dx * off };
    const len = (2 * ROOK_HALF_PATH) / ROOK_SPEED;
    const n = 8 + Math.floor(random() * 11);
    const caws = [];
    for (let i = 0; i < n; i++) {
      const at = ((i + random() * 0.8) / n) * len; // spread along the flight, in order
      const k = at / len;
      caws.push({ at, x: from.x + dx * 2 * ROOK_HALF_PATH * k + (random() - 0.5) * 16, z: from.z + dz * 2 * ROOK_HALF_PATH * k + (random() - 0.5) * 16, double: random() < 0.35 });
    }
    return { kind: 'flock', species: 'rook', heading, height, len, caws };
  }

  /**
   * One frame: `due` from `birdsDue`, `you` the listener's { x, z }. The birds that start now: [{ kind: 'song', species, x, z, len }] and
   * [{ kind: 'flock', species: 'rook', heading, height, len, caws: [{ at, x, z, double }] }] (each caw `at` seconds after it starts).
   */
  update(dt, due, you) {
    const p = this.p;
    this.t += dt;
    this.chorusFor = Math.max(0, this.chorusFor - dt);
    const chorus = Math.max(due.chorus, this.chorusFor > 0 ? 1 : 0);
    this.last = { chorus, rooks: due.rooks };
    this.voices = this.voices.filter((end) => end > this.t);
    const out = [];
    if (chorus > 0.05) {
      this.nextSong -= dt;
      if (this.nextSong <= 0) {
        this.nextSong = (p.chorusEvery / chorus) * (0.5 + this.random());
        const spot = this.voices.length < p.maxVoices ? this.singerNear(you.x, you.z) : null;
        if (spot) {
          const species = this.pickSpecies();
          const [a, b] = SINGERS[species].len;
          const len = a + this.random() * (b - a);
          this.voices.push(this.t + len);
          out.push({ kind: 'song', species, x: spot.x, z: spot.z, len });
        }
      }
    } else this.nextSong = this.random() * p.chorusEvery; // the first song of the next chorus comes soon after it starts
    if (due.rooks > 0.05) this.nextFlock ??= this.random() * p.rookEvery * 0.5;
    else this.nextFlock = null;
    if (this.nextFlock !== null) this.nextFlock -= dt;
    const room = this.voices.length <= p.maxVoices - 2; // a flock waits for two voices to be free, a forced one too
    if (!room && this.nextFlock !== null && this.nextFlock <= 0) this.nextFlock = 2;
    if (room && (this.flockNow || (this.nextFlock !== null && this.nextFlock <= 0))) {
      if (!this.flockNow) this.nextFlock = (p.rookEvery / Math.max(0.05, due.rooks)) * (0.6 + this.random() * 0.8);
      this.flockNow = false;
      const f = this.flock(you);
      this.voices.push(this.t + f.len, this.t + f.len); // a flock is two voices while it passes: a caw or two at a time
      out.push(f);
    }
    return out;
  }

  /** One line for the panel and the console: what is due and how many are sounding. */
  describe() {
    const pc = (v) => `${Math.round(v * 100)}%`;
    return `dawn chorus ${pc(this.last.chorus)}${this.chorusFor > 0 ? ' (started by hand)' : ''}, rooks ${pc(this.last.rooks)}; ${this.sounding()} sounding`;
  }
}
