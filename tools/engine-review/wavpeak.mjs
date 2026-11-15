// The strongest narrow 2 to 6 kHz tone in a rendered WAV, and how many 85 ms frames show one 6 dB over the clip's median.
//   node tools/engine-review/wavpeak.mjs a.wav [b.wav ...]
import { readFileSync } from 'node:fs';
const N = 4096;
for (const f of process.argv.slice(2)) {
  const b = readFileSync(f);
  const n = (b.length - 44) / 2;
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = b.readInt16LE(44 + i * 2) / 32768;
  const proms = [];
  for (let off = 0; off + N < n; off += 2048) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[off + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
    for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; } }
    for (let len = 2; len <= N; len <<= 1) { const a = (-2 * Math.PI) / len; for (let i = 0; i < N; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(a * k), s = Math.sin(a * k); const xr = re[i + k + len / 2] * c - im[i + k + len / 2] * s, xi = re[i + k + len / 2] * s + im[i + k + len / 2] * c; re[i + k + len / 2] = re[i + k] - xr; im[i + k + len / 2] = im[i + k] - xi; re[i + k] += xr; im[i + k] += xi; } }
    const db = [];
    for (let k = 0; k < N / 2; k++) db.push(10 * Math.log10(re[k] * re[k] + im[k] * im[k] + 1e-20));
    let best = -99;
    for (let k = Math.floor((2000 / 48000) * N); k < (6000 / 48000) * N; k++) {
      const around = [];
      for (let j = k - 40; j <= k + 40; j++) if (Math.abs(j - k) > 3) around.push(db[j]);
      around.sort((p, q) => p - q);
      best = Math.max(best, db[k] - around[around.length >> 1]);
    }
    proms.push(best);
  }
  const s = [...proms].sort((p, q) => p - q);
  const med = s[s.length >> 1];
  console.log(`${f.split('/').pop()}: median ${med.toFixed(1)} dB, max ${s.at(-1).toFixed(1)}, frames 6 dB over median ${proms.filter((p) => p > med + 6).length} of ${proms.length}`);
}
