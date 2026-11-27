// Scores ways of building revs from an idle recording against the same engine's real revs. For each bank with both from one
// recording, the worklet plays the idle firings only, with even firings at the rpm of a real rev grain; its spectrum (third-octave
// bands, 80 Hz to 8 kHz, level taken out) is compared with the real revs' at that rpm. Lower is closer.
//
//   WORKLET=tools/engine-review/prototype/engineWorklet.js node tools/engine-review/fit.mjs [--wav]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';
import { DEFAULT_AUDIO_PARAMS } from '../../src/audio/audioParams.js';
import { DEFAULT_ENGINE_PARAMS } from '../../src/engine/engineParams.js';
import { SPECS, bankFor } from './render.mjs';
import { modelBank, welch } from './model.mjs';

const SR = 48000;
const WORKLET = readFileSync(process.env.WORKLET, 'utf8');
const wavs = process.argv.includes('--wav');
mkdirSync('.scratch/engine-review/wav/fit', { recursive: true });

// Same-engine pairs: the bank, the vehicle whose settings it plays with, the idle kind and the recording its real revs come from.
export const PAIRS = [
  { bank: 'engine-bank-moto', vehicle: 'tz65', kind: 'idle', src: 'der', split: 1 },
  { bank: 'engine-bank-50', vehicle: 'asp', kind: 'idle', src: 'gil', split: 1 },
  { bank: 'engine-bank-plover', vehicle: 'plover', kind: 'idle', src: 'sl', split: 1 },
  { bank: 'engine-bank-2t', vehicle: 'adder', kind: 'idle2', src: 'crm', split: 1, sets: { recIdleSource: 'rev' } },
  // The Griffin's and Finch's pairs went with their old BBC banks in #858: their new recordings are idles alone.
];

const IDLE_ONLY = { pulseRevLo: 0, pulseRevHi: 0 };
export const CANDIDATES = [
  { id: 'now', label: 'Idle as now (each firing at its own speed)', sets: { pulsePitchFollow: 0 } },
  { id: 'resample', label: 'Idle resampled to fit (pitch follow 1)', sets: { pulsePitchFollow: 1 } },
  ...[0.5, 0.7, 0.85, 1].flatMap((f) => [2, 3, 4].map((o) => ({ id: `model-f${f}-s${o}`, label: `Model, follow ${f}, slope ${o} oct`, sets: { pulsePitchFollow: f }, model: { slopeOct: o } }))),
];

export function bands(x) {
  const N = 4096;
  const pow = welch(x, N);
  const out = [];
  for (let f = 80; f < 8000; f *= 2 ** (1 / 3)) {
    const lo = Math.floor((f / SR) * N), hi = Math.max(lo + 1, Math.floor(((f * 2 ** (1 / 3)) / SR) * N));
    let e = 1e-30;
    for (let k = lo; k < hi; k++) e += pow[k];
    out.push(10 * Math.log10(e / (hi - lo)));
  }
  const mean = out.reduce((a, b) => a + b, 0) / out.length;
  return out.map((v) => v - mean);
}
export const dist = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;
// How strongly it repeats at the firing period (the best normalised autocorrelation within 4% of it): the note you hear.
export function note(x, rpm, revsPerFiring) {
  const lag0 = (SR * 60 * revsPerFiring) / rpm;
  const M = Math.min(x.length, 24000);
  let best = -1;
  for (let lag = Math.floor(lag0 * 0.96); lag <= Math.ceil(lag0 * 1.04) && lag < M / 2; lag++) {
    let s = 0, a = 0, b = 0;
    for (let i = 0; i + lag < M; i++) { s += x[i] * x[i + lag]; a += x[i] * x[i]; b += x[i + lag] * x[i + lag]; }
    best = Math.max(best, s / Math.sqrt(a * b + 1e-20));
  }
  return best;
}

export function play(bankMsg, params, revsPerFiring, rpm, seconds = 1.6, seed = 1) {
  const sb = { sampleRate: SR, currentFrame: 0, registerProcessor: () => {}, AudioWorkletProcessor: class { constructor() { this.port = { postMessage: () => {} }; } } };
  vm.createContext(sb);
  // The worklet's own random choices, seeded, so a score repeats.
  vm.runInContext(`{ let s = ${seed * 7919}; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647; }`, sb);
  vm.runInContext(`${WORKLET}\n;this.EngineProcessor = EngineProcessor;`, sb);
  const proc = new sb.EngineProcessor();
  proc.onMessage({ bank: bankMsg });
  const out = new Float32Array(Math.round(seconds * SR));
  const block = new Float32Array(128);
  const period = (60 * revsPerFiring) / rpm;
  let next = 0.02, frame = 0;
  for (let t = 0; t < seconds; t += 1 / 60) {
    const events = [];
    while (next < t + 1 / 60) {
      events.push({ time: next + 0.02, type: 'fire', strength: 1, period });
      next += period;
    }
    proc.onMessage({ params, state: { rpm, throttle: 1, roughness: 0, running: true, cranking: false, fan: 0, loud: 0, revsPerCycle: revsPerFiring }, events });
    const end = Math.min(out.length, Math.round((t + 1 / 60) * SR));
    while (frame + 128 <= end) {
      sb.currentFrame = frame;
      proc.process([], [[block]]);
      out.set(block, frame);
      frame += 128;
    }
  }
  return out.subarray(Math.round(0.5 * SR));
}

export function writeWav(path, out) {
  const wav = Buffer.alloc(44 + out.length * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + out.length * 2, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(out.length * 2, 40);
  let peak = 1e-9;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < out.length; i++) wav.writeInt16LE(Math.round((out[i] / peak) * 0.7 * 32767), 44 + i * 2);
  writeFileSync(path, wav);
}

if (import.meta.url === `file://${process.argv[1]}`) {
const results = [];
for (const pair of PAIRS) {
  const spec = SPECS.find((s) => s.id === pair.vehicle);
  const eng = { ...DEFAULT_ENGINE_PARAMS, ...spec.engine };
  const revsPerCycle = eng.strokes === 2 ? 1 : 2;
  const cyl = pair.split > 1 ? pair.split : Math.max(1, eng.cylinders ?? 1);
  const revsPerFiring = revsPerCycle / cyl;
  const bank = bankFor(`public/audio/${pair.bank}.json`);
  // The real revs: rev grains from the same recording, at three rpms across their range, each ±8% of it joined in order.
  const real = bank.grains.filter((g) => g.kind === 'accel' && g.src === pair.src && g.ok !== false).sort((a, b) => a.rpm - b.rpm);
  const points = [0.25, 0.55, 0.85].map((q) => real[Math.floor(q * (real.length - 1))].rpm);
  const targets = points.map((label) => {
    const gs = real.filter((g) => Math.abs(Math.log(g.rpm / label)) < 0.08).sort((a, b) => a.start - b.start);
    const n = gs.reduce((s, g) => s + Math.round(g.dur * SR), 0);
    const x = new Float32Array(Math.max(n, 8192));
    let o = 0;
    for (const g of gs) {
      const a = Math.round(g.start * SR), len = Math.round(g.dur * SR);
      x.set(bank.data.subarray(a, a + len), o);
      o += len;
    }
    if (wavs) writeWav(`.scratch/engine-review/wav/fit/${pair.vehicle}-real-${Math.round(label)}.wav`, x);
    // A grain's label is its cycle's rpm (120 / length); the engine's rpm is that times its revs per cycle over 2.
    const rpm = (label * revsPerCycle) / 2;
    return { label, rpm, bands: bands(x), seconds: n / SR, note: note(x.subarray(0, n), rpm, revsPerFiring) };
  });
  const base = { ...DEFAULT_AUDIO_PARAMS, ...spec.audio, ...IDLE_ONLY, ...(pair.sets ?? {}), ...(pair.split > 1 ? { pulseSplit: pair.split, pulseDivide: 1 } : {}) };
  const models = new Map();
  const row = { pair: pair.vehicle, bank: pair.bank, points: targets.map((t) => Math.round(t.rpm)), scores: {} };
  for (const c of CANDIDATES) {
    let msg = bank;
    if (c.model) {
      const key = JSON.stringify(c.model);
      if (!models.has(key)) models.set(key, modelBank(bank, bank.data, pair.kind, { split: pair.split, ...c.model }));
      msg = models.get(key);
    }
    const params = { ...base, ...c.sets };
    const ds = targets.map((t) => {
      const y = play(msg, params, revsPerFiring, t.rpm);
      if (wavs) writeWav(`.scratch/engine-review/wav/fit/${pair.vehicle}-${c.id}-${Math.round(t.label)}.wav`, y);
      return [dist(bands(y), t.bands), note(y, t.rpm, revsPerFiring)];
    });
    row.scores[c.id] = ds.map((d) => d[0]);
    row.notes ??= {};
    row.notes[c.id] = ds.map((d) => d[1]);
  }
  results.push(row);
  console.log(`\n${pair.vehicle} (${pair.bank}), real revs at ${row.points.join(', ')} rpm (${targets.map((t) => t.seconds.toFixed(1)).join(', ')} s of recording)`);
  row.realNotes = targets.map((t) => t.note);
  console.log(`  ${'real revs: note'.padEnd(44)} ${''.padStart(17)}          ${row.realNotes.map((r) => r.toFixed(2).padStart(5)).join(' ')}`);
  for (const c of CANDIDATES) console.log(`  ${c.label.padEnd(44)} ${row.scores[c.id].map((d) => d.toFixed(1).padStart(5)).join(' ')}   mean ${(row.scores[c.id].reduce((a, b) => a + b, 0) / 3).toFixed(2)}   note ${row.notes[c.id].map((r) => r.toFixed(2).padStart(5)).join(' ')}`);
}
console.log('\nMean over every pair and rpm (dB, lower is closer to the real revs):');
for (const c of CANDIDATES) {
  const all = results.flatMap((r) => r.scores[c.id]);
  const nerr = results.flatMap((r) => r.notes[c.id].map((v, i) => Math.abs(v - r.realNotes[i])));
  console.log(`  ${c.label.padEnd(44)} tone ${(all.reduce((a, b) => a + b, 0) / all.length).toFixed(2)} dB   note off by ${(nerr.reduce((a, b) => a + b, 0) / nerr.length).toFixed(2)}`);
}
writeFileSync('.scratch/engine-review/fit.json', JSON.stringify(results));
}
