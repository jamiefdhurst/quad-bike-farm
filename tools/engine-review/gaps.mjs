// Counts dropouts in rendered WAVs: 5 ms windows more than 20 dB under the clip's median level (only where the engine is
// running: the clip's first and last 0.3 s are skipped), and clicks: samples jumping more than 8 times the clip's typical step.
//   node tools/engine-review/gaps.mjs a.wav [b.wav ...]
import { readFileSync } from 'node:fs';
for (const f of process.argv.slice(2)) {
  const b = readFileSync(f);
  const n = (b.length - 44) / 2;
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = b.readInt16LE(44 + i * 2) / 32768;
  const W = 240, from = 14400, to = n - 14400;
  const rms = [];
  for (let o = from; o + W < to; o += W) {
    let s = 0;
    for (let i = 0; i < W; i++) s += x[o + i] ** 2;
    rms.push(10 * Math.log10(s / W + 1e-12));
  }
  const med = [...rms].sort((a, c) => a - c)[rms.length >> 1];
  const drops = rms.filter((r) => r < med - 20).length;
  const steps = [];
  for (let i = from + 1; i < to; i++) steps.push(Math.abs(x[i] - x[i - 1]));
  const typical = [...steps].sort((a, c) => a - c)[Math.floor(steps.length * 0.5)] || 1e-9;
  const clicks = steps.filter((s) => s > typical * 8 && s > 0.02).length;
  console.log(`${f.split('/').pop().padEnd(44)} dropouts ${String(drops).padStart(4)} of ${rms.length}   clicks ${clicks}`);
}
