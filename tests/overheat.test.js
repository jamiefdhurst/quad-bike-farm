import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { radiatorEffect, pickThermostat, thermostatSticks, hotLevel, flushThermostat } from '../src/engine/coolant.js';
import { pourStep, DEFAULT_COOLANT_BOTTLE_PARAMS } from '../src/items/coolantBottle.js';
import { HARTLEY_SPEC, YAK_SPEC, TOR_SPEC, FINCH_SPEC, GRIFFIN_SPEC } from '../src/vehicle/quadSpecs.js';
import { tempGaugeFraction, WARM_AT, HOT_FROM } from '../src/vehicle/tempGauge.js';

const P = { ...DEFAULT_ENGINE_PARAMS, waterCooled: true };
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const make = (extra = {}) => new EngineModel({ ...extra, waterCooled: true }, { random: seeded(5) });

function start(e) {
  e.setTemperature(1);
  e.setIgnition(true);
  for (let t = 0; t < 10 && !e.isRunning; t += 0.05) e.update(0.05, { starter: true, choke: 0.3 });
}

/** Runs `seconds` with the same controls; true as soon as it stalls from heat. */
function drive(e, seconds, controls) {
  for (let t = 0; t < seconds; t += 0.5) {
    e.update(0.5, controls);
    if (e.events.some((x) => x.type === 'overheated')) return true;
  }
  return false;
}

describe('the gauge', () => {
  it('puts a warm engine in the middle and the red zone near the top', () => {
    expect(tempGaugeFraction(1)).toBe(0.5);
    expect(WARM_AT).toBe(0.5);
    expect(HOT_FROM).toBeGreaterThan(0.7);
  });
});

describe('which vehicles have a radiator', () => {
  it('gives every car, Tor, Crag, the UTV and the tractor one', () => {
    for (const spec of [HARTLEY_SPEC, YAK_SPEC, TOR_SPEC, FINCH_SPEC, GRIFFIN_SPEC]) expect(spec.engine.waterCooled, spec.id).toBe(true);
  });
});

describe('a healthy water-cooled engine', () => {
  it('idles all day in full sun without the needle leaving the middle band or any power loss', () => {
    const e = make();
    start(e);
    drive(e, 1800, { ambient: 1 });
    expect(e.hot).toBe(0);
    expect(tempGaugeFraction(e.temperature, true, e.gaugeHeat)).toBeLessThan(HOT_FROM);
    expect(e.isRunning).toBe(true);
  });

  it('copes with a heavy crawl too', () => {
    const e = make();
    start(e);
    expect(drive(e, 900, { ambient: 1, throttle: 1, driveLoad: 1, speed: 1 })).toBe(false);
    expect(e.hot).toBe(0);
  });
});

describe('a stuck thermostat', () => {
  it('runs the needle into the red idling in the sun, and loses power', () => {
    const e = make();
    e.thermostat = 1;
    start(e);
    drive(e, 1200, { ambient: 1 });
    expect(tempGaugeFraction(e.temperature, true, e.gaugeHeat)).toBeGreaterThan(HOT_FROM);
    expect(e.hot).toBeGreaterThan(0.2);
    expect(e.power).toBeLessThan(0.9);
  });

  it('stalls working hard in the sun, will not catch until cooled, then starts', () => {
    const e = make();
    e.thermostat = 1;
    start(e);
    expect(drive(e, 2400, { ambient: 1, throttle: 1, driveLoad: 1, speed: 1 })).toBe(true);
    expect(e.isRunning).toBe(false);
    expect(e.heatLocked).toBe(true);
    // Straight away it turns over and doesn't catch.
    for (let t = 0; t < 4; t += 0.05) e.update(0.05, { starter: true, ambient: 1 });
    expect(e.isRunning).toBe(false);
    e.setIgnition(false);
    drive(e, 400, { ambient: 1 });
    expect(e.heatLocked).toBe(false);
    for (let t = 0; t < 10 && !e.isRunning; t += 0.05) {
      e.setIgnition(true);
      e.update(0.05, { starter: true, choke: 0.3, ambient: 1 });
    }
    expect(e.isRunning).toBe(true);
  });

  it('takes the radiator down in proportion', () => {
    expect(radiatorEffect(1, 0, P)).toBe(1);
    expect(radiatorEffect(1, 1, P)).toBeCloseTo(1 - P.thermostatBlock);
    expect(radiatorEffect(0, 0, P)).toBe(0);
  });

  it('is dealt to some and develops in others', () => {
    expect(pickThermostat(() => 0.99, P)).toBe(0);
    expect(pickThermostat(() => 0, P)).toBe(P.thermostatMin);
    expect(thermostatSticks(() => 0.999, 1, P)).toBe(0);
    expect(thermostatSticks(() => 0, 1, P)).toBe(P.thermostatMin);
    const e = make({ thermostatStickPerHour: 3600 });
    start(e);
    drive(e, 5, { ambient: 0.2 });
    expect(e.thermostat).toBeGreaterThan(0);
  });

  it('scores heat from the threshold', () => {
    expect(hotLevel(P.hotFrom, P)).toBe(0);
    expect(hotLevel(1, P)).toBe(1);
  });
});

describe('the coolant bottle', () => {
  const B = DEFAULT_COOLANT_BOTTLE_PARAMS;
  const cold = (props) => Object.assign({ params: P, isRunning: false, heat: 0, soak: 0, coolant: 1, thermostat: 0 }, props);

  it('tops up a stopped, cool radiator', () => {
    const e = cold({ coolant: 0.5 });
    expect(pourStep(e, 1, B)).toBe('pouring');
    expect(e.coolant).toBeCloseTo(0.5 + B.pourRate);
    for (let i = 0; i < 20; i++) pourStep(e, 1, B);
    expect(e.coolant).toBe(1);
    expect(pourStep(e, 1, B)).toBe('full');
  });

  it('will not open the cap on a running or hot engine, or fill an air-cooled one', () => {
    expect(pourStep(cold({ isRunning: true, coolant: 0.3 }), 1, B)).toBe('hot');
    expect(pourStep(cold({ soak: 0.8, coolant: 0.3 }), 1, B)).toBe('hot');
    expect(pourStep(cold({ params: { ...P, waterCooled: false } }), 1, B)).toBe('air');
  });

  it('flushes a stuck thermostat free once the radiator is full', () => {
    const e = cold({ thermostat: 0.8 });
    expect(pourStep(e, 1, B)).toBe('flushing');
    let how;
    for (let i = 0; i < 20 && e.thermostat > 0; i++) how = pourStep(e, 1, B);
    expect(how).toBe('freed');
    expect(e.thermostat).toBe(0);
    expect(flushThermostat(0.1, 100, P)).toBe(0);
  });
});
