// Renders a vehicle's engine sound offline to a WAV, through the real engine model and the real worklet, with no browser:
// cheap enough to compare banks and settings by ear or by numbers.
//
//   node tools/render_engine_sound.mjs <vehicle id> <out.wav> [--bank path/to/bank.json] [--set param=value ...] [--start]
//
// The vehicle id is a spec's id (farm300, bruin, hartley, yak, tor, ...). --bank plays another bank (its WAV beside it, same
// name) instead of the spec's recBank; --set overrides an audio param (numbers or strings). The engine starts warm and runs
// one timeline, printed as it goes: idle 4 s, full throttle 7 s, idle 4 s, half throttle 4 s, full throttle 6 s, idle 3 s,
// with no load (stood still, revving), its roughness the middle of its range and on its own fuel. --start records the start
// first instead of skipping it: key on (glow plugs a few seconds), the starter until it catches, then a few seconds of tickover;
// with --no-catch as well, the tank is empty, so it cranks for four seconds without catching. Rendered at 48 kHz, written at half scale so the soft clipper's top isn't clipped again.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import vm from 'node:vm';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { DEFAULT_AUDIO_PARAMS } from '../src/audio/audioParams.js';
import { QUAD_SPECS, EXTRA_SPECS, PLOVER_SPEC, TRACTOR_SPEC, UTV_SPEC, TOR_SPEC, CRAG_SPEC, FINCH_SPEC, GRIFFIN_SPEC, VAUCLAIR_SPEC } from '../src/vehicle/quadSpecs.js';

const SR = 48000;
const DT = 1 / 60;
const PLAN = [
  [4, 0],
  [7, 1],
  [4, 0],
  [4, 0.5],
  [6, 1],
  [3, 0],
];

const args = process.argv.slice(2);
const [id, outPath] = args;
const spec = [...QUAD_SPECS, ...EXTRA_SPECS, PLOVER_SPEC, TRACTOR_SPEC, UTV_SPEC, TOR_SPEC, CRAG_SPEC, FINCH_SPEC, GRIFFIN_SPEC, VAUCLAIR_SPEC].find((s) => s.id === id);
if (!spec || !outPath) {
  console.error('usage: node tools/render_engine_sound.mjs <vehicle id> <out.wav> [--bank bank.json] [--set param=value ...]');
  process.exit(1);
}
const params = { ...DEFAULT_AUDIO_PARAMS, ...spec.audio };
let bankPath = `public/audio/${params.recBank}.json`;
for (let i = 2; i < args.length; i++) {
  if (args[i] === '--bank') bankPath = args[++i];
  else if (args[i] === '--set') {
    const [k, v] = args[++i].split('=');
    params[k] = Number.isNaN(Number(v)) ? v : Number(v);
  }
}

// The banks ship as FLAC; the lossless WAV they were made from is kept in source/audio (tools/wav_to_flac.py), or beside a --bank json.
function wavFor(jsonPath) {
  const beside = jsonPath.replace(/\.json$/, '.wav');
  const kept = `source/audio/${basename(beside)}`;
  return existsSync(beside) ? beside : kept;
}

/** A 16-bit mono WAV, resampled to the render rate as decodeAudioData would. */
function readWav(path) {
  const b = readFileSync(path);
  let o = 12;
  let data;
  let rate;
  while (o < b.length) {
    const chunk = b.toString('ascii', o, o + 4);
    const len = b.readUInt32LE(o + 4);
    if (chunk === 'fmt ') rate = b.readUInt32LE(o + 12);
    if (chunk === 'data') data = b.subarray(o + 8, o + 8 + len);
    o += 8 + len + (len & 1);
  }
  const n = data.length / 2;
  const src = new Float32Array(n);
  for (let i = 0; i < n; i++) src[i] = data.readInt16LE(i * 2) / 32768;
  const out = new Float32Array(Math.floor((n * SR) / rate));
  for (let i = 0; i < out.length; i++) {
    const x = (i * rate) / SR;
    const k = Math.floor(x);
    const f = x - k;
    out[i] = (src[k] ?? 0) * (1 - f) + (src[k + 1] ?? 0) * f;
  }
  return out;
}

// The worklet runs with the audio thread's globals; give it them in a sandbox (as tests/engineWorkletNaN.test.js does).
const sandbox = {
  sampleRate: SR,
  currentFrame: 0,
  registerProcessor: () => {},
  AudioWorkletProcessor: class {
    constructor() {
      this.port = { postMessage: (m) => m.warn && console.warn(m.warn) };
    }
  },
};
vm.createContext(sandbox);
vm.runInContext(`${readFileSync('src/audio/engineWorklet.js', 'utf8')}\n;this.EngineProcessor = EngineProcessor;`, sandbox);
const proc = new sandbox.EngineProcessor();
const bank = JSON.parse(readFileSync(bankPath, 'utf8'));
proc.onMessage({ bank: { ...bank, data: readWav(wavFor(bankPath)) } });

let seed = 7;
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
// The middle of its roughness range, and its own fuel: a diesel's engine reads a missing `diesel` as petrol and runs soaked in it.
const rough = spec.roughnessRange ? { baseRoughness: (spec.roughnessRange[0] + spec.roughnessRange[1]) / 2 } : {};
const engine = new EngineModel({ ...DEFAULT_ENGINE_PARAMS, ...spec.engine, ...rough, initialTemperature: 1 }, { random });
// --no-catch cranks on an empty tank, so the starter can be heard on its own for as long as it's held.
const fuel = { fuel: process.argv.includes('--no-catch') ? 0 : 1, diesel: spec.fuel?.startDiesel ?? 0 };
const recordStart = args.includes('--start');
const GLOW = 3; // seconds with the key on before the starter (a diesel's glow plugs; a petrol engine doesn't mind)
engine.setIgnition(true);
// A bike with no starter motor is kicked over every 1.5 s instead (after its ritual: the spark lever back and a tickle or two), as a person would.
const noStarter = !!spec.engine?.noStarter;
if (noStarter) {
  if (engine.params.manualTiming) engine.advance = engine.params.startAdvance;
  if (engine.temperature < 0.5) for (let i = 0; i < 2; i++) engine.tickle(); // (a warm one wants none)
}
const kickEvery = 1.5;
const kickNow = (s) => noStarter && !engine.isRunning && Math.abs(((s % kickEvery) + kickEvery) % kickEvery) < DT && engine.pull(0.6) !== null;
if (!recordStart) {
  for (let t = 0; t < 30 && !engine.isRunning; t += DT) {
    kickNow(t - 4);
    engine.update(DT, { ...fuel, starter: !noStarter && t > 8 });
  }
  for (let t = 0; t < 3; t += DT) engine.update(DT, fuel);
  if (!engine.isRunning) throw new Error(`${id} never started`);
}

// With --start: the key, the starter held until it catches (or 8 s), and a few seconds' tickover; otherwise the revving plan.
const plan = recordStart ? [['glow', GLOW], ['crank', fuel.fuel ? 8 : 4], ['idle', fuel.fuel ? 4 : 1]] : PLAN.map(([d, throttle]) => ['plan', d, throttle]);
const out = new Float32Array(Math.ceil(plan.reduce((a, [, d]) => a + d, 0) * SR));
const block = new Float32Array(128);
let frame = 0;
let t = 0;
for (const [step, dur, throttle = 0] of plan) {
  let top = 0;
  let caughtAt = null;
  const from = t;
  for (let s = 0; s < dur; s += DT) {
    if (step === 'crank' && engine.isRunning) {
      caughtAt ??= s;
      if (s - caughtAt > 0.5) break;
    }
    if (step === 'crank') kickNow(s);
    engine.update(DT, { ...fuel, throttle, starter: !noStarter && step === 'crank' && !engine.isRunning });
    top = Math.max(top, engine.rpm);
    const start = (frame + 0.05 * SR) / SR; // a little latency, as in the game
    const events = engine.pulses.map((p) => ({ time: start + p.t, type: p.type, strength: p.strength, period: p.period }));
    for (const e of engine.events ?? []) events.push({ time: start + e.t, type: e.type, strength: e.strength });
    proc.onMessage({
      params,
      state: {
        rpm: engine.rpm,
        throttle: engine.throttle,
        roughness: engine.roughness,
        running: engine.isRunning,
        cranking: engine.state === 'cranking',
        fan: engine.fan,
        loud: engine.exhaustLoud,
        revsPerCycle: engine.revsPerFiring,
      },
      events,
    });
    t += DT;
    const end = Math.min(out.length, Math.round(t * SR));
    while (frame + 128 <= end) {
      sandbox.currentFrame = frame;
      proc.process([], [[block]]);
      out.set(block, frame);
      frame += 128;
    }
  }
  const what = step === 'plan' ? `throttle ${throttle}` : step === 'crank' ? (caughtAt != null ? `cranking, caught after ${caughtAt.toFixed(2)} s` : 'cranking, never caught') : step;
  console.log(`${from.toFixed(1).padStart(4)} s: ${what}, up to ${Math.round(top)} rpm`);
}

const wav = Buffer.alloc(44 + out.length * 2);
wav.write('RIFF', 0);
wav.writeUInt32LE(36 + out.length * 2, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(SR, 24);
wav.writeUInt32LE(SR * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(out.length * 2, 40);
for (let i = 0; i < out.length; i++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[i] * 0.5)) * 32767), 44 + i * 2);
writeFileSync(outPath, wav);
console.log(`wrote ${outPath}`);
