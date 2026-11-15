// Scans a bank's idle grains in the source recording for a narrow tonal peak (2 to 6 kHz), grain by grain.
//   node tools/engine-review/srcscan.mjs <bank name> [kind]
import { readFileSync } from 'node:fs';
import { bankFor } from './render.mjs';
const SR = 48000;
const [name, kind = 'idle'] = process.argv.slice(2);
const b = bankFor(`public/audio/${name}.json`);
const N = 2048;
function prominence(off) {
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = (b.data[off + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; } }
  for (let len = 2; len <= N; len <<= 1) { const a = (-2 * Math.PI) / len; for (let i = 0; i < N; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(a * k), s = Math.sin(a * k); const xr = re[i + k + len / 2] * c - im[i + k + len / 2] * s, xi = re[i + k + len / 2] * s + im[i + k + len / 2] * c; re[i + k + len / 2] = re[i + k] - xr; im[i + k + len / 2] = im[i + k] - xi; re[i + k] += xr; im[i + k] += xi; } }
  const db = [];
  for (let k = 0; k < N / 2; k++) db.push(10 * Math.log10(re[k] * re[k] + im[k] * im[k] + 1e-20));
  let best = { hz: 0, p: -99 };
  for (let k = Math.floor((2000 / SR) * N); k < (6000 / SR) * N; k++) {
    const around = [];
    for (let j = k - 25; j <= k + 25; j++) if (Math.abs(j - k) > 2) around.push(db[j]);
    around.sort((x, y) => x - y);
    const p = db[k] - around[around.length >> 1];
    if (p > best.p) best = { hz: (k * SR) / N, p };
  }
  return best;
}
const grains = b.grains.filter((g) => g.kind === kind);
const rows = grains.map((g) => ({ t: g.start, ok: g.ok !== false, slice: g.slice, ...prominence(Math.round(g.start * SR)) }));
const ps = rows.map((r) => r.p).sort((x, y) => x - y);
console.log(`${name} ${kind}: ${rows.length} grains from ${rows[0].t.toFixed(2)} to ${rows.at(-1).t.toFixed(2)} s; tonal peak median ${ps[ps.length >> 1].toFixed(1)} dB, p90 ${ps[Math.floor(ps.length * 0.9)].toFixed(1)}`);
// Runs of grains whose peak stands 6 dB above the median, by time in the recording.
const thr = ps[ps.length >> 1] + 6;
let run = null;
const runs = [];
for (const r of rows) {
  if (r.p > thr) { if (!run) run = { from: r.t, to: r.t, n: 0, hz: [] }; run.to = r.t; run.n++; run.hz.push(r.hz); }
  else if (run) { runs.push(run); run = null; }
}
if (run) runs.push(run);
for (const r of runs.filter((r) => r.n >= 2)) console.log(`  ${r.from.toFixed(2)} to ${r.to.toFixed(2)} s: ${r.n} grains, around ${Math.round(r.hz.reduce((a, x) => a + x, 0) / r.hz.length)} Hz`);
if (process.argv[4]) {
  const [a, z] = process.argv[4].split('-').map(Number);
  for (const r of rows.filter((r) => r.t >= a && r.t <= z)) console.log(`    ${r.t.toFixed(3)} s${r.slice != null ? ` s${r.slice}` : ''}${r.ok ? '' : ' (not ok)'}: ${r.hz.toFixed(0)} Hz ${r.p.toFixed(1)} dB`);
}
