import { describe, it, expect } from 'vitest';
import { BenchJob, JOBS, JOB_KINDS, finishJob, jobAvailable, inBay, plugCondition, readPlug, PLUG_KINDS, DEFAULT_BENCH_PARAMS as P } from '../src/workshop/benchJobs.js';
import { Faults, DEFAULT_FAULT_PARAMS } from '../src/vehicle/faults.js';
import { Sump } from '../src/vehicle/sump.js';

/** Does every step of a job right: taps for presses, holds for the middle of any window. */
function doJob(job, { flawAt } = {}) {
  let guard = 0;
  while (!job.done && guard++ < 50) {
    const s = job.step;
    if (s.kind === 'press') job.press();
    else {
      job.startHold();
      const target = s.id === flawAt ? (s.limit ? job.needSeconds * 0.3 : 0) : s.limit ? (job.needSeconds + job.limitSeconds) / 2 : job.needSeconds + 0.01;
      job.update(target);
      job.releaseHold();
    }
  }
  return job;
}

const target = () => ({
  engine: { wear: 0.4, fouling: 0.8, params: { strokes: 4 } },
  faults: new Faults({ ...DEFAULT_FAULT_PARAMS }, () => 0.3),
  fuel: { oil: 0 },
});

describe('bench jobs', () => {
  it('every job has steps with ids, text and a kind', () => {
    for (const kind of JOB_KINDS) {
      expect(JOBS[kind].steps.length).toBeGreaterThanOrEqual(4);
      for (const s of JOBS[kind].steps) expect(['press', 'hold']).toContain(s.kind);
    }
  });

  it('runs through in order and finishes clean', () => {
    const job = doJob(new BenchJob('plug'));
    expect(job.done).toBe(true);
    expect(job.botched).toBe(false);
  });

  it('a press does nothing on a hold step, and a hold does nothing on a press step', () => {
    const job = new BenchJob('plug');
    job.startHold();
    expect(job.holding).toBe(false);
    job.press();
    expect(job.step.id).toBe('out');
    expect(job.press()).toEqual([]);
    expect(job.step.id).toBe('out');
  });

  it('a hold with no window just starts again if you let go early', () => {
    const job = new BenchJob('plug');
    job.press();
    job.startHold();
    job.update(0.3);
    expect(job.releaseHold()).toEqual([]);
    expect(job.step.id).toBe('out');
    expect(job.progress).toBe(0);
  });

  it('letting go too early on a window botches it, and so does holding too long', () => {
    const short = doJob(new BenchJob('carb'), { flawAt: 'tight' });
    expect(short.flaws).toEqual([{ step: 'tight', how: 'short' }]);
    const job = new BenchJob('carb');
    while (job.step.id !== 'tight') {
      if (job.step.kind === 'press') job.press();
      else {
        job.startHold();
        job.update(job.needSeconds + 0.01);
      }
    }
    job.startHold();
    const events = job.update(job.limitSeconds + 0.1);
    expect(events[0]).toEqual({ type: 'flaw', step: 'tight', how: 'over' });
    expect(job.done).toBe(true);
  });

  it('the hold scale speeds a hold up', () => {
    const fast = new BenchJob('plug', { ...P, holdScale: 0.5 });
    fast.press();
    expect(fast.needSeconds).toBeCloseTo(0.45);
  });
});

describe('what a finished job does', () => {
  it('a clean plug job clears the fouling and some wear; a botched one leaves it fouled', () => {
    const t = target();
    finishJob(doJob(new BenchJob('plug')), t);
    expect(t.engine.fouling).toBe(0);
    expect(t.engine.wear).toBeCloseTo(0.4 - P.plugWearRemoved);
    const u = target();
    finishJob(doJob(new BenchJob('plug'), { flawAt: 'tight' }), u);
    expect(u.engine.fouling).toBe(P.plugLeftFouling);
  });

  it('a clean carb or tyre job clears the fault; a botched one leaves a mild one', () => {
    for (const [kind, fault] of [['carb', 'carb'], ['tyre', 'puncture']]) {
      const t = target();
      t.faults.begin(fault);
      finishJob(doJob(new BenchJob(kind)), t);
      expect(t.faults.has(fault)).toBe(false);
      const u = target();
      u.faults.begin(fault);
      finishJob(doJob(new BenchJob(kind), { flawAt: kind === 'tyre' ? 'pump' : 'tight' }), u);
      expect(u.faults.has(fault)).toBe(true);
    }
  });

  it('a botched carb job leaves the carb a bit dirty', () => {
    const t = target();
    finishJob(doJob(new BenchJob('carb'), { flawAt: 'tight' }), t);
    expect(t.faults.levels.carb).toBe(P.botchedLevel);
  });

  it('the oil job sets the mix by how the pour went', () => {
    const oil = (opts) => {
      const t = target();
      finishJob(doJob(new BenchJob('oil'), opts), t);
      return t.fuel.oil;
    };
    expect(oil()).toBe(P.oilGood);
    expect(oil({ flawAt: 'pour' })).toBe(P.oilShort);
  });

  it('the sump job fills a four-stroke to the top mark, or just under after a short pour', () => {
    const level = (opts) => {
      const t = { ...target(), sump: new Sump({ level: 0.2 }) };
      finishJob(doJob(new BenchJob('sump'), opts), t);
      return t.sump.level;
    };
    expect(level()).toBe(1);
    expect(level({ flawAt: 'pour' })).toBe(P.sumpShort);
  });

  it('the sump job is for petrol four-strokes only', () => {
    expect(jobAvailable('sump', { params: { strokes: 4 } })).toBe(true);
    expect(jobAvailable('sump', { params: { strokes: 2 } })).toBe(false);
    expect(jobAvailable('sump', { params: { strokes: 4, runsOnDiesel: true } })).toBe(false);
  });

  it('the oil job is for two-strokes only', () => {
    expect(jobAvailable('oil', { params: { strokes: 4 } })).toBe(false);
    expect(jobAvailable('oil', { params: { strokes: 2 } })).toBe(true);
    expect(jobAvailable('plug', { params: { strokes: 4 } })).toBe(true);
  });

  it('the old plug shows how the engine ran', () => {
    const e = (over = {}) => ({ params: { strokes: 4 }, fouling: 0, wear: 0, oilRich: 0, rich: 0, mixture: 0, ...over });
    expect(readPlug(e()).kind).toBe('healthy');
    expect(readPlug(e({ fouling: 0.6 })).kind).toBe('rich');
    expect(readPlug(e({ rich: 0.3 })).kind).toBe('rich');
    expect(readPlug(e({ mixture: -0.3 })).kind).toBe('lean');
    expect(readPlug(e({ wear: 0.6 })).kind).toBe('worn');
    expect(readPlug(e({ wear: 0.6, params: { strokes: 2 } })).kind).toBe('oily');
    expect(readPlug(e({ oilRich: 0.5, params: { strokes: 2 } })).kind).toBe('oily');
    expect(plugCondition(e({ mixture: -0.3 }))).toMatch(/white/);
  });

  it('every kind of plug has a look', () => {
    for (const kind of PLUG_KINDS) {
      const found = [{}, { fouling: 1 }, { mixture: -1 }, { wear: 1 }, { wear: 1, params: { strokes: 2 } }]
        .map((o) => readPlug({ params: { strokes: 4 }, fouling: 0, wear: 0, oilRich: 0, rich: 0, mixture: 0, ...o }).kind);
      expect(found).toContain(kind);
    }
  });
});

describe('rough fixes in the yard', () => {
  it('leave a mild fault that never gets worse than the cap, and the bench clears it', () => {
    const f = new Faults({ ...DEFAULT_FAULT_PARAMS, carbEvery: 1e9 }, () => 0.3);
    f.begin('carb');
    f.levels.carb = 0.8;
    expect(f.fix('carb', { rough: true })).toBe(true);
    expect(f.levels.carb).toBe(DEFAULT_FAULT_PARAMS.fieldFixLevel);
    for (let i = 0; i < 20000; i++) f.update(0.1, { running: true, speed: 0, throttle: 0 });
    expect(f.levels.carb).toBe(DEFAULT_FAULT_PARAMS.fieldFixCap);
    expect(f.fix('carb', { rough: true })).toBe(false);
    expect(f.fix('carb')).toBe(true);
    expect(f.has('carb')).toBe(false);
    expect(f.caps.carb).toBe(1);
  });
});

describe('the bay', () => {
  const bay = { x: 0, z: 0, halfX: 1.5, halfZ: 1 };
  it('holds a quad whose middle is inside the lines', () => {
    expect(inBay(bay, 0.5, 0.3)).toBe(true);
    expect(inBay(bay, 1.6, 0)).toBe(false);
    expect(inBay(bay, 1.3, 0, 0.35)).toBe(false);
  });
});

describe('repacking the silencer', () => {
  it('is for two-strokes, and sets the packing right unless botched', () => {
    expect(jobAvailable('packing', { params: { strokes: 2 } })).toBe(true);
    expect(jobAvailable('packing', { params: { strokes: 4 } })).toBe(false);
    const done = (opts) => {
      const t = { ...target(), engine: { ...target().engine, silencerBlown: 0.9 } };
      finishJob(doJob(new BenchJob('packing'), opts), t);
      return t.engine.silencerBlown;
    };
    expect(done()).toBe(0);
    expect(done({ flawAt: 'wrap' })).toBe(P.packingBotched);
  });
});
