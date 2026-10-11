// Comparing notes. Each girl keeps a tally of how much each quad has shaken her (contentment.js), so each has a favourite and the two don't
// always agree. Stood about together, now and then they compare: one asks which shakes the other most, each names hers, and when they differ they
// argue and, a third of the time, swap quads to settle it. Amy writes the combined ranking in her logbook. Pure logic: the game says how the
// tallies stand and who is free; this plans the exchange as a list of timed steps and the game does each one.

export const DEFAULT_COMPARE_PARAMS = {
  startAfter: 240, // seconds into the game before they compare
  minTotal: 60, // shake-seconds each girl must have felt across all the quads before she has a ranking worth arguing about
  together: 7, // metres: the two stood this close to each other
  weight: 1, // how keen she is to compare notes once they could (chooser.js weighs it; either girl can start it)
  cooldown: 300, // seconds between one comparison and the next
  stepGap: 4.5, // seconds between one line and the next (the lines are recorded, so their lengths aren't known here)
  jessFirst: 0.6, // chance Jess is the one who asks
  swapChance: 0.33, // of the times they disagree, the chance they swap quads to settle it
  swapStay: 45, // seconds each sits on the other's pick before they give their verdicts
};

export const COMPARE_PARAM_RANGES = {
  startAfter: [0, 1200, 10],
  minTotal: [0, 600, 10],
  together: [2, 20, 0.5],
  weight: [0, 5, 0.05],
  cooldown: [0, 1800, 10],
  stepGap: [1, 15, 0.5],
  jessFirst: [0, 1, 0.05],
  swapChance: [0, 1, 0.05],
  swapStay: [5, 300, 5],
};

/** The quads in order of how much a tally says they have shaken her, most first, leaving out any she has felt nothing on. */
export function ranking(buzz, only = null) {
  return Object.entries(buzz)
    .filter(([id, v]) => v > 0 && (!only || only(id)))
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}

/** Both girls' tallies added together, as a ranking. */
export function combinedRanking(a, b, only = null) {
  const sum = {};
  for (const t of [a, b]) for (const [id, v] of Object.entries(t)) sum[id] = (sum[id] ?? 0) + v;
  return ranking(sum, only);
}

const total = (buzz) => Object.values(buzz).reduce((s, v) => s + v, 0);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class ComparingNotes {
  constructor(params = { ...DEFAULT_COMPARE_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.coolUntil = 0;
    this.steps = []; // the exchange under way: { at, type, girl, kind?, spec? }
    this.time = 0; // seconds into it
    this.last = null; // the plan under way or just done: { first, second, agree, swap, ranking }
  }

  get busy() {
    return this.steps.length > 0;
  }

  /**
   * Plans a comparison now between two girls (also the debug button). `girls` is [{ id, buzz }]; `only` limits the quads to those that exist.
   * Returns the plan's description, or null if one of them has nothing to say.
   */
  plan(girls, only = null, { force = false } = {}) {
    const p = this.p;
    const [a, b] = this.random() < p.jessFirst ? [girls.find((g) => g.id === 'jess'), girls.find((g) => g.id === 'amy')] : [girls.find((g) => g.id === 'amy'), girls.find((g) => g.id === 'jess')];
    if (!a || !b) return null;
    const ra = ranking(a.buzz, only);
    const rb = ranking(b.buzz, only);
    if (!ra.length || !rb.length) return null;
    const agree = ra[0] === rb[0];
    const swap = !agree && ra[0] !== rb[0] && (force || this.random() < p.swapChance);
    const g = p.stepGap;
    const steps = [
      { at: 0, type: 'say', girl: a.id, kind: 'rankAsk' },
      { at: g, type: 'say', girl: a.id, kind: 'rankTop', spec: ra[0] },
      agree ? { at: 2 * g, type: 'say', girl: b.id, kind: 'rankAgree' } : { at: 2 * g, type: 'say', girl: b.id, kind: 'rankTop', spec: rb[0] },
      { at: 2 * g + 0.1, type: 'note', girl: 'amy' },
    ];
    if (!agree) steps.push({ at: 3 * g, type: 'say', girl: a.id, kind: 'rankDisagree' });
    if (swap) {
      steps.push({ at: 4 * g, type: 'swap', picks: { [a.id]: rb[0], [b.id]: ra[0] }, say: a.id });
      steps.push({ at: 4 * g + p.swapStay, type: 'say', girl: b.id, kind: 'rankVerdict' });
      steps.push({ at: 5 * g + p.swapStay, type: 'say', girl: a.id, kind: 'rankVerdict' });
    }
    this.steps = steps;
    this.time = 0;
    this.last = { first: a.id, second: b.id, agree, swap, ranking: combinedRanking(a.buzz, b.buzz, only) };
    return this.last;
  }

  /**
   * One step. `ctx`: { girls: [{ id, x, z, free, buzz }], floorFree, only }. Returns the steps now due (each { type, girl?, kind?, spec?, picks? }).
   * Starting one is an offer (offers, take).
   */
  update(dt, ctx) {
    this.clock += dt;
    if (!this.steps.length) return [];
    this.time += dt;
    return this.due();
  }

  /**
   * Comparing notes, offered to each girl (the same `ctx` as update): [{ key: 'compare', girl, weight }] when they're stood about together,
   * each with a ranking worth having, nobody else talking, and the cooldown up.
   */
  offers(ctx) {
    const p = this.p;
    if (this.steps.length || ctx.girls.length < 2 || this.clock < p.startAfter || this.clock < this.coolUntil || !ctx.floorFree) return [];
    const [a, b] = ctx.girls;
    if (!a.free || !b.free || dist(a, b) > p.together) return [];
    if (total(a.buzz) < p.minTotal || total(b.buzz) < p.minTotal) return [];
    return ctx.girls.map((g) => ({ key: 'compare', girl: g.id, weight: p.weight }));
  }

  /** One of them started it: plans it and returns the first steps due (none if one of them has nothing to say). */
  take(o, ctx) {
    return this.plan(ctx.girls, ctx.only) ? this.due() : [];
  }

  /** The steps whose time has come; when the last has gone, the cooldown starts. */
  due() {
    const due = this.steps.filter((s) => s.at <= this.time);
    this.steps = this.steps.filter((s) => s.at > this.time);
    if (!this.steps.length) this.coolUntil = this.clock + this.p.cooldown;
    return due;
  }
}
