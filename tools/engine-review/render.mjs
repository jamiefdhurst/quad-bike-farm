// Renders every vehicle's engine through the real engine model and worklet (as tools/render_engine_sound.mjs does), as five short
// clips each: the start, a normal idle, a rough idle, revving stood still and a scripted drive. Writes WAVs, AAC for the review page,
// and data.json with each clip's rpm, throttle and gear trace.
//
//   node tools/engine-review/render.mjs [vehicle id ...]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { EngineModel } from '../../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../../src/engine/engineParams.js';
import { DEFAULT_AUDIO_PARAMS } from '../../src/audio/audioParams.js';
import { DEFAULT_GEARBOX_PARAMS } from '../../src/vehicle/manualDrivetrain.js';
import { DEFAULT_VEHICLE_PARAMS } from '../../src/vehicle/vehicleParams.js';
import { QUAD_SPECS, EXTRA_SPECS, PLOVER_SPEC, HARTLEY_SPEC, YAK_SPEC, TOR_SPEC, CRAG_SPEC, FINCH_SPEC, GRIFFIN_SPEC, VAUCLAIR_SPEC } from '../../src/vehicle/quadSpecs.js';

const SR = 48000;
const DT = 1 / 60;
const OUT = '.scratch/engine-review';
const SPECS = [...QUAD_SPECS, ...EXTRA_SPECS, PLOVER_SPEC, HARTLEY_SPEC, YAK_SPEC, TOR_SPEC, CRAG_SPEC, FINCH_SPEC, GRIFFIN_SPEC, VAUCLAIR_SPEC];
export { SPECS };
const main = import.meta.url === `file://${process.argv[1]}`;
const only = process.argv.slice(2);
mkdirSync(`${OUT}/wav`, { recursive: true });
mkdirSync(`${OUT}/site/audio`, { recursive: true });

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function wavFor(jsonPath) {
  const beside = jsonPath.replace(/\.json$/, '.wav');
  const kept = `source/audio/${basename(beside)}`;
  if (existsSync(beside)) return beside;
  if (existsSync(kept)) return kept;
  // No lossless copy kept (the Tor's): decode the shipped FLAC instead.
  const decoded = `${OUT}/wav/bank-${basename(beside)}`;
  if (!existsSync(decoded)) execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16', jsonPath.replace(/\.json$/, '.flac'), decoded]);
  return decoded;
}

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

function writeWav(path, out) {
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
  writeFileSync(path, wav);
}

const workletSource = `${readFileSync(process.env.WORKLET || 'src/audio/engineWorklet.js', 'utf8')}\n;this.EngineProcessor = EngineProcessor;`;
export const banks = new Map();
export function bankFor(path) {
  if (!banks.has(path)) banks.set(path, JSON.parse(readFileSync(path, 'utf8')));
  if (!banks.has(`${path}#data`)) banks.set(`${path}#data`, readWav(wavFor(path)));
  return { ...banks.get(path), data: banks.get(`${path}#data`) };
}

function newProcessor(bankPath) {
  const sandbox = {
    sampleRate: SR,
    currentFrame: 0,
    registerProcessor: () => {},
    AudioWorkletProcessor: class {
      constructor() {
        this.port = { postMessage: () => {} };
      }
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(workletSource, sandbox);
  const proc = new sandbox.EngineProcessor();
  proc.onMessage({ bank: bankFor(bankPath) });
  return { proc, sandbox };
}

/**
 * One clip. `script(t, engine)` returns the frame's controls (throttle, starter, driveLoad, gearRpm, gearLock, overrunRpm, gear)
 * or null to end. The engine is started warm and silently first unless `fromCold` (the start clip records it).
 */
export function renderClip(spec, { roughness, recordStart = false, duration, script, onProc, bankMsg }) {
  const params = { ...DEFAULT_AUDIO_PARAMS, ...spec.audio };
  const bankPath = `public/audio/${params.recBank}.json`;
  const { proc, sandbox } = newProcessor(bankPath);
  // Another bank in place of the shipped one (the model's, with its resonances divided out).
  if (bankMsg) proc.onMessage({ bank: bankMsg });
  onProc?.(proc, sandbox);
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const engine = new EngineModel({ ...DEFAULT_ENGINE_PARAMS, ...spec.engine, baseRoughness: roughness, initialTemperature: 1 }, { random });
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
  return { pcm: out.subarray(0, frame), trace, bank: params.recBank };
}

// The start: key on (a diesel's glow plugs), the starter (or a kick every 1.5 s) until it catches, then tickover.
export function startScript(spec) {
  const glow = spec.fuel?.startDiesel ? 3 : 1;
  let caughtAt = null;
  return (t, engine, { kickNow, noStarter }) => {
    if (t < glow) return {};
    if (engine.isRunning) caughtAt ??= t;
    if (caughtAt != null && t - caughtAt > 4) return null;
    const cranking = caughtAt == null && t < glow + 8;
    if (cranking) kickNow(t - glow);
    return { starter: !noStarter && cranking };
  };
}

// Idle for six seconds.
export const idleScript = () => () => ({});

// Stood still: idle, a small blip, idle, a sharp full blip, idle, full throttle held, back to idle.
export function revScript() {
  const steps = [[2, 0], [0.4, 0.4], [1.6, 0], [0.5, 1], [2, 0], [3, 1], [3, 0]];
  return (t) => {
    let at = 0;
    for (const [d, throttle] of steps) {
      if (t < at + d) return { throttle };
      at += d;
    }
    return null;
  };
}
export const REV_SECONDS = 12.5;

// A scripted drive with no physics. A CVT: full throttle away with the launch load, half throttle cruising, lift off with the wheels
// turning the engine over, brake to a stop. A manual: clutch up in first, changing up at about 70% of each gear's revs to fourth (or
// third on a three-speed box), cruise,
// lift off in gear so the road holds the revs, clutch in and stop.
export function driveScript(spec) {
  const vp = { ...DEFAULT_VEHICLE_PARAMS, ...spec.vehicle };
  const box = spec.gearbox ? { ...DEFAULT_GEARBOX_PARAMS, ...spec.gearbox } : spec.tractor ? DEFAULT_GEARBOX_PARAMS : null;
  let v = 0;
  if (!box) {
    const vmax = 13;
    return (t) => {
      let throttle = 0;
      let brake = 0;
      if (t < 5) throttle = 1;
      else if (t < 8) throttle = 0.45;
      else if (t < 11) throttle = 0;
      else if (t < 13) brake = 1;
      else if (t > 15) return null;
      const a = throttle > 0 ? 3 * throttle * (1 - v / vmax) - 0.3 : brake ? -4 : -0.7;
      v = Math.max(0, v + a * DT);
      const launch = 1 - smoothstep(0, vp.cvtShiftSpeed, v);
      return {
        throttle,
        driveLoad: throttle > 0 ? 0.25 + 0.55 * launch : 0,
        overrunRpm: throttle < 0.05 && !brake && v > 0 ? Math.min(vp.overrunMaxRpm, v * vp.overrunRpmPerMs) : 0,
        load: brake && v > 0.5 ? 0.3 : 0, // the brakes drag the CVT until the clutch lets go
      };
    };
  }
  const top = (g) => box[`topSpeed${g}`];
  const torque = (g) => box[`torque${g}`] ?? 1;
  const lastGear = Math.min(4, box.gears);
  const maxRpm = { ...DEFAULT_ENGINE_PARAMS, ...spec.engine }.maxRpm;
  let gear = 1;
  let phase = 'pullAway';
  let since = 0;
  let clutch = 0;
  return (t) => {
    since += DT;
    let throttle = 0;
    let brake = 0;
    if (phase === 'pullAway') {
      clutch = Math.min(1, since / 1.2);
      throttle = 0.35 + 0.4 * clutch;
      if (clutch >= 1) [phase, since] = ['accel', 0];
    } else if (phase === 'accel') {
      throttle = 1;
      if (v > top(gear) * (gear < lastGear ? 0.72 : 0.88) || since > 3.5) {
        if (gear < lastGear) [phase, since] = ['shiftOut', 0];
        else if (since > 2) [phase, since] = ['cruise', 0];
      }
    } else if (phase === 'shiftOut') {
      clutch = 0;
      if (since > 0.35) [phase, since, gear] = ['shiftIn', 0, gear + 1];
    } else if (phase === 'shiftIn') {
      clutch = Math.min(1, since / 0.3);
      throttle = 0.6 * clutch;
      if (clutch >= 1) [phase, since] = ['accel', 0];
    } else if (phase === 'cruise') {
      throttle = 0.35;
      if (since > 2.5) [phase, since] = ['liftOff', 0];
    } else if (phase === 'liftOff') {
      if (since > 3) [phase, since] = ['stop', 0];
    } else if (phase === 'stop') {
      clutch = 0;
      brake = 1;
      if (since > 3) return null;
    }
    const pulling = throttle > 0 && clutch > 0;
    let a;
    if (phase === 'cruise') a = 0;
    else if (pulling) a = 1.3 * top(1) * torque(gear) * throttle * clutch * Math.max(0, 1 - v / (top(gear) * 1.05)) - 0.2;
    else a = brake ? -4 : clutch > 0 ? -0.9 : -0.4;
    v = Math.max(0, v + a * DT);
    const launch = 1 - smoothstep(0, top(1), v);
    return {
      throttle,
      gear: clutch > 0.5 ? gear : 0,
      gearRpm: (v / top(gear)) * maxRpm,
      gearLock: clutch,
      driveLoad: pulling ? (0.3 + 0.35 * launch) * clutch : 0,
    };
  };
}

const CLIPS = [
  ['start', 'Starting', (s, r) => ({ roughness: r.mid, recordStart: true, duration: 16, script: startScript(s) })],
  ['idle', 'Idle', (s, r) => ({ roughness: r.mid, duration: 6, script: idleScript() })],
  ['rough', 'Rough idle', (s, r) => ({ roughness: r.rough, duration: 6, script: idleScript() })],
  ['revs', 'Revving, stood still', (s, r) => ({ roughness: r.mid, duration: REV_SECONDS, script: revScript() })],
  ['drive', 'Driving', (s, r) => ({ roughness: r.mid, duration: 30, script: driveScript(s) })],
];

if (main) {
const vehicles = [];
for (const spec of SPECS) {
  if (only.length && !only.includes(spec.id)) continue;
  const [lo, hi] = spec.roughnessRange ?? [0.08, 0.08];
  const r = { mid: (lo + hi) / 2, rough: Math.min(0.95, hi + 0.3) };
  const box = spec.gearbox ? { ...DEFAULT_GEARBOX_PARAMS, ...spec.gearbox } : spec.tractor ? DEFAULT_GEARBOX_PARAMS : null;
  const eng = { ...DEFAULT_ENGINE_PARAMS, ...spec.engine };
  const entry = {
    id: spec.id,
    name: spec.name,
    bank: null,
    gearbox: box ? `${box.gears}-speed manual` : 'CVT',
    diesel: !!spec.fuel?.startDiesel,
    kick: !!spec.engine?.noStarter,
    idleRpm: eng.idleRpmWarm,
    maxRpm: eng.maxRpm,
    roughness: { range: [lo, hi], mid: +r.mid.toFixed(3), rough: +r.rough.toFixed(3) },
    clips: {},
  };
  for (const [key, label, make] of CLIPS) {
    const t0 = Date.now();
    const { pcm, trace, bank } = renderClip(spec, make(spec, r));
    entry.bank = bank;
    const wav = `${OUT}/wav/${spec.id}-${key}.wav`;
    writeWav(wav, pcm);
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '128000', wav, `${OUT}/site/audio/${spec.id}-${key}.mp4`]);
    entry.clips[key] = { label, seconds: +(pcm.length / SR).toFixed(2), trace };
    console.log(`${spec.id} ${key}: ${(pcm.length / SR).toFixed(1)} s, top ${Math.max(...trace.map((p) => p[1]))} rpm (${Date.now() - t0} ms)`);
  }
  vehicles.push(entry);
}
writeFileSync(`${OUT}/data.json`, JSON.stringify(vehicles));
console.log(`wrote ${vehicles.length} vehicles`);
}
