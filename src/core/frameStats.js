// How hard the game is working, for the console's `perf`: frames drawn over the last second and how long the game's own work took on each
// (the simulation and handing the frame to the GPU; the GPU's drawing isn't counted, but a slow GPU holds up the next frame's handover).

export class FrameStats {
  constructor(window = 1) {
    this.window = window; // seconds the averages are over
    this.frames = []; // { at, ms }
  }

  /** A frame drawn at `at` (seconds) whose work took `ms`. */
  record(at, ms) {
    this.frames.push({ at, ms });
    while (this.frames.length && this.frames[0].at <= at - this.window) this.frames.shift();
  }

  summary() {
    const f = this.frames;
    if (!f.length) return { fps: 0, ms: 0, worstMs: 0 };
    const total = f.reduce((s, x) => s + x.ms, 0);
    return { fps: f.length / this.window, ms: total / f.length, worstMs: Math.max(...f.map((x) => x.ms)) };
  }
}
