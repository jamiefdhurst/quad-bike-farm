// How hard the game is working, for the console's `perf`: frames drawn over the last second and how long the game's own work took on each
// (the simulation and handing the frame to the GPU; the GPU's drawing isn't counted, but a slow GPU holds up the next frame's handover).
// It also keeps a longer record for stutters (#373): an average hides a 40 ms frame every few seconds, so the 1% low and the long frames are counted.

/** A frame whose own work took longer than this (ms) is a long frame, a stutter you would see (two 60 Hz frames, a touch over). */
export const LONG_FRAME_MS = 33;

export class FrameStats {
  constructor(window = 1, lowWindow = 10) {
    this.window = window; // seconds the averages are over
    this.lowWindow = lowWindow; // seconds the 1% low and the long-frame count are over
    this.frames = []; // { at, ms }
    this.recent = []; // the same over lowWindow
    this.longTotal = 0; // long frames since the game started
  }

  /** A frame drawn at `at` (seconds) whose work took `ms`. */
  record(at, ms) {
    this.frames.push({ at, ms });
    while (this.frames.length && this.frames[0].at <= at - this.window) this.frames.shift();
    this.recent.push({ at, ms });
    while (this.recent[0].at <= at - this.lowWindow) this.recent.shift();
    if (ms > LONG_FRAME_MS) this.longTotal += 1;
  }

  summary() {
    const f = this.frames;
    if (!f.length) return { fps: 0, ms: 0, worstMs: 0, p99Ms: 0, longFrames: 0, longTotal: this.longTotal };
    const total = f.reduce((s, x) => s + x.ms, 0);
    return { fps: f.length / this.window, ms: total / f.length, worstMs: Math.max(...f.map((x) => x.ms)), ...this.since(this.recent[0].at), longTotal: this.longTotal };
  }

  /** The 1% low (the frame time 99% of frames beat, so with fewer than 100 frames it is the worst) and the long frames among frames from `at` on. */
  since(at) {
    const ms = this.recent.filter((x) => x.at >= at).map((x) => x.ms).sort((a, b) => a - b);
    if (!ms.length) return { p99Ms: 0, longFrames: 0 };
    return { p99Ms: ms[Math.min(ms.length - 1, Math.floor(ms.length * 0.99))], longFrames: ms.filter((x) => x > LONG_FRAME_MS).length };
  }
}
