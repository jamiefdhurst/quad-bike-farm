import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { DEFAULT_AUDIO_PARAMS } from '../src/audio/audioParams.js';
import { Faults, FAULT_KINDS, BENCH_ONLY_KINDS, DEFAULT_FAULT_PARAMS } from '../src/vehicle/faults.js';
import { blowLevel, blowCarry, DEFAULT_BLOW_PARAMS as BL } from '../src/engine/exhaustBlow.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { BenchJob, JOBS, JOB_KINDS, finishJob, jobAvailable, exhaustJointLook, DEFAULT_BENCH_PARAMS as P } from '../src/workshop/benchJobs.js';
import { pickHistory } from '../src/vehicle/history.js';
import { captureVehicle, restoreVehicle } from '../src/farm/farmState.js';
import { MotWear } from '../src/farm/mot.js';
import { FuelSystem } from '../src/vehicle/fuelSystem.js';
import { Sump } from '../src/vehicle/sump.js';
import { TyreSet, newTyres } from '../src/vehicle/tyres.js';
import { AirFilter } from '../src/vehicle/airFilter.js';
import { QuirkSet } from '../src/vehicle/quirks.js';
import { AMY_SHED_LINES, JESS_SHED_LINES } from '../src/npc/shedLines.js';
import { VOICE_LINES } from '../src/npc/voiceLines.js';
import { JESS_LINES } from '../src/npc/jessLines.js';

const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const faults = (params = {}) => new Faults({ ...DEFAULT_FAULT_PARAMS, ...params }, seeded(3));
const run = (f, seconds, s = { running: true, speed: 0, throttle: 0 }) => {
  for (let t = 0; t < seconds; t += 0.1) f.update(0.1, s);
};

describe('the exhaust blow fault', () => {
  it('starts while running, worsens, and only the bench puts it right', () => {
    const f = faults({ exhaustBlowEvery: 1 });
    run(f, 30, { running: false, speed: 0, throttle: 0 });
    expect(f.has('exhaustBlow')).toBe(false);
    run(f, 30);
    expect(f.has('exhaustBlow')).toBe(true);
    const at = f.exhaustBlow;
    run(f, 60);
    expect(f.exhaustBlow).toBeGreaterThan(at);
    expect(FAULT_KINDS).toContain('exhaustBlow');
    expect(BENCH_ONLY_KINDS).toContain('exhaustBlow');
    expect(f.fix('exhaustBlow', { rough: true })).toBe(false);
    expect(f.has('exhaustBlow')).toBe(true);
    expect(f.fix('exhaustBlow')).toBe(true);
    expect(f.exhaustBlow).toBe(0);
  });

  it('takes a little drive, and a quad is never dealt it in its history', () => {
    const f = faults();
    f.begin('exhaustBlow');
    f.levels.exhaustBlow = 1;
    expect(f.driveFactor).toBeCloseTo(1 - DEFAULT_FAULT_PARAMS.exhaustBlowLoss);
    for (let seed = 1; seed < 80; seed++) {
      expect(pickHistory({ wearRange: [0, 0] }, seeded(seed), { faultChance: 1 }).faults.some((x) => x.kind === 'exhaustBlow')).toBe(false);
    }
  });

  it('is kept in the save and loads back', () => {
    const unit = () => ({
      dealtIdle: 1450,
      engine: new EngineModel({ strokes: 2 }),
      quad: {
        usage: { hours: 1, odoMiles: 1 },
        faults: new Faults(),
        fuel: new FuelSystem({ tankCapacity: 10, bowlCapacity: 0.1, startLitres: 6, reserveLitres: 1, startOil: 0.02 }),
        sump: new Sump({ level: 0.8 }),
        tyres: new TyreSet(newTyres(4)),
        filter: new AirFilter(),
        quirks: new QuirkSet([]),
        motWear: new MotWear(),
      },
      mud: { state: { body: 0, wheels: 0, wet: 0, washed: 0 } },
    });
    const a = unit();
    a.quad.faults.begin('exhaustBlow');
    a.quad.faults.levels.exhaustBlow = 0.6;
    const b = unit();
    restoreVehicle(b, JSON.parse(JSON.stringify(captureVehicle(a))));
    expect(b.quad.faults.has('exhaustBlow')).toBe(true);
    expect(b.quad.faults.exhaustBlow).toBeCloseTo(0.6);
  });
});

describe('the blow in the engine', () => {
  const blows = (exhaustBlow, temperature, seconds = 6) => {
    const e = new EngineModel({ initialTemperature: 0.6 }, { random: seeded(3) });
    e.setIgnition(true);
    for (let i = 0; i < 600 && !e.isRunning; i++) e.update(1 / 60, { starter: true, choke: 1 });
    if (!e.isRunning) throw new Error('did not start');
    let n = 0;
    for (let i = 0; i < seconds * 60; i++) {
      e.update(1 / 60, { throttle: 0, choke: 1, exhaustBlow });
      e.temperature = temperature; // held, so the test is of the level alone
      n += e.events.filter((x) => x.type === 'blow').length;
    }
    return { n, exhaustLeak: e.exhaustLeak };
  };

  it('ticks and chuffs a lot cold, and not at all once warm', () => {
    const cold = blows(1, 0).n;
    expect(cold).toBeGreaterThan(10);
    expect(blows(1, 0.9).n).toBe(0);
    expect(blows(0, 0).n).toBe(0);
    expect(blows(0.3, 0).n).toBeLessThan(cold);
  });

  it('is not the holed silencer: it does not make the exhaust louder', () => {
    expect(blows(1, 0).exhaustLeak).toBe(blows(0, 0).exhaustLeak);
  });

  it('fades as the metal warms and is lost in the revs', () => {
    expect(blowLevel(1, 0, BL)).toBe(1);
    expect(blowLevel(1, BL.blowWarmBelow, BL)).toBe(0);
    expect(blowLevel(1, 0.3, BL)).toBeLessThan(blowLevel(1, 0.1, BL));
    expect(blowCarry(1, BL)).toBeLessThan(blowCarry(0, BL));
  });
});

describe('sealing the exhaust joint at the bench', () => {
  const ctx = (f) => ({ engine: { params: {} }, faults: f, fuel: {} });
  const job = (flaws = []) => {
    const j = new BenchJob('exhaustJoint');
    j.flaws.push(...flaws);
    return j;
  };

  it('is a job on any engine, with a look at the joint first', () => {
    expect(JOB_KINDS).toContain('exhaustJoint');
    expect(JOBS.exhaustJoint.steps.some((s) => s.inspect)).toBe(true);
    expect(jobAvailable('exhaustJoint', { params: { strokes: 2 } })).toBe(true);
    expect(jobAvailable('exhaustJoint', { params: { strokes: 4, compressionIgnition: true } })).toBe(true);
  });

  it('done properly cures it, done badly leaves a faint one', () => {
    const f = faults();
    f.leave('exhaustBlow', 0.8);
    expect(finishJob(job(), ctx(f), P)).toMatch(/quietly/);
    expect(f.has('exhaustBlow')).toBe(false);
    f.leave('exhaustBlow', 0.8);
    finishJob(job([{ step: 'tight', how: 'short' }]), ctx(f), P);
    expect(f.exhaustBlow).toBeCloseTo(P.botchedLevel);
  });

  it('says what the rag finds, from a tight joint to a blown gasket', () => {
    expect(exhaustJointLook({ exhaustBlow: 0 })).toMatch(/tight/);
    expect(exhaustJointLook({ exhaustBlow: 0.25 })).toMatch(/loose/);
    expect(exhaustJointLook({ exhaustBlow: 1 })).toMatch(/gasket has gone/);
  });
});

describe('the girls and the blow', () => {
  it('both have a line about it, in the sets that are recorded', () => {
    expect(AMY_SHED_LINES.faultExhaustBlow.lines.length).toBeGreaterThan(0);
    expect(JESS_SHED_LINES.faultExhaustBlow.length).toBeGreaterThan(0);
    expect(VOICE_LINES.faultExhaustBlow).toBeDefined();
    expect(JESS_LINES.faultExhaustBlow).toBeDefined();
  });
});

describe('the blow in the worklet', () => {
  // The worklet runs on the audio thread with its own globals, so load it in a sandbox that provides them.
  const renderBlows = (strength, blowVolume) => {
    const sr = 44100;
    const sandbox = { sampleRate: sr, currentFrame: 0, registerProcessor: () => {}, AudioWorkletProcessor: class { constructor() { this.port = { postMessage: () => {} }; } } };
    vm.createContext(sandbox);
    vm.runInContext(`${readFileSync('src/audio/engineWorklet.js', 'utf8')}\n;this.EngineProcessor = EngineProcessor;`, sandbox);
    const proc = new sandbox.EngineProcessor();
    const events = Array.from({ length: 12 }, (_, i) => ({ time: i * 0.08, type: 'blow', strength }));
    proc.onMessage({ params: { ...DEFAULT_AUDIO_PARAMS, blowVolume }, state: { rpm: 1000, throttle: 0, running: true }, events });
    const block = new Float32Array(128);
    let sum = 0;
    let finite = true;
    for (let frame = 0; frame < sr; frame += 128) {
      sandbox.currentFrame = frame;
      proc.process([], [[block]]);
      for (const x of block) (sum += x * x), (finite &&= Number.isFinite(x));
    }
    return { rms: Math.sqrt(sum / (sr / 1)), finite };
  };

  it('plays a tick or a chuff for each event, finite, and silent at no volume', () => {
    for (const strength of [0.1, 0.9]) {
      const loud = renderBlows(strength, 0.5);
      expect(loud.finite).toBe(true);
      expect(loud.rms).toBeGreaterThan(renderBlows(strength, 0).rms);
    }
  });
});
