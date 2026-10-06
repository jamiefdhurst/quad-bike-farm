// Hand on the throttle. Riding with a girl on the back, now and then she reaches round you and gives it a handful over
// your hand. Jess does it again and again; Amy does it once, then apologises. Pure logic: the game says what's going
// on, this says whose hand is on the throttle, how far she has reached and how much throttle she's added.

export const DEFAULT_GRAB_PARAMS = {
  firstAfter: 25, // seconds riding together (moving) before she might
  chance: 0.03, // per second after that, at Jess's boldness of 1
  gap: 40, // seconds between grabs, after the last one ends
  minSpeed: 2, // m/s: you're moving, not stood revving
  maxSpeed: 11, // m/s: she won't add to it going faster than this
  reachTime: 0.7, // seconds to get her hand to the grip
  holdMin: 1.2, // seconds she keeps it open
  holdMax: 2.4,
  releaseTime: 0.6, // seconds letting go
  throttle: 0.9, // the throttle she holds it at (you can still have more)
  rampTime: 0.35, // seconds to take it from nothing to that
  jessBoldness: 1, // multiplies the chance
  amyBoldness: 0.25,
  amyMax: 1, // times Amy does it in a game
};

export const GRAB_PARAM_RANGES = {
  firstAfter: [0, 300, 5],
  chance: [0, 0.5, 0.005],
  gap: [0, 600, 5],
  minSpeed: [0, 10, 0.5],
  maxSpeed: [2, 30, 0.5],
  reachTime: [0.1, 3, 0.05],
  holdMin: [0.2, 6, 0.1],
  holdMax: [0.2, 10, 0.1],
  releaseTime: [0.1, 3, 0.05],
  throttle: [0.1, 1, 0.05],
  rampTime: [0.05, 2, 0.05],
  jessBoldness: [0, 5, 0.05],
  amyBoldness: [0, 5, 0.05],
  amyMax: [0, 10, 1],
};

export class ThrottleGrab {
  constructor(params = { ...DEFAULT_GRAB_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.together = 0; // seconds riding together, moving
    this.rest = 0; // seconds until she might again
    this.count = {}; // girl id -> times she has
    this.grab = null; // { girl, phase: 'reach' | 'hold' | 'release', t, hold }
  }

  /** The reach of her hand towards your throttle grip, 0..1. */
  get reach() {
    const g = this.grab;
    if (!g) return 0;
    if (g.phase === 'reach') return Math.min(1, g.t / this.p.reachTime);
    return g.phase === 'hold' ? 1 : Math.max(0, 1 - g.t / this.p.releaseTime);
  }

  /** The throttle she's adding, 0..1. */
  get throttle() {
    const g = this.grab;
    if (!g) return 0;
    if (g.phase === 'hold') return this.p.throttle * Math.min(1, g.t / this.p.rampTime);
    return g.phase === 'release' ? this.p.throttle * Math.max(0, 1 - g.t / this.p.rampTime) : 0;
  }

  /**
   * One step. `ctx`: { riding: you at the controls with the engine running, speed, girls: [{ id, onBack }] }
   * (onBack: sat on the pillion seat of your quad). Returns events: { type: 'start', girl } and { type: 'end', girl, count }.
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    const g = this.grab;
    if (g) {
      const here = ctx.girls.find((o) => o.id === g.girl)?.onBack && ctx.riding;
      g.t += dt;
      // Cut short if she's off, or you've stopped riding: her hand comes away at once.
      if (!here) {
        this.finish(events);
      } else if (g.phase === 'reach' && g.t >= p.reachTime) {
        Object.assign(g, { phase: 'hold', t: 0 });
      } else if (g.phase === 'hold' && g.t >= g.hold) {
        Object.assign(g, { phase: 'release', t: 0 });
      } else if (g.phase === 'release' && g.t >= p.releaseTime) {
        this.finish(events);
      }
      return events;
    }
    this.rest = Math.max(0, this.rest - dt);
    const moving = ctx.riding && ctx.speed >= p.minSpeed && ctx.speed <= p.maxSpeed;
    const companions = ctx.girls.filter((o) => o.onBack);
    this.together = moving && companions.length ? this.together + dt : 0;
    if (!moving || !companions.length || this.together < p.firstAfter || this.rest > 0) return events;
    for (const o of companions) {
      const bold = o.id === 'jess' ? p.jessBoldness : p.amyBoldness;
      if (o.id === 'amy' && (this.count.amy ?? 0) >= p.amyMax) continue;
      if (this.random() >= p.chance * bold * dt) continue;
      this.count[o.id] = (this.count[o.id] ?? 0) + 1;
      this.grab = { girl: o.id, phase: 'reach', t: 0, hold: p.holdMin + this.random() * Math.max(0, p.holdMax - p.holdMin) };
      events.push({ type: 'start', girl: o.id });
      break;
    }
    return events;
  }

  finish(events) {
    const g = this.grab;
    this.grab = null;
    this.rest = this.p.gap;
    events.push({ type: 'end', girl: g.girl, count: this.count[g.girl] });
  }
}
