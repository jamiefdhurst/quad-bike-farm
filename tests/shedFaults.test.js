import { describe, it, expect } from 'vitest';
import { Faults, FAULT_KINDS, BENCH_ONLY_KINDS, DEFAULT_FAULT_PARAMS, FAULT_PARAM_RANGES, applyTyreFaults } from '../src/vehicle/faults.js';
import { TyreSet, newTyres } from '../src/vehicle/tyres.js';
import { SHED_KINDS, SHED_PIECE_OF, SHED_WHEEL_KINDS, DEFAULT_SHED_FAULT_PARAMS, SHED_FAULT_RANGES } from '../src/vehicle/shedFaults.js';

const seeded = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const make = () => {
  const f = new Faults({ ...DEFAULT_FAULT_PARAMS }, seeded());
  f.hasChain = true;
  f.hasSump = true;
  return f;
};
const run = (f, seconds, s) => {
  for (let t = 0; t < seconds; t += 0.5) f.update(0.5, s);
};

describe('the shed faults', () => {
  it('are twelve, four for each piece, and all in the fault list', () => {
    expect(SHED_KINDS).toHaveLength(12);
    for (const piece of ['compressor', 'washer', 'pit']) expect(SHED_KINDS.filter((k) => SHED_PIECE_OF[k] === piece)).toHaveLength(4);
    for (const k of SHED_KINDS) {
      expect(FAULT_KINDS).toContain(k);
      expect(BENCH_ONLY_KINDS).toContain(k);
    }
  });

  it('have a rate, a speed and a range for every tunable', () => {
    for (const k of Object.keys(DEFAULT_SHED_FAULT_PARAMS)) {
      expect(DEFAULT_FAULT_PARAMS[k]).toBe(DEFAULT_SHED_FAULT_PARAMS[k]);
      expect(SHED_FAULT_RANGES[k], k).toBeDefined();
      expect(FAULT_PARAM_RANGES[k]).toBeDefined();
    }
    for (const k of SHED_KINDS) {
      expect(DEFAULT_SHED_FAULT_PARAMS[`${k}Every`], k).toBeGreaterThan(0);
      expect(DEFAULT_SHED_FAULT_PARAMS[`${k}Seconds`], k).toBeGreaterThan(0);
    }
  });

  it('start with use, with no rough fix in the yard', () => {
    const f = make();
    run(f, 200000, { running: true, speed: 6, throttle: 0.5, temperature: 2 });
    for (const k of SHED_KINDS) expect(f.has(k), k).toBe(true);
    for (const k of SHED_KINDS) expect(f.fix(k, { rough: true }), k).toBe(false);
    for (const k of SHED_KINDS) expect(f.fix(k), k).toBe(true);
    expect(f.has('gasket')).toBe(false);
  });

  it('only start where they can: no chain grit without a chain, no gasket without a sump, no gum on a diesel', () => {
    const f = new Faults({ ...DEFAULT_FAULT_PARAMS }, seeded(7));
    f.prone.carb = 0;
    run(f, 200000, { running: true, speed: 6, throttle: 0.5, temperature: 12 });
    expect(f.has('chainGrit')).toBe(false);
    expect(f.has('gasket')).toBe(false);
    expect(f.has('carbGum')).toBe(false);
  });

  it('keep the cold morning to the cold: it never starts on a warm day, and a warm day lets it go', () => {
    const f = make();
    run(f, 100000, { running: false, speed: 0, throttle: 0, temperature: 20 });
    expect(f.has('tyreCold')).toBe(false);
    f.begin('tyreCold');
    run(f, 2000, { running: false, speed: 0, throttle: 0, temperature: 20 });
    expect(f.has('tyreCold')).toBe(false);
    expect(f.coldDrop).toBe(0);
  });

  it('pick a wheel for the wheel faults, and let go of it when put right', () => {
    const f = make();
    for (const k of SHED_WHEEL_KINDS) {
      f.begin(k);
      expect(f.wheelOf[k]).toBeGreaterThanOrEqual(0);
      f.fix(k);
      expect(f.wheelOf[k]).toBe(-1);
    }
  });

  it('do what they say', () => {
    const f = make();
    const base = f.driveFactor;
    f.begin('tapClog');
    f.levels.tapClog = 1;
    f.tapLoad = 1;
    expect(f.driveFactor).toBeLessThan(base);
    f.tapLoad = 0;
    expect(f.driveFactor).toBe(base); // only at full throttle
    f.begin('brakeMud');
    f.levels.brakeMud = 1;
    expect(f.brakeFactor).toBeCloseTo(1 - DEFAULT_SHED_FAULT_PARAMS.brakeMudFade);
    f.begin('carbGum');
    f.levels.carbGum = 1;
    expect(f.dirt).toBeCloseTo(DEFAULT_SHED_FAULT_PARAMS.carbGumDirt);
    f.begin('exhaustHole');
    f.levels.exhaustHole = 1;
    expect(f.exhaustLeak).toBeCloseTo(DEFAULT_SHED_FAULT_PARAMS.exhaustHoleLoud);
    f.begin('gasket');
    f.levels.gasket = 1;
    expect(f.gasketLoss(1, true)).toBeGreaterThan(0);
    expect(f.gasketLoss(1, false)).toBe(0);
    f.begin('tyreLeak');
    expect(f.tyreBleed).toBeGreaterThan(0);
    f.begin('valveCore');
    f.standing = true;
    expect(f.coreBleed).toBeGreaterThan(0);
    f.standing = false;
    expect(f.coreBleed).toBe(0); // it seeps while the vehicle stands
  });

  it('make a gritty chain stretch faster and sound drier', () => {
    const a = make();
    const b = make();
    b.begin('chainGrit');
    b.levels.chainGrit = 1;
    expect(b.chainDryness).toBeGreaterThan(a.chainDryness);
    run(a, 3000, { running: true, speed: 6, throttle: 0.3, temperature: 12 });
    run(b, 3000, { running: true, speed: 6, throttle: 0.3, temperature: 12 });
    expect(b.levels.chain).toBeGreaterThanOrEqual(a.levels.chain);
  });
});

describe('the shed faults on the tyres', () => {
  const sets = () => new TyreSet(newTyres(4));
  it('a slow leak bleeds every tyre, a little a second', () => {
    const t = sets();
    const f = make();
    f.begin('tyreLeak');
    f.levels.tyreLeak = 1;
    for (let i = 0; i < 600; i++) applyTyreFaults(t, f, 1);
    for (const v of t.psi) expect(v).toBeCloseTo(4 - 600 * DEFAULT_SHED_FAULT_PARAMS.tyreLeakBleed, 2);
  });

  it('a dud valve core bleeds only that wheel, and only while it stands', () => {
    const t = sets();
    const f = make();
    f.begin('valveCore');
    f.levels.valveCore = 1;
    const w = f.wheelOf.valveCore;
    f.standing = false;
    for (let i = 0; i < 100; i++) applyTyreFaults(t, f, 1);
    expect(t.psi[w]).toBe(4);
    f.standing = true;
    for (let i = 0; i < 100; i++) applyTyreFaults(t, f, 1);
    expect(t.psi[w]).toBeLessThan(4);
    for (let i = 0; i < 4; i++) if (i !== w) expect(t.psi[i]).toBe(4);
  });

  it('a cold morning puts a ceiling under stock on all four, and leaves higher pressures alone when it is gone', () => {
    const t = sets();
    t.psi = [5, 5, 5, 5];
    const f = make();
    applyTyreFaults(t, f, 1);
    expect(t.psi).toEqual([5, 5, 5, 5]); // no fault, no ceiling
    f.begin('tyreCold');
    f.levels.tyreCold = 1;
    applyTyreFaults(t, f, 1);
    for (const v of t.psi) expect(v).toBeCloseTo(4 - DEFAULT_SHED_FAULT_PARAMS.tyreColdDrop, 5);
    f.fix('tyreCold');
    t.level(4);
    applyTyreFaults(t, f, 1);
    expect(t.psi).toEqual([4, 4, 4, 4]);
  });

  it('the odd tyre sits lower than the other three, until it is put right', () => {
    const t = sets();
    const f = make();
    f.begin('tyreUneven');
    f.levels.tyreUneven = 1;
    const w = f.wheelOf.tyreUneven;
    applyTyreFaults(t, f, 1);
    expect(t.psi[w]).toBeCloseTo(4 - DEFAULT_SHED_FAULT_PARAMS.tyreUnevenDrop, 5);
    for (let i = 0; i < 4; i++) if (i !== w) expect(t.psi[i]).toBe(4);
  });

  it('never lets a tyre below the lowest the pump can let it down to', () => {
    const t = sets();
    const f = make();
    f.begin('tyreLeak');
    f.levels.tyreLeak = 1;
    f.params.tyreLeakBleed = 1;
    applyTyreFaults(t, f, 100);
    for (const v of t.psi) expect(v).toBe(t.P.ventMinPsi);
  });
});
