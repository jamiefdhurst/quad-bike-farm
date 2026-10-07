// Drowning her out. Jess, sat on a running quad near Amy while Amy is mid-sentence, blips the throttle so nobody can hear
// a word; Amy cuts herself off and tells her to switch it off, and Jess does, grumbling. Amy never touches the ignition
// herself. Pure logic: the game says who is where and who is talking, and sets Jess's quad throttle from
// `throttleFor`.

export const DEFAULT_DROWNOUT_PARAMS = {
  chance: 0.25, // per second, while Amy is mid-sentence and the rest fits, that Jess starts revving
  cooldown: 120, // seconds before she may do it again
  hearRange: 7, // metres between the girls for it to count as drowning her out
  amyLeftMin: 0.8, // seconds Amy must still have to say, so it really is mid-sentence
  revDelay: 0.3, // seconds between Jess deciding and the throttle opening
  revFor: 1.6, // seconds the throttle is held
  switchOffAfter: 1.9, // seconds after the rev starts that the engine goes off
};

export const DROWNOUT_PARAM_RANGES = {
  chance: [0, 2, 0.05],
  cooldown: [0, 600, 10],
  hearRange: [2, 30, 0.5],
  amyLeftMin: [0, 5, 0.1],
  revDelay: [0, 2, 0.05],
  revFor: [0.3, 5, 0.1],
  switchOffAfter: [0.5, 8, 0.1],
};

export class DrownOut {
  constructor(params = { ...DEFAULT_DROWNOUT_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.next = 0; // earliest clock for the next one
    this.active = null; // { start, reached, off }
  }

  /** Is Jess's throttle held open right now? 1 or 0. */
  throttleFor() {
    const a = this.active;
    if (!a) return 0;
    const t = this.clock - a.start;
    return t >= this.p.revDelay && t < this.p.revDelay + this.p.revFor ? 1 : 0;
  }

  /**
   * One step. `ctx`:
   *   jessCanRev: she's sat on a running quad nobody else is at the controls of, and isn't busy with something else
   *   amyLeft: seconds of Amy's current line still to run (0 when she's quiet)
   *   distance: metres between the two of them
   * Returns events: { type: 'rev' }, { type: 'switchOff' } (Jess does it, Amy having told her to).
   */
  update(dt, ctx) {
    const p = this.p;
    this.clock += dt;
    const a = this.active;
    if (a) {
      const t = this.clock - a.start;
      if (!ctx.jessCanRev) {
        this.active = null; // she got off, or it stalled by itself: nothing left to switch off
        return [];
      }
      if (t >= p.switchOffAfter) {
        this.active = null;
        return [{ type: 'switchOff' }];
      }
      return [];
    }
    if (this.clock < this.next || !ctx.jessCanRev || ctx.amyLeft < p.amyLeftMin || ctx.distance > p.hearRange) return [];
    if (this.random() >= p.chance * dt) return [];
    this.active = { start: this.clock };
    this.next = this.clock + p.cooldown;
    return [{ type: 'rev' }];
  }
}
