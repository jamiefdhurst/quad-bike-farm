import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { airCharge, airPowerFactor, airMixture, airText } from '../src/engine/airDensity.js';
import { idealJet } from '../src/engine/jetting.js';
import { Weather } from '../src/world/weather.js';

const P = DEFAULT_ENGINE_PARAMS;
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

/** A warm engine, run on a day of `day` until it settles; returns it. */
function run(params, day) {
  const e = new EngineModel(params, { random: seeded(5) });
  e.setTemperature(1);
  e.setIgnition(true);
  for (let t = 0; t < 10 && !e.isRunning; t += 0.05) e.update(0.05, { starter: true, choke: 0.3, ...day });
  for (let t = 0; t < 5; t += 0.1) e.update(0.1, { throttle: 0.6, driveLoad: 0.6, ...day });
  return e;
}

describe('the day\'s air', () => {
  it('is nothing on the reference day', () => {
    expect(airCharge(P.jetRefCelsius, P.airRefDamp, P)).toBeCloseTo(0);
  });

  it('is dense when cold and dry, thin when warm and muggy', () => {
    expect(airCharge(-5, 0.2, P)).toBeGreaterThan(0.08);
    expect(airCharge(25, 0.9, P)).toBeLessThan(-0.08);
    expect(airCharge(12, 0.9, P)).toBeLessThan(airCharge(12, 0.2, P));
  });

  it('pulls harder and runs leaner past a fixed jet when dense, but not on injection, a diesel or a two-stroke', () => {
    expect(airPowerFactor(0.1, P)).toBeGreaterThan(1);
    expect(airPowerFactor(-0.1, P)).toBeLessThan(1);
    expect(airMixture(0.1, { ...P, strokes: 4 })).toBeLessThan(0);
    expect(airMixture(-0.1, { ...P, strokes: 4 })).toBeGreaterThan(0);
    expect(airMixture(0.1, { ...P, strokes: 4, injected: true })).toBe(0);
    expect(airMixture(0.1, { ...P, strokes: 4, compressionIgnition: true })).toBe(0);
    expect(airMixture(0.1, { ...P, strokes: 2 })).toBe(0);
  });

  it('gives a four-stroke more power and a leaner mixture on a cold dry day than a warm muggy one', () => {
    const cold = run({ strokes: 4 }, { dayTemp: -3, dayDamp: 0.2 });
    const muggy = run({ strokes: 4 }, { dayTemp: 24, dayDamp: 0.9 });
    expect(cold.power).toBeGreaterThan(muggy.power);
    expect(cold.mixture).toBeLessThan(muggy.mixture);
  });

  it('changes nothing on an engine given no damp and the reference temperature', () => {
    const plain = run({ strokes: 4 }, { dayTemp: 12 });
    expect(plain.air).toBeCloseTo(0);
  });

  it('wants a smaller jet on a damp day', () => {
    expect(idealJet(12, P, 0, 0.9)).toBeLessThan(idealJet(12, P, 0, 0.2));
    expect(idealJet(12, P)).toBe(0);
  });

  it('is damper with rain and wet ground', () => {
    const dry = new Weather('sunny', () => 0.5);
    const wet = new Weather('rain', () => 0.5);
    expect(wet.damp).toBeGreaterThan(dry.damp);
    expect(dry.damp).toBeLessThan(0.4);
    expect(airText(0.1)).toBe('cold, dense air');
    expect(airText(-0.1)).toBe('warm, thin air');
  });
});
