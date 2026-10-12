// A short rolling record of a few numbers, for the Vehicles tab's live graph. Pure: the panel samples into it and draws from it.

export const TRACE_SECONDS = 10; // how much history the graph shows
export const TRACE_RATE = 20; // samples a second

/** The lines on the graph: what each is, its colour, and the least it is scaled to (so a still quad doesn't fill the graph with noise). */
export const TRACE_LINES = [
  { key: 'rpm', label: 'revs', colour: '#e8b339', floor: 1 },
  { key: 'speed', label: 'speed', colour: '#4fc3f7', floor: 5 },
  { key: 'slip', label: 'wheel slip', colour: '#ef5350', floor: 2 },
  { key: 'throttle', label: 'throttle', colour: '#81c784', floor: 1 },
];

export class Trace {
  constructor(seconds = TRACE_SECONDS, rate = TRACE_RATE) {
    this.size = Math.max(2, Math.round(seconds * rate));
    this.step = 1 / rate;
    this.clear();
  }

  clear() {
    this.samples = [];
    this.owed = 0;
  }

  /** Time passes; takes a sample from `read()` for every step that has gone by (a long frame is not filled in), the oldest dropping off. */
  tick(dt, read) {
    this.owed += dt;
    if (this.owed < this.step) return;
    this.owed = Math.min(this.owed - this.step, this.step);
    this.samples.push(read());
    if (this.samples.length > this.size) this.samples.shift();
  }

  /** Each line's samples as 0 to 1 heights, oldest first. `scales` gives what 1 means for a line (revs use the engine's top); the others fit the window. */
  lines(scales = {}) {
    return TRACE_LINES.map((line) => {
      const values = this.samples.map((s) => Math.max(0, s[line.key] ?? 0));
      const top = scales[line.key] ?? Math.max(line.floor, ...values);
      return { ...line, top, values: values.map((v) => Math.min(1, v / top)) };
    });
  }
}
