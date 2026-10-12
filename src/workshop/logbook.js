// Amy's logbook: a notebook on the workbench where she writes down what's been found and done to the quads ("Blue, belt slipping.
// Green, plug black."). She writes what she really saw (her walk-round, a plug pulled in front of her, a bench job), so unlike Jess it's true.
// Pure logic, no Three.js or DOM. The notebook itself and the page you read are in notebook.js.

export const DEFAULT_LOGBOOK_PARAMS = {
  maxEntries: 40, // the page is full after this many: the oldest entries are dropped
  repeatSeconds: 120, // she won't write the same thing about the same quad again inside this long
  writeRange: 15, // how close (m) you have to be for her to see a bench job or a plug and write it up
  startMin: 2, // the fewest entries already in the book when the game starts (fewer if there is little to write)
  startMax: 5, // the most
  startKnows: 0.85, // chance each thing that is true at the start is something she has already written down
};

export const LOGBOOK_PARAM_RANGES = {
  maxEntries: [10, 100, 1],
  repeatSeconds: [0, 600, 10],
  writeRange: [3, 40, 1],
  startMin: [0, 10, 1],
  startMax: [0, 15, 1],
  startKnows: [0, 1, 0.05],
};

/** What she writes for each walk-round finding (the keys of WALK_FINDINGS in walkRound.js). */
const FAULT_TEXT = { puncture: 'slow puncture', belt: 'belt slipping', cable: 'throttle sticking', carb: 'carb dirty' };

const TINKER_TEXT = { limiter: 'throttle stop wound out', mixture: 'mixture left rich' };

const QUIRK_TEXT = {
  fuelHigh: 'fuel gauge reads high',
  fuelSticks: 'fuel gauge sticks',
  tempCold: 'temperature needle stuck on cold',
  chokeCreeps: 'choke creeps back on',
  tapStiff: 'fuel tap stiff',
  seatSplit: 'seat split',
  hornFlaky: 'horn works when it likes',
  brakesPull: 'brakes pull',
  brakeSqueal: 'brakes squeal',
  headlightFlicker: 'headlight flickers',
};

const WALK_TEXT = {
  walkPuncture: 'slow puncture',
  walkSoftTyre: 'tyre soft',
  walkBelt: 'belt slipping',
  walkCable: 'throttle sticking',
  walkCarb: 'carb dirty',
};

/** What she writes for each plug reading (the kinds of readPlug in benchJobs.js). */
const PLUG_TEXT = {
  healthy: 'plug tan',
  rich: 'plug black',
  lean: 'plug white',
  oily: 'plug oily',
  worn: 'plug tan, electrode worn',
};

/** What she writes when a bench job is finished (the keys of JOBS in benchJobs.js). */
const JOB_TEXT = {
  plug: 'new plug',
  carb: 'carb cleaned',
  mounts: 'engine mounts renewed',
  tyre: 'tyre mended',
  oil: 'two-stroke oil topped up',
  packing: 'silencer repacked',
  coolant: 'coolant topped up',
  bore: 'big-bore kit fitted',
  topEnd: 'top end rebuilt, new piston and rings',
  chain: 'chain adjusted and oiled',
  valves: 'valve clearances set',
  crash: 'crash damage put right',
  sump: 'engine oil topped up',
  tarp: 'tarp off',
  fuel: 'old fuel drained',
  brake: 'seized brake freed',
  battery: 'battery on the charger',
  chargeOn: 'battery lifted out and put on the charger',
  chargeOff: 'battery charged and put back',
};

/** "Blue quad" is just "Blue" in a notebook; "Mini moto" stays as it is. */
export function shortName(name) {
  return name.replace(/ quad$/, '');
}

/**
 * The text of an entry: { kind: 'walk', finding } | { kind: 'plug', reading } | { kind: 'job', job, botched } | { kind: 'oil' }
 * | the ones she may have written before the game: { kind: 'fault', fault } | { kind: 'tinker', tinker } | { kind: 'quirk', quirk } | { kind: 'rider', rider }
 */
export function entryText(what) {
  switch (what.kind) {
    case 'walk':
      return WALK_TEXT[what.finding] ?? null;
    case 'plug':
      return PLUG_TEXT[what.reading] ?? null;
    case 'job': {
      const text = JOB_TEXT[what.job];
      return text ? (what.botched ? `${text}, not well` : text) : null;
    }
    case 'oil':
      return 'engine oil topped up';
    case 'fault':
      return FAULT_TEXT[what.fault] ?? null;
    case 'tinker':
      return TINKER_TEXT[what.tinker] ?? null;
    case 'quirk':
      return QUIRK_TEXT[what.quirk] ?? null;
    case 'rider':
      return what.rider === 'jess' ? 'out with Jess' : what.rider === 'amy' ? 'out with Amy' : null;
    default:
      return null;
  }
}

export class Logbook {
  constructor(params = DEFAULT_LOGBOOK_PARAMS) {
    this.params = params;
    this.entries = [];
    this.clock = 0; // seconds into the game
    this.day = 1; // the farm's day: each entry carries the day it was written, and earlier days' entries say which
  }

  /** The page as plain data, for the farm's save. */
  toJSON() {
    return this.entries.map((e) => ({ ...e, day: e.day ?? this.day }));
  }

  /** Puts earlier days' entries back on the page (see toJSON), oldest first, within the page's length. */
  restore(entries) {
    if (!Array.isArray(entries)) return;
    const kept = entries.filter((e) => e && typeof e.text === 'string' && Number.isFinite(e.day)).map((e) => ({ ...e, old: true }));
    this.entries = [...kept, ...this.entries].slice(-this.params.maxEntries);
  }

  update(dt) {
    this.clock += dt;
  }

  /**
   * Writes one entry. Returns it, or null if it's unknown or she wrote the same thing about the same quad a moment ago.
   * @param {{ quad: string, what: object, by?: string }} e `by` is who did it, if it wasn't her ("you")
   */
  write({ quad, what, by = null }) {
    const text = entryText(what);
    if (!text) return null;
    const recent = this.entries.some((e) => !e.old && e.quad === quad && e.text === text && this.clock - e.time < this.params.repeatSeconds);
    if (recent) return null;
    const entry = { time: this.clock, quad, text, by, day: this.day, what };
    this.entries.push(entry);
    while (this.entries.length > this.params.maxEntries) this.entries.shift();
    return entry;
  }

  /** Her ranking of the quads by how much they shake the girls: one line, replaced each time she works it out. `names` are the quads' short names, best first. */
  writeRanking(names) {
    if (!names.length) return null;
    const text = `Buzz ranking: ${names.join(', ')}`;
    const old = this.entries.findIndex((e) => e.ranking);
    if (old >= 0 && this.entries[old].text === text) return null;
    if (old >= 0) this.entries.splice(old, 1);
    const entry = { time: this.clock, quad: null, text, by: null, ranking: true, day: this.day };
    this.entries.push(entry);
    while (this.entries.length > this.params.maxEntries) this.entries.shift();
    return entry;
  }

  /** Fills the page with what she wrote before the game began (`startingEntries`): all shown as "Yesterday". */
  seed(entries) {
    for (const e of entries) this.entries.push({ time: -1, quad: e.quad, text: entryText(e.what), by: e.by ?? null, old: true, day: this.day - 1, what: e.what });
  }

  /** The page as lines, newest last: "0:42  Blue, belt slipping." */
  lines() {
    return this.entries.map((e) => formatEntry(e, this.day));
  }
}

/** When an entry was written: m:ss today, "Yesterday", "Day 3", or "Before" for what she wrote before the farm's first day. */
export function formatWhen(e, today = e.day ?? 1) {
  const day = e.day ?? today;
  if (day === today) return formatClock(e.time);
  if (day === today - 1) return 'Yesterday';
  return day < 1 ? 'Before' : `Day ${day}`;
}

export function formatClock(seconds) {
  if (seconds < 0) return 'Yesterday';
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatEntry(e, today) {
  if (!e.quad) return `${formatWhen(e, today)}  ${e.text}.`; // a note about no one quad (the buzz ranking)
  return `${formatWhen(e, today)}  ${e.quad}, ${e.text}${e.by ? ` (${e.by})` : ''}.`;
}

/**
 * What is true of one vehicle at the start of the game that she could have written down before it: the faults it already has, tinkering
 * left in, its quirks, who had it out last. The plug is read at the bench, so it isn't here.
 * @param {{ name: string, history?: object, quirks?: string[] }} v
 * @returns {{ quad: string, what: object, by?: string }[]}
 */
export function startingCandidates({ name, history, quirks = [] }) {
  const quad = shortName(name);
  const out = [];
  for (const f of history?.faults ?? []) out.push({ quad, what: { kind: 'fault', fault: f.kind } });
  if (history?.tinker?.limiter > 0) out.push({ quad, what: { kind: 'tinker', tinker: 'limiter' } });
  if (history?.tinker?.mixture > 0) out.push({ quad, what: { kind: 'tinker', tinker: 'mixture' } });
  for (const quirk of quirks) out.push({ quad, what: { kind: 'quirk', quirk } });
  if (history?.lastRider) out.push({ quad, what: { kind: 'rider', rider: history.lastRider } });
  return out;
}

/**
 * Which of those she had already written in the book: each with probability `startKnows` (she misses some, and never writes what isn't
 * true, and at most one note of who had a quad out), then between `startMin` and `startMax` of them, in a shuffled order.
 */
export function startingEntries(candidates, random, P = DEFAULT_LOGBOOK_PARAMS) {
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  let rider = false; // nearly every quad has a last rider, so one such note is plenty or they crowd out the faults
  const known = shuffled.filter((c) => {
    if (random() >= P.startKnows) return false;
    if (c.what.kind !== 'rider') return true;
    return !rider && (rider = true);
  });
  const count = P.startMin + Math.floor(random() * (Math.max(P.startMax, P.startMin) - P.startMin + 1));
  return known.slice(0, count);
}
