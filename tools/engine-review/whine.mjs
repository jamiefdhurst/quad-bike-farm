// Looks for tonal artefacts (a narrow spectral peak standing well above its neighbours) in a long idle, and lists the grains
// playing when one shows.  node tools/engine-review/whine.mjs <vehicle id> [seconds]
import { writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { renderClip, SPECS, banks } from './render.mjs';
const SR = 48000;
const [id, secs = '30', bankOverride] = process.argv.slice(2);
const spec = SPECS.find((s) => s.id === id);
// A patched bank (dewhine.mjs) in place of the shipped one, same audio.
if (bankOverride) banks.set(`public/audio/${spec.audio.recBank}.json`, JSON.parse(readFileSync(bankOverride, 'utf8')));
const [lo, hi] = spec.roughnessRange;
const log = [];
let clock = 0;
const { pcm } = renderClip(spec, {
  roughness: (lo + hi) / 2,
  duration: +secs,
  script: () => ({}),
  onProc: (proc, sb) => {
    const wrap = () => {
      const r = proc.recorded;
      if (!r || r.__wrapped) return;
      r.__wrapped = true;
      const orig = r.playPulse.bind(r);
      r.playPulse = (g, cycleRpm, gain, period, attack, p, layer) => {
        const before = r.voices.length;
        orig(g, cycleRpm, gain, period, attack, p, layer);
        const v = r.voices[r.voices.length - 1];
        if (r.voices.length > before) log.push({ t: (sb.currentFrame) / SR, start: g.start, len: g.len, tail: g.tail, slice: g.slice, kind: g.kind, rpm: g.rpm, cycleRpm, rate: v.rate, playLen: v.len });
      };
    };
    const origProcess = proc.process.bind(proc);
    proc.process = (...a) => { wrap(); return origProcess(...a); };
  },
});
// Short-time spectra, 4096 points every 1024: the strongest peak from 300 Hz to 8 kHz against the median level around it.
const N = 4096;
function spectrum(off) {
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = (pcm[off + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; } }
  for (let len = 2; len <= N; len <<= 1) { const a = (-2 * Math.PI) / len; for (let i = 0; i < N; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(a * k), s = Math.sin(a * k); const xr = re[i + k + len / 2] * c - im[i + k + len / 2] * s, xi = re[i + k + len / 2] * s + im[i + k + len / 2] * c; re[i + k + len / 2] = re[i + k] - xr; im[i + k + len / 2] = im[i + k] - xi; re[i + k] += xr; im[i + k] += xi; } }
  const db = new Float64Array(N / 2);
  for (let k = 0; k < N / 2; k++) db[k] = 10 * Math.log10(re[k] * re[k] + im[k] * im[k] + 1e-20);
  return db;
}
const frames = [];
for (let off = 0; off + N < pcm.length; off += 1024) {
  const db = spectrum(off);
  let best = { k: 0, prom: -99 };
  for (let k = Math.floor((300 / SR) * N); k < (8000 / SR) * N; k++) {
    const around = [];
    for (let j = k - 40; j <= k + 40; j++) if (Math.abs(j - k) > 3) around.push(db[j]);
    around.sort((a, b) => a - b);
    const prom = db[k] - around[around.length >> 1];
    if (prom > best.prom) best = { k, prom };
  }
  frames.push({ t: off / SR, hz: (best.k * SR) / N, prom: best.prom });
}
const proms = frames.map((f) => f.prom).sort((a, b) => a - b);
console.log(`${id}: ${frames.length} frames, peak prominence median ${proms[proms.length >> 1].toFixed(1)} dB, p95 ${proms[Math.floor(proms.length * 0.95)].toFixed(1)}, max ${proms.at(-1).toFixed(1)}`);
const top = [...frames].sort((a, b) => b.prom - a.prom).slice(0, 12).sort((a, b) => a.t - b.t);
for (const f of top) {
  const near = log.filter((l) => l.t > f.t - 0.03 && l.t < f.t + N / SR);
  console.log(`  ${f.t.toFixed(2)} s: ${f.hz.toFixed(0)} Hz, ${f.prom.toFixed(1)} dB over its neighbours; grains ${near.map((l) => `${l.kind}@${(l.start / SR).toFixed(3)}${l.slice != null ? `/s${l.slice}` : ''} rate ${l.rate.toFixed(2)} len ${(l.playLen / SR * 1000).toFixed(0)}ms`).join(', ')}`);
}
writeFileSync(`.scratch/engine-review/wav/${id}-longidle.json`, JSON.stringify({ frames, log }));
const wav = Buffer.alloc(44 + pcm.length * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + pcm.length * 2, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(pcm.length * 2, 40);
for (let i = 0; i < pcm.length; i++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, pcm[i] * 0.5)) * 32767), 44 + i * 2);
writeFileSync(`.scratch/engine-review/wav/${id}-longidle${bankOverride ? '-fixed' : ''}.wav`, wav);
