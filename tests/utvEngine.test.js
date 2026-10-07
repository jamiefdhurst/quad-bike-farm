import { describe, it, expect } from 'vitest';
import { contaminant, stepDieselSoak } from '../src/engine/diesel.js';
import { reverseAllowed, REVERSE_STYLES } from '../src/vehicle/controls.js';
import { UTV_SPEC, TRACTOR_SPEC, QUAD_SPECS } from '../src/vehicle/quadSpecs.js';
import { DASH_STYLES } from '../src/vehicle/dash.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { FuelSystem, DEFAULT_FUEL_PARAMS } from '../src/vehicle/fuelSystem.js';
import { LAYOUT } from '../src/world/layout.js';

const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const P = { ...DEFAULT_ENGINE_PARAMS };

describe('what soaks an engine', () => {
  it('is diesel in a petrol engine, petrol in a fussy diesel, and nothing in the tractor', () => {
    expect(contaminant({ ...P }, 0.3)).toBeCloseTo(0.3, 5);
    expect(contaminant({ ...P, runsOnDiesel: true, petrolFussy: true }, 0.8)).toBeCloseTo(0.2, 5);
    expect(contaminant({ ...P, runsOnDiesel: true, petrolFussy: true }, 1)).toBe(0);
    expect(contaminant({ ...P, runsOnDiesel: true }, 0.2)).toBe(0);
  });

  it('soaks the UTV once a tankful has petrol in it, and not on clean diesel', () => {
    const p = { ...P, ...UTV_SPEC.engine };
    let soak = 0;
    for (let i = 0; i < 4000; i++) soak = stepDieselSoak(soak, 0.05, { diesel: contaminant(p, 1), active: true }, p);
    expect(soak).toBe(0);
    for (let i = 0; i < 4000; i++) soak = stepDieselSoak(soak, 0.05, { diesel: contaminant(p, 0.8), active: true }, p);
    expect(soak).toBeCloseTo(0.2 * p.dieselPotency, 3); // a fifth petrol: past the stalling point
    expect(soak).toBeGreaterThan(p.dieselStallAt - 0.01);
  });

  it('pours petrol into the UTV tank and the share is right', () => {
    const fuel = new FuelSystem({ ...DEFAULT_FUEL_PARAMS, ...UTV_SPEC.fuel });
    fuel.setLitres(10);
    expect(fuel.diesel).toBe(1);
    fuel.add(5, 0, 0); // petrol
    expect(fuel.diesel).toBeCloseTo(10 / 15, 5);
  });
});

describe('the UTV engine', () => {
  const make = (spec = UTV_SPEC) => new EngineModel({ ...P, ...spec.engine, initialTemperature: 0.9 }, { random: seeded(5) });
  const crank = (e, seconds = 6) => {
    for (let t = 0; t < seconds && !e.isRunning; t += 1 / 60) e.update(1 / 60, { starter: true, fuel: 1, diesel: 1 });
  };
  const settle = (e, seconds, controls = {}) => {
    for (let t = 0; t < seconds; t += 1 / 60) e.update(1 / 60, { fuel: 1, diesel: 1, ...controls });
  };
  const started = (spec) => {
    const e = make(spec);
    e.setIgnition(true);
    crank(e);
    settle(e, 2);
    return e;
  };

  it('starts on the starter, and runs', () => {
    expect(started().isRunning).toBe(true);
  });

  it('is stopped by the key, unlike the tractor, which carries on until its knob is pulled', () => {
    const e = started();
    e.setIgnition(false);
    settle(e, 3);
    expect(e.isRunning).toBe(false);
    const t = started(TRACTOR_SPEC);
    t.setIgnition(false);
    settle(t, 3);
    expect(t.isRunning).toBe(true);
  });

  it('runs badly on petrol and will not run on a half and half mix', () => {
    const e = started();
    settle(e, 60, { diesel: 0.5 });
    expect(e.dieselSoak).toBeGreaterThan(0.45);
    expect(e.isRunning).toBe(false); // it stalled, and a stalled one will not catch again
  });

  it('runs on clean diesel for as long as you like', () => {
    const e = started();
    settle(e, 60, { diesel: 1 });
    expect(e.dieselSoak).toBe(0);
    expect(e.isRunning).toBe(true);
  });
});

describe('the UTV spec', () => {
  it('names a dash that exists and a reverse style that exists, and is parked on the farm', () => {
    expect(DASH_STYLES).toContain(UTV_SPEC.dashStyle);
    expect(REVERSE_STYLES).toContain(UTV_SPEC.reverseStyle);
    expect(LAYOUT.utv).toMatchObject({ x: expect.any(Number), z: expect.any(Number), yaw: expect.any(Number) });
    expect(QUAD_SPECS.some((s) => s.id === UTV_SPEC.id)).toBe(false);
  });

  it('keeps its idle, redline and top revs in order', () => {
    const e = UTV_SPEC.engine;
    expect(UTV_SPEC.idleRange[0]).toBeGreaterThanOrEqual(UTV_SPEC.safeIdle);
    expect(e.idleRpmWarm).toBeLessThan(UTV_SPEC.idleRange[0] + 100);
    expect(e.redlineRpm).toBeLessThan(e.maxRpm);
    expect(UTV_SPEC.topRpmRange[0]).toBeLessThan(e.maxRpm + 100);
  });

  it('wants stopping for its dash lever', () => {
    expect(reverseAllowed('dashLever', { speed: 0.1 }).ok).toBe(true);
    const r = reverseAllowed('dashLever', { speed: 3 });
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/Stop first/);
  });
});
