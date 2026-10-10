// Numb. A long sit on a shaking seat sends her legs tingly and her bum numb, so she gets off, stretches, walks about a bit and gets back on. This
// is the build-up: numbness grows while she sits on a seat that shakes enough, faster the harder it shakes, and drains away while she is off it.
// Pure logic; the companion does the getting off and on (companion.js).

export const DEFAULT_NUMB_PARAMS = {
  shakeFrom: 0.4, // body-shake level (the one buzz counts; a warm idle is about 0.6, a cold one 1.2) below which the seat does nothing to her
  shakeFull: 1, // the level at which she numbs at the basic rate
  shakeCap: 2, // the most shake that counts
  fullAfter: 150, // seconds of sitting at shakeFull to go completely numb
  tingleAt: 0.65, // share of that at which her legs go tingly
  drainPerSecond: 0.05, // of the whole, drained while she is not sitting on it
  walkDistance: 5, // metres she walks away from the quad to shake her legs out
  walkAfterMin: 3, // seconds she stretches for once she has walked, from...
  walkAfterMax: 7, // ...to
};

export const NUMB_PARAM_RANGES = {
  shakeFrom: [0, 2, 0.05],
  shakeFull: [0.2, 3, 0.05],
  shakeCap: [0.5, 5, 0.1],
  fullAfter: [10, 1200, 10],
  tingleAt: [0.1, 0.95, 0.05],
  drainPerSecond: [0, 1, 0.01],
  walkDistance: [1, 20, 0.5],
  walkAfterMin: [0, 30, 0.5],
  walkAfterMax: [0, 60, 0.5],
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Numbness {
  constructor(params = { ...DEFAULT_NUMB_PARAMS }) {
    this.p = params;
    this.value = 0; // 0 comfortable .. 1 numb
    this.tingled = false;
  }

  /** How fast she numbs at this shake level, as a share of the whole a second (0 below shakeFrom). */
  rate(level) {
    const p = this.p;
    if (level < p.shakeFrom) return 0;
    return clamp(level, 0, p.shakeCap) / p.shakeFull / p.fullAfter;
  }

  /** One step. `ctx`: { sitting: she is on a seat that counts, level: the seat's shake }. Returns events: 'tingle' (once per build-up) and 'numb' (then it resets). */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    if (!ctx.sitting) {
      this.value = Math.max(0, this.value - p.drainPerSecond * dt);
      if (this.value < p.tingleAt * 0.5) this.tingled = false;
      return events;
    }
    this.value += this.rate(ctx.level ?? 0) * dt;
    if (!this.tingled && this.value >= p.tingleAt) {
      this.tingled = true;
      events.push('tingle');
    }
    if (this.value >= 1) {
      this.value = 0;
      this.tingled = false;
      events.push('numb');
    }
    return events;
  }
}
