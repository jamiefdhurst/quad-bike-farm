// The air filter. Driving through mud and ploughing through puddles slowly clogs it; a clogged filter chokes the
// engine, so it runs rich, smokes darker and loses power at the top end (the engine does that, from `clog`). Dust on dry
// stubble clogs it much faster than mud does. Cleaning it at the toolbox is a short hold. Pure logic.

export const DEFAULT_FILTER_PARAMS = {
  mudRate: 0.0024, // clog per second, moving through full mud under the wheels (about seven minutes from clean to choked)
  puddleRate: 0.0033, // the same, splashing through a puddle at full depth
  dustRate: 0.012, // the same, in a full cloud of stubble dust (five times mud, as dust really clogs: about 80 s from clean to choked)
  minSpeed: 1.5, // m/s: stood still it doesn't get splashed
  cleanSeconds: 3, // holding the key at the toolbox
};

export const FILTER_PARAM_RANGES = {
  mudRate: [0, 0.05, 0.0005],
  puddleRate: [0, 0.05, 0.0005],
  dustRate: [0, 0.1, 0.001],
  minSpeed: [0, 10, 0.5],
  cleanSeconds: [0.5, 15, 0.5],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class AirFilter {
  constructor(params = { ...DEFAULT_FILTER_PARAMS }) {
    this.p = params;
    this.clog = 0; // 0 clean .. 1 choked
  }

  /** One step. `mud` and `puddle` (0..1) are the worst under any wheel; `dust` (0..1) is the cloud the quad is in. */
  update(dt, { running = false, speed = 0, mud = 0, puddle = 0, dust = 0 } = {}) {
    if (!running || Math.abs(speed) < this.p.minSpeed) return;
    this.clog = clamp01(this.clog + dt * (this.p.mudRate * clamp01(mud) + this.p.puddleRate * clamp01(puddle) + (this.p.dustRate ?? 0) * clamp01(dust)));
  }

  /** How it is, in words, for the toolbox. */
  get state() {
    return this.clog < 0.1 ? 'clean' : this.clog < 0.4 ? 'a bit dirty' : this.clog < 0.7 ? 'clogged' : 'choked';
  }

  get isClean() {
    return this.clog < 0.005;
  }

  /** Cleaned out. */
  clean() {
    this.clog = 0;
  }
}
