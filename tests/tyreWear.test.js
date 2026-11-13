import { describe, it, expect } from 'vitest';
import { TyreSet, newTyres, TYRE_SIZES, TYRE_SIZE_IDS, tyrePart, DEFAULT_TYRE_PARAMS as P } from '../src/vehicle/tyres.js';
import { DEFAULT_TUNE_PARAMS as T } from '../src/vehicle/tuneUp.js';
import { QUAD_SPECS, EXTRA_SPECS, HARTLEY_SPEC, YAK_SPEC, TOR_SPEC, CRAG_SPEC, FINCH_SPEC, GRIFFIN_SPEC } from '../src/vehicle/quadSpecs.js';
import { Faults, DEFAULT_FAULT_PARAMS } from '../src/vehicle/faults.js';
import { Spares, DEFAULT_SPARES_PARAMS, PARTS, PART_IDS, TYRE_IDS, ALL_PART_IDS } from '../src/workshop/spares.js';
import { BenchJob, finishJob, tyreJobFor, jobPart, JOBS, DEFAULT_BENCH_PARAMS } from '../src/workshop/benchJobs.js';
import { treadTyre, wornTyre, wearLook, outerRadius } from '../src/vehicle/detail/tread.js';
import { fixEverything, problemSummary } from '../src/debug/vehicleDebug.js';

const fresh = () => new TyreSet(newTyres(T.stockPsi), P, T);

describe('tread wear', () => {
  it('wears with distance, more on tarmac, less in mud, more on a driven wheel', () => {
    const lost = (o) => {
      const t = fresh();
      t.wearWheel(0, { metres: 1000, ...o });
      return 1 - t.tread.front;
    };
    const grass = lost({});
    expect(grass).toBeGreaterThan(0);
    expect(lost({ tarmac: 1 })).toBeCloseTo(grass * P.wearTarmac, 6);
    expect(lost({ mud: 1 })).toBeLessThan(grass);
    expect(lost({ driven: true })).toBeGreaterThan(grass);
  });

  it('wheelspin wears a driven wheel and a free one not at all', () => {
    const t = fresh();
    t.wearWheel(2, { spin: 1, seconds: 10, driven: true });
    expect(t.tread.rear).toBeLessThan(1);
    const free = fresh();
    free.wearWheel(0, { spin: 1, seconds: 10, driven: false });
    expect(free.tread.front).toBe(1);
  });

  it('a four-wheeler shares an axle between its two tyres, a bike gives its one tyre all of it', () => {
    const quad = fresh();
    quad.wearWheel(0, { metres: 1000 });
    quad.wearWheel(1, { metres: 1000 });
    const bike = fresh();
    bike.useLayout([{ x: 0, front: true }, { x: 0, front: false }]);
    bike.wearWheel(0, { metres: 1000 });
    expect(1 - bike.tread.front).toBeCloseTo(1 - quad.tread.front, 6);
  });

  it('wears out in about fifteen kilometres of grass and never goes below bald', () => {
    const t = fresh();
    for (let i = 0; i < 40; i++) for (const w of [0, 1]) t.wearWheel(w, { metres: 1000 });
    expect(t.tread.front).toBe(0);
    const half = fresh();
    for (let i = 0; i < 7; i++) for (const w of [0, 1]) half.wearWheel(w, { metres: 1000 });
    expect(half.tread.front).toBeGreaterThan(0.4);
    expect(half.tread.front).toBeLessThan(0.7); // (a front wheel only rolls: 0.7 of the wear)
  });

  it('picks the more worn axle, and fitting new ones restores it and says how many tyres', () => {
    const t = fresh();
    t.tread = { front: 0.8, rear: 0.3 };
    expect(t.worstAxle).toBe('rear');
    expect(t.wantsNew).toBe(true);
    expect(t.replace('rear')).toBe(2);
    expect(t.tread.rear).toBe(1);
    t.tread = { front: 1, rear: 1 };
    expect(t.wantsNew).toBe(false);
  });

  it('makes a puncture more likely as the worst axle goes bald', () => {
    const t = fresh();
    expect(t.punctureFactor).toBe(1);
    t.tread.rear = 0;
    expect(t.punctureFactor).toBe(P.baldPuncture);
    const starts = (factor) => {
      let n = 0;
      for (let seed = 1; seed <= 400; seed++) {
        let s = seed;
        const f = new Faults({ ...DEFAULT_FAULT_PARAMS }, () => ((s = (s * 16807) % 2147483647) / 2147483647));
        for (let i = 0; i < 300 && !f.started.puncture; i++) f.update(1, { running: true, speed: 5, throttle: 0.3, punctureFactor: factor });
        if (f.started.puncture) n++;
      }
      return n;
    };
    expect(starts(3)).toBeGreaterThan(starts(1));
  });

  it('reads out for the gauge, leaving out an axle with no tyres', () => {
    const t = fresh();
    t.tread = { front: 0.82, rear: 0.3 };
    expect(t.treadText()).toBe('Front 82%   Rear 30%');
  });
});

describe('tyre sizes', () => {
  const specs = [...QUAD_SPECS, ...EXTRA_SPECS, HARTLEY_SPEC, YAK_SPEC, TOR_SPEC, CRAG_SPEC, FINCH_SPEC, GRIFFIN_SPEC];

  it('every vehicle names a size the rack stocks', () => {
    for (const s of specs) expect(TYRE_SIZE_IDS, s.id).toContain(s.tyreSize);
  });

  it('every size is a part the shelf counts, orders and starts with', () => {
    expect(TYRE_IDS).toHaveLength(TYRE_SIZE_IDS.length);
    for (const size of TYRE_SIZE_IDS) {
      expect(PARTS[tyrePart(size)].many).toBe(TYRE_SIZES[size].many);
      expect(DEFAULT_SPARES_PARAMS[`start${tyrePart(size)[0].toUpperCase()}${tyrePart(size).slice(1)}`]).toBeTypeOf('number');
    }
    expect(PART_IDS).toHaveLength(5);
    expect(ALL_PART_IDS).toHaveLength(5 + 1 + TYRE_SIZE_IDS.length); // the rack's five, the toolbox's tyre plugs, the tyres
    const s = new Spares({ ...DEFAULT_SPARES_PARAMS }, () => 0.5);
    expect(s.count('tyreQuad')).toBe(4);
    expect(s.order('tyreQuad').ok).toBe(true);
    expect(s.ordered.tyreQuad).toBe(2);
    s.deliver();
    s.collect();
    expect(s.count('tyreQuad')).toBe(6);
    const restored = new Spares({ ...DEFAULT_SPARES_PARAMS }, () => 0.5);
    restored.restore(s.toJSON());
    expect(restored.count('tyreQuad')).toBe(6);
  });
});

describe('fitting new tyres at the bench', () => {
  const worn = () => {
    const t = fresh();
    t.tread = { front: 0.9, rear: 0.2 };
    return t;
  };

  it('is only offered for worn tyres, and costs the worn axle\'s tyres of the vehicle\'s size', () => {
    expect(tyreJobFor(fresh(), 'quad')).toBeNull();
    expect(tyreJobFor(worn(), 'quad')).toEqual({ part: 'tyreQuad', count: 2, axle: 'rear' });
    const bike = worn();
    bike.useLayout([{ x: 0, front: true }, { x: 0, front: false }]);
    expect(tyreJobFor(bike, 'kid').count).toBe(1);
    expect(jobPart('newTyres', 'car')).toBe('tyreCar');
  });

  const run = (job) => {
    const events = [];
    while (!job.done) {
      const step = job.step;
      if (step.kind === 'press') events.push(...job.press());
      else {
        job.startHold();
        events.push(...job.update(step.limit ? step.need * 1.1 : step.need + 0.1));
        if (!job.done && job.step === step) events.push(...job.releaseHold());
      }
      if (events.some((e) => e.type === 'noPart')) break;
    }
    return events;
  };

  it('uses up the tyres from the shelf and puts the worn axle right', () => {
    const spares = new Spares({ ...DEFAULT_SPARES_PARAMS }, () => 0.5);
    const tyres = worn();
    const info = tyreJobFor(tyres, 'quad');
    const job = new BenchJob('newTyres', DEFAULT_BENCH_PARAMS, spares, info);
    run(job);
    expect(job.done).toBe(true);
    expect(spares.count('tyreQuad')).toBe(2);
    const faults = new Faults({ ...DEFAULT_FAULT_PARAMS }, () => 0.3);
    const msg = finishJob(job, { engine: {}, faults, fuel: {}, tyres }, DEFAULT_BENCH_PARAMS);
    expect(msg).toContain('New tyres');
    expect(tyres.tread.rear).toBe(1);
    expect(tyres.tread.front).toBe(0.9);
  });

  it('stops with no part if the rack is short', () => {
    const spares = new Spares({ ...DEFAULT_SPARES_PARAMS, startTyreQuad: 1 }, () => 0.5);
    const job = new BenchJob('newTyres', DEFAULT_BENCH_PARAMS, spares, tyreJobFor(worn(), 'quad'));
    const events = run(job);
    expect(events.some((e) => e.type === 'noPart' && e.part === 'tyreQuad')).toBe(true);
    expect(spares.count('tyreQuad')).toBe(1);
    expect(JOBS.newTyres.steps.length).toBeGreaterThanOrEqual(4);
  });
});

describe('worn tyre geometry', () => {
  it('wears by looks, from new to bald', () => {
    expect([1, 0.8, 0.7, 0.6, 0.4, 0.3, 0.15, 0.1, 0].map(wearLook)).toEqual([0, 0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('makes the same tyre with its lugs worn down, once, and never taller than the new one', () => {
    for (const kind of ['atv', 'farm', 'tractor', 'allTerrain', 'trike']) {
      const geo = treadTyre(kind, { radius: 0.3, width: 0.2, rimR: 0.16, count: 12, segments: 20 });
      expect(wornTyre(geo, 0)).toBe(geo);
      const half = wornTyre(geo, 2);
      expect(wornTyre(geo, 2)).toBe(half);
      expect(wornTyre(half, 0)).toBe(geo);
      const bald = wornTyre(geo, 3);
      expect(outerRadius(geo)).toBeCloseTo(0.3, 3);
      expect(outerRadius(half)).toBeLessThan(outerRadius(geo) - 0.001);
      expect(outerRadius(bald)).toBeLessThan(outerRadius(half));
      expect(bald.attributes.position.count).toBe(geo.attributes.position.count);
    }
  });

  it('leaves a geometry it did not make alone', () => {
    const other = { userData: {} };
    expect(wornTyre(other, 3)).toBe(other);
  });
});

describe('the debug panel', () => {
  it('puts the tread right and lists bald tyres as a problem', () => {
    const t = fresh();
    t.tread = { front: 0.9, rear: 0.05 };
    const u = { engine: { wear: 0, battery: 1 }, quad: { tyres: t, startTrouble: 0, faults: new Faults(), quirks: { tapStiff: 0 }, fuel: { litres: 5, water: 0, sediment: 0, wax: 0, clearWater() {} }, brakes: { wet: 0, fix() {} }, iceCable: { frozen: false, fix() {} }, carbIce: { icing: false, fix() {} } } };
    expect(problemSummary(u)).toContain('bald tyres');
    fixEverything(u);
    expect(t.tread).toEqual({ front: 1, rear: 1 });
    expect(problemSummary(u)).not.toContain('bald');
  });
});
