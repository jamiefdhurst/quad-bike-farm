// Making up. A while into a falling out (fallingOut.js) one of the girls makes the first move: she takes her friend a mug of tea, or
// hands over her own favourite quad. Both are offers for the chooser (chooser.js) that meet company, so when she does it follows from
// how much she is missing her friend; this never starts either itself. The one at fault gets there first, the other a while later.
// Her friend may take it or not; taking it ends the row. Pure logic: the game says who is where and what is parked, this says
// who could make the gesture and what comes of it.

export const DEFAULT_MAKE_UP_PARAMS = {
  firstAfter: 45, // seconds into a falling out before the girl at fault thinks of making the first move
  otherAfter: 90, // and the seconds after that before the other girl might
  weight: 0.8, // how much she cares for making it up (weighed against everything else she could do, chooser.js)
  quadWeight: 1, // times this for the quad, which costs her more than a cup of tea
  range: 60, // metres: her friend is this close to her
  acceptChance: 0.85, // chance her friend takes it
  refusedCooldown: 150, // seconds before she tries again after being turned down
  handTimeout: 45, // seconds she has to get there before it's forgotten
};

export const MAKE_UP_PARAM_RANGES = {
  firstAfter: [0, 300, 5],
  otherAfter: [0, 300, 5],
  weight: [0, 3, 0.05],
  quadWeight: [0, 3, 0.05],
  range: [5, 200, 5],
  acceptChance: [0, 1, 0.05],
  refusedCooldown: [0, 600, 10],
  handTimeout: [10, 120, 5],
};

export class MakeUp {
  constructor(params = { ...DEFAULT_MAKE_UP_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.forced = null; // a girl id to make the first move at the first chance (the debug panel)
    this.pending = {}; // girl id -> { how, until }: on her way
    this.coolUntil = {};
  }

  update(dt) {
    this.clock += dt;
    for (const [girl, job] of Object.entries(this.pending)) if (this.clock > job.until) delete this.pending[girl];
  }

  /** Whether this girl is on her way to make it up. */
  busy(girl) {
    return !!this.pending[girl];
  }

  /**
   * What each girl could do now. `ctx`: { fallenOut, since (seconds the falling out has lasted), fault (the girl most at fault),
   * girls: [{ id, free, x, z, settled (her friend is stood or sat about, so there is someone to walk up to), quad (spec id of her
   * favourite if it's parked, upright and her friend could drive it, else null) }] }.
   * Returns [{ key: 'makeUpTea' | 'makeUpQuad', girl, friend, quad?, weight }].
   */
  offers(ctx) {
    const p = this.p;
    if (!ctx.fallenOut || ctx.girls.length < 2) return [];
    const out = [];
    for (const g of ctx.girls) {
      const wait = g.id === ctx.fault ? p.firstAfter : p.firstAfter + p.otherAfter;
      const forced = this.forced === g.id;
      if (!g.free || this.pending[g.id] || (!forced && (ctx.since < wait || this.clock < (this.coolUntil[g.id] ?? 0)))) continue;
      const f = ctx.girls.find((o) => o.id !== g.id);
      if (!f.settled || Math.hypot(g.x - f.x, g.z - f.z) > p.range) continue;
      out.push({ key: 'makeUpTea', girl: g.id, friend: f.id, weight: p.weight });
      if (g.quad) out.push({ key: 'makeUpQuad', girl: g.id, friend: f.id, quad: g.quad, weight: p.weight * p.quadWeight });
    }
    return out;
  }

  /** She chose to: the event the game acts on, { type: 'makeUp', how: 'tea' | 'quad', girl, friend, quad? }. */
  take(offer) {
    if (this.forced === offer.girl) this.forced = null;
    const how = offer.key === 'makeUpQuad' ? 'quad' : 'tea';
    this.pending[offer.girl] = { how, until: this.clock + this.p.handTimeout };
    return { type: 'makeUp', how, girl: offer.girl, friend: offer.friend, quad: offer.quad ?? null };
  }

  /** She got there with it. Returns whether her friend takes it; if not, she waits before trying again. */
  offered(girl) {
    delete this.pending[girl];
    const accepted = this.random() < this.p.acceptChance;
    if (!accepted) this.coolUntil[girl] = this.clock + this.p.refusedCooldown;
    return accepted;
  }

  /** She couldn't (her friend walked off, the quad was taken): forget it. */
  cancel(girl) {
    delete this.pending[girl];
  }
}
