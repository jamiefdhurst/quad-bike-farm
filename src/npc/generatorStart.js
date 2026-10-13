// A girl starts the barn's generator. When the barn is dark or the charger has a battery waiting on it and the set is off (with fuel
// in it), a free girl may go and pull the cord, a few goes if it won't catch. Going is an offer (the chooser, chooser.js); only the
// debug panel's forced one starts here. Pure logic: the game says what the set is doing and who is free.

export const DEFAULT_GENERATOR_START_PARAMS = {
  startAfter: 120, // seconds into the game before she thinks of it
  darkAbove: 0.3, // how dark it is (0 day, 1 night) before the barn wants its bulb
  cooldown: 300, // seconds after she has been before she might go again
  range: 70, // metres: she is this close to the generator
  tries: 4, // goes at the cord before she gives up
  tryGap: 1.9, // seconds between pulls
  jobTimeout: 60, // seconds she has to get there before it is forgotten
  amyRange: 25, // metres: the other girl is this close and comments
};

export const GENERATOR_START_PARAM_RANGES = {
  startAfter: [0, 900, 10],
  darkAbove: [0, 1, 0.05],
  cooldown: [0, 1800, 30],
  range: [10, 200, 5],
  tries: [1, 10, 1],
  tryGap: [1.2, 6, 0.1],
  jobTimeout: [10, 180, 5],
  amyRange: [3, 80, 1],
};

export class GeneratorStart {
  constructor(params = { ...DEFAULT_GENERATOR_START_PARAMS }) {
    this.p = params;
    this.clock = 0;
    this.forced = false; // go at the first chance (the debug panel)
    this.job = null; // { girl, until }: she is on her way
    this.cooldownUntil = 0;
  }

  /** Why anyone would want it on now, or null. `ctx`: set { running, fuel }, dark (0..1), charging (a battery is on the charger). */
  wants(ctx) {
    if (ctx.set.running || ctx.set.fuel <= 0) return null;
    if (ctx.charging) return 'the charger is waiting';
    if (ctx.dark > this.p.darkAbove) return 'the barn is dark';
    return null;
  }

  /** She got there and began pulling, or has finished or given up. */
  started() {
    this.job = null;
  }

  finished() {
    this.job = null;
    this.cooldownUntil = this.clock + this.p.cooldown;
  }

  update(dt) {
    this.clock += dt;
    if (this.job && this.clock > this.job.until) this.finished();
  }

  /** The girls who could go: free and near enough. */
  near(ctx) {
    return ctx.girls.filter((g) => g.free && Math.hypot(g.x - ctx.at.x, g.z - ctx.at.z) <= this.p.range);
  }

  /** Going, as offers for the chooser: [{ key: 'generatorStart', girl, weight }], or none. */
  offers(ctx) {
    if (this.job || this.clock < this.p.startAfter || this.clock < this.cooldownUntil || !this.wants(ctx)) return [];
    return this.near(ctx)
      .filter((g) => g.weight > 0)
      .map((g) => ({ key: 'generatorStart', girl: g.id, weight: g.weight }));
  }

  /** For the debug panel: the first free girl goes now (whether or not anyone wants it), or null. */
  force(ctx, girlId) {
    const g = ctx.girls.find((o) => o.id === girlId && o.free);
    return g ? this.take({ girl: g.id }) : null;
  }

  /** She chose to: books the job and returns the event the game acts on, { type: 'go', girl }. */
  take(offer) {
    this.job = { girl: offer.girl, until: this.clock + this.p.jobTimeout };
    return { type: 'go', girl: offer.girl };
  }

  describe() {
    if (this.job) return `${this.job.girl} is on her way to the generator`;
    const left = this.cooldownUntil - this.clock;
    return left > 0 ? `resting for ${Math.round(left)} s` : this.clock < this.p.startAfter ? 'not yet' : 'waiting for a reason';
  }
}
