// Jess fills a quad from the diesel can by mistake. Now and then a free Jess, with a parked, unattended quad near her that is
// low on fuel, takes a few litres of red diesel to it and pours it in. Amy, if she's about, tells her off. Amy never does it.
// Pure logic: the game says who and what is where, this says who goes and when.

export const DEFAULT_DIESEL_MISTAKE_PARAMS = {
  startAfter: 240, // seconds into the game before she does
  chance: 0.004, // per second, for a free Jess with a suitable quad near her
  cooldown: 600, // seconds after one before she might again
  range: 35, // metres: the quad is this close to her
  lowFuel: 0.6, // she picks a quad that's under this full (she's being helpful)
  litres: 3, // what she pours in
  pourSeconds: 6, // how long she's stood there pouring
  amyRange: 18, // metres: Amy is this close to the quad and sees
  amyChance: 0.85, // that Amy says something
  jobTimeout: 45, // seconds she has to get there before it's forgotten
};

export const DIESEL_MISTAKE_PARAM_RANGES = {
  startAfter: [0, 900, 10],
  chance: [0, 0.1, 0.001],
  cooldown: [0, 1800, 30],
  range: [5, 80, 1],
  lowFuel: [0.1, 1, 0.05],
  litres: [0.5, 10, 0.5],
  pourSeconds: [1, 20, 0.5],
  amyRange: [3, 60, 1],
  amyChance: [0, 1, 0.05],
  jobTimeout: [10, 120, 5],
};

export class DieselMistake {
  constructor(params = { ...DEFAULT_DIESEL_MISTAKE_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.forced = false; // do it at the first chance (the debug panel)
    this.job = null; // { girl, spec, until }: she's on her way
    this.cooldownUntil = 0;
  }

  /** She got there and started pouring. */
  started() {
    this.job = null;
  }

  /** She's finished, or couldn't (the quad was taken, say). */
  finished() {
    this.job = null;
    this.cooldownUntil = this.clock + this.p.cooldown;
  }

  /**
   * One step. `ctx`:
   *   girls: [{ id, free, x, z }]
   *   quads: [{ id, x, z, speed, rider, driver, tipped, space, level }]    space: litres the tank has room for; level 0..1
   * Returns events: { type: 'go', girl, spec } (she is to go and do it).
   */
  update(dt, ctx) {
    const p = this.p;
    this.clock += dt;
    if (this.job && this.clock > this.job.until) this.finished();
    if (this.job) return [];
    const jess = ctx.girls.find((g) => g.id === 'jess');
    if (!jess?.free) return [];
    if (!this.forced && (this.clock < p.startAfter || this.clock < this.cooldownUntil || this.random() >= p.chance * dt)) return [];
    const options = ctx.quads.filter(
      (q) => !q.rider && !q.driver && !q.tipped && q.speed < 0.3 && q.space >= p.litres && (this.forced || q.level < p.lowFuel) && Math.hypot(q.x - jess.x, q.z - jess.z) <= p.range,
    );
    if (!options.length) return [];
    const q = options.reduce((a, b) => (b.level < a.level ? b : a));
    this.forced = false;
    this.job = { girl: 'jess', spec: q.id, until: this.clock + p.jobTimeout };
    return [{ type: 'go', girl: 'jess', spec: q.id }];
  }
}
