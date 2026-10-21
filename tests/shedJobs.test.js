import { describe, it, expect } from 'vitest';
import { BenchJob, JOBS, finishJob, DEFAULT_BENCH_PARAMS as P } from '../src/workshop/benchJobs.js';
import { SHED_JOBS, SHED_JOB_KINDS, SHED_JOB_FAULT, shedJobWhyNot, shedLook } from '../src/workshop/shedJobs.js';
import { SHED_KINDS, SHED_PIECE_OF } from '../src/vehicle/shedFaults.js';
import { Faults, DEFAULT_FAULT_PARAMS } from '../src/vehicle/faults.js';
import { TyreSet, newTyres } from '../src/vehicle/tyres.js';

/** Does every step of a job right: taps for presses, the middle of any window for holds. A step named in `flawAt` is let go early. */
function doJob(job, { flawAt } = {}) {
  let guard = 0;
  while (!job.done && guard++ < 50) {
    const s = job.step;
    if (s.kind === 'press') job.press();
    else {
      job.startHold();
      const t = s.id === flawAt ? (s.limit ? job.needSeconds * 0.3 : 0) : s.limit ? (job.needSeconds + job.limitSeconds) / 2 : job.needSeconds + 0.01;
      job.update(t);
      job.releaseHold();
    }
  }
  return job;
}

const target = () => {
  const faults = new Faults({ ...DEFAULT_FAULT_PARAMS }, () => 0.3);
  faults.hasChain = true;
  faults.hasSump = true;
  return { engine: { wear: 0.4, fouling: 0, params: { strokes: 4 } }, faults, fuel: { oil: 0 }, tyres: new TyreSet(newTyres(4)) };
};

describe('the shed kit jobs', () => {
  it('are eleven, listed once each, and each belongs to a piece', () => {
    expect(SHED_JOB_KINDS).toHaveLength(11);
    expect(new Set(SHED_JOB_KINDS).size).toBe(11);
    for (const k of SHED_JOB_KINDS) {
      expect(JOBS[k]).toBe(SHED_JOBS[k]);
      expect(['compressor', 'washer', 'pit']).toContain(SHED_JOBS[k].piece);
      expect(SHED_JOBS[k].steps.length).toBeGreaterThanOrEqual(4);
      for (const s of SHED_JOBS[k].steps) expect(['press', 'hold']).toContain(s.kind);
      expect(SHED_JOBS[k].steps.some((s) => s.inspect), `${k} has an inspect step`).toBe(true);
    }
  });

  it('between them cover every shed fault, and each puts right a fault of its own piece', () => {
    const covered = new Set(Object.values(SHED_JOB_FAULT));
    covered.add('tyreCold');
    covered.add('tyreUneven'); // the pressures job
    for (const k of SHED_KINDS) expect(covered.has(k), k).toBe(true);
    for (const [job, fault] of Object.entries(SHED_JOB_FAULT)) expect(SHED_PIECE_OF[fault], job).toBe(SHED_JOBS[job].piece);
  });

  it('clear their fault when done right', () => {
    for (const [job, fault] of Object.entries(SHED_JOB_FAULT)) {
      const t = target();
      t.faults.leave(fault, 0.7);
      const j = doJob(new BenchJob(job));
      expect(j.botched, job).toBe(false);
      finishJob(j, t, P);
      expect(t.faults.has(fault), job).toBe(false);
    }
  });

  it('bring the fault back at the botched level when a hold is let go early', () => {
    for (const [job, fault] of Object.entries(SHED_JOB_FAULT)) {
      const win = SHED_JOBS[job].steps.find((s) => s.kind === 'hold' && s.limit);
      const t = target();
      t.faults.leave(fault, 0.7);
      const j = doJob(new BenchJob(job), { flawAt: win.id });
      expect(j.botched, job).toBe(true);
      finishJob(j, t, P);
      expect(t.faults.has(fault), job).toBe(true);
      expect(t.faults.levels[fault], job).toBe(P.botchedLevel);
    }
  });

  it('set the pressures: all four to stock, the cold and the odd tyre dealt with', () => {
    const t = target();
    t.tyres.psi = [2.1, 3, 5.4, 4];
    t.faults.leave('tyreCold', 0.6);
    t.faults.leave('tyreUneven', 0.6);
    const j = doJob(new BenchJob('pressures'));
    expect(finishJob(j, t, P)).toMatch(/same pressure/);
    expect(t.tyres.psi).toEqual([4, 4, 4, 4]);
    expect(t.faults.has('tyreCold') || t.faults.has('tyreUneven')).toBe(false);
  });

  it('set the pressures a little off when the fill was let go early or held on too long', () => {
    for (const [flaw, expected] of [['short', 4 - P.pressureOff], ['over', 4 + P.pressureOff]]) {
      const t = target();
      const j = new BenchJob('pressures');
      j.press();
      j.press();
      j.startHold();
      j.update(flaw === 'short' ? 0.2 : j.limitSeconds + 1);
      if (flaw === 'short') j.releaseHold();
      while (!j.done) j.press();
      finishJob(j, t, P);
      expect(t.tyres.psi[0]).toBeCloseTo(expected, 5);
    }
  });

  it('wash the carb: the gum goes, and so does ordinary carb dirt', () => {
    const t = target();
    t.faults.leave('carbGum', 0.8);
    t.faults.leave('carb', 0.5);
    finishJob(doJob(new BenchJob('degum')), t, P);
    expect(t.faults.has('carbGum') || t.faults.has('carb')).toBe(false);
  });

  it('wash the chain: oiled well leaves it fully oiled', () => {
    const t = target();
    t.faults.leave('chainGrit', 0.8);
    t.faults.kept.chainLube = 0.1;
    finishJob(doJob(new BenchJob('chainWash')), t, P);
    expect(t.faults.kept.chainLube).toBe(1);
    expect(t.faults.has('chainGrit')).toBe(false);
  });

  it('tell you what is wrong when you look, without giving the fault a name', () => {
    const t = target();
    for (const k of SHED_JOB_KINDS) {
      const fine = shedLook(k, t.faults, t.tyres);
      expect(fine.length).toBeGreaterThan(10);
    }
    t.faults.leave('bearing', 0.8);
    t.faults.wheelSides = null;
    expect(shedLook('bearing', t.faults)).toMatch(/grumbles/);
    t.faults.leave('gasket', 0.8);
    expect(shedLook('gasket', t.faults)).not.toBe(shedLook('gasket', target().faults));
    t.faults.leave('valveCore', 0.5);
    expect(shedLook('valveCore', t.faults)).toMatch(/bubbles blow/);
  });
});

describe('who can have a shed job', () => {
  const ctx = (o = {}) => ({ have: () => true, atPit: true, hasCarb: true, hasChain: true, hasSump: true, ...o });
  it('needs the piece standing in the barn', () => {
    expect(shedJobWhyNot('pressures', ctx({ have: () => false }))).toMatch(/compressor/);
    expect(shedJobWhyNot('degum', ctx({ have: () => false }))).toMatch(/washer/);
    expect(shedJobWhyNot('exhaust', ctx({ have: () => false }))).toMatch(/pit/);
    for (const k of SHED_JOB_KINDS) expect(shedJobWhyNot(k, ctx()), k).toBeNull();
  });
  it('wants a pit job done over the pit', () => {
    for (const k of SHED_JOB_KINDS.filter((j) => SHED_JOBS[j].piece === 'pit')) expect(shedJobWhyNot(k, ctx({ atPit: false })), k).toMatch(/big bay/);
    expect(shedJobWhyNot('pressures', ctx({ atPit: false }))).toBeNull();
  });
  it('leaves out what the vehicle has not got', () => {
    expect(shedJobWhyNot('degum', ctx({ hasCarb: false }))).toMatch(/no carb/);
    expect(shedJobWhyNot('chainWash', ctx({ hasChain: false }))).toMatch(/no chain/);
    expect(shedJobWhyNot('gasket', ctx({ hasSump: false }))).toMatch(/no sump/);
  });
});
