// Ticks: short bursts above 2.5 kHz standing 5 times over the 20 ms around them (0.25 ms steps), counted a second, in WAVs.
//   node tools/engine-review/ticks.mjs a.wav [b.wav ...]
import { readFileSync } from 'node:fs';
export function tickRate(x, sr = 48000, { hz = 2500, over = 5 } = {}) {
  const w = (2 * Math.PI * hz) / sr, cos = Math.cos(w), alpha = Math.sin(w) / (2 * 0.707), a0 = 1 + alpha;
  const b0 = (1 + cos) / 2 / a0, b1 = -(1 + cos) / a0, a1 = (-2 * cos) / a0, a2 = (1 - alpha) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const step = 12, lv = [];
  let e = 0, k = 0;
  for (let i = 0; i < x.length; i++) {
    const y = b0 * x[i] + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y;
    e += y * y;
    if (++k === step) { lv.push(Math.sqrt(e / step)); e = 0; k = 0; }
  }
  // The 20 ms around each step (80 levels) kept sorted as it slides, one out and one in, rather than sorted afresh at every step.
  let ticks = 0, last = -99;
  const around = lv.slice(0, 80).sort((p, q) => p - q);
  const at = (v) => {
    let lo = 0, hi = around.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (around[mid] < v) lo = mid + 1; else hi = mid; }
    return lo;
  };
  for (let j = 40; j < lv.length - 40; j++) {
    if (j > 40) {
      around.splice(at(lv[j - 41]), 1);
      around.splice(at(lv[j + 39]), 0, lv[j + 39]);
    }
    if (lv[j] > over * around[40] && j - last > 8) { ticks++; last = j; }
  }
  return ticks / (x.length / sr);
}
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const f of process.argv.slice(2)) {
    const b = readFileSync(f);
    const n = (b.length - 44) / 2;
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = b.readInt16LE(44 + i * 2) / 32768;
    console.log(`${f.split('/').pop().padEnd(44)} ${tickRate(x).toFixed(1)} ticks a second`);
  }
}
