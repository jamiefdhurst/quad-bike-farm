// Warming their hands. On a cold or wet day a girl stood about near a quad that's running (and left idling) goes
// and holds her hands over its engine, and her friend often joins her. Switch it off while she's at it and she
// complains. Pure logic: the game says who and what is where, this says who goes, who leaves and who complains.

export const DEFAULT_WARMING_PARAMS = {
  coldBelow: 0.5, // weather warmth (0..1) under which it's a cold day (overcast, drizzle, rain, fog)
  wetAbove: 0.25, // or rain above this
  warmRange: 16, // metres: she'll go to an idling quad this close
  checkEvery: 2, // seconds between her thinking about it
  warmChance: 0.2, // each time, while it's cold and a quad idles near her
  joinChance: 0.7, // the same, when her friend is already at it
  maxAtQuad: 2, // girls round one engine
  warmForMin: 25, // seconds she stays with her hands over it
  warmForMax: 70,
  cooldown: 60, // seconds after she's done before she thinks of it again
  startAfter: 20, // seconds into the game before anyone does
};

export const WARMING_PARAM_RANGES = {
  coldBelow: [0, 1, 0.05],
  wetAbove: [0, 1, 0.05],
  warmRange: [3, 60, 1],
  checkEvery: [0.5, 20, 0.5],
  warmChance: [0, 1, 0.05],
  joinChance: [0, 1, 0.05],
  maxAtQuad: [1, 4, 1],
  warmForMin: [5, 300, 5],
  warmForMax: [5, 600, 5],
  cooldown: [0, 600, 5],
  startAfter: [0, 300, 5],
};

/** Whether the day is cold enough to want warming up. */
export function isChilly(weather, p) {
  return weather.warmth < p.coldBelow || weather.rain > p.wetAbove;
}

export class Warming {
  constructor(params = { ...DEFAULT_WARMING_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.nextCheck = 0;
    this.at = new Map(); // girl id -> { spec, leaveAt }, once she has arrived
    this.coolUntil = {}; // girl id -> time
    this.sent = {}; // girl id -> { spec, until }: on her way there, for counting who is round an engine
  }

  /**
   * One step. `ctx`:
   *   weather: { warmth, rain }
   *   girls: [{ id, x, z, free, warmSpec }]     free: stood about; warmSpec: the quad she's holding her hands over, if any
   *   quads: [{ id, x, z, idling }]             idling: running with nobody on it and not moving
   * Returns events: { type: 'go', girl, spec, join }, { type: 'warm', girl, spec } (she's arrived and put her hands out),
   *   { type: 'leave', girl, off } (off: she's leaving because the engine's gone off).
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.clock += dt;
    for (const g of ctx.girls) {
      const here = this.at.get(g.id);
      if (g.warmSpec && !here) {
        const leaveAt = this.clock + p.warmForMin + this.random() * Math.max(0, p.warmForMax - p.warmForMin);
        this.at.set(g.id, { spec: g.warmSpec, leaveAt });
        delete this.sent[g.id];
        events.push({ type: 'warm', girl: g.id, spec: g.warmSpec });
      } else if (!g.warmSpec && here) {
        this.at.delete(g.id); // she's been sent off to do something else
        this.coolUntil[g.id] = this.clock + p.cooldown;
      } else if (here) {
        const quad = ctx.quads.find((q) => q.id === here.spec);
        const off = !quad?.idling;
        if (off || this.clock >= here.leaveAt) {
          this.at.delete(g.id);
          this.coolUntil[g.id] = this.clock + p.cooldown;
          events.push({ type: 'leave', girl: g.id, off });
        }
      }
    }
    if (this.clock < this.nextCheck) return events;
    this.nextCheck = this.clock + p.checkEvery;
    if (this.clock < p.startAfter || !isChilly(ctx.weather, p)) return events;
    for (const g of ctx.girls) {
      if (!g.free || g.warmSpec || this.at.has(g.id) || this.clock < (this.coolUntil[g.id] ?? 0)) continue;
      const crowd = (q) => ctx.girls.filter((o) => o !== g && o.warmSpec === q.id || (this.sent[o.id]?.spec === q.id && this.sent[o.id].until > this.clock)).length;
      const options = ctx.quads.filter((q) => q.idling && Math.hypot(q.x - g.x, q.z - g.z) <= p.warmRange && crowd(q) < p.maxAtQuad);
      if (!options.length) continue;
      // Where her friend already is, she is likelier to go.
      const joined = options.find((q) => ctx.girls.some((o) => o !== g && o.warmSpec === q.id));
      const q = joined ?? options.reduce((a, b) => (Math.hypot(b.x - g.x, b.z - g.z) < Math.hypot(a.x - g.x, a.z - g.z) ? b : a));
      if (this.random() >= (joined ? p.joinChance : p.warmChance)) continue;
      this.sent[g.id] = { spec: q.id, until: this.clock + 30 };
      events.push({ type: 'go', girl: g.id, spec: q.id, join: !!joined });
    }
    return events;
  }
}
