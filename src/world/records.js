// The records on the barn's chalkboard: the best lap, drag run, hill climb and longest jump of the game, by whoever set them. Pure, tested.
// Times are kept for every quad as well as overall, so a slow quad is not compared with the quick one. They carry from day to day with the farm (farm/farmState.js); one set today is marked so.

export const RECORD_KINDS = {
  lap: { label: 'Lap of the track', better: 'lower' },
  drag: { label: 'Drag strip', better: 'lower' },
  climb: { label: 'Hill climb', better: 'lower' },
  jump: { label: 'Longest jump', better: 'higher' },
};

export const WHO_NAMES = { you: 'You', amy: 'Amy', jess: 'Jess' };

export const DEFAULT_RECORD_PARAMS = {
  jumpMinAir: 0.45, // seconds in the air before a landing counts as a jump (a bump or a kerb does not)
  jumpMinDistance: 4, // metres from take-off to landing before it counts
};

export const RECORD_PARAM_RANGES = {
  jumpMinAir: [0.1, 2, 0.05],
  jumpMinDistance: [1, 20, 0.5],
};

/** 83.4 seconds as "1:23.4", and 48.25 as "48.2 s" (under a minute needs no minutes). */
export function formatTime(seconds) {
  const s = Math.max(0, seconds);
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`;
}

export function formatValue(kind, value) {
  return RECORD_KINDS[kind].better === 'higher' ? `${value.toFixed(1)} m` : formatTime(value);
}

export class Records {
  constructor(day = 1) {
    this.day = day; // the farm's day: a record carries the day it was set
    this.bests = {}; // kind -> { who, value, quad, day }
    this.byQuad = {}; // kind -> quad id -> { who, value, day }
  }

  /** The records as plain data, for the farm's save. */
  toJSON() {
    return { bests: structuredClone(this.bests), byQuad: structuredClone(this.byQuad) };
  }

  /** Puts saved records back (see toJSON), keeping only kinds and values the board knows. */
  restore(s) {
    const ok = (r) => r && typeof r === 'object' && r.value > 0 && typeof r.who === 'string';
    for (const kind of Object.keys(RECORD_KINDS)) {
      if (ok(s?.bests?.[kind])) this.bests[kind] = { ...s.bests[kind] };
      const quads = s?.byQuad?.[kind];
      if (quads && typeof quads === 'object') {
        for (const [id, r] of Object.entries(quads)) if (ok(r)) (this.byQuad[kind] ??= {})[id] = { ...r };
      }
    }
  }

  beats(kind, value, old) {
    return !old || (RECORD_KINDS[kind].better === 'higher' ? value > old.value : value < old.value);
  }

  /**
   * Offers a result. Returns { record, quadBest, previous }: a new best overall, a new best on that quad, and the old overall best (or null).
   * A result that only matches the old one is not a record.
   */
  submit(kind, who, value, quad = null) {
    if (!RECORD_KINDS[kind] || !(value > 0)) return { record: false, quadBest: false, previous: null };
    const previous = this.bests[kind] ?? null;
    const record = this.beats(kind, value, previous);
    if (record) this.bests[kind] = { who, value, quad, day: this.day };
    let quadBest = false;
    if (quad) {
      const q = (this.byQuad[kind] ??= {});
      quadBest = this.beats(kind, value, q[quad]);
      if (quadBest) q[quad] = { who, value, day: this.day };
    }
    return { record, quadBest, previous };
  }

  best(kind) {
    return this.bests[kind] ?? null;
  }

  bestOn(kind, quad) {
    return this.byQuad[kind]?.[quad] ?? null;
  }

  /** One line per kind for the board: { kind, label, text, set, today }. After the first day, a record set today says so. */
  lines() {
    return Object.entries(RECORD_KINDS).map(([kind, k]) => {
      const b = this.bests[kind];
      const today = !!b && this.day > 1 && b.day === this.day;
      return { kind, label: k.label, set: !!b, today, text: b ? `${formatValue(kind, b.value)}  ${WHO_NAMES[b.who] ?? b.who}${today ? '  (today)' : ''}` : 'not yet' };
    });
  }
}

/** Measures jumps for one vehicle: take-off to landing along the ground. `update` returns { distance, air } on the step it lands, else null. */
export class JumpMeasure {
  constructor(params = DEFAULT_RECORD_PARAMS) {
    this.p = params;
    this.air = 0;
    this.from = null;
  }

  reset() {
    this.air = 0;
    this.from = null;
  }

  update(dt, { airborne, x, z }) {
    if (airborne) {
      if (!this.from) this.from = { x, z };
      this.air += dt;
      return null;
    }
    const from = this.from;
    const air = this.air;
    this.reset();
    if (!from || air < this.p.jumpMinAir) return null;
    const distance = Math.hypot(x - from.x, z - from.z);
    return distance >= this.p.jumpMinDistance ? { distance, air } : null;
  }
}
