import { describe, it, expect } from 'vitest';
import { CarbIcing, icingWeather, DEFAULT_CARB_ICE_PARAMS, CARB_ICE_PARAM_RANGES } from '../src/vehicle/carbIcing.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';

const cold = { running: true, throttle: 0.4, revs: 0.4, temperature: 5, damp: 0.8, engineTemp: 0.5 };
const run = (c, seconds, state) => {
  for (let t = 0; t < seconds; t += 0.1) c.update(0.1, state);
};

describe('carb icing', () => {
  it('has a range for every tunable', () => {
    expect(Object.keys(CARB_ICE_PARAM_RANGES).sort()).toEqual(Object.keys(DEFAULT_CARB_ICE_PARAMS).sort());
  });

  it('wants cold and damp: not a warm day, a dry one or a hard frost', () => {
    expect(icingWeather(5, 0.8)).toBeGreaterThan(0.7);
    expect(icingWeather(20, 0.8)).toBe(0);
    expect(icingWeather(5, 0.05)).toBe(0);
    expect(icingWeather(-8, 0.8)).toBe(0);
    expect(icingWeather(11, 0.8)).toBeLessThan(icingWeather(5, 0.8));
  });

  it('builds at a steady part throttle on a cold, damp day', () => {
    const c = new CarbIcing();
    run(c, 40, cold);
    expect(c.ice).toBeGreaterThan(0.6);
    expect(c.icing).toBe(true);
  });

  it('does not build on a mild or dry day, at idle, or flat out', () => {
    for (const state of [{ ...cold, temperature: 18 }, { ...cold, damp: 0 }, { ...cold, throttle: 0 }, { ...cold, throttle: 1 }]) {
      const c = new CarbIcing();
      run(c, 60, state);
      expect(c.ice).toBe(0);
    }
  });

  it('does not build while the throttle is being worked', () => {
    const c = new CarbIcing();
    for (let i = 0; i < 400; i++) c.update(0.1, { ...cold, throttle: i % 2 ? 0.2 : 0.6 });
    expect(c.ice).toBe(0);
  });

  it('a blip breaks it off', () => {
    const c = new CarbIcing();
    c.update(0.05, { ...cold, throttle: 0.4 });
    c.ice = 0.8;
    c.update(0.05, { ...cold, throttle: 0.9 });
    expect(c.ice).toBeCloseTo(0.3);
    expect(c.blipped).toBe(true);
  });

  it('stopping to idle, or switching off, melts it', () => {
    const idling = new CarbIcing();
    idling.ice = 0.8;
    run(idling, 20, { ...cold, throttle: 0 });
    expect(idling.ice).toBeLessThan(0.1);
    const off = new CarbIcing();
    off.ice = 0.8;
    run(off, 30, { ...cold, running: false });
    expect(off.ice).toBeLessThan(0.1);
  });

  it('a diesel never ices, and fix clears it', () => {
    const d = new CarbIcing(DEFAULT_CARB_ICE_PARAMS, false);
    run(d, 60, cold);
    expect(d.ice).toBe(0);
    const c = new CarbIcing();
    c.ice = 1;
    c.fix();
    expect(c.ice).toBe(0);
  });

  it('costs the engine power', () => {
    const power = (ice) => {
      const e = new EngineModel({ ...DEFAULT_ENGINE_PARAMS });
      e.update(0.016, { throttle: 0.5, ice });
      return e.power;
    };
    expect(power(1)).toBeLessThan(power(0));
  });
});
