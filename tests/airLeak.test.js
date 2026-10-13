import { describe, it, expect } from 'vitest';
import { Faults, DEFAULT_FAULT_PARAMS, BENCH_ONLY_KINDS } from '../src/vehicle/faults.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { BenchJob, JOBS, finishJob, jobAvailable, bootLook, DEFAULT_BENCH_PARAMS as P } from '../src/workshop/benchJobs.js';
import { pickHistory } from '../src/vehicle/history.js';

const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const faults = (params = {}) => new Faults({ ...DEFAULT_FAULT_PARAMS, ...params }, seeded(3));
const run = (f, seconds, s = { running: true, speed: 0, throttle: 0 }) => {
  for (let t = 0; t < seconds; t += 0.1) f.update(0.1, s);
};

describe('a split intake boot', () => {
  it('starts while the engine runs, gets worse, and only on an engine with a boot', () => {
    const f = faults({ leakEvery: 1 });
    run(f, 30, { running: false, speed: 0, throttle: 0 });
    expect(f.has('leak')).toBe(false);
    run(f, 30);
    expect(f.has('leak')).toBe(true);
    const at = f.airLeak;
    run(f, 60);
    expect(f.airLeak).toBeGreaterThan(at);
    const d = faults({ leakEvery: 1 });
    d.hasBoot = false;
    run(d, 60);
    expect(d.has('leak')).toBe(false);
  });

  it('is not fixed by a rough fix in the yard, only at the bench', () => {
    const f = faults();
    f.begin('leak');
    expect(BENCH_ONLY_KINDS).toContain('leak');
    expect(f.fix('leak', { rough: true })).toBe(false);
    expect(f.has('leak')).toBe(true);
    expect(f.fix('leak')).toBe(true);
    expect(f.airLeak).toBe(0);
  });

  it('is dealt as a starting fault on a petrol quad but never on a diesel', () => {
    let petrol = false;
    for (let seed = 1; seed < 300; seed++) {
      const h = pickHistory({ wearRange: [0, 0], engine: { compressionIgnition: true } }, seeded(seed), { faultChance: 1 });
      expect(h.faults.some((f) => f.kind === 'leak')).toBe(false);
      if (pickHistory({ wearRange: [0, 0] }, seeded(seed), { faultChance: 1 }).faults.some((f) => f.kind === 'leak')) petrol = true;
    }
    expect(petrol).toBe(true);
  });
});

describe('what the engine does with it', () => {
  const idleRpms = (airLeak) => {
    const e = new EngineModel({ ...DEFAULT_ENGINE_PARAMS, baseRoughness: 0.08, initialTemperature: 1 }, { random: seeded(7) });
    e.setIgnition(true);
    for (let t = 0; t < 8 && !e.isRunning; t += 1 / 60) e.update(1 / 60, { starter: true, fuel: 1, airLeak });
    for (let t = 0; t < 5; t += 1 / 60) e.update(1 / 60, { fuel: 1, airLeak });
    const rpms = [];
    for (let t = 0; t < 20; t += 1 / 60) {
      e.update(1 / 60, { fuel: 1, airLeak });
      rpms.push(e.rpm);
    }
    return { spread: Math.max(...rpms) - Math.min(...rpms), lean: e.lean, e };
  };

  it('hunts at idle and runs lean, more than a sound one', () => {
    const sound = idleRpms(0);
    const split = idleRpms(1);
    expect(split.spread).toBeGreaterThan(sound.spread + 100);
    expect(split.lean).toBeGreaterThan(sound.lean);
  });

  it('adds to how readily it pops on the overrun', async () => {
    const { popPropensity } = await import('../src/engine/runOn.js');
    const base = { lean: 0, wear: 0, heat: 0 };
    expect(popPropensity({ ...base, airLeak: 1 }, DEFAULT_ENGINE_PARAMS)).toBeGreaterThan(popPropensity({ ...base, airLeak: 0 }, DEFAULT_ENGINE_PARAMS));
  });
});

describe('renewing the boot at the bench', () => {
  const ctx = (f) => ({ engine: { params: {} }, faults: f, fuel: {} });
  const job = (flaws = []) => {
    const j = new BenchJob('boot');
    j.flaws.push(...flaws);
    return j;
  };

  it('is a job for petrol engines only, with a look at the split', () => {
    expect(jobAvailable('boot', { params: { strokes: 4 } })).toBe(true);
    expect(jobAvailable('boot', { params: { strokes: 4, compressionIgnition: true } })).toBe(false);
    expect(JOBS.boot.steps.some((s) => s.inspect)).toBe(true);
  });

  it('done properly cures it, done badly leaves a faint one', () => {
    const f = faults();
    f.leave('leak', 0.8);
    expect(finishJob(job(), ctx(f), P)).toMatch(/steady/);
    expect(f.has('leak')).toBe(false);
    f.leave('leak', 0.8);
    finishJob(job([{ step: 'fit', how: 'short' }]), ctx(f), P);
    expect(f.airLeak).toBeCloseTo(P.botchedLevel);
  });

  it('says what the spray shows, worse as it splits', () => {
    const f = faults();
    expect(bootLook(f)).toMatch(/sound/);
    f.leave('leak', 0.9);
    expect(bootLook(f)).toMatch(/open/);
  });
});
