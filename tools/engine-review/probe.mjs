// Drives the worklet straight, with perfectly even firings at fixed rpm (no engine model), and measures how strongly the audio
// repeats at the firing rate, its loudness and its centroid. Separates what the worklet does with revs from what the model sends.
//
//   node tools/engine-review/probe.mjs <vehicle id> [--cyl n] [--set param=value ...] [--wav out.wav]

import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import { DEFAULT_AUDIO_PARAMS } from '../../src/audio/audioParams.js';
import { DEFAULT_ENGINE_PARAMS } from '../../src/engine/engineParams.js';
import { SPECS } from './render.mjs';

const SR = 48000;
const args = process.argv.slice(2);
const spec = SPECS.find((s) => s.id === args[0]);
const sets = {};
let wavOut = null;
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--set') {
    const [k, v] = args[++i].split('=');
    sets[k] = Number.isNaN(Number(v)) ? v : Number(v);
  } else if (args[i] === '--wav') wavOut = args[++i];
}
const eng = { ...DEFAULT_ENGINE_PARAMS, ...spec.engine };
const params = { ...DEFAULT_AUDIO_PARAMS, ...spec.audio, ...sets };
const revsPerFiring = (eng.strokes === 2 ? 1 : 2) / Math.max(1, eng.cylinders ?? 1);

// The bank, as render.mjs loads it.
const { bankFor } = await import('./render.mjs');
const sandbox = { sampleRate: SR, currentFrame: 0, registerProcessor: () => {}, AudioWorkletProcessor: class { constructor() { this.port = { postMessage: () => {} }; } } };
vm.createContext(sandbox);
vm.runInContext(`${readFileSync(process.env.WORKLET || 'src/audio/engineWorklet.js', 'utf8')}\n;this.EngineProcessor = EngineProcessor;`, sandbox);
const proc = new sandbox.EngineProcessor();
proc.onMessage({ bank: bankFor(`public/audio/${params.recBank}.json`) });

const steps = [];
for (let r = Math.ceil(eng.idleRpmWarm / 500) * 500; r <= eng.maxRpm; r += 500) steps.push(r);
const STEP = 1.5;
const out = new Float32Array(Math.round(steps.length * STEP * SR));
const block = new Float32Array(128);
let frame = 0;
let nextFire = 0.05;
const DT = 1 / 60;
for (let t = 0; t < steps.length * STEP; t += DT) {
  const rpm = steps[Math.min(steps.length - 1, Math.floor(t / STEP))];
  const period = (60 * revsPerFiring) / rpm;
  const events = [];
  while (nextFire < t + DT) {
    events.push({ time: nextFire + 0.05, type: 'fire', strength: 1, period });
    nextFire += period;
  }
  proc.onMessage({ params, state: { rpm, throttle: 0.35, roughness: 0, running: true, cranking: false, fan: 0, loud: 0, revsPerCycle: revsPerFiring }, events });
  const end = Math.min(out.length, Math.round((t + DT) * SR));
  while (frame + 128 <= end) {
    sandbox.currentFrame = frame;
    proc.process([], [[block]]);
    out.set(block, frame);
    frame += 128;
  }
}

function corrAt(x, lag) {
  let s = 0, a = 0, b = 0;
  for (let i = 0; i + lag < x.length; i++) { s += x[i] * x[i + lag]; a += x[i] * x[i]; b += x[i + lag] * x[i + lag]; }
  return s / Math.sqrt(a * b + 1e-20);
}
console.log(`${spec.id} ${params.recBank} ${params.engineSound} cyl ${eng.cylinders ?? 1} ${JSON.stringify(sets)}`);
console.log('  rpm  firing Hz | r at firing  r at cycle | level dB  centroid');
for (let i = 0; i < steps.length; i++) {
  const seg = out.subarray(Math.round((i * STEP + 0.5) * SR), Math.round((i + 1) * STEP * SR));
  const hz = steps[i] / 60 / revsPerFiring;
  const lag = Math.round(SR / hz);
  let rms = 0;
  for (const v of seg) rms += v * v;
  // Centroid by zero crossings would mislead; a coarse DFT-free proxy: energy of the first difference over energy.
  let d = 0;
  for (let k = 1; k < seg.length; k++) d += (seg[k] - seg[k - 1]) ** 2;
  const bright = (SR / (2 * Math.PI)) * Math.sqrt(d / rms);
  console.log(`  ${String(steps[i]).padStart(5)} ${hz.toFixed(0).padStart(7)}   | ${corrAt(seg.subarray(0, 24000), lag).toFixed(2).padStart(8)} ${corrAt(seg.subarray(0, 24000), lag * Math.max(1, eng.cylinders ?? 1)).toFixed(2).padStart(10)}  | ${(10 * Math.log10(rms / seg.length + 1e-12)).toFixed(1).padStart(6)} ${bright.toFixed(0).padStart(8)}`);
}
if (wavOut) {
  const wav = Buffer.alloc(44 + out.length * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + out.length * 2, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(out.length * 2, 40);
  for (let i = 0; i < out.length; i++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[i] * 0.5)) * 32767), 44 + i * 2);
  writeFileSync(wavOut, wav);
}
