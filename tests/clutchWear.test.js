import { describe, it, expect } from 'vitest';
import { Faults, DEFAULT_FAULT_PARAMS, BENCH_ONLY_KINDS, clutchSlipping, clutchSlipUnderPower } from '../src/vehicle/faults.js';
import { BenchJob, JOBS, finishJob, jobAvailable, clutchLook, DEFAULT_BENCH_PARAMS as P } from '../src/workshop/benchJobs.js';
import { pickHistory } from '../src/vehicle/history.js';

const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const faults = (params = {}) => {
  const f = new Faults({ ...DEFAULT_FAULT_PARAMS, ...params }, seeded(5));
  f.hasClutch = true;
  return f;
};
const run = (f, seconds, s) => {
  for (let t = 0; t < seconds; t += 0.1) f.update(0.1, s);
};
const D = DEFAULT_FAULT_PARAMS;
const biting = { gear: 1, clutch: 0.5 };

describe('what counts as slipping the clutch', () => {
  it('is nothing fully in, fully out, in neutral or with the engine off', () => {
    const s = { running: true, throttle: 0.8, slope: 0, speed: 5 };
    expect(clutchSlipping({ gear: 1, clutch: 1 }, s)).toBe(0);
    expect(clutchSlipping({ gear: 1, clutch: 0 }, s)).toBe(0);
    expect(clutchSlipping({ gear: 0, clutch: 0.5 }, s)).toBe(0);
    expect(clutchSlipping(biting, { ...s, running: false })).toBe(0);
  });

  it('is something at the bite with the throttle open, on a climb, or creeping in low', () => {
    expect(clutchSlipping(biting, { running: true, throttle: 0.8, slope: 0, speed: 5 })).toBeGreaterThan(0.5);
    expect(clutchSlipping(biting, { running: true, throttle: 0, slope: 0.15, speed: 5 })).toBeGreaterThan(0.3);
    expect(clutchSlipping(biting, { running: true, throttle: 0, slope: 0, speed: 1 })).toBeGreaterThan(0);
    // Riding along fast on the flat with no throttle is just a half-held pedal, not wear.
    expect(clutchSlipping(biting, { running: true, throttle: 0, slope: 0, speed: 8 })).toBe(0);
    // Creeping only counts in the low gears.
    expect(clutchSlipping({ gear: 4, clutch: 0.5 }, { running: true, throttle: 0, slope: 0, speed: 1 })).toBe(0);
  });
});

describe('a worn clutch', () => {
  it('starts only from slipping it, and only on a quad with a clutch', () => {
    const f = faults({ clutchEvery: 1 });
    run(f, 60, { running: true, speed: 5, throttle: 1, clutchSlip: 0 });
    expect(f.has('clutch')).toBe(false);
    run(f, 60, { running: true, speed: 5, throttle: 1, clutchSlip: 1 });
    expect(f.has('clutch')).toBe(true);
    const none = faults({ clutchEvery: 1 });
    none.hasClutch = false;
    run(none, 60, { running: true, speed: 5, throttle: 1, clutchSlip: 1 });
    expect(none.has('clutch')).toBe(false);
    expect(none.clutchWear).toBe(0);
  });

  it('wears further only while it is slipped', () => {
    const f = faults();
    f.begin('clutch');
    const at = f.clutchWear;
    run(f, 120, { running: true, speed: 5, throttle: 1, clutchSlip: 0 });
    expect(f.clutchWear).toBe(at);
    run(f, 120, { running: true, speed: 5, throttle: 1, clutchSlip: 1 });
    expect(f.clutchWear).toBeGreaterThan(at);
  });

  it('slips under power only once worn, and more with wear and throttle', () => {
    expect(clutchSlipUnderPower(0.1, 1, D)).toBe(0);
    expect(clutchSlipUnderPower(0.9, 0, D)).toBe(0);
    expect(clutchSlipUnderPower(0.9, 1, D)).toBeGreaterThan(clutchSlipUnderPower(0.5, 1, D));
    expect(clutchSlipUnderPower(0.9, 1, D)).toBeGreaterThan(clutchSlipUnderPower(0.9, 0.3, D));
  });

  it('is not fixed by a rough fix in the yard, only at the bench', () => {
    const f = faults();
    f.begin('clutch');
    expect(BENCH_ONLY_KINDS).toContain('clutch');
    expect(f.fix('clutch', { rough: true })).toBe(false);
    expect(f.fix('clutch')).toBe(true);
    expect(f.clutchWear).toBe(0);
  });

  it('is dealt as a starting fault on a manual quad only', () => {
    let manual = false;
    for (let seed = 1; seed < 300; seed++) {
      expect(pickHistory({ wearRange: [0, 0] }, seeded(seed), { faultChance: 1 }).faults.some((x) => x.kind === 'clutch')).toBe(false);
      expect(pickHistory({ wearRange: [0, 0], gearbox: {}, tractor: true }, seeded(seed), { faultChance: 1 }).faults.some((x) => x.kind === 'clutch')).toBe(false);
      if (pickHistory({ wearRange: [0, 0], gearbox: {} }, seeded(seed), { faultChance: 1 }).faults.some((x) => x.kind === 'clutch')) manual = true;
    }
    expect(manual).toBe(true);
  });
});

describe('fitting a new clutch at the bench', () => {
  const ctx = (f) => ({ engine: { params: {} }, faults: f, fuel: {} });
  const job = (flaws = []) => {
    const j = new BenchJob('clutch');
    j.flaws.push(...flaws);
    return j;
  };

  it('is a job for a manual quad only, with a look at the plates', () => {
    expect(jobAvailable('clutch', { params: { strokes: 4 } }, P, false, true, true)).toBe(true);
    expect(jobAvailable('clutch', { params: { strokes: 4 } })).toBe(false);
    expect(JOBS.clutch.steps.some((s) => s.inspect)).toBe(true);
  });

  it('done properly cures it, done badly leaves some slip', () => {
    const f = faults();
    f.leave('clutch', 0.8);
    expect(finishJob(job(), ctx(f), P)).toMatch(/bites cleanly/);
    expect(f.has('clutch')).toBe(false);
    f.leave('clutch', 0.8);
    finishJob(job([{ step: 'fit', how: 'short' }]), ctx(f), P);
    expect(f.clutchWear).toBeCloseTo(P.botchedLevel);
  });

  it('says what the plates look like, worse as they wear', () => {
    const f = faults();
    expect(clutchLook(f)).toMatch(/sound/);
    f.leave('clutch', 0.9);
    expect(clutchLook(f)).toMatch(/rivets/);
  });
});
