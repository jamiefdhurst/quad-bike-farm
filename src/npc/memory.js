// What she remembers about how things went (TODO 15). Each kind of thing she chooses to do has a multiplier on its weight, 1 when she
// has no feeling about it: a bog or a tip makes her warier of driving (under 1), a win makes her keener on the race (over 1). The chooser
// (game.js updateMinds) multiplies it into the offer's weight, so it nudges what she picks and nothing else. It drifts back to 1 with
// time, quicker for the girl who forgets quicker, and half of it is kept in the farm's save (farmState.js). Pure.

/**
 * What happened, and which offer kinds it changes her feeling for and by how much (added to the multiplier, so a bad
 * outcome is negative). Keys are the events the game reports with `note(outcome)`.
 */
export const OUTCOMES = {
  bogged: { drive: -0.25, bigGo: -0.2, convoy: -0.1 },
  tipped: { drive: -0.3, bigGo: -0.3, climb: -0.2, cones: -0.1, convoy: -0.15 },
  raceWon: { race: 0.25, raceDare: 0.25, convoy: 0.05 },
  raceLost: { race: -0.15, raceDare: -0.15 },
  dragWon: { dragDare: 0.25 },
  dragLost: { dragDare: -0.15 },
  climbDone: { climb: 0.1 },
  climbRecord: { climb: 0.3 },
  conesClean: { cones: 0.25 },
  conesMessy: { cones: -0.1 },
  prankLanded: { prank: 0.2 },
};

/** Every offer kind any outcome touches, for the debug panel and the console. */
export const REMEMBERED_KINDS = [...new Set(Object.values(OUTCOMES).flatMap((o) => Object.keys(o)))];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Memory {
  constructor() {
    this.feel = {}; // offer kind -> multiplier (missing means 1)
    this.last = null; // { outcome, at } for the debug panel
    this.clock = 0;
  }

  /** How much she feels for this kind of thing now (1: nothing). */
  weight(key) {
    return this.feel[key] ?? 1;
  }

  /** Something happened: nudges every offer kind it touches, by `strength` times the outcome's amount, within her limits. */
  note(outcome, p, strength = 1) {
    const change = OUTCOMES[outcome];
    if (!change) return false;
    for (const [key, d] of Object.entries(change)) this.feel[key] = clamp(this.weight(key) + d * strength * p.memoryStrength, p.memoryMin, p.memoryMax);
    this.last = { outcome, at: this.clock };
    return true;
  }

  /** Time passes: each feeling eases back towards 1 at `memoryFade` a second, and is dropped once it's near enough. */
  update(dt, p) {
    this.clock += dt;
    for (const key of Object.keys(this.feel)) {
      const v = this.feel[key];
      const step = p.memoryFade * dt;
      const next = v > 1 ? Math.max(1, v - step) : Math.min(1, v + step);
      if (Math.abs(next - 1) < 0.005) delete this.feel[key];
      else this.feel[key] = next;
    }
  }

  /** Whether she's wary (-1), keen (1) or neither (0) of something, for her saying so: past `memoryLineAt` either side of 1. */
  attitude(key, p) {
    const w = this.weight(key);
    return w <= 1 - p.memoryLineAt ? -1 : w >= 1 + p.memoryLineAt ? 1 : 0;
  }

  forget() {
    this.feel = {};
    this.last = null;
  }

  /** Plain data for the save: only what's off 1. */
  capture() {
    return { ...this.feel };
  }

  /** Back from the save, pulled `kept` of the way from 1 (half: she doesn't hold a grudge for ever, or forget at once). */
  restore(saved, kept, p) {
    this.forget();
    if (!saved || typeof saved !== 'object') return;
    for (const [key, v] of Object.entries(saved)) {
      if (typeof v !== 'number' || !Number.isFinite(v) || !REMEMBERED_KINDS.includes(key)) continue;
      const w = clamp(1 + (v - 1) * kept, p.memoryMin, p.memoryMax);
      if (Math.abs(w - 1) >= 0.005) this.feel[key] = w;
    }
  }

  /** What she feels, for the debug panel: "drive 0.70 (wary), race 1.25 (keen)", or "nothing in particular". */
  describe() {
    const parts = Object.entries(this.feel).map(([k, v]) => `${k} ${v.toFixed(2)}${v < 1 ? ' (wary)' : ' (keen)'}`);
    return parts.length ? parts.join(', ') : 'nothing in particular';
  }
}
