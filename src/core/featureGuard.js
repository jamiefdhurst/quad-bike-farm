// One feature's error must not stop the rest of the frame (#262). The main update runs each feature's update through `run`: an error is caught,
// logged once with the feature's name, and counted after that, so the girls and the rest of the farm carry on. Nothing is hidden: the counts show
// in the console's `errors` and on the debug panel, and the smoke test (tools/smoke.mjs) fails on any logged one.
// It also times each feature (#364), so the "farm features" stage of the frame can be split by feature: `endFrame` folds a frame's times into
// smoothed figures, and `slowest` lists them.

export class FeatureGuard {
  /**
   * @param {(line: string) => void} [log] where the first error from each feature is written
   * @param {() => number} [clock] milliseconds, `performance.now` by default (a test passes its own)
   * @param {number} [smoothing] how much of the old figure is kept each frame, as in FrameBreakdown
   */
  constructor(log = (line) => console.error(line), clock = () => performance.now(), smoothing = 0.9) {
    this.log = log;
    this.clock = clock;
    this.smoothing = smoothing;
    this.frame = new Map(); // feature -> ms so far this frame (a feature run twice in a frame, like each Land Rover's, adds up)
    this.ms = new Map(); // feature -> smoothed ms a frame
    /** @type {Map<string, { count: number, first: string, last: string }>} */
    this.failures = new Map();
  }

  /** Run `fn`; if it throws, record it under `name` and carry on. Returns whether it ran clean. */
  run(name, fn) {
    const t0 = this.clock();
    try {
      fn();
      return true;
    } catch (e) {
      this.record(name, e);
      return false;
    } finally {
      this.frame.set(name, (this.frame.get(name) ?? 0) + (this.clock() - t0));
    }
  }

  /** The frame is over: fold this frame's times into the smoothed figures. A feature that did not run this frame decays towards nothing. */
  endFrame() {
    const k = this.smoothing;
    for (const [name, v] of this.frame) this.ms.set(name, this.ms.has(name) ? this.ms.get(name) * k + v * (1 - k) : v);
    for (const [name, v] of this.ms) if (!this.frame.has(name)) this.ms.set(name, v * k);
    this.frame.clear();
  }

  /** The `n` features that take the most: [{ name, ms }], slowest first. */
  slowest(n = 5) {
    return [...this.ms].map(([name, ms]) => ({ name, ms })).sort((a, b) => b.ms - a.ms).slice(0, n);
  }

  /** The time all the guarded features take together, in smoothed ms. */
  get totalMs() {
    let t = 0;
    for (const v of this.ms.values()) t += v;
    return t;
  }

  record(name, e) {
    const text = e?.message ?? String(e);
    const f = this.failures.get(name);
    if (f) {
      f.count++;
      f.last = text;
      return;
    }
    this.failures.set(name, { count: 1, first: text, last: text });
    this.log(`${name} threw (logged once, counted after): ${e?.stack ?? text}`);
  }

  get total() {
    let n = 0;
    for (const f of this.failures.values()) n += f.count;
    return n;
  }

  /** Worst first: [{ name, count, message }] */
  summary() {
    return [...this.failures].map(([name, f]) => ({ name, count: f.count, message: f.last })).sort((a, b) => b.count - a.count);
  }

  clear() {
    this.failures.clear();
  }
}
