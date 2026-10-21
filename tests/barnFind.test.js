import { describe, it, expect } from 'vitest';
import { pickBarnFind, BarnFind, jobsFor, RUSTY_JOBS, DEFAULT_BARN_FIND_PARAMS as P } from '../src/vehicle/barnFind.js';
import { QUAD_SPECS } from '../src/vehicle/quadSpecs.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { BenchJob, JOBS, finishJob, jobAvailable } from '../src/workshop/benchJobs.js';
import { FuelSystem, DEFAULT_FUEL_PARAMS } from '../src/vehicle/fuelSystem.js';
import { createRandom } from '../src/core/random.js';

const plan = { donor: QUAD_SPECS[0], jobs: ['fuel', 'plug', 'battery'] };

describe('picking a barn find', () => {
  const games = Array.from({ length: 600 }, (_, i) => pickBarnFind(createRandom(i), QUAD_SPECS));

  it('is the same for the same seed', () => {
    expect(pickBarnFind(createRandom(5), QUAD_SPECS)).toEqual(pickBarnFind(createRandom(5), QUAD_SPECS));
  });

  it('turns up in about one game in five', () => {
    const share = games.filter(Boolean).length / games.length;
    expect(share).toBeGreaterThan(0.14);
    expect(share).toBeLessThan(0.27);
  });

  it('copies a regular quad and needs three or four of the jobs, in the bench order', () => {
    const found = games.filter(Boolean);
    expect(found.length).toBeGreaterThan(0);
    for (const f of found) {
      expect(QUAD_SPECS).toContain(f.donor);
      expect(f.jobs.length).toBeGreaterThanOrEqual(P.minJobs);
      expect(f.jobs.length).toBeLessThanOrEqual(P.maxJobs);
      expect(f.jobs).toEqual(RUSTY_JOBS.filter((k) => f.jobs.includes(k)));
    }
    expect(new Set(found.map((f) => f.donor.id)).size).toBeGreaterThan(2);
    expect(new Set(found.map((f) => f.jobs.join())).size).toBeGreaterThan(5);
  });

  it('never asks a pull-start quad to charge a battery', () => {
    const pull = QUAD_SPECS.filter((s) => s.engine?.noStarter);
    for (const s of pull) expect(jobsFor(s)).not.toContain('battery');
    for (let i = 0; i < 300; i++) {
      const f = pickBarnFind(createRandom(i), pull.length ? pull : QUAD_SPECS, { ...P, chance: 1 });
      if (f.donor.engine?.noStarter) expect(f.jobs).not.toContain('battery');
    }
  });
});

describe('bringing it back', () => {
  it('offers only the tarp until it is off, then only what it needs', () => {
    const find = new BarnFind(plan);
    expect(find.kinds).toEqual(['tarp', 'fuel', 'plug']);
    expect(find.available('tarp')).toBe(true);
    expect(find.available('fuel')).toBe(false);
    find.finish('tarp');
    expect(find.available('tarp')).toBe(false);
    expect(find.available('fuel')).toBe(true);
    expect(find.available('carb')).toBe(false);
  });

  it('will not start until the tarp is off, every job is done and its battery is fitted and charged', () => {
    const find = new BarnFind(plan);
    expect(find.startBlocked).toBe(true);
    find.finish('tarp');
    find.finish('fuel');
    find.finish('plug');
    expect(find.startBlocked).toBe(true);
    expect(find.setBattery(P.startBattery, true)).toBe(false); // fitted but flat
    expect(find.startBlocked).toBe(true);
    expect(find.setBattery(1, false)).toBe(false); // charged but out on the bench
    expect(find.startBlocked).toBe(true);
    expect(find.setBattery(P.readyAt, true)).toBe(true);
    expect(find.startBlocked).toBe(false);
    expect(find.setBattery(1, true)).toBe(false); // already so
  });

  it('has no battery job of its own: the bench charger rows do it, and the bench cannot mark it done', () => {
    const find = new BarnFind(plan);
    find.finish('tarp');
    expect(find.kinds).not.toContain('battery');
    expect(find.available('battery')).toBe(false);
    find.finish('battery');
    expect(find.isDone('battery')).toBe(false);
  });

  it('holds the brake on until the brake job is done', () => {
    const find = new BarnFind({ donor: QUAD_SPECS[0], jobs: ['brake', 'tyre'] });
    expect(find.brakeSeized).toBe(true);
    find.finish('brake');
    expect(find.brakeSeized).toBe(false);
    expect(new BarnFind(plan).brakeSeized).toBe(false);
  });

  it('says what is stopping it, in the bench order', () => {
    const find = new BarnFind(plan);
    expect(find.blockedReason()).toMatch(/varnish/);
    find.finish('fuel');
    expect(find.blockedReason()).toMatch(/plug/);
  });
});

describe('its jobs at the bench', () => {
  it('each barn-find job is a short run of presses and holds that can be finished', () => {
    for (const kind of ['tarp', 'fuel', 'brake']) {
      const job = new BenchJob(kind);
      let guard = 0;
      while (!job.done && guard++ < 30) {
        const s = job.step;
        if (s.kind === 'press') job.press();
        else {
          job.startHold();
          job.update(s.limit ? (job.needSeconds + job.limitSeconds) / 2 : job.needSeconds + 0.01);
          job.releaseHold();
        }
      }
      expect(job.done).toBe(true);
      expect(job.botched).toBe(false);
      expect(jobAvailable(kind, { params: { strokes: 4 } })).toBe(true);
      expect(typeof finishJob(job, { engine: { fouling: 0.5, wear: 0, params: {} }, faults: {}, fuel: {} })).toBe('string');
    }
    expect(JOBS.tarp.steps[0].kind).toBe('press');
  });

  it('draining the fuel clears the fouling, or leaves some if it was botched', () => {
    const engine = { fouling: 0.4, params: {} };
    const job = new BenchJob('fuel');
    finishJob(job, { engine }, undefined);
    expect(engine.fouling).toBe(0);
    job.flaws.push({ step: 'flush', how: 'over' });
    finishJob(job, { engine }, undefined);
    expect(engine.fouling).toBeGreaterThan(0);
  });
});

describe('draining the tank', () => {
  it('empties it, oil and all, so it has to be filled again', () => {
    const fuel = new FuelSystem({ ...DEFAULT_FUEL_PARAMS, startLitres: 2, startOil: 0.02 });
    expect(fuel.litres).toBeGreaterThan(0);
    finishJob(new BenchJob('fuel'), { engine: { fouling: 0, params: {} }, fuel });
    expect(fuel.litres).toBe(0);
    expect(fuel.bowl).toBe(0);
    expect(fuel.oil).toBe(0);
    fuel.add(1, 0.02);
    expect(fuel.litres).toBe(1);
    expect(fuel.oil).toBeCloseTo(0.02);
  });
});

describe('the engine and a barn find that is not ready', () => {
  function seededRandom(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function crankFor(blocked) {
    const e = new EngineModel({ ...QUAD_SPECS[0].engine, initialTemperature: 1 }, { random: seededRandom(3) });
    e.setIgnition(true);
    e.startBlocked = blocked;
    for (let i = 0; i < 60 * 12 && !e.isRunning; i++) e.update(1 / 60, { starter: true });
    return e.isRunning;
  }

  it('cranks without catching while blocked, and catches once it is not', () => {
    expect(crankFor(true)).toBe(false);
    expect(crankFor(false)).toBe(true);
  });
});

describe('the old bike\'s restoration', () => {
  const spec = { id: 'plover', classicBike: true, engine: { noStarter: true } };
  it('is always there, with four or five of its own jobs, never the battery', async () => {
    const { pickClassicFind, CLASSIC_JOBS, DEFAULT_BARN_FIND_PARAMS: P } = await import('../src/vehicle/barnFind.js');
    for (let i = 0; i < 40; i++) {
      let n = i + 1;
      const random = () => ((n = (n * 16807) % 2147483647) / 2147483647);
      const plan = pickClassicFind(random, spec, P);
      expect(plan.donor).toBe(spec);
      expect(plan.jobs.length).toBeGreaterThanOrEqual(P.classicMinJobs);
      expect(plan.jobs.length).toBeLessThanOrEqual(P.classicMaxJobs);
      expect(plan.jobs).not.toContain('battery');
      expect(plan.jobs.every((k) => CLASSIC_JOBS.includes(k))).toBe(true);
      expect(plan.jobs).toEqual(CLASSIC_JOBS.filter((k) => plan.jobs.includes(k))); // in the bench's order
    }
  });
  it('holds the kickstart seized until its job is done, and says what is wrong', async () => {
    const { BarnFind, DEFAULT_BARN_FIND_PARAMS: P } = await import('../src/vehicle/barnFind.js');
    const find = new BarnFind({ donor: spec, jobs: ['points', 'kick'] }, P);
    find.finish('tarp');
    expect(find.kickSeized).toBe(true);
    expect(find.blockedReason()).toMatch(/points/);
    find.finish('points');
    expect(find.blockedReason()).toMatch(/kickstart/);
    find.finish('kick');
    expect(find.kickSeized).toBe(false);
    expect(find.ready).toBe(true);
  });
});
