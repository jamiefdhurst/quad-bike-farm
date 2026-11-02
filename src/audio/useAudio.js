// The small sounds of using things: picking something up, putting it down, a latch or switch, a page or a board. Made once as samples
// and played at the listener, so every interaction has a sound (.claude/rules/controls.md). Same shape as doorAudio.js. Pure.

export const USE_CUES = ['pickUp', 'putDown', 'latch', 'paper', 'tap'];

// What each cue is: a body note (Hz, how fast it dies, level), a click of noise (how fast it dies, how dark, level) and a length.
const CUES = {
  pickUp: { body: [210, 38, 0.35], noise: [70, 0.35, 0.5], seconds: 0.18 }, // a light scuff and knock
  putDown: { body: [120, 26, 0.8], noise: [90, 0.2, 0.35], seconds: 0.25 }, // a duller knock
  latch: { body: [1400, 90, 0.3], noise: [160, 0.6, 0.55], seconds: 0.1 }, // a short dry click
  tap: { body: [2600, 55, 0.5], noise: [220, 0.7, 0.4], seconds: 0.12 }, // a spanner rapped on metal
  paper: { body: [0, 1, 0], noise: [18, 0.7, 0.5], seconds: 0.3 }, // a rustle: noise swelling in and fading out
};

/** One cue as samples, deterministic. */
export function useSamples(kind, rate) {
  const c = CUES[kind];
  if (!c) throw new Error(`No such cue: ${kind}`);
  const n = Math.round(rate * c.seconds);
  const out = new Float32Array(n);
  let seed = 4242 + kind.length * 17;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    lp += (noise - lp) * c.noise[1];
    const swell = kind === 'paper' ? Math.min(1, t * 40) * (0.6 + 0.4 * Math.sin(t * 90)) : 1;
    out[i] = Math.sin(2 * Math.PI * c.body[0] * t) * Math.exp(-t * c.body[1]) * c.body[2] + lp * Math.exp(-t * c.noise[0]) * c.noise[2] * swell;
  }
  return out;
}
