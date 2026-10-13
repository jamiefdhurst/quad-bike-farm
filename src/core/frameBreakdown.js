// Where a frame's time goes: the game calls `lap('name')` as each stage of the frame finishes and this keeps a smoothed milliseconds figure
// per stage, in the order the stages first ran. Pure (the clock is passed in), tested in tests/frameBreakdown.test.js.

export class FrameBreakdown {
  /** @param {number} smoothing  How much of the old figure is kept each frame (0 jumps to the latest, 0.95 is slow and steady). */
  constructor(smoothing = 0.9) {
    this.smoothing = smoothing;
    this.ms = new Map(); // stage -> smoothed ms
    this.worst = new Map(); // stage -> worst ms in the last `worstFrames` frames
    this.latest = new Map();
    this.frameStart = 0;
    this.mark = 0;
    this.frames = 0;
    this.worstFrames = 120;
  }

  /** A frame starts at `now` (ms). */
  begin(now) {
    this.frameStart = this.mark = now;
    this.latest.clear();
  }

  /** The stage `name` has finished at `now`: it gets the time since the last lap (a stage lapped twice in a frame adds up). */
  lap(name, now) {
    this.latest.set(name, (this.latest.get(name) ?? 0) + (now - this.mark));
    this.mark = now;
  }

  /** The frame is over: fold its stages into the smoothed figures. */
  end() {
    this.frames += 1;
    const k = this.smoothing;
    for (const [name, v] of this.latest) {
      this.ms.set(name, this.ms.has(name) ? this.ms.get(name) * k + v * (1 - k) : v);
      const w = this.worst.get(name);
      this.worst.set(name, w === undefined || this.frames % this.worstFrames === 0 ? v : Math.max(w, v));
    }
  }

  /** [{ name, ms, worst, share }] in running order; `share` is the fraction of the smoothed total. */
  summary() {
    const total = this.total;
    return [...this.ms].map(([name, ms]) => ({ name, ms, worst: this.worst.get(name) ?? ms, share: total ? ms / total : 0 }));
  }

  get total() {
    let t = 0;
    for (const v of this.ms.values()) t += v;
    return t;
  }

  /** The name of the stage that takes the most, or null before any frame. */
  get biggest() {
    let best = null;
    let bestMs = -1;
    for (const [name, ms] of this.ms) if (ms > bestMs) [best, bestMs] = [name, ms];
    return best;
  }
}

/** The stages of a frame, in the order they run, with what each covers (for the debug panel). */
export const FRAME_STAGES = [
  ['input and prompts', 'keys, what you are looking at, the menus'],
  ['physics', 'the fixed steps: Rapier and every vehicle\'s fixed update'],
  ['vehicles', 'each vehicle\'s engine, drivetrain, model and effects'],
  ['farm features', 'every farm feature, job and trailer that updates each frame'],
  ['girls', 'their minds, bodies and voices'],
  ['player and items', 'you, the cans and tools, the barn bench and shelves'],
  ['audio', 'the mixer and the wind on the bars'],
  ['world, weather and effects', 'daylight, the world, weather, rain and smoke'],
  ['hud', 'achievements, the HUD, photos'],
  ['drawing', 'the renderer: shadows and every draw call'],
];

/** One line for a stage: "2.31 ms (24%), worst 6.1". */
export function stageText(s) {
  if (!s) return '-';
  return `${s.ms.toFixed(2)} ms (${Math.round(s.share * 100)}%), worst ${s.worst.toFixed(1)}`;
}
