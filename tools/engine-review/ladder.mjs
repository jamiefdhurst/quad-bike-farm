// Renders an engine through the real engine model and worklet, offline and in node, with nothing written anywhere: the core the
// review's tools share and tests/engineSound.test.js imports (#856). Every random choice (the model's and the worklet's) comes from a
// seeded stream, so a render repeats sample for sample.
//
//   renderClip(spec, { roughness, duration, script })  one clip from a script of the frame's controls
//   renderLadder(spec, { stepSeconds })                 held at 500 rpm steps from idle to its top

import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import vm from 'node:vm';
import { EngineModel } from '../../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../../src/engine/engineParams.js';
import { DEFAULT_AUDIO_PARAMS } from '../../src/audio/audioParams.js';
import { QUAD_SPECS, EXTRA_SPECS, PLOVER_SPEC, HARTLEY_SPEC, YAK_SPEC, TOR_SPEC, CRAG_SPEC, FINCH_SPEC, GRIFFIN_SPEC, VAUCLAIR_SPEC } from '../../src/vehicle/quadSpecs.js';

export const SR = 48000;
export const DT = 1 / 60;
// Every vehicle with an engine.
export const SPECS = [...QUAD_SPECS, ...EXTRA_SPECS, PLOVER_SPEC, HARTLEY_SPEC, YAK_SPEC, TOR_SPEC, CRAG_SPEC, FINCH_SPEC, GRIFFIN_SPEC, VAUCLAIR_SPEC];

// A Park-Miller stream: the same numbers for the same seed, in [0, 1).
export function seeded(seed = 7) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// The banks ship as FLAC; the lossless WAV each was made from is kept in source/audio (tools/wav_to_flac.py).
function wavFor(jsonPath) {
  const beside = jsonPath.replace(/\.json$/, '.wav');
  const kept = `source/audio/${basename(beside)}`;
  if (existsSync(beside)) return beside;
  if (existsSync(kept)) return kept;
  // CI's unit tests check out only the bank WAVs (.github/workflows/test.yml): a bank without one has to have one kept.
  throw new Error(`no WAV for ${jsonPath}: keep the one its FLAC was made from as ${kept} (tools/wav_to_flac.py)`);
}

// A 16-bit mono WAV, resampled to SR.
export function readWav(path) {
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

let workletSource;
export const banks = new Map();
export function bankFor(path) {
  if (!banks.has(path)) banks.set(path, JSON.parse(readFileSync(path, 'utf8')));
  if (!banks.has(`${path}#data`)) banks.set(`${path}#data`, readWav(wavFor(path)));
  return { ...banks.get(path), data: banks.get(`${path}#data`) };
}

// The worklet in a sandbox with the audio thread's globals, its Math.random replaced by a seeded stream.
function newProcessor(bankPath, seed) {
  workletSource ??= `${readFileSync(process.env.WORKLET || 'src/audio/engineWorklet.js', 'utf8')}\n;this.EngineProcessor = EngineProcessor;`;
  const sandbox = {
    sampleRate: SR,
    currentFrame: 0,
    registerProcessor: () => {},
    AudioWorkletProcessor: class {
      constructor() {
        this.port = { postMessage: () => {} };
      }
    },
    seededRandom: seeded(seed),
  };
  vm.createContext(sandbox);
  vm.runInContext('Math.random = seededRandom;', sandbox);
  vm.runInContext(workletSource, sandbox);
  const proc = new sandbox.EngineProcessor();
  proc.onMessage({ bank: bankFor(bankPath) });
  return { proc, sandbox };
}

/**
 * One clip. `script(t, engine)` returns the frame's controls (throttle, starter, driveLoad, gearRpm, gearLock, overrunRpm, gear)
 * or null to end. The engine is started warm and silently first unless `recordStart` (the start clip records it).
 */
export function renderClip(spec, { roughness, recordStart = false, duration, script, onProc, bankMsg, seed = 7 }) {
  const params = { ...DEFAULT_AUDIO_PARAMS, ...spec.audio };
  const bankPath = `public/audio/${params.recBank}.json`;
  const { proc, sandbox } = newProcessor(bankPath, seed);
  // Another bank in place of the shipped one (the model's, with its resonances divided out).
  if (bankMsg) proc.onMessage({ bank: bankMsg });
  onProc?.(proc, sandbox);
  const engine = new EngineModel({ ...DEFAULT_ENGINE_PARAMS, ...spec.engine, baseRoughness: roughness, initialTemperature: 1 }, { random: seeded(seed) });
  const fuel = { fuel: 1, diesel: spec.fuel?.startDiesel ?? 0 };
  engine.setIgnition(true);
  const noStarter = !!spec.engine?.noStarter;
  if (noStarter && engine.params.manualTiming) engine.advance = engine.params.startAdvance;
  const kickEvery = 1.5;
  const kickNow = (s) => noStarter && !engine.isRunning && Math.abs(((s % kickEvery) + kickEvery) % kickEvery) < DT && engine.pull(0.6) !== null;
  if (!recordStart) {
    for (let t = 0; t < 30 && !engine.isRunning; t += DT) {
      kickNow(t - 4);
      engine.update(DT, { ...fuel, starter: !noStarter && t > 8 });
    }
    for (let t = 0; t < 3; t += DT) engine.update(DT, fuel);
    if (!engine.isRunning) throw new Error(`${spec.id} never started`);
  }

  const out = new Float32Array(Math.ceil(duration * SR));
  const block = new Float32Array(128);
  const trace = [];
  let frame = 0;
  let n = 0;
  for (let t = 0; t < duration; t += DT, n++) {
    const c = script(t, engine, { kickNow, noStarter });
    if (!c) break;
    const { gear = null, ...controls } = c;
    engine.update(DT, { ...fuel, ...controls });
    if (n % 3 === 0) trace.push([+t.toFixed(2), Math.round(engine.rpm), +engine.throttle.toFixed(2), gear, +engine.roughness.toFixed(2)]);
    const start = (frame + 0.05 * SR) / SR;
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
    const end = Math.min(out.length, Math.round((t + DT) * SR));
    while (frame + 128 <= end) {
      sandbox.currentFrame = frame;
      proc.process([], [[block]]);
      out.set(block, frame);
      frame += 128;
    }
  }
  return { pcm: out.subarray(0, frame), trace, bank: params.recBank, engine };
}

// The revs the ladder holds: from the first 500 above idle to the top, in 500 rpm steps, and the top itself.
export function ladderSteps(spec) {
  const eng = { ...DEFAULT_ENGINE_PARAMS, ...spec.engine };
  const steps = [];
  for (let r = Math.ceil(eng.idleRpmWarm / 500) * 500; r <= eng.maxRpm; r += 500) steps.push(r);
  if (steps.at(-1) !== eng.maxRpm) steps.push(eng.maxRpm);
  return steps;
}

/**
 * The engine held at each of `ladderSteps` for `stepSeconds`, tied to the road through the clutch with the throttle part open, at the
 * middle of its roughness. Returns the clip, the steps and `segment(i, settle)`: step i's audio after the first `settle` seconds.
 */
export function renderLadder(spec, { stepSeconds = 1.6, seed = 7, throttle = 0.35 } = {}) {
  const steps = ladderSteps(spec);
  const [lo, hi] = spec.roughnessRange ?? [0.08, 0.08];
  let revsPerFiring = 2;
  const clip = renderClip(spec, {
    roughness: (lo + hi) / 2,
    duration: steps.length * stepSeconds,
    seed,
    script: (t, engine) => {
      revsPerFiring = engine.revsPerFiring;
      const i = Math.min(steps.length - 1, Math.floor(t / stepSeconds));
      return { throttle, gearRpm: steps[i], gearLock: 1, driveLoad: 0.3 };
    },
  });
  const segment = (i, settle = 0) => clip.pcm.subarray(Math.round((i * stepSeconds + settle) * SR), Math.round((i + 1) * stepSeconds * SR));
  return { ...clip, steps, stepSeconds, revsPerFiring, segment };
}
