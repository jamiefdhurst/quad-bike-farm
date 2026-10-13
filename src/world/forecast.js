// A day that changes, and the board that says how. Most games the weather stays what it was picked as, but some days it turns: a fine
// morning clouds over to rain by the afternoon, or a wet one clears. The game deals that turn at the start from its seed (so ?seed=N
// repeats it) and weather.js eases into it. The forecast board in the barn shows what the day is said to hold in three slots, and is
// right most of the time: now and then it promises a turn that never comes, or misses one. Pure.

export const DEFAULT_FORECAST_PARAMS = {
  shiftChance: 0.4, // chance a game's weather turns to something else during the day
  shiftEarliest: 1, // hours after the game starts before it can turn
  shiftLatest: 5, // and the latest it turns, hours after the start
  shiftHours: 0.75, // game hours the sky takes to change over (about four minutes at the usual clock rate)
  accuracy: 0.8, // chance the board is right about whether the weather turns
  stormEarliest: 0.4, // a storm always passes: it turns this many hours after the start at the soonest...
  stormLatest: 1.5, // ...and this many at the latest (an hour is about five minutes of play)
  tempShiftScale: 1, // how much the day's warmest moves with the turn (1 is the offsets in KIND_WARMTH, 0 keeps it as it was)
};

export const FORECAST_PARAM_RANGES = {
  shiftChance: [0, 1, 0.05],
  shiftEarliest: [0, 8, 0.25],
  shiftLatest: [0, 12, 0.25],
  shiftHours: [0.1, 3, 0.05],
  accuracy: [0, 1, 0.05],
  stormEarliest: [0, 6, 0.1],
  stormLatest: [0, 8, 0.1],
  tempShiftScale: [0, 3, 0.1],
};

/** What each kind can turn into, by weight: only believable turns. Snow stays snow (its own rules melt it). */
export const SHIFTS = {
  sunny: { fair: 3, overcast: 2, drizzle: 1, rain: 1 },
  fair: { sunny: 1, overcast: 2, drizzle: 1, rain: 1.5 },
  overcast: { sunny: 0.5, fair: 1, drizzle: 2, rain: 1.5 },
  drizzle: { fair: 1, overcast: 2, rain: 1 },
  rain: { fair: 1, overcast: 1.5, drizzle: 2 },
  fog: { sunny: 2, fair: 1.5, overcast: 1 }, // burning off
  storm: { rain: 3, drizzle: 1.5, overcast: 1 }, // blowing over
};

/** How wet the sky is, for telling a turn for the worse from one for the better. */
export const SKY_RANK = { sunny: 0, fair: 1, fog: 2, overcast: 2, drizzle: 3, rain: 4, snow: 4, storm: 5 };

/** Degrees the day's warmest sits above or below a mild grey day for each kind: a clear day is warmer, a wet one cooler. */
export const KIND_WARMTH = { sunny: 1.5, fair: 0.5, overcast: 0, drizzle: -1, rain: -1.5, fog: -1, snow: -1, storm: -1 };

/** The picture on the board for each kind. */
export const SYMBOLS = { sunny: 'sun', fair: 'sunCloud', overcast: 'cloud', drizzle: 'drizzle', rain: 'rain', fog: 'fog', snow: 'snow', storm: 'rain' };

/** The board's three slots, in hours after midnight. */
export const SLOTS = [
  { label: 'Morning', from: 6, to: 12 },
  { label: 'Afternoon', from: 12, to: 17 },
  { label: 'Evening', from: 17, to: 22 },
];

const pickWeighted = (table, random) => {
  const entries = Object.entries(table);
  let r = random() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
};

/** A turn dealt for a day that starts as `kind` at `startHour`: { to, at (hour it begins) }, or null if it keeps as it is. */
export function dealShift(kind, startHour, random, p = DEFAULT_FORECAST_PARAMS, force = false) {
  const table = SHIFTS[kind];
  if (!table) return null;
  const storm = kind === 'storm'; // a storm is always going to blow over, and soon
  if (!force && !storm && random() >= p.shiftChance) return null;
  const to = pickWeighted(table, random);
  const early = storm ? p.stormEarliest : p.shiftEarliest;
  const at = startHour + early + (Math.max(storm ? p.stormLatest : p.shiftLatest, early) - early) * random();
  return { to, at: Math.round(at * 4) / 4 };
}

/** The sky is getting wetter (true) or clearer (false) going from one kind to another. */
export const isWorse = (from, to) => (SKY_RANK[to] ?? 2) > (SKY_RANK[from] ?? 2);

export class Forecast {
  /** `kind` the weather starts as, `startHour` the game's start; `random` deals the turn and whether the board is right. */
  constructor(kind, startHour, random = Math.random, p = { ...DEFAULT_FORECAST_PARAMS }, { frozen = false } = {}) {
    this.p = p;
    this.start = kind;
    this.shift = frozen ? null : dealShift(kind, startHour, random, p);
    // What the board says: the real turn if it is right today, otherwise the opposite (a turn that never comes, or none when one does).
    const right = random() < p.accuracy;
    this.told = frozen ? null : right ? this.shift : this.shift ? null : dealShift(kind, startHour, random, p, true);
    this.begun = false;
  }

  /** Called with the time of day: returns the turn once, as it starts ({ from, to, worse, told }), else null. */
  update(hour) {
    if (this.begun || !this.shift || hour < this.shift.at) return null;
    this.begun = true;
    const { to } = this.shift;
    return { from: this.start, to, worse: isWorse(this.start, to), told: this.told === this.shift };
  }

  /** Turns the weather now (the debug panel): deals a turn from `kind` if none is left, and returns it starting, or null if this kind has none. */
  turnNow(kind, hour, random = Math.random) {
    if (this.begun || !this.shift) {
      const shift = dealShift(kind, hour, random, this.p, true);
      if (!shift) return null;
      this.start = kind;
      this.shift = this.told = shift;
      this.begun = false;
    }
    this.shift.at = hour;
    return this.update(hour);
  }

  /** In words, for the debug panel and the console. */
  describe(hour) {
    const said = this.told ? `the board says ${this.told.to} from ${Math.floor(this.told.at)}:00` : `the board says no change from ${this.start}`;
    const real = this.shift ? `${this.begun ? 'turned' : 'will turn'} to ${this.shift.to} at ${Math.floor(this.shift.at)}:${String(Math.round((this.shift.at % 1) * 60)).padStart(2, '0')}` : 'no turn today';
    return `${said}; in fact ${real}`;
  }

  /** The turn is off (the weather was changed by hand): nothing more happens and the board says nothing. */
  cancel() {
    this.shift = null;
    this.told = null;
  }

  /** What the board says the weather will be at `hour`. */
  saidAt(hour) {
    return this.told && hour >= this.told.at ? this.told.to : this.start;
  }

  /** The board's slots as of `hour`: { label, kind, symbol, past, now }. */
  board(hour) {
    return SLOTS.map((s) => {
      const kind = this.saidAt((s.from + s.to) / 2);
      return { label: s.label, kind, symbol: SYMBOLS[kind] ?? 'cloud', past: hour >= s.to, now: hour >= s.from && hour < s.to };
    });
  }

  /** What the board promises that a girl could read off it: { worse, to } for a turn it shows, or null. */
  promise() {
    return this.told ? { worse: isWorse(this.start, this.told.to), to: this.told.to } : null;
  }
}
