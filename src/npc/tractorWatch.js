// The girls and the tractor. Three small things they notice, each said by one of them who's near and free:
//   key    you turned the key off and it ran on (a diesel stops with its knob, not the key): they laugh, Jess more often than Amy.
//   glow   you're sat on a cold one with the key on, waiting for the glow plugs: they say so (Amy helpfully, Jess impatiently).
//   caught it has just fired up, in its cloud of black smoke.
// Pure logic: the game says what the tractor is doing and who is near.

export const DEFAULT_TRACTOR_WATCH_PARAMS = {
  hearRange: 18, // metres: how near a girl has to be to remark on it
  keyDelay: 3, // seconds it has run on with the key off before somebody laughs
  keyCooldown: 90,
  jessKeyChance: 0.7, // chance it's Jess who laughs, when both are near
  glowDelay: 2.5, // seconds you've waited for the plugs before somebody says something
  glowCooldown: 45,
  caughtChance: 0.7, // chance somebody remarks on it catching
  caughtCooldown: 50,
};

export const TRACTOR_WATCH_PARAM_RANGES = {
  hearRange: [4, 60, 1],
  keyDelay: [0, 20, 0.5],
  keyCooldown: [0, 600, 5],
  jessKeyChance: [0, 1, 0.05],
  glowDelay: [0, 20, 0.5],
  glowCooldown: [0, 300, 5],
  caughtChance: [0, 1, 0.05],
  caughtCooldown: [0, 300, 5],
};

export class TractorWatch {
  constructor(params = { ...DEFAULT_TRACTOR_WATCH_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.keyFor = 0; // seconds it has run on with the key off
    this.glowFor = 0; // seconds you've waited for the plugs
    this.glowSaid = false; // she has said her bit about this wait
    this.last = { key: -Infinity, glow: -Infinity, caught: -Infinity };
  }

  /** The nearer of the free girls within hearing, or null. With `prefer` a girl's id, she's picked when she's one of them. */
  near(ctx, prefer = null) {
    const p = this.p;
    const close = ctx.girls
      .filter((g) => g.free && Math.hypot(g.x - ctx.tractor.x, g.z - ctx.tractor.z) <= p.hearRange)
      .sort((a, b) => Math.hypot(a.x - ctx.tractor.x, a.z - ctx.tractor.z) - Math.hypot(b.x - ctx.tractor.x, b.z - ctx.tractor.z));
    return close.find((g) => g.id === prefer) ?? close[0] ?? null;
  }

  /**
   * One step. `ctx`:
   *   tractor: { x, z, running, keyOn, glowWaiting, caught }
   *     glowWaiting: you're on it with the key on, it isn't running, and the plugs aren't ready yet
   *     caught: it fired up this step
   *   girls: [{ id, free, x, z }]
   * Returns events: { type: 'key' | 'glow' | 'caught', girl }.
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.clock += dt;
    const t = ctx.tractor;

    this.keyFor = t.running && !t.keyOn ? this.keyFor + dt : 0;
    if (this.keyFor >= p.keyDelay && this.clock - this.last.key >= p.keyCooldown) {
      const girl = this.near(ctx, this.random() < p.jessKeyChance ? 'jess' : 'amy');
      if (girl) {
        this.last.key = this.clock;
        events.push({ type: 'key', girl: girl.id });
      }
    }

    if (t.glowWaiting) this.glowFor += dt;
    else {
      this.glowFor = 0;
      this.glowSaid = false;
    }
    if (this.glowFor >= p.glowDelay && !this.glowSaid && this.clock - this.last.glow >= p.glowCooldown) {
      const girl = this.near(ctx);
      if (girl) {
        this.glowSaid = true;
        this.last.glow = this.clock;
        events.push({ type: 'glow', girl: girl.id });
      }
    }

    if (t.caught && this.clock - this.last.caught >= p.caughtCooldown && this.random() < p.caughtChance) {
      const girl = this.near(ctx);
      if (girl) {
        this.last.caught = this.clock;
        events.push({ type: 'caught', girl: girl.id });
      }
    }
    return events;
  }
}
