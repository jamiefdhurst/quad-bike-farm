// A head start. Whichever quad you ride most is your usual one. Walk towards it while it's cold and the girl you
// favour, if she's nearer to it than you are, gets there first and starts it so it's warm when you arrive. The
// neglected girl starts her own quad instead, pointedly, and leaves yours. Pure logic: the game says who is where and
// who is free, this says who goes and for what.

export const DEFAULT_HEADSTART_PARAMS = {
  usualAfter: 30, // seconds on a quad before it counts as your usual one
  noticeRange: 24, // metres: you're on foot this close to your usual quad, and walking at it
  minRange: 5, // metres: closer than this you're there, too late for her to get in first
  closeSpeed: 0.8, // m/s you must be closing on it (smoothed) to count as heading for it
  girlRange: 40, // metres: she notices from this far
  startAfter: 90, // seconds into the game before anyone does it
  cooldown: 240, // seconds before the same girl does it again
  favouredChance: 0.85, // once per approach: the favoured girl gets there first
  snubChance: 0.7, // once per approach: the neglected girl starts her own instead
};

export const HEADSTART_PARAM_RANGES = {
  usualAfter: [0, 600, 5],
  noticeRange: [5, 80, 1],
  minRange: [0, 20, 1],
  closeSpeed: [0, 4, 0.1],
  girlRange: [5, 120, 1],
  startAfter: [0, 600, 5],
  cooldown: [0, 1200, 10],
  favouredChance: [0, 1, 0.05],
  snubChance: [0, 1, 0.05],
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class HeadStart {
  constructor(params = { ...DEFAULT_HEADSTART_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.rideTime = {}; // spec id -> seconds you've been at its controls
    this.lastRidden = null;
    this.lastDist = null;
    this.closing = 0; // smoothed m/s towards your usual quad
    this.rolled = false; // already decided for this approach
    this.coolUntil = {}; // girl id -> time
  }

  /** You spent `dt` seconds riding this quad. */
  ride(specId, dt) {
    this.rideTime[specId] = (this.rideTime[specId] ?? 0) + dt;
    this.lastRidden = specId;
  }

  /** The quad you ride most, once you've ridden one long enough (the latest wins a tie). */
  usual() {
    let best = null;
    for (const [id, t] of Object.entries(this.rideTime)) {
      if (t < this.p.usualAfter) continue;
      if (!best || t > this.rideTime[best] || (t === this.rideTime[best] && id === this.lastRidden)) best = id;
    }
    return best;
  }

  /**
   * One step. `ctx`:
   *   cold: it's a cold enough day for a warm engine to matter
   *   you: { x, z, onFoot }
   *   girls: [{ id, x, z, free, mood, own }]     mood: 'favoured', 'neglected' or 'even'; own: the spec id of her quad
   *   quads: [{ id, x, z, startable }]           startable: off, unattended and not tipped, and she may have a go at it
   * Returns events: { type: 'warmFor', girl, spec } (she's off to start yours) and
   *   { type: 'snub', girl, spec, yours } (she's off to start her own, not yours).
   */
  update(dt, ctx) {
    const p = this.p;
    this.clock += dt;
    const usual = this.usual();
    const target = ctx.quads.find((q) => q.id === usual);
    if (!target || !ctx.you.onFoot || !target.startable) {
      this.lastDist = null;
      this.closing = 0;
      if (!target || !target.startable || !ctx.you.onFoot) this.rolled = false;
      return [];
    }
    const d = dist(ctx.you, target);
    if (this.lastDist !== null && dt > 0) {
      this.closing += ((this.lastDist - d) / dt - this.closing) * Math.min(1, dt * 2);
    }
    this.lastDist = d;
    if (d > p.noticeRange * 1.5) this.rolled = false; // walked off: the next approach is a new one
    if (this.rolled || !ctx.cold || this.clock < p.startAfter) return [];
    if (d > p.noticeRange || d < p.minRange || this.closing < p.closeSpeed) return [];
    this.rolled = true;
    const events = [];
    for (const g of ctx.girls) {
      if (!g.free || this.clock < (this.coolUntil[g.id] ?? 0)) continue;
      if (g.mood === 'favoured') {
        // She has to be able to beat you to it.
        if (dist(g, target) > p.girlRange || dist(g, target) > d + 2) continue;
        if (this.random() >= p.favouredChance) continue;
        this.coolUntil[g.id] = this.clock + p.cooldown;
        events.push({ type: 'warmFor', girl: g.id, spec: target.id });
      } else if (g.mood === 'neglected') {
        const own = ctx.quads.find((q) => q.id === g.own);
        if (!own || own.id === target.id || !own.startable || dist(g, own) > p.girlRange) continue;
        if (this.random() >= p.snubChance) continue;
        this.coolUntil[g.id] = this.clock + p.cooldown;
        events.push({ type: 'snub', girl: g.id, spec: own.id, yours: target.id });
      }
    }
    return events;
  }
}
