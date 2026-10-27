// The girls and the gravel pit. Two things they say, each by one of them who is near and free:
//   near   you have come to the lip of the pit (said once, then not again for a good while).
//   stall  your engine stopped while you were down in the pit.
// Pure logic: the game says where you are, what the engine did and who is near.

export const DEFAULT_QUARRY_WATCH_PARAMS = {
  hearRange: 40, // metres: how near a girl has to be to remark on it (the pit is wide)
  nearReach: 10, // metres from the lip at which you count as having come to it
  nearCooldown: 400, // seconds before she says it again
  stallCooldown: 60,
  jessChance: 0.55, // chance it is Jess who speaks, when both are near
};

export const QUARRY_WATCH_PARAM_RANGES = {
  hearRange: [4, 80, 1],
  nearReach: [2, 40, 1],
  nearCooldown: [0, 1200, 10],
  stallCooldown: [0, 600, 5],
  jessChance: [0, 1, 0.05],
};

export class QuarryWatch {
  constructor(params = { ...DEFAULT_QUARRY_WATCH_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.last = { near: -Infinity, stall: -Infinity };
    this.was = { near: false, running: false };
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
   *   you: { x, z }  where you are
   *   fromLip: metres from the pit's lip (negative inside it)
   *   inPit: you are below the lip
   *   running: your engine is running (false off a vehicle)
   *   girls: [{ id, free, x, z }]
   * Returns events: { type: 'near' | 'stall', girl }.
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.clock += dt;

    const near = ctx.fromLip <= p.nearReach;
    if (near && !this.was.near && this.clock - this.last.near >= p.nearCooldown) {
      const girl = this.pick(ctx.girls, ctx.you);
      if (girl) {
        this.last.near = this.clock;
        events.push({ type: 'near', girl: girl.id });
      }
    }
    this.was.near = near;

    const stalled = ctx.inPit && this.was.running && !ctx.running;
    if (stalled && this.clock - this.last.stall >= p.stallCooldown) {
      const girl = this.pick(ctx.girls, ctx.you);
      if (girl) {
        this.last.stall = this.clock;
        events.push({ type: 'stall', girl: girl.id });
      }
    }
    this.was.running = !!ctx.running;
    return events;
  }
}
