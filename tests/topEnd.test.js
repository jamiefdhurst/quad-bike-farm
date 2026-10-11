import { describe, it, expect } from 'vitest';
import { canRebuildTopEnd, readScoring, rebuildTopEnd } from '../src/engine/topEnd.js';
import { BenchJob, JOBS, finishJob, jobAvailable, DEFAULT_BENCH_PARAMS as P } from '../src/workshop/benchJobs.js';
import { EngineModel } from '../src/engine/engineModel.js';

const engine = (over = {}) => ({ wear: 0.3, scuff: 0, seized: false, overheat: 0.4, runIn: 0, params: { strokes: 2, wearMax: 1 }, ...over });

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

describe('top-end rebuild', () => {
  it('is only for a two-stroke that has scuffed or seized', () => {
    expect(canRebuildTopEnd(engine(), P)).toBe(false);
    expect(canRebuildTopEnd(engine({ scuff: 0.2 }), P)).toBe(true);
    expect(canRebuildTopEnd(engine({ seized: true, scuff: 1 }), P)).toBe(true);
    expect(canRebuildTopEnd(engine({ seized: true, params: { strokes: 4 } }), P)).toBe(false);
    expect(jobAvailable('topEnd', engine({ seized: true }), P)).toBe(true);
    expect(jobAvailable('topEnd', engine(), P)).toBe(false);
  });

  it('reads the scoring by how far it got', () => {
    expect(readScoring(engine({ scuff: 0.2 }), P).kind).toBe('light');
    expect(readScoring(engine({ scuff: 0.7 }), P).kind).toBe('deep');
    expect(readScoring(engine({ scuff: 1, seized: true }), P).kind).toBe('seized');
  });

  it('a good rebuild frees a seized engine, costs less wear than a strip down and starts the running in', () => {
    const e = engine({ seized: true, scuff: 1 });
    expect(rebuildTopEnd(e, false, P)).toBe(true);
    expect(e.seized).toBe(false);
    expect(e.scuff).toBe(0);
    expect(e.overheat).toBe(0);
    expect(e.runIn).toBe(1);
    expect(e.wear).toBeCloseTo(0.3 + P.topEndSeizeWear - P.topEndWearRemoved);
    expect(e.wear).toBeLessThan(0.3 + 0.3); // the strip down's seizeWear
  });

  it('a botched one leaves some scuffing, so it nips up again sooner', () => {
    const e = engine({ seized: true, scuff: 1 });
    rebuildTopEnd(e, true, P);
    expect(e.scuff).toBe(P.topEndBotchedScuff);
    expect(e.seized).toBe(false);
    expect(P.topEndBotchedScuff).toBeLessThan(0.55); // still turns freely, doesn't nip up yet
  });

  it('the bench job runs through, shows the scoring on the inspect step and finishes', () => {
    expect(JOBS.topEnd.steps.some((s) => s.inspect)).toBe(true);
    const e = engine({ seized: true, scuff: 1 });
    const text = finishJob(doJob(new BenchJob('topEnd')), { engine: e }, P);
    expect(e.seized).toBe(false);
    expect(text).toMatch(/new piston/i);
    const job = doJob(new BenchJob('topEnd'), 'tight');
    expect(job.botched).toBe(true);
  });

  it('a real engine that was seized turns over again after the job and wants running in', () => {
    const e = new EngineModel({ initialTemperature: 1 }, { random: () => 0.5 });
    e.seized = true;
    e.scuff = 1;
    finishJob(doJob(new BenchJob('topEnd')), { engine: e }, P);
    expect(e.seized).toBe(false);
    expect(e.runIn).toBe(1);
    e.setIgnition(true);
    for (let i = 0; i < 600 && !e.isRunning; i++) e.update(1 / 60, { starter: true });
    expect(e.isRunning).toBe(true);
  });
});
