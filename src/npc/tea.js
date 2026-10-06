// Tea on the rack. A girl stood about now and then fetches a mug of tea and leaves it on the rear rack of a parked quad.
// Ride off without looking and the mug falls off, and its owner lets you know. Left alone, she comes back for it after a
// minute or two. Pure logic: the game says who and what is where, this says who puts one down, collects one, or loses it.

export const DEFAULT_TEA_PARAMS = {
  startAfter: 90, // seconds into the game before anyone does
  chance: 0.01, // per second, for a free girl with no mug out and a quad with a rack near her
  cooldown: 120, // seconds after she's had one before she thinks of another
  range: 18, // metres: the quad is this close to her
  leaveMin: 90, // seconds before she comes back for it
  leaveMax: 180,
  fallSpeed: 2.5, // m/s: the quad goes this fast and the mug is off
  placeTimeout: 40, // seconds she has to get there before it's forgotten
  stainFor: 60, // seconds the spilt tea stays on the ground
};

export const TEA_PARAM_RANGES = {
  startAfter: [0, 600, 10],
  chance: [0, 0.2, 0.002],
  cooldown: [0, 900, 10],
  range: [3, 60, 1],
  leaveMin: [10, 900, 10],
  leaveMax: [10, 1200, 10],
  fallSpeed: [0.5, 10, 0.5],
  placeTimeout: [5, 120, 5],
  stainFor: [5, 600, 5],
};

export class Tea {
  constructor(params = { ...DEFAULT_TEA_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.forced = false; // put one down at the first chance (the debug panel)
    this.mugs = []; // { girl, spec, leaveAt, collecting }
    this.pending = {}; // girl id -> { kind: 'place' | 'collect', spec, until }
    this.cooldownUntil = {};
  }

  mugOf(girl) {
    return this.mugs.find((m) => m.girl === girl) ?? null;
  }

  /** She got there and put it down (the quad is still free): the mug is on the rack. */
  placed(girl, spec) {
    delete this.pending[girl];
    if (this.mugOf(girl)) return;
    this.mugs.push({ girl, spec, leaveAt: this.clock + this.p.leaveMin + this.random() * Math.max(0, this.p.leaveMax - this.p.leaveMin) });
  }

  /** She got there and took it back (or it was lost on the way). */
  collected(girl) {
    delete this.pending[girl];
    this.mugs = this.mugs.filter((m) => m.girl !== girl);
    this.cooldownUntil[girl] = this.clock + this.p.cooldown;
  }

  /** She couldn't (the quad was taken, say): forget it. */
  cancel(girl) {
    delete this.pending[girl];
  }

  /**
   * One step. `ctx`:
   *   girls: [{ id, free, x, z }]
   *   quads: [{ id, x, z, speed, rider, driver, tipped, hasRack }]    rider: you at the controls; driver: a girl's id
   * Returns events: { type: 'place', girl, spec }, { type: 'collect', girl, spec } (she is to go and do it) and
   *   { type: 'fall', girl, spec, by } (the mug has come off: by is 'you', a girl's id or null).
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.clock += dt;
    for (const [girl, job] of Object.entries(this.pending)) if (this.clock > job.until) delete this.pending[girl];
    for (const m of [...this.mugs]) {
      const q = ctx.quads.find((x) => x.id === m.spec);
      if (!q || q.speed > p.fallSpeed || q.tipped) {
        this.mugs = this.mugs.filter((x) => x !== m);
        this.cooldownUntil[m.girl] = this.clock + p.cooldown;
        events.push({ type: 'fall', girl: m.girl, spec: m.spec, by: q?.rider ? 'you' : q?.driver ?? null });
      }
    }
    for (const g of ctx.girls) {
      if (!g.free || this.pending[g.id]) continue;
      const mug = this.mugOf(g.id);
      if (mug) {
        const q = ctx.quads.find((x) => x.id === mug.spec);
        if (this.clock >= mug.leaveAt && q && !q.rider && !q.driver && q.speed < 0.3) {
          this.pending[g.id] = { kind: 'collect', spec: mug.spec, until: this.clock + p.placeTimeout };
          events.push({ type: 'collect', girl: g.id, spec: mug.spec });
        }
        continue;
      }
      if (!this.forced && (this.clock < p.startAfter || this.clock < (this.cooldownUntil[g.id] ?? 0) || this.random() >= p.chance * dt)) continue;
      const taken = new Set([...this.mugs.map((m) => m.spec), ...Object.values(this.pending).map((j) => j.spec)]);
      const options = ctx.quads.filter((q) => q.hasRack && !taken.has(q.id) && !q.rider && !q.driver && q.speed < 0.3 && Math.hypot(q.x - g.x, q.z - g.z) <= p.range);
      if (!options.length) continue;
      const q = options.reduce((a, b) => (Math.hypot(b.x - g.x, b.z - g.z) < Math.hypot(a.x - g.x, a.z - g.z) ? b : a));
      this.forced = false;
      this.pending[g.id] = { kind: 'place', spec: q.id, until: this.clock + p.placeTimeout };
      events.push({ type: 'place', girl: g.id, spec: q.id });
    }
    return events;
  }
}
