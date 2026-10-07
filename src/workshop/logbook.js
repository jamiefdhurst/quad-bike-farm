// Amy's logbook: a notebook on the workbench where she writes down what's been found and done to the quads ("Blue, belt slipping.
// Green, plug black."). She writes what she really saw (her walk-round, a plug pulled in front of her, a bench job), so unlike Jess it's true.
// Pure logic, no Three.js or DOM. The notebook itself and the page you read are in notebook.js.

export const DEFAULT_LOGBOOK_PARAMS = {
  maxEntries: 40, // the page is full after this many: the oldest entries are dropped
  repeatSeconds: 120, // she won't write the same thing about the same quad again inside this long
  writeRange: 15, // how close (m) you have to be for her to see a bench job or a plug and write it up
};

export const LOGBOOK_PARAM_RANGES = {
  maxEntries: [10, 100, 1],
  repeatSeconds: [0, 600, 10],
  writeRange: [3, 40, 1],
};

/** What she writes for each walk-round finding (the keys of WALK_FINDINGS in walkRound.js). */
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
  tyre: 'tyre mended',
  oil: 'two-stroke oil topped up',
  packing: 'silencer repacked',
  sump: 'engine oil topped up',
};

/** "Blue quad" is just "Blue" in a notebook; "Mini moto" stays as it is. */
export function shortName(name) {
  return name.replace(/ quad$/, '');
}

/** The text of an entry: { kind: 'walk', finding } | { kind: 'plug', reading } | { kind: 'job', job, botched } | { kind: 'oil' } */
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
    default:
      return null;
  }
}

export class Logbook {
  constructor(params = DEFAULT_LOGBOOK_PARAMS) {
    this.params = params;
    this.entries = [];
    this.clock = 0; // seconds into the game
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
    const recent = this.entries.some((e) => e.quad === quad && e.text === text && this.clock - e.time < this.params.repeatSeconds);
    if (recent) return null;
    const entry = { time: this.clock, quad, text, by };
    this.entries.push(entry);
    while (this.entries.length > this.params.maxEntries) this.entries.shift();
    return entry;
  }

  /** The page as lines, newest last: "0:42  Blue, belt slipping." */
  lines() {
    return this.entries.map((e) => formatEntry(e));
  }
}

export function formatClock(seconds) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatEntry(e) {
  return `${formatClock(e.time)}  ${e.quad}, ${e.text}${e.by ? ` (${e.by})` : ''}.`;
}
