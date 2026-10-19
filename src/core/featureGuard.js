// One feature's error must not stop the rest of the frame (#262). The main update runs each feature's update through `run`: an error is caught,
// logged once with the feature's name, and counted after that, so the girls and the rest of the farm carry on. Nothing is hidden: the counts show
// in the console's `errors` and on the debug panel, and the smoke test (tools/smoke.mjs) fails on any logged one.

export class FeatureGuard {
  /** @param {(line: string) => void} [log] where the first error from each feature is written */
  constructor(log = (line) => console.error(line)) {
    this.log = log;
    /** @type {Map<string, { count: number, first: string, last: string }>} */
    this.failures = new Map();
  }

  /** Run `fn`; if it throws, record it under `name` and carry on. Returns whether it ran clean. */
  run(name, fn) {
    try {
      fn();
      return true;
    } catch (e) {
      this.record(name, e);
      return false;
    }
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
