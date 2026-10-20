import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_BLEED_PARAMS as P, BLEED_PARAM_RANGES, runsDry, stepBleed, airText } from '../src/vehicle/bleeding.js';

describe('bleeding a diesel', () => {
  it('has a range for every param', () => {
    expect(Object.keys(BLEED_PARAM_RANGES).sort()).toEqual(Object.keys(P).sort());
  });

  it('runs dry only when turned over with nothing in the bowl', () => {
    expect(runsDry(0, true)).toBe(true);
    expect(runsDry(0, false)).toBe(false);
    expect(runsDry(0.5, true)).toBe(false);
  });

  it('is bled by holding the lever for bleedSeconds, and needs fuel to push', () => {
    let air = 1;
    for (let t = 0; t < P.bleedSeconds - 0.5; t += 0.1) air = stepBleed(air, 0.1, { pumping: true }, P);
    expect(air).toBeGreaterThan(0);
    for (let t = 0; t < 1; t += 0.1) air = stepBleed(air, 0.1, { pumping: true }, P);
    expect(air).toBe(0);
    expect(stepBleed(1, 5, { pumping: true, hasFuel: false }, P)).toBe(1);
    expect(stepBleed(0.6, 5, { pumping: false }, P)).toBe(0.6);
  });

  it('says how it looks', () => {
    expect(airText(0)).toBe('bled');
    expect(airText(1)).toBe('air in the line');
  });
});

const diesel = (airLock) => {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const e = new EngineModel({ compressionIgnition: true, runsOnDiesel: true }, { random });
  e.setTemperature(1);
  e.setIgnition(true);
  e.update(0.05, { airLock });
  return e;
};
const tryStart = (e, airLock) => {
  for (let t = 0; t < 8 && !e.isRunning; t += 0.05) e.update(0.05, { starter: true, airLock });
  return e.isRunning;
};

describe('a diesel with air in the line', () => {
  it('starts when bled and not when it has air in', () => {
    expect(tryStart(diesel(0), 0)).toBe(true);
    expect(tryStart(diesel(1), 1)).toBe(false);
  });

  it('cuts out if the air gets in while it runs', () => {
    const e = diesel(0);
    tryStart(e, 0);
    expect(e.isRunning).toBe(true);
    for (let t = 0; t < 1; t += 0.05) e.update(0.05, { airLock: 1 });
    expect(e.isRunning).toBe(false);
  });

  it('is only a diesel thing', () => {
    const e = new EngineModel({});
    e.update(0.05, { airLock: 1 });
    expect(e.airLock).toBe(0);
  });
});
