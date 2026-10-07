import { describe, it, expect } from 'vitest';
import { QUAD_SPECS, EXTRA_SPECS, TRACTOR_SPEC } from '../src/vehicle/quadSpecs.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { DEFAULT_VEHICLE_PARAMS } from '../src/vehicle/vehicleParams.js';
import { DEFAULT_FUEL_PARAMS } from '../src/vehicle/fuelSystem.js';
import { applyIdle, applyTopRpm } from '../src/vehicle/quadVariation.js';
import { DEFAULT_TUNE_PARAMS as P, captureStock, stockSettings, nudge, applyTune, limits } from '../src/vehicle/tuneUp.js';
import { createRandom } from '../src/core/random.js';

const ALL = [...QUAD_SPECS, ...EXTRA_SPECS, TRACTOR_SPEC];
const engineFor = (spec) => ({ ...DEFAULT_ENGINE_PARAMS, ...spec.engine });

describe('top rpm each game', () => {
  it('every vehicle has a range around its own top revs, with the redline inside it', () => {
    for (const spec of ALL) {
      const e = engineFor(spec);
      expect(spec.topRpmRange, spec.id).toBeTruthy();
      const [lo, hi] = spec.topRpmRange;
      expect(lo, spec.id).toBeLessThan(hi);
      expect(e.maxRpm, spec.id).toBeGreaterThanOrEqual(lo);
      expect(e.maxRpm, spec.id).toBeLessThanOrEqual(hi);
      expect(e.redlineRpm, spec.id).toBeLessThan(lo);
    }
  });

  it('picks within the range, keeps the redline gap, and repeats for a seed', () => {
    for (const spec of ALL) {
      const gap = engineFor(spec).maxRpm - engineFor(spec).redlineRpm;
      for (let seed = 1; seed <= 20; seed++) {
        const a = engineFor(spec);
        const b = engineFor(spec);
        const top = applyTopRpm(spec, a, createRandom(seed));
        applyTopRpm(spec, b, createRandom(seed));
        expect(top).toBeGreaterThanOrEqual(spec.topRpmRange[0]);
        expect(top).toBeLessThanOrEqual(spec.topRpmRange[1]);
        expect(a.maxRpm - a.redlineRpm).toBe(gap);
        expect(b.maxRpm).toBe(a.maxRpm);
      }
    }
  });

  it('gives different seeds different tops', () => {
    const spec = QUAD_SPECS[0];
    const tops = new Set();
    for (let seed = 1; seed <= 20; seed++) tops.add(applyTopRpm(spec, engineFor(spec), createRandom(seed)));
    expect(tops.size).toBeGreaterThan(3);
  });

  it('leaves a spec without a range alone', () => {
    const e = engineFor({});
    expect(applyTopRpm({}, e, createRandom(1))).toBe(DEFAULT_ENGINE_PARAMS.maxRpm);
    expect(e.redlineRpm).toBe(DEFAULT_ENGINE_PARAMS.redlineRpm);
  });
});

describe('the rev limiter in the toolbox', () => {
  function target(spec = QUAD_SPECS[0]) {
    const t = {
      engine: engineFor(spec),
      vehicle: { ...DEFAULT_VEHICLE_PARAMS, ...spec.vehicle },
      fuel: { ...DEFAULT_FUEL_PARAMS, ...spec.fuel },
      smoke: { warmDensity: 0.2 },
      spec,
    };
    applyTopRpm(spec, t.engine, createRandom(7));
    applyIdle(t.engine, t.vehicle, spec.idleRange[0]);
    return t;
  }

  it('starts at this game\'s top revs and moves them, and the redline, by a step a click', () => {
    const t = target();
    const stock = captureStock(t);
    const top = t.engine.maxRpm;
    const gap = top - t.engine.redlineRpm;
    let s = nudge(stockSettings(stock), 'revs', 1, stock);
    expect(s.revs).toBe(1);
    applyTune(t, stock, s);
    expect(t.engine.maxRpm).toBe(top + P.revStep);
    expect(t.engine.maxRpm - t.engine.redlineRpm).toBe(gap);
    s = nudge(nudge(s, 'revs', -1, stock), 'revs', -1, stock);
    applyTune(t, stock, s);
    expect(t.engine.maxRpm).toBe(top - P.revStep);
  });

  it('stops at its limits and puts stock back exactly', () => {
    const t = target(QUAD_SPECS[1]);
    const stock = captureStock(t);
    const before = JSON.stringify(t.engine);
    let s = stockSettings(stock);
    for (let i = 0; i < 10; i++) s = nudge(s, 'revs', 1, stock);
    expect(s.revs).toBe(P.revUpClicks);
    expect(limits('revs', s, stock)).toEqual([-P.revDownClicks, P.revUpClicks, 1]);
    applyTune(t, stock, s);
    applyTune(t, stock, stockSettings(stock));
    expect(JSON.stringify(t.engine)).toBe(before);
  });

  it('adds to the throttle stop rather than fighting it', () => {
    const t = target();
    const stock = captureStock(t);
    applyTune(t, stock, { ...stockSettings(stock), limiter: 3, revs: 2 });
    expect(t.engine.maxRpm).toBe(Math.round(stock.engine.maxRpm * (1 + P.limiterRpm * 3)) + 2 * P.revStep);
  });
});
