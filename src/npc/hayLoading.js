// A girl loading the hay: while the bales lie in the field and the trailer is by them, a free girl may pick one up and throw it onto the
// trailer, and then another. Going is an offer (the chooser, chooser.js); only the debug panel's forced one starts here. Pure logic: the game
// says whether there is a bale to carry and where the girls are, and does the walking, carrying and throwing (game.js handleHayLoad).

export const DEFAULT_HAY_LOADING_PARAMS = {
  range: 90, // metres: she is this close to the bale to think of it
  cooldown: 3, // seconds after she has thrown one before she thinks of the next
  jobTimeout: 45, // seconds she has to get a bale up before the job is forgotten
  weight: 1, // how keen she is (times her own hayLoadWeight)
};

export const HAY_LOADING_PARAM_RANGES = {
  range: [10, 250, 5],
  cooldown: [0, 30, 0.5],
  jobTimeout: [10, 120, 5],
  weight: [0, 3, 0.05],
};

export class HayLoading {
  constructor(params = { ...DEFAULT_HAY_LOADING_PARAMS }) {
    this.p = params;
    this.clock = 0;
    this.jobs = {}; // girl id -> { until }
    this.rest = {}; // girl id -> clock when she is ready for the next
  }

  update(dt) {
    this.clock += dt;
    for (const id of Object.keys(this.jobs)) if (this.clock > this.jobs[id].until) this.finished(id);
  }

  /** `ctx`: ready (a bale to carry and the trailer by it), at ({ x, z } of the nearest loose bale), girls: [{ id, x, z, free, weight (her hayLoadWeight), gap (her hayCooldown) }]. */
  offers(ctx) {
    if (!ctx.ready || !ctx.at) return [];
    return ctx.girls
      .filter((g) => g.free && g.weight > 0 && !this.jobs[g.id] && this.clock >= (this.rest[g.id] ?? 0) && Math.hypot(g.x - ctx.at.x, g.z - ctx.at.z) <= this.p.range)
      .map((g) => ({ key: 'hayLoad', girl: g.id, weight: g.weight * this.p.weight }));
  }

  /** She chose to (or the panel forced it): books the job. Returns { type: 'go', girl }. */
  take(offer) {
    this.jobs[offer.girl] = { until: this.clock + this.p.jobTimeout };
    return { type: 'go', girl: offer.girl };
  }

  /** For the debug panel: the girl goes now if she is free and there is something to carry. */
  force(ctx, girlId) {
    const g = ctx.girls.find((o) => o.id === girlId && o.free);
    return g && ctx.ready && !this.jobs[girlId] ? this.take({ girl: g.id }) : null;
  }

  /** Whether she is on a job now. */
  busy(girlId) {
    return !!this.jobs[girlId];
  }

  /** Her job is over (the bale is up, or she was called away): she rests a moment (`gap`, her own) before the next. */
  finished(girlId, gap = this.p.cooldown) {
    delete this.jobs[girlId];
    this.rest[girlId] = this.clock + gap;
  }

  describe() {
    const on = Object.keys(this.jobs);
    return on.length ? `${on.join(' and ')} loading bales` : 'no one loading';
  }
}
