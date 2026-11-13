import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { canFitBore, fitBore, borePowerFactor, boreWearFactor } from '../src/engine/bigBore.js';
import { idealJet, jetError } from '../src/engine/jetting.js';
import { heatTarget } from '../src/engine/heat.js';
import { BenchJob, JOB_KINDS, finishJob, jobAvailable, DEFAULT_BENCH_PARAMS as B } from '../src/workshop/benchJobs.js';
import { QUAD_SPECS, EXTRA_SPECS } from '../src/vehicle/quadSpecs.js';
import { AMY_BENCH_LINES, JESS_BENCH_LINES } from '../src/npc/benchLines.js';

const P = DEFAULT_ENGINE_PARAMS;
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const make = (params = {}) => new EngineModel({ strokes: 2, boreKit: 1, ...params }, { random: seeded(5) });

function doJob(job, flawAt) {
  while (!job.done) {
    const s = job.step;
    if (s.kind === 'press') job.press();
    else {
      job.startHold();
      job.update(s.id === flawAt ? job.needSeconds * 0.3 : s.limit ? (job.needSeconds + job.limitSeconds) / 2 : job.needSeconds + 0.01);
      job.releaseHold();
    }
  }
  return job;
}

describe('the big-bore factors', () => {
  it('change nothing without the kit', () => {
    expect(borePowerFactor(0, 1, P)).toBe(1);
    expect(boreWearFactor(0, P)).toBe(1);
    expect(heatTarget({ ambient: 0.5, work: 1, speed: 0, fan: false }, P)).toBe(heatTarget({ ambient: 0.5, work: 1, speed: 0, fan: false, bore: 0 }, P));
  });

  it('give more power, more heat, faster wear and a richer jet with it', () => {
    expect(borePowerFactor(1, 1, P)).toBeCloseTo(1 + P.borePower);
    expect(borePowerFactor(1, 0.5, P)).toBeLessThan(borePowerFactor(1, 1, P));
    expect(boreWearFactor(1, P)).toBeGreaterThan(2);
    const args = { ambient: 0.5, work: 1, speed: 0, fan: false };
    expect(heatTarget({ ...args, bore: 1 }, P)).toBeGreaterThan(heatTarget(args, P));
    expect(idealJet(12, P, 1)).toBeCloseTo(P.boreJet);
    expect(jetError(0, 12, P, 1)).toBeLessThan(0);
  });
});

describe('fitting it', () => {
  it('only the yellow has a kit, and only once', () => {
    expect([...QUAD_SPECS, ...EXTRA_SPECS].find((q) => q.id === 'hornet').engine.boreKit).toBe(1);
    expect([...QUAD_SPECS, ...EXTRA_SPECS].filter((q) => q.engine.boreKit).length).toBe(1);
    const e = make();
    expect(canFitBore(e)).toBe(true);
    expect(jobAvailable('bore', e)).toBe(true);
    fitBore(e, 1, B);
    expect(jobAvailable('bore', e)).toBe(false);
    expect(jobAvailable('bore', make({ boreKit: 0 }))).toBe(false);
    expect(JOB_KINDS).toContain('bore');
  });

  it('a good job fits it fully and takes some wear off; a botched one gives less power', () => {
    const e = make();
    e.wear = 0.4;
    const good = finishJob(doJob(new BenchJob('bore')), { engine: e }, B);
    expect(e.bore).toBe(1);
    expect(e.boreFit).toBe(1);
    expect(e.wear).toBeCloseTo(0.4 - B.boreWearRemoved);
    expect(good).toMatch(/fitted/);
    const f = make();
    const job = doJob(new BenchJob('bore'), 'tight');
    expect(job.botched).toBe(true);
    finishJob(job, { engine: f }, B);
    expect(f.boreFit).toBe(B.boreBotchedFit);
  });
});

describe('running with it', () => {
  const run = (e) => {
    e.setTemperature(1);
    e.setIgnition(true);
    for (let t = 0; t < 10 && !e.isRunning; t += 0.05) e.update(0.05, { starter: true, choke: 0.3, dayTemp: 12 });
    for (let t = 0; t < 120; t += 0.1) e.update(0.1, { throttle: 0.9, driveLoad: 0.9, dayTemp: 12 });
    return e;
  };

  it('wears faster and heats more than the same engine without it', () => {
    const plain = run(make());
    const big = make();
    fitBore(big, 1, B);
    big.wear = 0;
    run(big);
    expect(big.wear).toBeGreaterThan(plain.wear * 2);
    expect(big.heat).toBeGreaterThan(plain.heat);
  });
});

describe('what the girls say', () => {
  it('has lines for the catalogue and for the fitting, for both girls', () => {
    for (const k of ['boreCatalogue', 'boreDone', 'boreBotched']) {
      expect(AMY_BENCH_LINES[k].lines.length).toBeGreaterThan(1);
      expect(JESS_BENCH_LINES[k].length).toBeGreaterThan(1);
    }
  });
});
