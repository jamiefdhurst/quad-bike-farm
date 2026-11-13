// A girl loads or unloads a Tor's or Crag's back. With nobody in the Tor or the Crag and a loose can, the toolbox or the like lying about
// near it, a free girl may go and put it in; with something in the back she may take it out and set it down beside. Going is an offer
// (the chooser, chooser.js); only the debug panel's forced one starts here. Pure logic: the game says what is standing where and who is
// free, and does the walking, the tailgate and the lifting.

export const DEFAULT_TIDY_LOAD_PARAMS = {
  startAfter: 240, // seconds into the game before she thinks of it
  cooldown: 420, // seconds after one of them has done it before anyone might again
  range: 60, // metres: she is this close to the vehicle
  itemRange: 25, // metres: the thing to load is this close to the vehicle
  loadShare: 0.6, // of her keenness when it is putting something in (she is less keen to take it out again)
  unloadShare: 0.4, // and when it is taking something out
  gateWait: 1.1, // seconds she waits for the tailgate or door to come open before she starts
  carrySeconds: 1.2, // seconds she holds the thing before it goes in or down
  closeWait: 1.0, // seconds after, before she shuts it again
  jobTimeout: 70, // seconds she has to get there and finish before it is forgotten
};

export const TIDY_LOAD_PARAM_RANGES = {
  startAfter: [0, 900, 10],
  cooldown: [0, 1800, 30],
  range: [10, 200, 5],
  itemRange: [3, 80, 1],
  loadShare: [0, 1, 0.05],
  unloadShare: [0, 1, 0.05],
  gateWait: [0.2, 4, 0.1],
  carrySeconds: [0.2, 4, 0.1],
  closeWait: [0, 4, 0.1],
  jobTimeout: [10, 180, 5],
};

export class TidyLoad {
  constructor(params = { ...DEFAULT_TIDY_LOAD_PARAMS }) {
    this.p = params;
    this.clock = 0;
    this.job = null; // { girl, vehicle, mode, until }: she is on her way, or at it
    this.cooldownUntil = 0;
  }

  /**
   * What could be done at a vehicle now, as modes: 'load' with something lying near it and room, 'unload' with something in it. `v`:
   * { id, free (nobody in or at the wheel, and not moving), loose (things lying within reach), loaded, room (spots free) }.
   */
  modes(v) {
    if (!v.free) return [];
    const out = [];
    if (v.loose > 0 && v.room > 0) out.push('load');
    if (v.loaded > 0) out.push('unload');
    return out;
  }

  /** Going, as offers for the chooser: [{ key: 'tidyLoad', girl, vehicle, mode, weight }], or none. */
  offers(ctx) {
    if (this.job || this.clock < this.p.startAfter || this.clock < this.cooldownUntil) return [];
    const out = [];
    for (const g of ctx.girls) {
      if (!g.free || g.weight <= 0) continue;
      for (const v of ctx.vehicles) {
        if (Math.hypot(g.x - v.x, g.z - v.z) > this.p.range) continue;
        for (const mode of this.modes(v)) out.push({ key: 'tidyLoad', girl: g.id, vehicle: v.id, mode, weight: g.weight * (mode === 'load' ? this.p.loadShare : this.p.unloadShare) });
      }
    }
    return out;
  }

  /** For the debug panel: this girl does it now at this vehicle, in this mode (or whichever is possible). Null if there is nothing to do. */
  force(ctx, girlId, vehicleId = null, mode = null) {
    const g = ctx.girls.find((o) => o.id === girlId && o.free);
    if (!g || this.job) return null;
    const near = (v) => Math.hypot(g.x - v.x, g.z - v.z);
    for (const v of [...ctx.vehicles].filter((x) => !vehicleId || x.id === vehicleId).sort((a, b) => near(a) - near(b))) {
      const m = this.modes(v).find((k) => !mode || k === mode);
      if (m) return this.take({ girl: g.id, vehicle: v.id, mode: m });
    }
    return null;
  }

  /** She chose to: books the job and returns the event the game acts on, { type: 'go', girl, vehicle, mode }. */
  take(offer) {
    this.job = { girl: offer.girl, vehicle: offer.vehicle, mode: offer.mode, until: this.clock + this.p.jobTimeout };
    return { type: 'go', girl: offer.girl, vehicle: offer.vehicle, mode: offer.mode };
  }

  finished() {
    this.job = null;
    this.cooldownUntil = this.clock + this.p.cooldown;
  }

  update(dt) {
    this.clock += dt;
    if (this.job && this.clock > this.job.until) this.finished();
  }

  describe() {
    if (this.job) return `${this.job.girl} is ${this.job.mode === 'load' ? 'loading' : 'unloading'} the ${this.job.vehicle}`;
    const left = this.cooldownUntil - this.clock;
    return left > 0 ? `resting for ${Math.round(left)} s` : this.clock < this.p.startAfter ? 'not yet' : 'waiting for something to carry';
  }
}
