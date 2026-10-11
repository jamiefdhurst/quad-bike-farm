import { describe, it, expect } from 'vitest';
import { Faults, DEFAULT_FAULT_PARAMS } from '../src/vehicle/faults.js';
import { BenchJob, JOBS, finishJob, jobAvailable, chainLook } from '../src/workshop/benchJobs.js';
import { pickHistory } from '../src/vehicle/history.js';
import { QUAD_SPECS, EXTRA_SPECS } from '../src/vehicle/quadSpecs.js';

const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const chainQuad = (params = {}, seed = 3) => {
  const f = new Faults({ ...DEFAULT_FAULT_PARAMS, ...params }, seeded(seed));
  f.hasChain = true;
  return f;
};
const ride = { running: true, speed: 8, throttle: 0.3, jolt: 0 };
const run = (f, seconds, s = ride) => {
  for (let t = 0; t < seconds; t += 0.1) f.update(0.1, s);
};

describe('the drive chain', () => {
  it('only a chain-driven quad can get one', () => {
    const f = new Faults({ ...DEFAULT_FAULT_PARAMS, chainEvery: 1 }, seeded(3));
    run(f, 60);
    expect(f.has('chain')).toBe(false);
    const g = chainQuad({ chainEvery: 1 });
    run(g, 60);
    expect(g.has('chain')).toBe(true);
  });

  it('stretches only while the quad is ridden', () => {
    const f = chainQuad({ chainEvery: 1e9 });
    f.begin('chain');
    const at = f.levels.chain;
    run(f, 60, { running: true, speed: 0, throttle: 0 });
    expect(f.levels.chain).toBe(at);
    run(f, 60);
    expect(f.levels.chain).toBeGreaterThan(at);
  });

  it('oils off as it is ridden, and a dry chain stretches faster', () => {
    const wet = chainQuad({ chainEvery: 1e9 });
    const dry = chainQuad({ chainEvery: 1e9 });
    wet.begin('chain');
    dry.begin('chain');
    dry.kept.chainLube = 0;
    run(wet, 30);
    run(dry, 30);
    expect(wet.kept.chainLube).toBeLessThan(1);
    expect(dry.levels.chain).toBeGreaterThan(wet.levels.chain);
    expect(dry.chainDryness).toBe(1);
  });

  it('slaps over a bump once slack, not before and not on smooth ground', () => {
    const f = chainQuad({ chainEvery: 1e9 });
    f.leave('chain', 0.1);
    f.update(0.1, { ...ride, jolt: 10 });
    expect(f.takeSlap()).toBe(0);
    f.leave('chain', 0.6);
    f.update(0.1, { ...ride, jolt: 0 });
    expect(f.takeSlap()).toBe(0);
    f.update(0.1, { ...ride, jolt: 10 });
    expect(f.takeSlap()).toBeGreaterThan(0);
    expect(f.takeSlap()).toBe(0);
  });

  it('jumps the sprocket only when very slack and loaded, and then drives nothing', () => {
    const f = chainQuad({ chainEvery: 1e9, chainSeconds: 1e9, chainJumpRate: 50 });
    f.leave('chain', 0.5);
    run(f, 20, { ...ride, throttle: 1 });
    expect(f.chainOff).toBe(false);
    f.leave('chain', 1);
    run(f, 20, { ...ride, throttle: 0.1 });
    expect(f.chainOff).toBe(false);
    run(f, 20, { ...ride, throttle: 1 });
    expect(f.chainOff).toBe(true);
    expect(f.takeJump()).toBe(true);
    expect(f.takeJump()).toBe(false);
    expect(f.driveFactor).toBe(0);
  });

  it('is put back on and oiled in the yard, but only the bench takes the stretch out', () => {
    const f = chainQuad({ chainEvery: 1e9 });
    f.leave('chain', 1);
    f.kept.chainOff = true;
    f.kept.chainLube = 0;
    expect(f.fix('chain', { rough: true })).toBe(true);
    expect(f.chainOff).toBe(false);
    expect(f.kept.chainLube).toBeGreaterThan(0.5);
    expect(f.levels.chain).toBeLessThan(0.3);
    expect(f.driveFactor).toBeGreaterThan(0.8);
    f.fix('chain');
    expect(f.has('chain')).toBe(false);
    expect(f.kept.chainLube).toBe(1);
  });

  it('is only in a history for a quad with a chain', () => {
    const specs = [...QUAD_SPECS, ...EXTRA_SPECS].filter((s) => s.chainDrive);
    expect(specs.map((s) => s.id).sort()).toEqual(['atc', 'moto', 'yellow']);
    for (let seed = 1; seed < 200; seed++) {
      const h = pickHistory({ wearRange: [0, 0] }, seeded(seed), { faultChance: 1 });
      expect(h.faults.some((f) => f.kind === 'chain')).toBe(false);
    }
    let seen = false;
    for (let seed = 1; seed < 200; seed++) {
      const h = pickHistory({ wearRange: [0, 0], chainDrive: true }, seeded(seed), { faultChance: 1 });
      if (h.faults.some((f) => f.kind === 'chain')) seen = true;
    }
    expect(seen).toBe(true);
  });
});

function doJob(job, { flawAt } = {}) {
  while (!job.done) {
    const st = job.step;
    if (st.kind === 'press') job.press();
    else {
      job.startHold();
      job.update(st.id === flawAt ? job.needSeconds * 0.3 : st.limit ? (job.needSeconds + job.limitSeconds) / 2 : job.needSeconds + 0.01);
      job.releaseHold();
    }
  }
  return job;
}

describe('adjusting and oiling the chain at the bench', () => {
  const slack = () => {
    const f = chainQuad();
    f.leave('chain', 0.9);
    f.kept.chainOff = true;
    f.kept.chainLube = 0;
    return f;
  };

  it('is only a job for a quad with a chain', () => {
    expect(jobAvailable('chain', { params: {} }, undefined, true)).toBe(true);
    expect(jobAvailable('chain', { params: {} }, undefined, false)).toBe(false);
    expect(JOBS.chain.steps.some((st) => st.inspect)).toBe(true);
  });

  it('done properly puts it back on, takes the stretch out and oils it', () => {
    const faults = slack();
    const text = finishJob(doJob(new BenchJob('chain')), { engine: { params: {} }, faults, fuel: {} });
    expect(text).toMatch(/adjusted and oiled/);
    expect(faults.has('chain')).toBe(false);
    expect(faults.chainOff).toBe(false);
    expect(faults.kept.chainLube).toBe(1);
  });

  it('adjusted badly leaves some slack, and too little oil leaves it dry', () => {
    const a = slack();
    finishJob(doJob(new BenchJob('chain'), { flawAt: 'adjust' }), { engine: { params: {} }, faults: a, fuel: {} });
    expect(a.has('chain')).toBe(true);
    expect(a.levels.chain).toBeLessThan(0.5);
    expect(a.chainOff).toBe(false);
    const b = slack();
    const text = finishJob(doJob(new BenchJob('chain'), { flawAt: 'oil' }), { engine: { params: {} }, faults: b, fuel: {} });
    expect(text).toMatch(/dry/);
    expect(b.has('chain')).toBe(false);
    expect(b.kept.chainLube).toBeLessThan(1);
  });

  it('shows how slack it is when you pull on it', () => {
    const f = chainQuad();
    expect(chainLook(f)).toMatch(/snug/);
    f.leave('chain', 0.6);
    expect(chainLook(f)).toMatch(/slack/);
    f.leave('chain', 0.95);
    f.kept.chainLube = 0;
    expect(chainLook(f)).toMatch(/off the sprocket and bone dry/);
  });
});
