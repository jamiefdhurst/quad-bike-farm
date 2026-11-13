import { describe, it, expect } from 'vitest';
import { BenchJob, JOBS, JOB_KINDS, finishJob, DEFAULT_BENCH_PARAMS as BP } from '../src/workshop/benchJobs.js';
import { Faults, DEFAULT_FAULT_PARAMS } from '../src/vehicle/faults.js';
import { entryText } from '../src/workshop/logbook.js';
import { JobBoard, DEFAULT_JOB_BOARD_PARAMS } from '../src/world/farmJobs.js';
import {
  DEFAULT_SERVICE_PARAMS as P, ServiceJob, ServiceRun, servicePlan, serviceDue, pickServiceJob, serviceChalk, applyServiceReward, factsOf, stateOf,
} from '../src/workshop/service.js';

const petrol4 = { strokes: 4, hasFilter: true, hasChain: true, hasBelt: false };
const petrol2 = { strokes: 2, hasFilter: true, hasChain: false, hasBelt: true };
const diesel = { strokes: 4, compressionIgnition: true, runsOnDiesel: true, hasFilter: true, hasChain: false, hasBelt: true };
const fine = { wear: 0, fouling: 0, clog: 0, sump: 1, oil: 0.02, chain: 0, belt: 0 };

describe('the plan', () => {
  it('is what the quad has', () => {
    expect(servicePlan(petrol4)).toEqual(['plug', 'filter', 'sump', 'chain']);
    expect(servicePlan(petrol2)).toEqual(['plug', 'filter', 'oil', 'belt']);
    expect(servicePlan(diesel)).toEqual(['filter', 'belt']);
  });

  it('only uses jobs that exist, and the two that are done only in a service are not on the bench menu', () => {
    for (const k of [...servicePlan(petrol4), ...servicePlan(petrol2), ...servicePlan(diesel)]) expect(JOBS[k]).toBeTruthy();
    expect(JOB_KINDS).not.toContain('filter');
    expect(JOB_KINDS).not.toContain('belt');
  });

  it('reads the facts off a unit', () => {
    const unit = {
      engine: { wear: 0.4, fouling: 0.1, params: { strokes: 2 } },
      quad: { filter: { clog: 0.5 }, fuel: { oil: 0.01 }, faults: { hasChain: false, hasClutch: false, levels: { chain: 0, belt: 0.3 } } },
    };
    expect(factsOf(unit)).toMatchObject({ strokes: 2, hasFilter: true, hasChain: false, hasBelt: true });
    expect(stateOf(unit)).toMatchObject({ wear: 0.4, clog: 0.5, oil: 0.01, sump: null, belt: 0.3 });
  });
});

describe('what is due', () => {
  it('is nothing on a quad in good order', () => {
    expect(serviceDue(servicePlan(petrol4), fine)).toEqual([]);
  });

  it('picks out what has gone off', () => {
    const plan = servicePlan(petrol4);
    expect(serviceDue(plan, { ...fine, wear: 0.4, clog: 0.6 })).toEqual(['plug', 'filter']);
    expect(serviceDue(plan, { ...fine, sump: 0.5, chain: 0.4 })).toEqual(['sump', 'chain']);
  });
});

describe('the board', () => {
  const quad = (id, state, facts = petrol4) => ({ id, name: id, plan: servicePlan(facts), state: { ...fine, ...state } });
  const yes = () => 0;

  it('posts nothing when every quad is fine, or only one thing is due', () => {
    expect(pickServiceJob([quad('farm300', {})], yes)).toBeNull();
    expect(pickServiceJob([quad('farm300', { clog: 0.9 })], yes)).toBeNull();
  });

  it('posts a partial service for two things due', () => {
    const job = pickServiceJob([quad('farm300', { wear: 0.35, clog: 0.9 })], yes);
    expect(job).toMatchObject({ id: 'farm300', kinds: ['plug', 'filter'], full: false });
    expect(serviceChalk({ ...job, name: 'Red' })).toBe('Red: plug, air filter');
  });

  it('posts a full service past the book wear, and takes the worst quad', () => {
    const job = pickServiceJob([quad('farm300', { wear: 0.35, clog: 0.9 }), quad('bruin', { wear: 0.7 }), quad('rb300', { wear: 0.55 })], yes);
    expect(job).toMatchObject({ id: 'bruin', full: true, kinds: servicePlan(petrol4) });
    expect(serviceChalk({ ...job, name: 'Blue' })).toBe('Full service on the Blue');
  });

  it('does not always go up', () => {
    expect(pickServiceJob([quad('bruin', { wear: 0.7 })], () => 0.99)).toBeNull();
  });

  it('goes on the board on top of the usual jobs and ticks off when its kinds are done clean', () => {
    const board = new JobBoard({ ids: ['muck', 'silage'], random: () => 0.5, params: { ...DEFAULT_JOB_BOARD_PARAMS } });
    board.add('service:red', { chalk: 'Red: plug, air filter', hint: '' });
    expect(board.today).toHaveLength(3);
    expect(board.lines()[2].text).toBe('Red: plug, air filter');
    const job = new ServiceJob({ id: 'farm300', name: 'Red', kinds: ['plug', 'filter'], full: false });
    expect(job.note('bruin', 'plug', false)).toBe(false); // another quad
    expect(job.note('farm300', 'plug', true)).toBe(false); // botched: still to do
    expect(job.note('farm300', 'plug', false)).toBe(false);
    expect(job.note('farm300', 'filter', false)).toBe(true);
    expect(board.complete('service:red')).toBe(true);
  });
});

describe('a full service', () => {
  const run = (botchAt) => {
    const r = new ServiceRun('farm300', ['plug', 'filter', 'sump']);
    for (const k of ['plug', 'filter', 'sump']) r.record(k, k === botchAt);
    return r;
  };

  it('goes in order and only counts the next job', () => {
    const r = new ServiceRun('farm300', ['plug', 'filter']);
    r.record('filter', false);
    expect(r.next).toBe('plug');
    r.record('plug', false);
    expect(r.next).toBe('filter');
    expect(r.finished).toBe(false);
    r.record('filter', false);
    expect(r.finished).toBe(true);
  });

  it('takes a little off the roughness when clean, never below the quad best', () => {
    const e = { params: { baseRoughness: 0.5 } };
    expect(applyServiceReward(e, 0.2, run(), P)).toBeCloseTo(P.serviceSmooth);
    expect(e.params.baseRoughness).toBeCloseTo(0.5 - P.serviceSmooth);
    const near = { params: { baseRoughness: 0.22 } };
    applyServiceReward(near, 0.2, run(), P);
    expect(near.params.baseRoughness).toBeCloseTo(0.2);
    const best = { params: { baseRoughness: 0.1 } };
    applyServiceReward(best, 0.2, run(), P);
    expect(best.params.baseRoughness).toBe(0.1);
  });

  it('takes nothing off if any step was botched or it is unfinished', () => {
    const e = { params: { baseRoughness: 0.5 } };
    expect(applyServiceReward(e, 0.2, run('filter'), P)).toBe(0);
    expect(applyServiceReward(e, 0.2, new ServiceRun('farm300', ['plug']), P)).toBe(0);
    expect(e.params.baseRoughness).toBe(0.5);
  });

  it('is written up in the logbook', () => {
    expect(entryText({ kind: 'job', job: 'service', botched: false })).toBe('full service done, ticked off');
  });
});

describe('the filter and belt jobs', () => {
  function doJob(job, how = 'good') {
    while (!job.done) {
      const s = job.step;
      if (s.kind === 'press') job.press();
      else {
        job.startHold();
        job.update(how === 'short' && s.limit ? job.needSeconds * 0.3 : s.limit ? (job.needSeconds + job.limitSeconds) / 2 : job.needSeconds + 0.01);
        job.releaseHold();
      }
    }
    return job;
  }
  const target = () => ({ engine: { wear: 0, params: {} }, faults: new Faults({ ...DEFAULT_FAULT_PARAMS }, () => 0.3), filter: { clog: 0.8 } });

  it('a clean filter job empties the filter, a poor one leaves some', () => {
    const t = target();
    finishJob(doJob(new BenchJob('filter')), t, BP);
    expect(t.filter.clog).toBe(0);
    const u = target();
    finishJob(doJob(new BenchJob('filter'), 'short'), u, BP);
    expect(u.filter.clog).toBe(BP.filterLeft);
  });

  it('a belt job fixes the belt, badly done leaves a little slip', () => {
    const t = target();
    t.faults.started.belt = true;
    t.faults.levels.belt = 0.9;
    finishJob(doJob(new BenchJob('belt')), t, BP);
    expect(t.faults.levels.belt).toBe(0);
    t.faults.started.belt = true;
    t.faults.levels.belt = 0.9;
    finishJob(doJob(new BenchJob('belt'), 'short'), t, BP);
    expect(t.faults.levels.belt).toBe(BP.botchedLevel);
  });
});
