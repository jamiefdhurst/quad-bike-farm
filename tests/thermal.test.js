import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { warmth, metalForWarmth, heatLevel, celsiusForHeat, fuelHeat, finCooling, metalTarget, thermostatOpen, fanState, stepThermal } from '../src/engine/thermal.js';
import { radiatorEffect } from '../src/engine/coolant.js';
import { engineReadouts } from '../src/debug/vehicleDebug.js';

const AIR = { ...DEFAULT_ENGINE_PARAMS };
const WATER = { ...DEFAULT_ENGINE_PARAMS, waterCooled: true };
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const make = (params = {}) => new EngineModel(params, { random: seeded(5) });

/** An engine already running at its idle, cold on a day of `dayTemp` °C: the choke eases off as it warms, as a rider's would. */
function coldIdle(params, dayTemp) {
  const e = make(params);
  e.update(0.05, { dayTemp });
  e.runWarm(0);
  return e;
}

/** Seconds idling until `done(e)`, or Infinity; the day's temperature and sun as given. */
function idleUntil(e, done, { dayTemp = 12, ambient = 0.5, limit = 1800 } = {}) {
  for (let t = 0; t < limit; t += 0.5) {
    e.update(0.5, { dayTemp, ambient, choke: Math.max(0, 1 - e.temperature) });
    if (done(e)) return t;
  }
  return Infinity;
}

const warmAfter = (params, dayTemp) => idleUntil(coldIdle(params, dayTemp), (e) => e.temperature >= 0.99, { dayTemp });

describe('the metal, in degrees', () => {
  it('has a warm-up of 0 at the air and 1 at the warm temperature, and maps back', () => {
    expect(warmth(12, 12, AIR)).toBe(0);
    expect(warmth(AIR.warmC, 12, AIR)).toBe(1);
    expect(warmth(AIR.warmC + 40, 12, AIR)).toBe(1);
    expect(metalForWarmth(0.5, -5, AIR)).toBeCloseTo(-5 + 0.5 * (AIR.warmC + 5));
    for (const air of [-5, 12, 25]) expect(warmth(metalForWarmth(0.37, air, AIR), air, AIR)).toBeCloseTo(0.37);
  });

  it('counts heat from the metal on an air-cooled engine and the coolant on a water-cooled one, and maps back', () => {
    expect(heatLevel(AIR.warmC, 999, AIR)).toBe(0);
    expect(heatLevel(AIR.warmC + AIR.heatSpanC / 2, 0, AIR)).toBeCloseTo(0.5);
    expect(heatLevel(999, WATER.coolantWarmC + WATER.coolantSpanC, WATER)).toBe(1);
    expect(heatLevel(999, WATER.coolantWarmC, WATER)).toBe(0);
    for (const p of [AIR, WATER]) expect(heatLevel(celsiusForHeat(0.6, p), celsiusForHeat(0.6, p), p)).toBeCloseTo(0.6);
  });

  it('is heated by the fuel, more with revs, load and a big bore, and by the sun', () => {
    const idle = { rpmNorm: 0, load: 0 };
    expect(fuelHeat(idle, AIR)).toBe(1);
    expect(fuelHeat({ rpmNorm: 1, load: 0 }, AIR)).toBeGreaterThan(fuelHeat(idle, AIR));
    expect(fuelHeat({ rpmNorm: 0, load: 1 }, AIR)).toBeGreaterThan(fuelHeat(idle, AIR));
    expect(fuelHeat({ ...idle, bore: 1 }, AIR)).toBeGreaterThan(fuelHeat(idle, AIR));
    const still = { air: 12, fuel: 1, cooling: 1 };
    expect(metalTarget({ ...still, ambient: 1 }, AIR)).toBeGreaterThan(metalTarget({ ...still, ambient: 0 }, AIR));
    expect(metalTarget({ ...still, ambient: 0 }, AIR)).toBeCloseTo(12 + AIR.idleRiseC);
  });

  it('is shed through the fins, more with the flywheel fan and the wind of riding along', () => {
    expect(finCooling({ rpmNorm: 0, speed: 0 }, AIR)).toBe(1);
    expect(finCooling({ rpmNorm: 1, speed: 0 }, AIR)).toBeGreaterThan(1);
    expect(finCooling({ rpmNorm: 0, speed: AIR.airflowSpeed }, AIR)).toBeGreaterThan(finCooling({ rpmNorm: 0, speed: 2 }, AIR));
    const t = (speed) => metalTarget({ air: 12, ambient: 0.5, fuel: 1.5, cooling: finCooling({ rpmNorm: 0.5, speed }, AIR) }, AIR);
    expect(t(AIR.airflowSpeed)).toBeLessThan(t(0) - 20);
  });

  it('sheds its heat to the air a switched-off engine, but only down to the barn\'s warmth when sheltered, and slower', () => {
    const run = (sheltered, seconds) => {
      const s = { metalC: 90, coolantC: 90, fan: false };
      for (let t = 0; t < seconds; t++) stepThermal(s, 1, { running: false, air: 12, sheltered }, AIR);
      return s.metalC;
    };
    expect(run(true, 600)).toBeGreaterThan(run(false, 600));
    expect(run(false, 40000)).toBeCloseTo(12, 0);
    expect(run(true, 40000)).toBeCloseTo(12 + AIR.barnWarmC, 0);
    // Over its warm temperature it sheds that much quickly: well on the way in a few minutes.
    expect(run(false, 300)).toBeLessThan(AIR.warmC + 3 + (90 - AIR.warmC) * 0.1);
  });
});

describe('the coolant, the thermostat and the fan', () => {
  it('opens the thermostat between two temperatures', () => {
    expect(thermostatOpen(WATER.thermostatOpenC - 5, WATER)).toBe(0);
    expect(thermostatOpen(WATER.thermostatOpenC + WATER.thermostatSpanC / 2, WATER)).toBeCloseTo(0.5);
    expect(thermostatOpen(WATER.thermostatOpenC + WATER.thermostatSpanC + 5, WATER)).toBe(1);
  });

  it('cuts the fan in and out at two coolant temperatures, running and water-cooled only', () => {
    expect(fanState(false, WATER.fanOnC + 1, true, WATER)).toBe(true);
    expect(fanState(true, (WATER.fanOnC + WATER.fanOffC) / 2, true, WATER)).toBe(true);
    expect(fanState(false, (WATER.fanOnC + WATER.fanOffC) / 2, true, WATER)).toBe(false);
    expect(fanState(true, WATER.fanOffC - 1, true, WATER)).toBe(false);
    expect(fanState(true, WATER.fanOnC + 5, false, WATER)).toBe(false);
    expect(fanState(true, WATER.fanOnC + 5, true, AIR)).toBe(false);
  });

  const settle = (radiator, seconds = 1500) => {
    const s = { metalC: 88, coolantC: 88, fan: false };
    for (let t = 0; t < seconds; t++) stepThermal(s, 1, { running: true, air: 12, ambient: 1, radiator }, WATER);
    return s;
  };

  it('is held about warm by a healthy radiator, and runs hot with a stuck thermostat or no coolant', () => {
    const healthy = settle(1);
    expect(healthy.coolantC).toBeLessThan(WATER.coolantWarmC + 15);
    expect(settle(radiatorEffect(1, 1, WATER)).coolantC).toBeGreaterThan(healthy.coolantC + 20);
    expect(settle(radiatorEffect(0, 0, WATER)).coolantC).toBeGreaterThan(healthy.coolantC + 20);
  });

  it('keeps the metal a little over the coolant', () => {
    const s = settle(1);
    expect(s.metalC).toBeGreaterThan(s.coolantC);
    expect(s.metalC).toBeLessThan(s.coolantC + 20);
  });

  it('holds the coolant back until the thermostat opens: it keeps warming with the radiator shut', () => {
    const s = { metalC: 12, coolantC: 12, fan: false };
    for (let t = 0; t < 100; t++) stepThermal(s, 1, { running: true, air: 12, ambient: 0.5 }, WATER);
    const a = s.coolantC;
    for (let t = 0; t < 100; t++) stepThermal(s, 1, { running: true, air: 12, ambient: 0.5 }, WATER);
    expect(thermostatOpen(s.coolantC, WATER)).toBe(0);
    expect(s.coolantC - a).toBeGreaterThan((a - 12) * 0.5); // not slowing as it would with a radiator carrying it off
  });
});

describe('the engine reads them as the 0 to 1 values it always had', () => {
  it('gives a temperature that sets and reads back, for both kinds', () => {
    for (const params of [{}, { waterCooled: true }]) {
      const e = make(params);
      for (const t of [0, 0.3, 1]) {
        e.setTemperature(t);
        expect(e.temperature).toBeCloseTo(t);
      }
      e.setTemperature(0);
      expect(e.metalC).toBe(12);
      e.setTemperature(1);
      expect(e.metalC).toBe(e.params.warmC);
    }
    const w = make({ waterCooled: true });
    w.setTemperature(1);
    expect(w.coolantC).toBe(w.params.coolantWarmC);
  });

  it('follows the day: the same metal reads colder on a warmer day', () => {
    const e = make();
    e.setTemperature(0.5);
    e.update(0.05, { dayTemp: 30 });
    expect(e.temperature).toBeLessThan(0.5);
  });

  it('gives a heat that sets and reads back, and only ever cools a cold engine to warm', () => {
    for (const params of [{}, { waterCooled: true }]) {
      const e = make(params);
      e.heat = 0.6;
      expect(e.heat).toBeCloseTo(0.6);
      e.heat = 0;
      expect(e.heat).toBe(0);
      e.setTemperature(0);
      e.heat = 0;
      expect(e.temperature).toBe(0);
    }
  });

  it('shows the thermostat as open only on a water-cooled engine, and once the coolant is warm', () => {
    const e = make({ waterCooled: true });
    e.setTemperature(0);
    expect(e.thermostatOpen).toBe(0);
    e.setTemperature(1);
    expect(e.thermostatOpen).toBeGreaterThan(0);
    expect(make().thermostatOpen).toBe(0);
  });
});

describe('an engine warming and cooling as it did', () => {
  it('idles from cold to warm in about 150 s on a 12 °C day, in either kind', () => {
    for (const params of [{}, { waterCooled: true }]) {
      const t = warmAfter(params, 12);
      expect(t).toBeGreaterThan(150 * 0.75);
      expect(t).toBeLessThan(150 * 1.25);
    }
  });

  it('takes longer on a frosty day and less on a hot one', () => {
    for (const params of [{}, { waterCooled: true }]) {
      expect(warmAfter(params, -5)).toBeGreaterThan(warmAfter(params, 12) * 1.3);
      expect(warmAfter(params, 25)).toBeLessThan(warmAfter(params, 12) * 0.85);
    }
  });

  it('warms quicker revving it than idling', () => {
    const idle = coldIdle({}, 12);
    const revved = coldIdle({}, 12);
    for (let t = 0; t < 60; t += 0.5) {
      idle.update(0.5, { choke: Math.max(0, 1 - idle.temperature) });
      revved.update(0.5, { throttle: 0.6, driveLoad: 0.3, choke: Math.max(0, 1 - revved.temperature) });
    }
    expect(revved.temperature).toBeGreaterThan(idle.temperature + 0.1);
  });

  it('cools switched off over about as long as it did: half in about ten minutes, nearly cold in an hour', () => {
    for (const params of [{}, { waterCooled: true }]) {
      const e = make(params);
      e.setTemperature(1);
      e.setIgnition(false);
      let half = Infinity;
      for (let t = 0; t < 3600; t++) {
        e.update(1, {});
        if (half === Infinity && e.temperature < 0.5) half = t;
      }
      expect(half).toBeGreaterThan(624 * 0.75);
      expect(half).toBeLessThan(624 * 1.25);
      expect(e.temperature).toBeLessThan(0.05);
    }
  });

  it('cools slower in the barn and never below its warmth', () => {
    const cool = (sheltered, seconds) => {
      const e = make();
      e.setTemperature(1);
      e.setIgnition(false);
      for (let t = 0; t < seconds; t++) e.update(1, { sheltered });
      return e.temperature;
    };
    expect(cool(true, 1800)).toBeGreaterThan(cool(false, 1800) + 0.2);
    expect(cool(true, 40000)).toBeGreaterThan(0.1);
  });

  it('has an air-cooled engine idling in full sun from cold reach the pinking temperature in about four minutes, without pinking idling (#861)', () => {
    const e = coldIdle({}, 12);
    const t = idleUntil(e, (x) => x.metalC > x.params.pinkFromC, { ambient: 1 });
    expect(e.pink).toBe(0);
    expect(t).toBeGreaterThan(240 * 0.75);
    expect(t).toBeLessThan(240 * 1.25);
  });

  it('never gets a healthy water-cooled engine hot, idling in full sun or crawling', () => {
    const e = make({ waterCooled: true });
    e.setTemperature(1);
    e.setIgnition(true);
    for (let t = 0; t < 10 && !e.isRunning; t += 0.05) e.update(0.05, { starter: true, choke: 0.3 });
    let top = 0;
    for (let t = 0; t < 1800; t += 0.5) {
      e.update(0.5, { ambient: 1 });
      top = Math.max(top, e.coolantC);
    }
    for (let t = 0; t < 900; t += 0.5) {
      e.update(0.5, { ambient: 1, throttle: 1, driveLoad: 1, speed: 1 });
      top = Math.max(top, e.coolantC);
    }
    expect(top).toBeLessThan(WATER.hotFromC);
    expect(e.hot).toBe(0);
    expect(e.isRunning).toBe(true);
  });
});

describe('the read-outs', () => {
  it('show the metal and (water-cooled) the coolant and thermostat, climbing from the day\'s temperature to warm after a cold start', () => {
    for (const params of [{}, { waterCooled: true }]) {
      const e = coldIdle(params, 12);
      const read = (key) => engineReadouts(e).find((r) => r.key === key)?.get(e);
      expect(read('metalC')).toBe(12);
      if (params.waterCooled) {
        expect(read('coolantC')).toBe(12);
        expect(read('thermostatOpen')).toBe(0);
      } else {
        expect(engineReadouts(e).some((r) => r.key === 'coolantC' || r.key === 'thermostatOpen')).toBe(false);
      }
      let before = read('metalC');
      for (let n = 0; n < 4; n++) {
        idleUntil(e, () => false, { limit: 30 });
        expect(read('metalC')).toBeGreaterThan(before);
        before = read('metalC');
      }
      idleUntil(e, (x) => x.temperature >= 0.99, { limit: 600 });
      expect(read('metalC')).toBeGreaterThanOrEqual(e.params.warmC - 2);
      if (params.waterCooled) {
        expect(read('coolantC')).toBeGreaterThan(40);
        idleUntil(e, () => false, { limit: 400 });
        expect(read('coolantC')).toBeGreaterThan(e.params.thermostatOpenC);
        expect(read('thermostatOpen')).toBeGreaterThan(0);
      }
    }
  });
});
