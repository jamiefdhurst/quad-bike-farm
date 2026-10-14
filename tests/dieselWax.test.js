import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';
import { FuelSystem, DEFAULT_FUEL_PARAMS } from '../src/vehicle/fuelSystem.js';
import { doseStep } from '../src/items/antiGelBottle.js';
import { DEFAULT_DIESEL_WAX_PARAMS as P, DIESEL_WAX_PARAM_RANGES, waxWeather, dealWax, stepWax, pourAntiGel, waxText } from '../src/vehicle/dieselWax.js';

const run = (wax, seconds, ctx) => {
  for (let i = 0; i < seconds; i++) wax = stepWax(wax, 1, ctx, P);
  return wax;
};

describe('diesel waxing', () => {
  it('has a range for every param', () => {
    expect(Object.keys(DIESEL_WAX_PARAM_RANGES).sort()).toEqual(Object.keys(P).sort());
  });

  it('needs a hard frost', () => {
    expect(waxWeather(0)).toBe(0);
    expect(waxWeather(P.waxBelow)).toBe(0);
    expect(waxWeather(P.waxFull)).toBe(1);
    expect(waxWeather(-30)).toBe(1);
    expect(waxWeather(-4)).toBeCloseTo(0.5);
  });

  it('builds on a vehicle stood out in a hard frost, and not on a mild day', () => {
    expect(run(0, 900, { temperature: -6 })).toBeGreaterThan(0.9);
    expect(run(0, 900, { temperature: 4 })).toBe(0);
  });

  it('never builds in the barn, and melts there', () => {
    expect(run(0, 900, { temperature: -6, covered: true })).toBe(0);
    expect(run(0.8, 300, { temperature: -6, covered: true })).toBeLessThan(0.2);
  });

  it('is cleared by a warm running engine, which a cold one does slower', () => {
    const warm = run(0.8, 60, { temperature: -4, running: true, engineTemp: 1 });
    const cold = run(0.8, 60, { temperature: -4, running: true, engineTemp: 0 });
    expect(warm).toBeLessThan(cold);
    expect(warm).toBeLessThan(0.8);
  });

  it('is stopped and dissolved by anti-gel, but a weak dose does nothing', () => {
    expect(run(0, 900, { temperature: -6, antiGel: 1 })).toBe(0);
    expect(run(0.9, 60, { temperature: -6, antiGel: 1 })).toBeLessThan(0.5);
    expect(run(0, 900, { temperature: -6, antiGel: P.antiGelEffect - 0.05 })).toBeGreaterThan(0.9);
  });

  it('deals a partly waxed start only to a diesel left out in a hard frost', () => {
    expect(dealWax(() => 0.1, -6, false)).toBeGreaterThan(0.4);
    expect(dealWax(() => 0.1, -6, true)).toBe(0);
    expect(dealWax(() => 0.1, 5, false)).toBe(0);
    expect(dealWax(() => 0.99, -6, false)).toBe(0);
  });

  it('pours anti-gel up to full and says how it looks', () => {
    expect(pourAntiGel(0.9, 10, 0.1)).toBe(1);
    expect(waxText(0)).toBe('clear');
    expect(waxText(1)).toBe('waxed solid');
  });
});

const diesel = (wax) => {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const e = new EngineModel({ compressionIgnition: true, runsOnDiesel: true }, { random });
  e.setTemperature(1);
  e.setIgnition(true);
  e.update(0.05, { wax });
  return e;
};
const tryStart = (e, wax) => {
  for (let t = 0; t < 8 && !e.isRunning; t += 0.05) e.update(0.05, { starter: true, wax });
  return e.isRunning;
};

describe('waxed diesel in the engine', () => {
  it('starts when clear and will not when solid', () => {
    expect(tryStart(diesel(0), 0)).toBe(true);
    expect(tryStart(diesel(1), 1)).toBe(false);
  });

  it('loses power and cuts out when waxed', () => {
    const clear = diesel(0);
    tryStart(clear, 0);
    clear.update(0.05, { throttle: 1, wax: 0 });
    const waxed = diesel(0);
    tryStart(waxed, 0);
    waxed.update(0.05, { throttle: 1, wax: 0.9 });
    expect(waxed.power).toBeLessThan(clear.power);
    let stalled = false;
    for (let t = 0; t < 120 && !stalled; t += 0.05) {
      waxed.update(0.05, { throttle: 0.4, wax: 1 });
      stalled = !waxed.isRunning;
    }
    expect(stalled).toBe(true);
  });

  it('is ignored by a petrol engine', () => {
    const e = new EngineModel({}, { random: () => 0.5 });
    e.update(0.05, { wax: 1 });
    expect(e.wax).toBe(0);
  });
});

describe('anti-gel in the tank', () => {
  const tank = (litres = 5) => Object.assign(new FuelSystem({ ...DEFAULT_FUEL_PARAMS }), { litres });
  const dieselEngine = { params: { compressionIgnition: true } };

  it('doses a diesel tank up to full, and says why not otherwise', () => {
    const f = tank();
    expect(doseStep(f, dieselEngine, 1)).toBe('pouring');
    expect(f.antiGel).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) doseStep(f, dieselEngine, 1);
    expect(doseStep(f, dieselEngine, 1)).toBe('full');
    expect(doseStep(tank(), { params: {} }, 1)).toBe('petrol');
    expect(doseStep(tank(0), dieselEngine, 1)).toBe('empty');
  });

  it('thins out when topped up with untreated diesel', () => {
    const f = tank(5);
    f.antiGel = 1;
    f.add(5, 0, 1);
    expect(f.antiGel).toBeCloseTo(0.5, 1);
  });
});
