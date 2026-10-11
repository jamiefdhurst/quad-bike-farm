// Nicking your quad. Get off with it still running and, now and then, Jess hops on and rides off with it, laughing, and brings it
// back eventually, muddier and with less fuel. Pure logic: when she could (this file: an offer the chooser weighs, chooser.js), what she does with it is Companion.nickQuad
// (a long drive, then HerDrive's park mode back to where you left it) and game.js's updateNicking.

export const DEFAULT_NICK_PARAMS = {
  startAfter: 120, // seconds into the game before anyone does it
  minWait: 3, // seconds after you get off before she can have it: long enough for it to look like you've wandered off
  window: 30, // seconds after you get off she may take it; leave it longer and the moment has gone
  weight: 1.5, // how keen she is while the window is open, times her own nickChance (Jess 1, Amy 0; chooser.js weighs it)
  minRange: 4, // metres: you're beyond this from the quad, so she isn't taking it from under you
  maxRange: 40, // metres: you're within this of it, so you can see it go
  girlRange: 35, // metres: she's this close to it
  cooldown: 360, // seconds before the same girl does it again
  awayMin: 40, // seconds she keeps it for
  awayMax: 90,
  churn: 0.35, // how torn up the ground is under her (0..1, like doughnuts but gentler): it's the mud it comes back wearing
  extraBurn: 0.02, // litres a second on top of what it burns, from her thrashing it about
  returnSpeed: 4, // m/s she brings it back at: quicker than tidying, not hurrying
  laughGap: 14, // seconds between her laughing while she's away with it
};

export const NICK_PARAM_RANGES = {
  startAfter: [0, 900, 5],
  minWait: [0, 30, 0.5],
  window: [5, 120, 1],
  weight: [0, 5, 0.05],
  minRange: [0, 20, 1],
  maxRange: [10, 120, 1],
  girlRange: [5, 120, 1],
  cooldown: [0, 1800, 10],
  awayMin: [10, 300, 5],
  awayMax: [10, 600, 5],
  churn: [0, 1, 0.05],
  extraBurn: [0, 0.2, 0.005],
  returnSpeed: [1, 8, 0.1],
  laughGap: [4, 60, 1],
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class Nicking {
  constructor(params = { ...DEFAULT_NICK_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.wasRiding = null; // the quad you were on last step
    this.left = null; // { id, at } the quad you've just got off, and when
    this.coolUntil = {}; // girl id -> time
  }

  /** How long she keeps it for, seconds. */
  awayFor() {
    return this.p.awayMin + this.random() * Math.max(0, this.p.awayMax - this.p.awayMin);
  }

  /**
   * One step. `ctx`:
   *   riding: the id of the quad you're at the controls of, or null
   *   you: { x, z }
   *   quads: [{ id, x, z, running, free }]      free: unattended, upright and nobody heading for it
   *   girls: [{ id, x, z, free, chance }]
   * Returns no events: it watches for you getting off with it running, and while the moment lasts offers it (offers, take).
   */
  update(dt, ctx) {
    const p = this.p;
    this.clock += dt;
    this.window = null;
    if (ctx.riding) {
      this.left = null;
    } else if (this.wasRiding) {
      this.left = { id: this.wasRiding, at: this.clock };
    }
    this.wasRiding = ctx.riding;
    const left = this.left;
    if (!left || ctx.riding || this.clock < p.startAfter) return [];
    const since = this.clock - left.at;
    if (since > p.window) {
      this.left = null;
      return [];
    }
    const quad = ctx.quads.find((q) => q.id === left.id);
    if (!quad || !quad.running || !quad.free || since < p.minWait) return [];
    const d = dist(ctx.you, quad);
    if (d < p.minRange || d > p.maxRange) return [];
    this.window = quad; // it's there for the taking
    return [];
  }

  /**
   * While the quad you got off is there for the taking (the same `ctx` as update, after update): [{ key: 'nick', girl, spec, weight }]
   * for each free girl near it with a taste for it (her nickChance) and her cooldown up.
   */
  offers(ctx) {
    const p = this.p;
    const quad = this.window;
    if (!quad) return [];
    return ctx.girls
      .filter((g) => g.free && g.chance && this.clock >= (this.coolUntil[g.id] ?? 0) && dist(g, quad) <= p.girlRange)
      .map((g) => ({ key: 'nick', girl: g.id, spec: quad.id, weight: p.weight * g.chance }));
  }

  /** She chose to: once per getting off, and her cooldown starts. Returns the event the game acts on, { type: 'nick', girl, spec }. */
  take(o) {
    this.coolUntil[o.girl] = this.clock + this.p.cooldown;
    this.left = null;
    this.window = null;
    return { type: 'nick', girl: o.girl, spec: o.spec };
  }
}
