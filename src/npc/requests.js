// Favours. Now and then a girl asks you for something: wash her favourite quad,
// take her over to the straw bales, or fetch the jerry can. Doing it pleases her;
// leaving it, the request lapses and she remembers (a grudge that makes her
// short with you and more likely to say no). Nothing shows on screen: you have
// to remember what she said, and she'll remind you if you talk to her. Pure
// logic; the game says what's where, and does the talking and the favour score.

export const DEFAULT_REQUEST_PARAMS = {
  firstDelay: 180, // seconds into a game before anyone asks for anything
  cooldown: 240, // seconds after a girl asks (or a favour ends) before she asks again, at the soonest
  checkEvery: 5, // seconds between each look for a chance
  chance: 0.15, // chance per look, for a girl who's free, near you and due to ask
  askRange: 14, // metres she must be from you (you on foot) to ask
  expireAfter: 360, // seconds she waits before the request lapses
  grudgeFor: 600, // seconds she remembers a request you ignored
  doneFavour: 4, // favour score for doing what she asked
  ignoredFavour: -2, // favour score for letting it lapse
  grudgeRefuse: 0.15, // chance she says no to a request about a quad while she holds a grudge
  muddyAbove: 0.3, // her favourite quad must be this muddy (0..1) for her to ask you to wash it
  cleanBelow: 0.1, // and it's washed once it's below this
  balesRange: 7, // metres from the straw bales that counts as having taken her over
  canRange: 3, // metres from her the jerry can must be (held or put down) to count as fetched
  stopSpeed: 0.8, // m/s: the quad counts as stopped below this
  joinDelay: 1.5, // seconds after you get on a quad before the girl who asked for the bales sets off to climb on the back
  joinRange: 30, // metres she'll come from to get on the back of the quad you're on
};

export const REQUEST_PARAM_RANGES = {
  firstDelay: [0, 1200, 10],
  cooldown: [0, 1800, 10],
  checkEvery: [1, 30, 1],
  chance: [0, 1, 0.01],
  askRange: [3, 40, 1],
  expireAfter: [30, 1800, 10],
  grudgeFor: [30, 3600, 10],
  doneFavour: [0, 10, 0.1],
  ignoredFavour: [-10, 0, 0.1],
  grudgeRefuse: [0, 1, 0.05],
  muddyAbove: [0, 1, 0.05],
  cleanBelow: [0, 1, 0.05],
  balesRange: [2, 20, 0.5],
  canRange: [1, 10, 0.5],
  stopSpeed: [0.1, 3, 0.1],
  joinDelay: [0, 10, 0.5],
  joinRange: [5, 80, 1],
};

export const REQUEST_KINDS = ['wash', 'bales', 'can'];

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class Requests {
  constructor(params = { ...DEFAULT_REQUEST_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.nextCheck = params.checkEvery;
    this.lastAsk = {}; // girl id -> time
    this.open = []; // { girl, kind, quad?, since }
    this.grudges = {}; // girl id -> { kind, until, told }
    this.rideTime = 0; // how long you've been on the current quad
    this.rideQuad = null;
  }

  /**
   * The girl who asked to go to the bales, if she should now come and get on the
   * back of the quad you've just got on: she's still waiting, free, in range, and
   * the quad has a free pillion seat. She waits `joinDelay` after you mount so
   * you've time to see she's coming, and is only sent once per quad.
   * `ctx.ridden`: { id, hasPillion, pillion } for the quad you're on, or null.
   * Returns the girl's id, or null.
   */
  joiner(dt, ctx) {
    const q = ctx.ridden;
    if (!q) {
      this.rideQuad = null;
      this.rideTime = 0;
      return null;
    }
    if (this.rideQuad !== q.id) {
      this.rideQuad = q.id;
      this.rideTime = 0;
      this.sentFor = null;
    }
    this.rideTime += dt;
    if (this.rideTime < this.p.joinDelay || this.sentFor === q.id || !q.hasPillion || q.pillion) return null;
    const r = this.open.find((o) => o.kind === 'bales' && ctx.girls.some((g) => g.id === o.girl && g.free && dist(g, ctx.you) <= this.p.joinRange));
    if (!r) return null;
    this.sentFor = q.id;
    return r.girl;
  }

  /** The request she's waiting on, if any. */
  openFor(girl) {
    return this.open.find((r) => r.girl === girl) ?? null;
  }

  /** Whether she's holding a grudge: { kind, told } or null. */
  grudge(girl) {
    const g = this.grudges[girl];
    return g && g.until > this.clock ? g : null;
  }

  /** The chance she says no to a request about a quad, on account of a grudge. */
  refuseChance(girl) {
    return this.grudge(girl) ? this.p.grudgeRefuse : 0;
  }

  /**
   * One step. `ctx`:
   *   you: { x, z, onFoot }
   *   girls: [{ id, x, z, free, favourite }]       free: stood about, nothing on; favourite: her favourite quad's id
   *   quads: [{ id, x, z, muddy, speed, ridden, hasPillion, pillion }]   pillion: id of the girl on the back (or front rack), if any
   *   can: { x, z, held }
   *   bales: [{ x, z }]
   * Returns events: { type: 'ask' | 'done' | 'lapsed', request }.
   */
  update(dt, ctx) {
    const events = [];
    this.clock += dt;
    for (const r of [...this.open]) {
      const end = (type) => {
        this.open.splice(this.open.indexOf(r), 1);
        this.lastAsk[r.girl] = this.clock;
        events.push({ type, request: r });
      };
      if (this.fulfilled(r, ctx)) {
        delete this.grudges[r.girl];
        end('done');
      } else if (this.clock - r.since > this.p.expireAfter) {
        this.grudges[r.girl] = { kind: r.kind, until: this.clock + this.p.grudgeFor, told: false };
        end('lapsed');
      }
    }
    if (this.clock < this.nextCheck) return events;
    this.nextCheck = this.clock + this.p.checkEvery;
    if (this.clock < this.p.firstDelay || !ctx.you.onFoot) return events;
    const options = [];
    for (const g of ctx.girls) {
      if (!g.free || this.openFor(g.id) || this.clock - (this.lastAsk[g.id] ?? -Infinity) < this.p.cooldown) continue;
      if (dist(g, ctx.you) > this.p.askRange) continue;
      for (const kind of REQUEST_KINDS) {
        const target = this.target(kind, g, ctx);
        if (target) options.push({ girl: g.id, kind, ...target });
      }
    }
    if (!options.length || this.random() >= this.p.chance) return events;
    const o = options[Math.floor(this.random() * options.length)];
    const request = { girl: o.girl, kind: o.kind, quad: o.quad, since: this.clock };
    this.open.push(request);
    this.lastAsk[o.girl] = this.clock;
    events.push({ type: 'ask', request });
    return events;
  }

  /** Whether she could ask for this now, and what about. */
  target(kind, girl, ctx) {
    const p = this.p;
    if (kind === 'wash') {
      const q = ctx.quads.find((x) => x.id === girl.favourite);
      return q && q.muddy > p.muddyAbove ? { quad: q.id } : null;
    }
    if (kind === 'bales') return ctx.bales.length && ctx.quads.some((q) => q.hasPillion && !q.pillion) ? {} : null;
    // The can: not already by her, and nobody holding it near her.
    return dist(ctx.can, girl) > p.canRange * 2 ? {} : null;
  }

  fulfilled(r, ctx) {
    const p = this.p;
    const girl = ctx.girls.find((g) => g.id === r.girl);
    if (!girl) return false;
    if (r.kind === 'wash') return (ctx.quads.find((q) => q.id === r.quad)?.muddy ?? 1) < p.cleanBelow;
    if (r.kind === 'can') return dist(ctx.can, girl) <= p.canRange && (ctx.can.held ? dist(ctx.you, girl) <= p.canRange : true);
    // Bales: on the back of a quad you're on, stopped near them.
    const q = ctx.quads.find((x) => x.pillion === r.girl && x.ridden);
    return !!q && Math.abs(q.speed) < p.stopSpeed && ctx.bales.some((b) => dist(b, q) <= p.balesRange);
  }
}
