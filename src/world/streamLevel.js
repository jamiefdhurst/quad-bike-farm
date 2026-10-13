// How high the stream stands: it rises with rain (the hill's water comes off the pasture over a few minutes, so it lags the shower) and
// drops back slowly over a dry spell. Pure, no Three.js or DOM: world.js steps it with the weather and gives the hill (world/hill.js) its
// `rise`, the stream view its colour and flow, and game.js the 'up' and 'down' events for the girls to remark on.

export const DEFAULT_STREAM_PARAMS = {
  riseSeconds: 360, // steady rain (1.0) takes this long to take the stream from low to full
  fallSeconds: 1100, // and dry weather this long to bring it from full back to low
  rainFrom: 0.12, // rain under this feeds nothing
  floodRise: 0.22, // metres the water surface stands above its usual at full; the ford is 0.18 m deep and its channel 0.42 m
  flowLow: 1, // how fast the water runs at low (a multiplier on the ripple's drift)
  flowHigh: 3.6, // and at full
  gulpHigh: 2.2, // water an engine gulps ploughing through the stream, as a multiple of usual, when it is full (the ford is deeper and the bow wave bigger)
  upAt: 0.5, // level where a girl says it is up
  downAt: 0.2, // level it must fall back under before it counts as gone down again
  startWet: 0.7, // a game that starts with wet ground starts with the stream this fraction of the way up
};

export const STREAM_PARAM_RANGES = {
  riseSeconds: [30, 1200, 10],
  fallSeconds: [60, 3000, 20],
  rainFrom: [0, 0.6, 0.02],
  floodRise: [0, 0.35, 0.01],
  flowLow: [0.2, 3, 0.1],
  flowHigh: [0.5, 8, 0.1],
  gulpHigh: [1, 6, 0.1],
  upAt: [0.1, 0.95, 0.05],
  downAt: [0, 0.9, 0.05],
  startWet: [0, 1, 0.05],
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export class StreamLevel {
  constructor(params = {}) {
    this.params = { ...DEFAULT_STREAM_PARAMS, ...params };
    this.level = 0; // 0..1, low to full
    this.up = false; // it has been called up and not yet gone back down
  }

  /** A game starting on wet ground starts with the stream part-way up. */
  start(wet) {
    this.level = clamp01(wet * this.params.startWet);
    this.up = this.level >= this.params.upAt;
  }

  /** Metres the water stands above its usual. */
  get rise() {
    return this.level * this.params.floodRise;
  }

  /** How fast the water runs, as a multiplier on the usual ripple drift. */
  get flow() {
    return this.params.flowLow + (this.params.flowHigh - this.params.flowLow) * this.level;
  }

  /** How much more water goes up the intake in the stream than usual. */
  get gulp() {
    return 1 + (this.params.gulpHigh - 1) * this.level;
  }

  /** Steps with the rain falling now (0..1). Returns 'up' or 'down' when it crosses the line, else null. */
  update(dt, rain) {
    const p = this.params;
    if (rain > p.rainFrom) this.level = clamp01(this.level + (rain * dt) / p.riseSeconds);
    else this.level = clamp01(this.level - dt / p.fallSeconds);
    if (!this.up && this.level >= p.upAt) {
      this.up = true;
      return 'up';
    }
    if (this.up && this.level < p.downAt) {
      this.up = false;
      return 'down';
    }
    return null;
  }

  /** Sets the level at once (the debug panel and the console). */
  set(level) {
    this.level = clamp01(level);
    this.up = this.level >= this.params.upAt;
  }
}
