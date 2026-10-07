// Shouting a fault. A girl behind you or beside you as you ride sees what you can't from the saddle: smoke from under you, steam off
// the radiator, a soft tyre, a flat one wobbling on its rim, a silencer coming apart. She shouts it, Amy sooner and plainly, Jess
// a beat later and as a joke. Pure logic: the game says what your quad is showing and where everyone is.

export const DEFAULT_SHOUT_PARAMS = {
  seeRange: 28, // metres: how far off a girl can see it and be heard shouting
  minSpeed: 2.5, // m/s: you have to be on the move, or she'd just walk over and say it
  aheadSlack: 1.5, // metres in front of your middle that she can still be and see it (alongside); further ahead and your back is to her
  smokeAt: 0.5, // oil burnt blue (0..1) that she can see
  steamAt: 0.25, // radiator steam (0..1) that she can see
  dieselAt: 0.3, // diesel soak (0..1): black smoke
  tyreAt: 0.35, // puncture level at which she can see the tyre sagging (below what you feel through the bars)
  wobbleAt: 0.7, // puncture level at which it's flat enough to wobble on the rim
  hangingAt: 0.5, // blown silencer (0..1) at which it's coming loose
  amySeeFor: 1.2, // seconds she's had it in view before she shouts
  jessSeeFor: 2.6, // Jess takes longer to notice, or to bother
  gap: 12, // seconds between one girl's shouts
  sameGap: 70, // seconds before the same girl shouts the same thing again
};

export const SHOUT_PARAM_RANGES = {
  seeRange: [5, 80, 1],
  minSpeed: [0, 15, 0.5],
  aheadSlack: [0, 10, 0.5],
  smokeAt: [0, 1, 0.05],
  steamAt: [0, 1, 0.05],
  dieselAt: [0, 1, 0.05],
  tyreAt: [0, 1, 0.05],
  wobbleAt: [0, 1, 0.05],
  hangingAt: [0, 1, 0.05],
  amySeeFor: [0, 20, 0.2],
  jessSeeFor: [0, 20, 0.2],
  gap: [0, 120, 1],
  sameGap: [0, 600, 5],
};

/** Everything her eyes could catch on a quad right now, most worrying first. */
export function visibleFaults(signs, p) {
  const out = [];
  if (signs.steam >= p.steamAt) out.push('steam');
  if (signs.hanging >= p.hangingAt) out.push('hanging');
  if (signs.oil >= p.smokeAt || signs.diesel >= p.dieselAt) out.push('smoke');
  if (signs.tyre >= p.wobbleAt) out.push('wobble');
  else if (signs.tyre >= p.tyreAt) out.push('tyre');
  return out;
}

export class FaultShout {
  constructor(params = { ...DEFAULT_SHOUT_PARAMS }) {
    this.p = params;
    this.clock = 0;
    this.seen = {}; // `${girl}:${what}` -> seconds she has had it in view
    this.said = {}; // `${girl}:${what}` -> when she last shouted it
    this.last = {}; // girl id -> when she last shouted anything
  }

  /**
   * One step. `ctx`:
   *   quad: { x, z, yaw, speed } the one you're riding, null when you aren't on a running quad
   *   signs: { oil, steam, diesel, tyre, hanging }
   *   girls: [{ id, x, z, watching }]   watching: off your quad and free to look (following, stood about, or on her own quad)
   * Returns events: { girl, what: 'smoke' | 'steam' | 'tyre' | 'wobble' | 'hanging' }.
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.clock += dt;
    const q = ctx.quad;
    const moving = q && Math.abs(q.speed) >= p.minSpeed;
    const faults = moving ? visibleFaults(ctx.signs, p) : [];
    for (const g of ctx.girls) {
      const sees = new Set();
      if (g.watching && faults.length) {
        const dx = g.x - q.x;
        const dz = g.z - q.z;
        // Behind or alongside, and near enough: her view is of your back and sides, not your front.
        const ahead = dx * Math.sin(q.yaw) + dz * Math.cos(q.yaw);
        if (Math.hypot(dx, dz) <= p.seeRange && ahead <= p.aheadSlack) for (const f of faults) sees.add(f);
      }
      for (const key of Object.keys(this.seen)) if (key.startsWith(`${g.id}:`) && !sees.has(key.slice(g.id.length + 1))) delete this.seen[key];
      const wait = g.id === 'amy' ? p.amySeeFor : p.jessSeeFor;
      for (const what of faults) {
        if (!sees.has(what)) continue;
        const key = `${g.id}:${what}`;
        this.seen[key] = (this.seen[key] ?? 0) + dt;
        if (this.seen[key] < wait || this.clock - (this.last[g.id] ?? -Infinity) < p.gap || this.clock - (this.said[key] ?? -Infinity) < p.sameGap) continue;
        this.said[key] = this.clock;
        this.last[g.id] = this.clock;
        events.push({ girl: g.id, what });
        break; // one shout at a time; the next waits its turn
      }
    }
    return events;
  }
}
