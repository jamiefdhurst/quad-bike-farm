// What made a long frame long (#373). The game hands each long frame to `StutterLog.note` with where its time went and what the browser did
// meanwhile; this names the likeliest cause and keeps the last few for the console's `perf` and the Tune tab's "Frame time" folder.
// Pure (the clock, the heap and the shader count are passed in), tested in tests/stutters.test.js.

import { LONG_FRAME_MS } from './frameStats.js';

/** Heap use, where the browser offers it (Chrome's `performance.memory`): how fast the game is allocating, and whether the heap just dropped (a clean-up). */
export class HeapWatch {
  constructor(window = 5, dropBytes = 1.5 * 1024 * 1024) {
    this.window = window; // seconds the allocation rate is over
    this.dropBytes = dropBytes; // a fall at least this big in one frame is a clean-up
    this.last = null;
    this.rises = []; // { at, bytes } growth between frames
    this.used = 0;
  }

  /** The heap is `bytes` at `at` (seconds). Returns the bytes it fell by since the last sample, 0 if it did not fall. */
  sample(at, bytes) {
    this.used = bytes;
    const d = this.last === null ? 0 : bytes - this.last;
    this.last = bytes;
    if (d > 0) this.rises.push({ at, bytes: d });
    while (this.rises.length && this.rises[0].at <= at - this.window) this.rises.shift();
    return d < 0 ? -d : 0;
  }

  /** Megabytes a second the heap has grown by, falls not taken off (the clean-ups would hide the rate). */
  get allocMbPerSecond() {
    return this.rises.reduce((s, r) => s + r.bytes, 0) / (1024 * 1024) / this.window;
  }

  /** Did a fall of this size just happen? */
  isCleanUp(fell) {
    return fell >= this.dropBytes;
  }
}

/**
 * The cause of a long frame, in plain words.
 * @param {{ ms: number, stages: Map<string, number>, features: Map<string, number>, shadersAdded: number, heapFell: boolean }} f
 */
export function causeOfLongFrame({ stages, features, shadersAdded, heapFell }) {
  if (shadersAdded > 0) return `a shader was prepared (${shadersAdded} new)`;
  if (heapFell) return 'memory clean-up';
  let total = 0;
  let top = null;
  for (const [name, v] of stages) {
    total += v;
    if (!top || v > top[1]) top = [name, v];
  }
  if (!top || top[1] < total * 0.4) return 'spread across the frame, no one part';
  if (top[0] === 'farm features') {
    let feature = null;
    for (const [name, v] of features) if (!feature || v > feature[1]) feature = [name, v];
    if (feature && feature[1] >= top[1] * 0.5) return `${top[0]}: ${feature[0]} (${feature[1].toFixed(0)} ms)`;
  }
  return `${top[0]} (${top[1].toFixed(0)} ms)`;
}

export class StutterLog {
  constructor(keep = 5) {
    this.keep = keep;
    this.items = []; // { at, ms, cause }, newest last
  }

  note(at, ms, cause) {
    this.items.push({ at, ms, cause });
    if (this.items.length > this.keep) this.items.shift();
  }

  /** The last few as lines, newest first: "41 ms, memory clean-up". */
  lines() {
    return [...this.items].reverse().map((x) => `${Math.round(x.ms)} ms, ${x.cause}`);
  }
}

/** The game's one place for it: told about every frame, it keeps the heap's figures and names the cause of each long frame. */
export class StutterWatch {
  constructor() {
    this.heap = new HeapWatch();
    this.log = new StutterLog();
    this.shaders = null; // how many shader programs the renderer held after the last frame
  }

  /**
   * A frame has ended.
   * @param {{ at: number, ms: number, stages: Map<string, number>, features: Map<string, number>, shaders: number, heapBytes?: number }} f
   *   `at` seconds, `ms` the frame's own work, `shaders` the renderer's program count, `heapBytes` where the browser reports it
   */
  frame({ at, ms, stages, features, shaders, heapBytes }) {
    const fell = heapBytes === undefined ? 0 : this.heap.sample(at, heapBytes);
    const added = this.shaders === null ? 0 : Math.max(0, shaders - this.shaders);
    this.shaders = shaders;
    if (ms > LONG_FRAME_MS) this.log.note(at, ms, causeOfLongFrame({ stages, features, shadersAdded: added, heapFell: this.heap.isCleanUp(fell) }));
  }
}
