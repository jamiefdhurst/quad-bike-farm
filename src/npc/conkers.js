// Conkers, on an autumn day (world/autumn.js). Jess, stood about under the oaks with you in range, picks one up and throws it at you. It is
// an arc she isn't very good at: a hit is a thock and a laugh, a miss a groan. Amy tuts at it, and says so once when the leaves in the
// wood are slippery or the conkers are everywhere. Pure logic; the game says where everyone is, poses her arm and plays the sound.
// When she does it is the chooser's (chooser.js): `offers` says whether she could, `take` starts it.

const GRAVITY = 9.8;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Who throws: Jess does, Amy only minds. */
export const THROWERS = ['jess'];

export class Conkers {
  constructor(params, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.lastThrow = -Infinity;
    this.windup = null; // { girl, t, aim }
    this.flight = null; // { girl, from, vel, t, total, target }
    this.said = { conkers: false, slippery: false }; // Amy's remarks, each once a game
  }

  get active() {
    return !!(this.windup || this.flight);
  }

  /**
   * Whether a girl could throw one now. `ctx`: { autumn, you: { x, y, z, speed }, girls: [{ id, free, x, z, inWoods }] }.
   * Returns [{ key: 'conker', girl, weight }] for the chooser.
   */
  offers(ctx) {
    if (!ctx.autumn || this.active || this.clock - this.lastThrow < this.p.throwCooldown || !this.p.throwWeight) return [];
    const out = [];
    for (const g of ctx.girls) {
      if (!THROWERS.includes(g.id) || !g.free || !g.inWoods) continue;
      const d = dist(g, ctx.you);
      if (d < this.p.throwMinRange || d > this.p.throwRange) continue;
      out.push({ key: 'conker', girl: g.id, weight: this.p.throwWeight });
    }
    return out;
  }

  /** She chose to: she starts winding up. Returns the event the game acts on. */
  take(o, ctx) {
    this.lastThrow = this.clock;
    const g = ctx.girls.find((x) => x.id === o.girl);
    this.windup = { girl: o.girl, t: 0 };
    return { type: 'windup', girl: o.girl, seconds: this.p.throwWindup, facing: Math.atan2(ctx.you.x - g.x, ctx.you.z - g.z) };
  }

  /** The debug panel's way of starting one for a girl who is free now. */
  force(girl, ctx) {
    this.clock += this.p.throwCooldown;
    return this.take({ girl }, ctx);
  }

  /** Where the conker will land if she throws at you now: your head, out by up to `throwSpread` metres in a random direction. */
  aimPoint(you) {
    const a = this.random() * Math.PI * 2;
    const r = this.p.throwSpread * Math.sqrt(this.random());
    return { x: you.x + Math.cos(a) * r, y: you.y, z: you.z + Math.sin(a) * r };
  }

  /**
   * One step. `ctx` as for `offers`, plus `hand` (where the throwing hand is: { x, y, z }) for the girl winding up.
   * Events: { type: 'release', girl, from, target }, { type: 'land', girl, hit, at }, { type: 'abandon', girl }, and Amy's remarks
   * { type: 'remark', kind: 'conkers' | 'slippery' } when `ctx.amyCanRemark`.
   */
  update(dt, ctx) {
    this.clock += dt;
    const events = [];
    const w = this.windup;
    if (w) {
      const g = ctx.girls.find((x) => x.id === w.girl);
      // Something took her off it (you called her, she was busy): the throw is dropped.
      if (!g || !g.throwing || !ctx.autumn) {
        this.windup = null;
        events.push({ type: 'abandon', girl: w.girl });
      } else {
        w.t += dt;
        if (w.t >= this.p.throwWindup) {
          const from = ctx.hand ?? { x: g.x, y: 1.4, z: g.z };
          const target = this.aimPoint(ctx.you);
          const d = Math.hypot(target.x - from.x, target.z - from.z);
          const total = Math.max(0.25, Math.hypot(d, target.y - from.y) / this.p.throwSpeed);
          // Velocity that arrives at the target after `total` seconds under gravity.
          const vel = { x: (target.x - from.x) / total, y: (target.y - from.y) / total + 0.5 * GRAVITY * total, z: (target.z - from.z) / total };
          this.flight = { girl: w.girl, from, vel, t: 0, total, target };
          this.windup = null;
          events.push({ type: 'release', girl: w.girl, from, target });
        }
      }
    }
    const f = this.flight;
    if (f) {
      f.t += dt;
      if (f.t >= f.total) {
        const near = Math.hypot(f.target.x - ctx.you.x, f.target.z - ctx.you.z);
        const hit = near < this.p.throwHitRadius && Math.abs(f.target.y - ctx.you.y) < 0.8;
        events.push({ type: 'land', girl: f.girl, hit, at: { ...f.target } });
        this.flight = null;
      }
    }
    this.remarks(ctx, events);
    return events;
  }

  /** Where the conker is now, or null when none is in the air. */
  position() {
    const f = this.flight;
    if (!f) return null;
    return { x: f.from.x + f.vel.x * f.t, y: f.from.y + f.vel.y * f.t - 0.5 * GRAVITY * f.t * f.t, z: f.from.z + f.vel.z * f.t };
  }

  /** Amy's two remarks: the first time you're in the wood on an autumn day, and the first time you ride its wet leaves. */
  remarks(ctx, events) {
    if (!ctx.autumn || !ctx.amyCanRemark || !ctx.youInWoods) return;
    if (!this.said.slippery && ctx.wet >= 0.3 && ctx.youRiding) {
      this.said.slippery = true;
      events.push({ type: 'remark', kind: 'slippery' });
    } else if (!this.said.conkers) {
      this.said.conkers = true;
      events.push({ type: 'remark', kind: 'conkers' });
    }
  }
}
