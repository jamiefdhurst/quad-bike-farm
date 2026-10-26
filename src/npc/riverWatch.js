// The girls and the river. Two things they say, each by one of them who is near and free:
//   near   you have come down to the marked crossing (said once, then not again for a good while).
//   stall  the deep water has drowned your engine (you went in off the line).
// Pure logic: the game says where you are, what the engine did and who is near.

export const DEFAULT_RIVER_WATCH_PARAMS = {
  hearRange: 22, // metres: how near a girl has to be to remark on it
  nearReach: 16, // metres from the crossing's middle at which you count as having come to it
  nearCooldown: 400, // seconds before she says it again
  stallCooldown: 60,
  jessChance: 0.55, // chance it is Jess who speaks, when both are near
};

export const RIVER_WATCH_PARAM_RANGES = {
  hearRange: [4, 60, 1],
  nearReach: [4, 40, 1],
  nearCooldown: [0, 1200, 10],
  stallCooldown: [0, 600, 5],
  jessChance: [0, 1, 0.05],
};

export class RiverWatch {
  constructor(params = { ...DEFAULT_RIVER_WATCH_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.last = { near: -Infinity, stall: -Infinity };
    this.was = { near: false, stalled: false };
  }

  /** One of the free girls within hearing of `at`, the nearer first; the Jess chance picks between two. */
  pick(girls, at) {
    const close = girls
      .filter((g) => g.free && Math.hypot(g.x - at.x, g.z - at.z) <= this.p.hearRange)
      .sort((a, b) => Math.hypot(a.x - at.x, a.z - at.z) - Math.hypot(b.x - at.x, b.z - at.z));
    const prefer = this.random() < this.p.jessChance ? 'jess' : 'amy';
    return close.find((g) => g.id === prefer) ?? close[0] ?? null;
  }

  /**
   * One step. `ctx`:
   *   you: { x, z, riding }  where you are, and whether you are on a vehicle
   *   crossing: { x, z }  the crossing's middle
   *   drowned: your engine has water in it past stalling, and you are in the river's deep water
   *   girls: [{ id, free, x, z }]
   * Returns events: { type: 'near' | 'stall', girl }.
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.clock += dt;
    const at = ctx.you;

    const near = Math.hypot(at.x - ctx.crossing.x, at.z - ctx.crossing.z) <= p.nearReach;
    if (near && !this.was.near && this.clock - this.last.near >= p.nearCooldown) {
      const girl = this.pick(ctx.girls, at);
      if (girl) {
        this.last.near = this.clock;
        events.push({ type: 'near', girl: girl.id });
      }
    }
    this.was.near = near;

    if (ctx.drowned && !this.was.stalled && this.clock - this.last.stall >= p.stallCooldown) {
      const girl = this.pick(ctx.girls, at);
      if (girl) {
        this.last.stall = this.clock;
        events.push({ type: 'stall', girl: girl.id });
      }
    }
    this.was.stalled = !!ctx.drowned;
    return events;
  }
}
