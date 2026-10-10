// Don't fix it. A worn, rough engine shakes more, and the girls like the shake (the buzz tally in contentment.js). So when you service or put
// right the quad that is a girl's favourite and it had gone rough, she minds: Jess says you've made it boring, Amy wanted it fixed but will miss
// it. Pure logic: the game feeds in each quad's wear every frame, and this spots the drop that a service or a repair makes and says who
// minds. Wear is what the engines already keep (a service clears it), so every way of looking after a quad counts.

export const DEFAULT_DONTFIX_PARAMS = {
  roughFrom: 0.25, // engine wear (0..1) from which a quad counts as rough enough to be worth minding about
  dropBy: 0.15, // how much wear has to come off in a go for it to count as fixed
  window: 3, // seconds: the drop has to happen within this (a service is a moment; wear builds up over minutes)
  hearRange: 15, // metres: how close she has to be to you to say so
  cooldown: 60, // seconds before she says it again
};

export const DONTFIX_PARAM_RANGES = {
  roughFrom: [0, 1, 0.05],
  dropBy: [0.02, 1, 0.01],
  window: [0.5, 20, 0.5],
  hearRange: [2, 50, 1],
  cooldown: [0, 600, 5],
};

export class DontFixIt {
  constructor(params = { ...DEFAULT_DONTFIX_PARAMS }) {
    this.p = params;
    this.clock = 0;
    this.history = new Map(); // quad id -> [{ t, wear }] over the last window
    this.said = new Map(); // girl id -> time she last said it
  }

  /**
   * One step. `ctx.units` is [{ id, wear }] for every vehicle; `ctx.girls` is [{ id, favourite, distance }]: the spec id of the quad she likes best
   * and how far she is from you. Returns events: { type: 'minds', girl, unit } for each girl whose favourite was just fixed.
   */
  update(dt, ctx) {
    const p = this.p;
    this.clock += dt;
    const events = [];
    for (const u of ctx.units) {
      const h = this.history.get(u.id) ?? [];
      h.push({ t: this.clock, wear: u.wear });
      while (h.length && this.clock - h[0].t > p.window) h.shift();
      this.history.set(u.id, h);
      const peak = Math.max(...h.map((x) => x.wear));
      if (peak < p.roughFrom || peak - u.wear < p.dropBy) continue;
      // Fixed: forget the high so the one fix is only counted once.
      this.history.set(u.id, [{ t: this.clock, wear: u.wear }]);
      for (const g of ctx.girls) {
        if (g.favourite !== u.id || g.distance > p.hearRange) continue;
        if (this.clock - (this.said.get(g.id) ?? -Infinity) < p.cooldown) continue;
        this.said.set(g.id, this.clock);
        events.push({ type: 'minds', girl: g.id, unit: u.id });
      }
    }
    return events;
  }

  /** The debug button: she minds now, whatever the engine is doing. */
  force(girl, unit) {
    this.said.set(girl, this.clock);
    return { type: 'minds', girl, unit };
  }
}
