// Talking about you. When the girls think you can't hear, they talk about you. Come up on them quietly (on foot, nothing
// running nearby) and you catch an exchange or two; get close, run at them, start an engine or open the wheel and they
// notice, stop dead mid-line and, after a silence, one of them covers for it. Being near only gives you away to a girl who can see you
// (npc/sight.js): behind the barn you can stand right by them. Pure logic: the game says who is where, and
// `speak(speaker, text, opts)` does the talking and returns how long the line lasts; `cut()` stops whoever is talking.

export const DEFAULT_GOSSIP_PARAMS = {
  startAfter: 60, // seconds into the game before they say anything about you
  hearMin: 4.5, // metres: any nearer and a girl who can see you has seen you
  hearClose: 1.5, // metres: any nearer and they know you're there whatever is in the way
  hearMax: 14, // metres: any further and you couldn't make out the words
  together: 7, // metres: the two of them have to be this close to each other to be talking
  runSpeed: 3.2, // m/s: faster than this, within noticeRange, is heard coming
  noticeRange: 20, // metres: how far off a run, or a running engine, gives you away
  settle: 2, // seconds you have to have crept into earshot before they start
  chance: 0.4, // per second once settled
  cooldown: 150, // seconds between one lot of gossip and the next
  silence: 0.9, // seconds they stand there mid-sentence, caught, before one of them speaks
};

export const GOSSIP_PARAM_RANGES = {
  startAfter: [0, 600, 5],
  hearMin: [1, 20, 0.5],
  hearClose: [0.5, 5, 0.5],
  hearMax: [5, 40, 0.5],
  together: [2, 20, 0.5],
  runSpeed: [1, 8, 0.1],
  noticeRange: [5, 60, 1],
  settle: [0, 10, 0.5],
  chance: [0, 2, 0.05],
  cooldown: [0, 900, 10],
  silence: [0, 3, 0.1],
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class Gossip {
  constructor(exchanges, params = { ...DEFAULT_GOSSIP_PARAMS }, random = Math.random) {
    this.exchanges = exchanges;
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.coolUntil = 0;
    this.creeping = 0; // seconds you've been in earshot without being noticed
    this.used = new Map(); // exchange -> times used
    this.running = null; // { exchange, index, wait, last }
    this.caught = null; // { by, wait }: the silence after they notice you
    this.ids = [];
  }

  get busy() {
    return !!this.running || !!this.caught;
  }

  /** Have they noticed you? Too close, running at them, or something loud going on. */
  noticed(ctx) {
    const p = this.p;
    const near = Math.min(...ctx.girls.map((g) => dist(g, ctx.you)));
    if (ctx.girls.some((g) => dist(g, ctx.you) < (g.sees === false ? p.hearClose : p.hearMin))) return true;
    if (ctx.loud && near < p.noticeRange) return true;
    return ctx.you.speed > p.runSpeed && near < p.noticeRange;
  }

  /** Exchanges used least first (ties at random). */
  pick() {
    const least = Math.min(...this.exchanges.map((e) => this.used.get(e) ?? 0));
    const options = this.exchanges.filter((e) => (this.used.get(e) ?? 0) === least);
    return options[Math.floor(this.random() * options.length)];
  }

  /**
   * One step. `ctx`:
   *   you: { x, z, onFoot, speed }
   *   girls: [{ id, x, z, free, sees }]     free: stood about with nothing on; sees: she could see you (false behind a wall or a hedge)
   *   loud: an engine running near them, or you're talking to one of them
   *   floorFree: nobody else is talking
   * Returns events: { type: 'noticed' } the moment they notice you mid-exchange (they turn to look), then
   * { type: 'caught', girl } when the silence after they notice you is over and she speaks up.
   */
  update(dt, ctx, speak, cut) {
    const p = this.p;
    this.clock += dt;
    this.ids = ctx.girls.map((g) => g.id);
    if (this.caught) {
      this.caught.wait -= dt;
      if (this.caught.wait > 0) return [];
      const girl = this.caught.by;
      this.caught = null;
      return [{ type: 'caught', girl }];
    }
    const [a, b] = ctx.girls;
    const both = ctx.girls.length === 2 && a.free && b.free && dist(a, b) < p.together;
    if (this.running) {
      if (!both || !ctx.you.onFoot) return this.stop(cut, null);
      if (this.noticed(ctx)) return this.stop(cut, this.running.last);
      this.play(dt, speak);
      return [];
    }
    const near = both && ctx.you.onFoot ? Math.min(dist(a, ctx.you), dist(b, ctx.you)) : Infinity;
    if (near < p.hearClose || near > p.hearMax || this.noticed(ctx)) {
      this.creeping = 0;
      return [];
    }
    this.creeping += dt;
    if (!ctx.floorFree || this.clock < p.startAfter || this.clock < this.coolUntil || this.creeping < p.settle) return [];
    if (this.random() >= p.chance * dt) return [];
    const exchange = this.pick();
    this.used.set(exchange, (this.used.get(exchange) ?? 0) + 1);
    this.running = { exchange, index: 0, wait: 0, last: null };
    this.play(0, speak);
    return [];
  }

  /** They've stopped. If it's because they noticed you (`last` is who was talking), the other one covers for it. */
  stop(cut, last) {
    this.running = null;
    this.coolUntil = this.clock + this.p.cooldown;
    this.creeping = 0;
    if (last === null) return [];
    cut();
    this.caught = { by: this.ids.find((id) => id !== last) ?? last, wait: this.p.silence };
    return [{ type: 'noticed' }];
  }

  play(dt, speak) {
    const r = this.running;
    r.wait -= dt;
    if (r.wait > 0) return;
    const lines = r.exchange.lines;
    if (r.index >= lines.length) {
      this.coolUntil = this.clock + this.p.cooldown;
      this.creeping = 0;
      this.running = null;
      return;
    }
    const [speaker, text, opts] = lines[r.index++];
    r.last = speaker;
    const seconds = speak(speaker, text, opts ?? {}) ?? 0;
    r.wait = Math.max(seconds, 0.8) + 0.3 + this.random() * 0.4;
  }
}
