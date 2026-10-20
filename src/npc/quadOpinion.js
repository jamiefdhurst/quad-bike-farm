// What a girl has made of the quads (#27, was TODO 132). Each quad is a little better at one thing (vehicle/strength.js) and nobody
// says which. She works it out by riding: every second she spends on a quad going up a slope, through mud or along tarmac adds to what
// she knows of it there. Until she knows it she goes on a hunch, her own and different from her friend's, so early on the two disagree;
// the more she has ridden it the nearer her view gets to the truth, so over a few games they settle. Pure: the game says where she is
// riding and what the truth is; this keeps the tally and says which quad she thinks best at what.

import { STRENGTH_KINDS } from '../vehicle/strength.js';

export const DEFAULT_OPINION_PARAMS = {
  tau: 150, // seconds on a kind of ground before her view is two thirds of the way from her hunch to the truth
  minSeconds: 20, // seconds on a quad on that ground before she has any view of it
  hunch: 0.08, // how far off the truth her first idea can be (a share, like the strength itself)
  pull: 0.6, // how much her view of a quad swings her choice of which to take for a drive (1 plus this times how good she thinks it is)
  cap: 1200, // the most seconds kept for a quad on one kind of ground
  kept: 0.5, // the share of what she has worked out that the next game still has
};

export const OPINION_PARAM_RANGES = {
  tau: [10, 1000, 10],
  minSeconds: [0, 300, 5],
  hunch: [0, 0.3, 0.01],
  pull: [0, 3, 0.05],
  cap: [100, 6000, 100],
  kept: [0, 1, 0.05],
};

/** The live values (the Tune tab edits this in place). */
export const OPINION_PARAMS = { ...DEFAULT_OPINION_PARAMS };

/** A steady number in -1..1 for a name, so a girl's hunch about a quad never changes between loads. */
export function hunchOf(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

export class QuadOpinion {
  constructor(girl) {
    this.girl = girl;
    this.seen = {}; // spec id -> { hill, mud, tarmac } seconds spent riding it on that ground
  }

  /** She has ridden `specId` for `dt` seconds on `kind` of ground. */
  ride(dt, specId, kind, p = OPINION_PARAMS) {
    if (!STRENGTH_KINDS.includes(kind)) return;
    const s = (this.seen[specId] ??= {});
    s[kind] = Math.min(p.cap, (s[kind] ?? 0) + dt);
  }

  seconds(specId, kind) {
    return this.seen[specId]?.[kind] ?? 0;
  }

  /** How much better than the others she thinks `specId` is on `kind` of ground (a share like the strength), or null before she has a view. */
  view(specId, kind, truth, p = OPINION_PARAMS) {
    const e = this.seconds(specId, kind);
    if (e < p.minSeconds) return null;
    const k = 1 - Math.exp(-e / p.tau);
    return truth * k + p.hunch * hunchOf(`${this.girl}:${specId}:${kind}`) * (1 - k);
  }

  /** The quad she thinks best on `kind` of ground among `ids` (those she has a view of; at least two to compare), or null. `truthOf(id, kind)`. */
  best(kind, ids, truthOf, p = OPINION_PARAMS) {
    const seen = ids.map((id) => [id, this.view(id, kind, truthOf(id, kind), p)]).filter(([, v]) => v !== null);
    if (seen.length < 2) return null;
    seen.sort((a, b) => b[1] - a[1]);
    return seen[0][0];
  }

  /** How good she thinks `specId` is at its best, 0..1 of the strength (so a weight to take it for a drive is 1 + pull * this). 0 with no view. */
  keenness(specId, truthOf, amount, p = OPINION_PARAMS) {
    let top = 0;
    for (const kind of STRENGTH_KINDS) {
      const v = this.view(specId, kind, truthOf(specId, kind), p);
      if (v !== null && v > top) top = v;
    }
    return amount > 0 ? Math.min(1, top / amount) : 0;
  }

  /** Plain data for the save: the seconds. */
  capture() {
    return structuredClone(this.seen);
  }

  /** Back from the save with `kept` of the time, so she has worked out less than she had. */
  restore(saved, p = OPINION_PARAMS) {
    this.seen = {};
    if (!saved || typeof saved !== 'object') return;
    for (const [id, kinds] of Object.entries(saved)) {
      if (!kinds || typeof kinds !== 'object') continue;
      for (const kind of STRENGTH_KINDS) {
        const v = kinds[kind];
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) (this.seen[id] ??= {})[kind] = Math.min(p.cap, v * p.kept);
      }
    }
  }

  forget() {
    this.seen = {};
  }

  /** For the debug panel: "hill: red, mud: blue; still learning the green". */
  describe(ids, truthOf, p = OPINION_PARAMS) {
    const picks = STRENGTH_KINDS.map((k) => [k, this.best(k, ids, truthOf, p)]).filter(([, id]) => id);
    return picks.length ? picks.map(([k, id]) => `${k}: ${id}`).join(', ') : 'no views yet';
  }
}

/** Where the two girls differ: the kinds of ground each thinks a different quad best on, as [{ kind, a, b }], once each has a view. */
export function disagreements(opA, opB, ids, truthOf, p = OPINION_PARAMS) {
  const out = [];
  for (const kind of STRENGTH_KINDS) {
    const a = opA.best(kind, ids, truthOf, p);
    const b = opB.best(kind, ids, truthOf, p);
    if (a && b && a !== b) out.push({ kind, a, b });
  }
  return out;
}

/** Where they agree on a pick, as [{ kind, id }]. */
export function agreements(opA, opB, ids, truthOf, p = OPINION_PARAMS) {
  const out = [];
  for (const kind of STRENGTH_KINDS) {
    const a = opA.best(kind, ids, truthOf, p);
    if (a && a === opB.best(kind, ids, truthOf, p)) out.push({ kind, id: a });
  }
  return out;
}
