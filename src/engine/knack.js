// A quad's knack for starting: the green won't fire from cold until the throttle's
// been blipped twice, the way you'd tickle an old carb. Pure logic; the engine
// feeds it the throttle each frame and asks how much to scale the catch chance.

export const DEFAULT_KNACK_PARAMS = {
  knackBlips: 0, // throttle blips needed before it'll catch from cold (0 = no knack, it just starts)
  knackBlipAt: 0.5, // throttle past this counts as a blip
  knackWindow: 8, // seconds a blip stays good for
  knackColdBelow: 0.6, // temperature under which the knack matters
  knackMissFactor: 0.04, // catch chance multiplier from cold without the knack done
};

export const KNACK_RANGES = {
  knackBlips: [0, 4, 1],
  knackBlipAt: [0.2, 0.9, 0.05],
  knackWindow: [2, 30, 1],
  knackColdBelow: [0.1, 1, 0.05],
  knackMissFactor: [0, 1, 0.01],
};

export class Knack {
  constructor(params = DEFAULT_KNACK_PARAMS) {
    this.p = params;
    this.count = 0; // blips so far
    this.age = 0; // seconds since the last one
    this.high = false;
  }

  /** Counts a rising edge of the throttle as a blip; blips go stale after the window. Running engines forget them. */
  update(dt, throttle, running) {
    const p = this.p;
    if (running) {
      this.count = 0;
      this.high = throttle > p.knackBlipAt;
      return;
    }
    this.age += dt;
    if (this.age > p.knackWindow) this.count = 0;
    const high = throttle > p.knackBlipAt;
    if (high && !this.high) {
      this.count++;
      this.age = 0;
    }
    this.high = high;
  }

  /** Has the trick been done lately? Always true on a quad with no knack. */
  get primed() {
    return !this.p.knackBlips || this.count >= this.p.knackBlips;
  }

  /** Multiplier on the chance of catching at this temperature. */
  catchFactor(temperature) {
    return this.primed || temperature >= this.p.knackColdBelow ? 1 : this.p.knackMissFactor;
  }
}
