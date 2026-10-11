import { describe, it, expect } from 'vitest';
import { Faults, DEFAULT_FAULT_PARAMS } from '../src/vehicle/faults.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { BenchJob, JOBS, finishJob, jobAvailable, valvesLook, DEFAULT_BENCH_PARAMS as P } from '../src/workshop/benchJobs.js';
import { pickHistory } from '../src/vehicle/history.js';

const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const fourStroke = (params = {}, seed = 3) => {
  const f = new Faults({ ...DEFAULT_FAULT_PARAMS, ...params }, seeded(seed));
  f.hasValves = true;
  return f;
};
const idle = { running: true, speed: 0, throttle: 0 };
const run = (f, seconds, s = idle) => {
  for (let t = 0; t < seconds; t += 0.1) f.update(0.1, s);
};

describe('valve clearances', () => {
  it('only a four-stroke can get them out', () => {
    const f = new Faults({ ...DEFAULT_FAULT_PARAMS, valvesEvery: 1 }, seeded(3));
    run(f, 60);
    expect(f.has('valves')).toBe(false);
    const g = fourStroke({ valvesEvery: 1 });
    run(g, 60);
    expect(g.has('valves')).toBe(true);
  });

  it('wear wide while the engine runs, and the tick gets louder', () => {
    const f = fourStroke({ valvesEvery: 1e9 });
    f.begin('valves');
    const at = f.valveLoose;
    run(f, 5, { running: false, speed: 0, throttle: 0 });
    expect(f.valveLoose).toBe(at);
    run(f, 300);
    expect(f.valveLoose).toBeGreaterThan(at);
    expect(f.valveTight).toBe(0);
  });

  it('too tight is a different fault: no tick, and it does not wear any wider', () => {
    const f = fourStroke({ valvesEvery: 1e9 });
    f.leave('valves', 0.5);
    f.kept.valveTight = true;
    expect(f.valveLoose).toBe(0);
    expect(f.valveTight).toBe(0.5);
    run(f, 300);
    expect(f.levels.valves).toBe(0.5);
  });

  it('fixing it clears the tight setting too', () => {
    const f = fourStroke();
    f.leave('valves', 0.5);
    f.kept.valveTight = true;
    expect(f.fix('valves')).toBe(true);
    expect(f.valveTight).toBe(0);
    expect(f.kept.valveTight).toBe(false);
  });

  it('only a four-stroke starts a game with them out', () => {
    for (let seed = 1; seed < 200; seed++) {
      const h = pickHistory({ wearRange: [0, 0], engine: { strokes: 2 } }, seeded(seed), { faultChance: 1 });
      expect(h.faults.some((f) => f.kind === 'valves')).toBe(false);
    }
    let seen = false;
    for (let seed = 1; seed < 200; seed++) {
      const h = pickHistory({ wearRange: [0, 0] }, seeded(seed), { faultChance: 1 });
      if (h.faults.some((f) => f.kind === 'valves')) seen = true;
    }
    expect(seen).toBe(true);
  });
});

describe('what the engine does with them', () => {
  const make = (seed = 7) => new EngineModel({ strokes: 4 }, { random: seeded(seed) });
  const spin = (e, controls, seconds = 6) => {
    for (let t = 0; t < seconds; t += 1 / 60) e.update(1 / 60, controls);
  };

  it('wide valves tick, and cost a little power', () => {
    const a = make();
    const b = make();
    for (const e of [a, b]) {
      e.setIgnition(true);
      spin(e, { starter: true }, 3);
      spin(e, { throttle: 0.3 }, 3);
    }
    spin(a, { throttle: 0.5, valveLoose: 1 });
    spin(b, { throttle: 0.5 });
    expect(a.tick).toBe(1);
    expect(b.tick).toBe(0);
    expect(a.power).toBeLessThan(b.power);
  });

  it('tight valves lose more power and make it start richer when hot', () => {
    const a = make();
    const b = make();
    for (const e of [a, b]) {
      e.setIgnition(true);
      spin(e, { starter: true }, 3);
      spin(e, { throttle: 0.3 }, 3);
    }
    spin(a, { throttle: 0.5, valveTight: 1 });
    spin(b, { throttle: 0.5, valveLoose: 1 });
    expect(a.power).toBeLessThan(b.power);
    a.soak = 1;
    b.soak = 1;
    a.state = b.state = 'off';
    a.updateMixture();
    b.updateMixture();
    expect(a.mixture).toBeGreaterThan(b.mixture);
  });
});

describe('setting the clearances at the bench', () => {
  const worn = () => {
    const f = fourStroke();
    f.leave('valves', 0.8);
    return f;
  };
  const doJob = (flaws = []) => {
    const job = new BenchJob('valves');
    job.flaws.push(...flaws);
    return job;
  };
  const ctx = (faults) => ({ engine: { params: {} }, faults, fuel: {} });

  it('is a job for four-strokes only, and has a look at the old clearance', () => {
    expect(jobAvailable('valves', { params: { strokes: 4 } })).toBe(true);
    expect(jobAvailable('valves', { params: { strokes: 2 } })).toBe(false);
    expect(JOBS.valves.steps.some((st) => st.inspect)).toBe(true);
  });

  it('done properly puts it right', () => {
    const f = worn();
    expect(finishJob(doJob(), ctx(f), P)).toMatch(/set/);
    expect(f.has('valves')).toBe(false);
  });

  it('too little turn leaves them wide, too much leaves them tight', () => {
    const a = worn();
    finishJob(doJob([{ step: 'gap', how: 'short' }]), ctx(a), P);
    expect(a.valveLoose).toBeCloseTo(P.valvesBotchedLevel);
    const b = worn();
    const text = finishJob(doJob([{ step: 'gap', how: 'over' }]), ctx(b), P);
    expect(b.valveTight).toBeCloseTo(P.valvesBotchedLevel);
    expect(b.valveLoose).toBe(0);
    expect(text).toMatch(/tight/);
  });

  it('the feeler gauge says which way it is out', () => {
    const f = fourStroke();
    expect(valvesLook(f)).toMatch(/right/);
    f.leave('valves', 0.4);
    expect(valvesLook(f)).toMatch(/wide/);
    f.leave('valves', 0.9);
    expect(valvesLook(f)).toMatch(/far too wide/);
    f.kept.valveTight = true;
    expect(valvesLook(f)).toMatch(/too tight/);
  });
});
