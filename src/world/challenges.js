// The challenges on the barn's chalkboard (#44, was TODO 149): start every quad from cold inside five minutes, the tidiest line-up in the yard's
// painted bays, and a clean run up the hill. Only you attempt them; the girls say something when you finish. Pure, tested.
// Each keeps its best, carried from day to day with the farm (farm/farmState.js); one set today is marked so.

import { formatTime } from './records.js';

export const CHALLENGE_KINDS = {
  coldStart: { label: 'Cold start', better: 'lower', unit: 'time', blurb: 'Start every quad from cold inside five minutes' },
  lineUp: { label: 'Line-up', better: 'higher', unit: 'score', blurb: 'Park the quads tidily in the painted bays' },
  cleanClimb: { label: 'Clean climb', better: 'lower', unit: 'time', blurb: 'Up the hill without a stall or a tip' },
};

export const DEFAULT_CHALLENGE_PARAMS = {
  coldLimit: 300, // seconds you have to get every cold quad started
  coldMin: 2, // quads that must be cold for the challenge to be worth timing
  bayReach: 1.6, // metres from a bay's middle a parked quad still counts as in it
  bayParkedSpeed: 0.3, // m/s: a quad faster than this is not parked
  posForgive: 1.0, // metres off the middle of its bay that scores nothing for position
  headForgive: 0.5, // radians off straight in its bay that scores nothing for heading
  headWeight: 0.4, // how much of a quad's marks are for heading (the rest are for position)
  lineUpMin: 3, // quads in bays before a line-up can be judged
};

export const CHALLENGE_PARAM_RANGES = {
  coldLimit: [60, 900, 10],
  coldMin: [1, 6, 1],
  bayReach: [0.6, 4, 0.1],
  bayParkedSpeed: [0.05, 2, 0.05],
  posForgive: [0.2, 3, 0.1],
  headForgive: [0.1, 1.5, 0.05],
  headWeight: [0, 1, 0.05],
  lineUpMin: [1, 6, 1],
};

/** The bays' middles from the layout's line-up: `count` of them side by side across the row, each facing `yaw` (a quad's forward is sin, cos of its yaw). */
export function bayPlaces(lineUp) {
  const across = { x: Math.cos(lineUp.yaw), z: -Math.sin(lineUp.yaw) };
  return Array.from({ length: lineUp.bays }, (_, i) => {
    const o = (i - (lineUp.bays - 1) / 2) * lineUp.spacing;
    return { x: lineUp.x + across.x * o, z: lineUp.z + across.z * o, yaw: lineUp.yaw };
  });
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** The smallest angle between two headings, 0..PI. */
export function headingGap(a, b) {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
}

/**
 * Judges the line-up. `parked` is the quads { id, x, z, yaw, speed, occupied }; a parked, unoccupied one within `bayReach` of a bay's middle is in it
 * (each bay holds the nearest). Each quad earns up to 1 for how near the middle and how straight it sits, and the score is the total over the bays
 * out of 100, so every bay filled perfectly is 100. Returns { score, inBays, ok, why }; `ok` is false when too few are in bays to judge.
 */
export function judgeLineUp(bays, parked, p = DEFAULT_CHALLENGE_PARAMS) {
  const taken = new Set();
  let total = 0;
  let inBays = 0;
  for (const bay of bays) {
    let best = null;
    for (const q of parked) {
      if (taken.has(q.id) || q.occupied || q.speed > p.bayParkedSpeed) continue;
      const d = Math.hypot(q.x - bay.x, q.z - bay.z);
      if (d <= p.bayReach && (!best || d < best.d)) best = { q, d };
    }
    if (!best) continue;
    taken.add(best.q.id);
    inBays++;
    const pos = 1 - clamp01(best.d / p.posForgive);
    const head = 1 - clamp01(headingGap(best.q.yaw, bay.yaw) / p.headForgive);
    total += pos * (1 - p.headWeight) + head * p.headWeight;
  }
  const score = Math.round((total / Math.max(1, bays.length)) * 100);
  if (inBays < p.lineUpMin) return { score, inBays, ok: false, why: `Only ${inBays} in the bays. It needs ${p.lineUpMin}, parked and with nobody on.` };
  return { score, inBays, ok: true, why: '' };
}

/**
 * The cold-start clock. `start` takes the quads that are cold (never run since the day began); each counts once it is seen running. `update` returns
 * 'done' on the step the last one runs, 'out' when the time is up, else null.
 */
export class ColdStartRun {
  constructor(p = DEFAULT_CHALLENGE_PARAMS) {
    this.p = p;
    this.state = 'idle'; // 'idle', 'running', 'done' or 'out'
    this.time = 0;
    this.left = new Set(); // ids still to be started
    this.total = 0;
  }

  /** Begins timing for these cold quads. Returns false (and does nothing) when fewer than `coldMin` are cold. */
  start(coldIds) {
    if (coldIds.length < this.p.coldMin) return false;
    this.state = 'running';
    this.time = 0;
    this.left = new Set(coldIds);
    this.total = coldIds.length;
    return true;
  }

  get active() {
    return this.state === 'running';
  }

  cancel() {
    this.state = 'idle';
    this.left.clear();
  }

  update(dt, runningIds) {
    if (this.state !== 'running') return null;
    this.time += dt;
    for (const id of runningIds) this.left.delete(id);
    if (!this.left.size) {
      this.state = 'done';
      return 'done';
    }
    if (this.time > this.p.coldLimit) {
      this.state = 'out';
      return 'out';
    }
    return null;
  }
}

/** Whether a hill climb of yours has stayed clean: it is spoiled by the engine stopping or the quad on its side at any moment of the run. */
export class CleanWatch {
  constructor() {
    this.clean = true;
  }

  reset() {
    this.clean = true;
  }

  update({ running, tipped }) {
    if (!running || tipped) this.clean = false;
    return this.clean;
  }
}

export function formatChallenge(kind, value) {
  return CHALLENGE_KINDS[kind].unit === 'score' ? `${Math.round(value)} / 100` : formatTime(value);
}

export class Challenges {
  constructor(day = 1) {
    this.day = day;
    this.bests = {}; // kind -> { value, day }
  }

  toJSON() {
    return { bests: structuredClone(this.bests) };
  }

  restore(s) {
    for (const kind of Object.keys(CHALLENGE_KINDS)) {
      const r = s?.bests?.[kind];
      if (r && typeof r === 'object' && r.value > 0) this.bests[kind] = { value: r.value, day: r.day ?? 0 };
    }
  }

  /** Offers a result. Returns { best, previous }: a new best (a tie is not one) and the old one or null. */
  submit(kind, value) {
    if (!CHALLENGE_KINDS[kind] || !(value > 0)) return { best: false, previous: null };
    const previous = this.bests[kind] ?? null;
    const better = CHALLENGE_KINDS[kind].better === 'higher' ? value > previous?.value : value < previous?.value;
    const best = !previous || better;
    if (best) this.bests[kind] = { value, day: this.day };
    return { best, previous };
  }

  /** One line per challenge for the card: { kind, label, blurb, set, today, text }. */
  lines() {
    return Object.entries(CHALLENGE_KINDS).map(([kind, k]) => {
      const b = this.bests[kind];
      const today = !!b && this.day > 1 && b.day === this.day;
      return { kind, label: k.label, blurb: k.blurb, set: !!b, today, text: b ? `${formatChallenge(kind, b.value)}${today ? '  (today)' : ''}` : 'not yet' };
    });
  }
}
