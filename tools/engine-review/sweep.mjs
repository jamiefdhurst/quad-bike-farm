// Holds each engine at fixed revs, idle to its top in 500 rpm steps (tied to the road through the clutch, throttle part open), renders
// it through the real worklet and measures each step: the firing rate heard in the audio against the engine's, loudness, tone.
//
//   node tools/engine-review/sweep.mjs [vehicle id ...] [--set param=value ...]

import { writeFileSync, mkdirSync } from 'node:fs';
import { renderClip, SPECS } from './render.mjs';
import { DEFAULT_ENGINE_PARAMS } from '../../src/engine/engineParams.js';

const SR = 48000;
const STEP = 1.6; // seconds at each rpm
const SETTLE = 0.6; // of which this is skipped before measuring
const args = process.argv.slice(2);
const ids = [];
const sets = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--set') {
    const [k, v] = args[++i].split('=');
    sets[k] = Number.isNaN(Number(v)) ? v : Number(v);
  } else ids.push(args[i]);
}
mkdirSync('.scratch/engine-review/sweep', { recursive: true });

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const c = Math.cos(a * k);
        const s = Math.sin(a * k);
        const xr = re[i + k + len / 2] * c - im[i + k + len / 2] * s;
        const xi = re[i + k + len / 2] * s + im[i + k + len / 2] * c;
        re[i + k + len / 2] = re[i + k] - xr;
        im[i + k + len / 2] = im[i + k] - xi;
        re[i + k] += xr;
        im[i + k] += xi;
      }
    }
  }
}

// Third-octave band levels (dB) from 40 Hz to 12 kHz, the centroid, and the strongest periodicity near the expected firing rate.
function analyse(x, expectHz) {
  const N = 32768;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = (x[i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  fft(re, im);
  const pow = new Float64Array(N / 2);
  for (let i = 0; i < N / 2; i++) pow[i] = re[i] * re[i] + im[i] * im[i];
  const bands = [];
  for (let f = 40; f < 12000; f *= 2 ** (1 / 3)) {
    const lo = Math.floor((f / SR) * N);
    const hi = Math.max(lo + 1, Math.floor((f * 2 ** (1 / 3) / SR) * N));
    let e = 1e-20;
    for (let k = lo; k < hi; k++) e += pow[k];
    bands.push(e);
  }
  let tot = 0;
  let cen = 0;
  for (let k = 1; k < N / 2; k++) {
    tot += pow[k];
    cen += pow[k] * ((k * SR) / N);
  }
  let rms = 0;
  for (const v of x) rms += v * v;
  rms = Math.sqrt(rms / x.length);
  // Autocorrelation over lags from half to twice the expected firing period: which rate does the audio repeat at?
  const M = Math.min(x.length, 24000);
  let best = { hz: 0, r: -1 };
  const lagLo = Math.floor(SR / (expectHz * 2.2));
  const lagHi = Math.ceil(SR / (expectHz * 0.45));
  let e0 = 0;
  for (let i = 0; i < M; i++) e0 += x[i] * x[i];
  for (let lag = Math.max(8, lagLo); lag <= lagHi && lag < M / 2; lag++) {
    let s = 0;
    let e1 = 0;
    for (let i = 0; i + lag < M; i++) {
      s += x[i] * x[i + lag];
      e1 += x[i + lag] * x[i + lag];
    }
    const r = s / Math.sqrt(e0 * e1 + 1e-20);
    if (r > best.r) best = { hz: SR / lag, r };
  }
  const db = bands.map((e) => 10 * Math.log10(e / tot));
  return { rmsDb: 20 * Math.log10(rms + 1e-9), centroid: cen / tot, bandsDb: db, periodHz: best.hz, periodR: best.r };
}

const out = [];
for (const spec of SPECS) {
  if (ids.length && !ids.includes(spec.id)) continue;
  const eng = { ...DEFAULT_ENGINE_PARAMS, ...spec.engine };
  const steps = [];
  for (let r = Math.ceil(eng.idleRpmWarm / 500) * 500; r <= eng.maxRpm; r += 500) steps.push(r);
  if (steps.at(-1) !== eng.maxRpm) steps.push(eng.maxRpm);
  const [lo, hi] = spec.roughnessRange ?? [0.08, 0.08];
  let revsPerFiring = 2;
  const clip = renderClip({ ...spec, audio: { ...spec.audio, ...sets } }, {
    roughness: (lo + hi) / 2,
    duration: steps.length * STEP,
    script: (t, engine) => {
      revsPerFiring = engine.revsPerFiring;
      const i = Math.min(steps.length - 1, Math.floor(t / STEP));
      return { throttle: 0.35, gearRpm: steps[i], gearLock: 1, driveLoad: 0.3 };
    },
  });
  const rows = steps.map((rpm, i) => {
    const a = Math.round((i * STEP + SETTLE) * SR);
    const seg = clip.pcm.subarray(a, Math.round((i + 1) * STEP * SR));
    const heldRpm = clip.trace.filter((p) => p[0] >= i * STEP + SETTLE && p[0] < (i + 1) * STEP);
    const actual = heldRpm.reduce((s, p) => s + p[1], 0) / (heldRpm.length || 1);
    const expectHz = actual / 60 / revsPerFiring;
    return { rpm, actual: Math.round(actual), expectHz, ...analyse(seg, expectHz) };
  });
  // How different each step sounds from the one below: mean absolute difference of its third-octave levels, in dB.
  for (let i = 1; i < rows.length; i++) rows[i].tone = rows[i].bandsDb.reduce((s, v, k) => s + Math.abs(v - rows[i - 1].bandsDb[k]), 0) / rows[i].bandsDb.length;
  const params = { engineSound: 'pulse', ...spec.audio, ...sets };
  console.log(`\n${spec.id} (${clip.bank}, ${params.engineSound ?? 'pulse'}, ${eng.cylinders ?? 1} cyl)`);
  console.log('  rpm  held | firing Hz  heard Hz   r   | level dB  centroid  tone change');
  for (const r of rows)
    console.log(
      `  ${String(r.rpm).padStart(5)} ${String(r.actual).padStart(5)} | ${r.expectHz.toFixed(0).padStart(6)} ${r.periodHz.toFixed(0).padStart(8)} ${r.periodR.toFixed(2).padStart(5)} | ${r.rmsDb.toFixed(1).padStart(6)} ${r.centroid.toFixed(0).padStart(8)}   ${r.tone == null ? '' : r.tone.toFixed(2)}`,
    );
  out.push({ id: spec.id, rows: rows.map(({ bandsDb, ...r }) => r) });
  const wav = Buffer.alloc(44 + clip.pcm.length * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + clip.pcm.length * 2, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(clip.pcm.length * 2, 40);
  for (let i = 0; i < clip.pcm.length; i++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, clip.pcm[i] * 0.5)) * 32767), 44 + i * 2);
  writeFileSync(`.scratch/engine-review/sweep/${spec.id}.wav`, wav);
}
writeFileSync('.scratch/engine-review/sweep/sweep.json', JSON.stringify(out));
