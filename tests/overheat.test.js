import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { radiatorEffect, pickThermostat, thermostatSticks, hotLevel, flushThermostat, boilingC, boilsOver } from '../src/engine/coolant.js';
import { gaugeReading } from '../src/engine/thermal.js';
import { lampStates } from '../src/vehicle/dashState.js';
import { pourStep, DEFAULT_COOLANT_BOTTLE_PARAMS } from '../src/items/coolantBottle.js';
import { QUAD_SPECS, HARTLEY_SPEC, YAK_SPEC, TOR_SPEC, CRAG_SPEC, FINCH_SPEC, GRIFFIN_SPEC, VAUCLAIR_SPEC } from '../src/vehicle/quadSpecs.js';
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

/** Where an engine's needle is. */
const needle = (e) => tempGaugeFraction(e.gauge, true, e.overheat);

describe('the gauge', () => {
  it('puts a warm engine in the middle and the red zone near the top', () => {
    expect(WARM_AT).toBe(0.5);
    expect(HOT_FROM).toBeGreaterThan(0.7);
  });

  it('reads the coolant on a radiator engine: cold at the air, the middle warm, the red too hot and the top at the stall', () => {
    const at = (c) => tempGaugeFraction(gaugeReading(c - 10, c, 12, P));
    expect(at(12)).toBe(0);
    expect(at(5)).toBe(0);
    expect(at(P.coolantWarmC)).toBeCloseTo(WARM_AT);
    expect(at(P.hotFromC)).toBeCloseTo(HOT_FROM);
    expect(at(P.hotStallC)).toBeCloseTo(1);
    expect(at(P.hotStallC + 30)).toBe(1);
    expect(at(50)).toBeGreaterThan(0);
    expect(at(50)).toBeLessThan(WARM_AT);
    expect(at(100)).toBeGreaterThan(WARM_AT);
    expect(at(100)).toBeLessThan(HOT_FROM);
    expect(tempGaugeFraction(gaugeReading(80, 90, 12, P), false)).toBe(0);
  });

  it('reads the metal on an air-cooled engine, its red where it starts to pink', () => {
    const A = DEFAULT_ENGINE_PARAMS;
    const at = (c) => tempGaugeFraction(gaugeReading(c, 0, 12, A));
    expect(at(12)).toBe(0);
    expect(at(A.warmC)).toBeCloseTo(WARM_AT);
    expect(at(A.pinkFromC)).toBeCloseTo(HOT_FROM);
    expect(at(A.pinkFromC + A.pinkSpanC)).toBeCloseTo(1);
  });

  it('follows the coolant on a real engine, not the metal', () => {
    const e = make();
    e.coolantC = P.hotFromC + 1;
    e.metalC = 60;
    expect(needle(e)).toBeGreaterThan(HOT_FROM);
    const a = new EngineModel({}, { random: seeded(5) });
    a.metalC = a.params.pinkFromC + 1;
    expect(needle(a)).toBeGreaterThan(HOT_FROM);
  });

  it('lights the temperature lamp with the needle in the red, and only then', () => {
    const lamp = (c) => lampStates({ ignition: true, gauge: gaugeReading(c - 5, c, 12, P), overheat: 0, fuelLevel: 1, reserveLevel: 0.1 }).temp;
    expect(lamp(P.hotFromC - 0.5)).toBe(false);
    expect(lamp(P.hotFromC + 0.5)).toBe(true);
    expect(lampStates({ ignition: false, gauge: gaugeReading(130, 130, 12, P), overheat: 0, fuelLevel: 1, reserveLevel: 0.1 }).temp).toBe(false);
  });

  it('rises from cold to the middle after a start on a healthy radiator, and stays there idling', () => {
    const e = make();
    e.dayTemp = 12;
    e.setTemperature(0);
    e.setIgnition(true);
    for (let t = 0; t < 10 && !e.isRunning; t += 0.05) e.update(0.05, { starter: true, choke: 0.8, dayTemp: 12 });
    expect(needle(e)).toBeLessThan(0.1);
    const seen = [];
    for (let t = 0; t < 1200; t += 0.5) {
      e.update(0.5, { choke: Math.max(0, 0.8 - t / 200), dayTemp: 12, ambient: 0.5 });
      if (t % 60 < 0.5) seen.push(needle(e));
    }
    expect(e.isRunning).toBe(true);
    for (let i = 1; i < 3; i++) expect(seen[i]).toBeGreaterThan(seen[i - 1]);
    for (const f of seen.slice(-10)) {
      expect(f).toBeGreaterThan(WARM_AT - 0.05);
      expect(f).toBeLessThan(WARM_AT + 0.1);
    }
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
    expect(needle(e)).toBeLessThan(HOT_FROM);
    expect(e.isRunning).toBe(true);
  });

});

// Each vehicle with a radiator, built from its own spec: how long it lasts revved hard standing still (#860).
const ADDER_SPEC = QUAD_SPECS.find((s) => s.id === 'adder');
const RADIATORS = [
  ['Adder', ADDER_SPEC, 120],
  ['Finch', FINCH_SPEC, 240],
  ['Griffin', GRIFFIN_SPEC, 240],
  ['Vauclair', VAUCLAIR_SPEC, 240],
  ['Yak', YAK_SPEC, 240],
  ['Tor', TOR_SPEC, 300],
  ['Crag', CRAG_SPEC, 300],
  ['Hartley', HARTLEY_SPEC, null],
];

/** A warm, running engine from a vehicle's spec, on a day of `dayTemp` °C, with its setup (`coolant`, `thermostat`) applied first. */
function vehicleEngine(spec, dayTemp, setup = {}) {
  const e = new EngineModel({ ...DEFAULT_ENGINE_PARAMS, ...spec.engine }, { random: seeded(5) });
  const diesel = spec.engine.runsOnDiesel ? 1 : 0;
  e.dayTemp = dayTemp;
  e.setTemperature(1);
  Object.assign(e, setup);
  e.setIgnition(true);
  for (let t = 0; t < 4; t += 0.05) e.update(0.05, { diesel, dayTemp }); // (the glow plugs)
  for (let t = 0; t < 20 && !e.isRunning; t += 0.05) e.update(0.05, { starter: true, choke: diesel ? 0 : 0.15, diesel, dayTemp });
  expect(e.isRunning, spec.id).toBe(true);
  return { e, diesel };
}

/** Runs it `seconds` with the same controls: when it first ran too hot, when it stalled from heat, and the needle when it first lost power. */
function hold(spec, seconds, controls, setup) {
  const { e, diesel } = vehicleEngine(spec, controls.dayTemp, setup);
  const out = { e, hotAt: null, stallAt: null, needleAtHot: null, maxHot: 0 };
  for (let t = 0; t < seconds; t += 0.5) {
    if (spec.engine.strokes === 2) e.fouling = 0; // (a two-stroke idling for ages oils its plug: not what this is about)
    e.update(0.5, { diesel, ...controls });
    out.maxHot = Math.max(out.maxHot, e.hot);
    if (out.hotAt === null && e.hot > 0) {
      out.hotAt = t;
      out.needleAtHot = needle(e);
    }
    if (e.events.some((x) => x.type === 'overheated')) {
      out.stallAt = t;
      break;
    }
  }
  return out;
}

const REVVED = { throttle: 1, ambient: 0.5, dayTemp: 12 }; // held near the limiter standing still on a mild day

describe('each radiator, revved hard standing still (#860)', () => {
  for (const [name, spec, seconds] of RADIATORS) {
    it(`${name}: idles an hour in full sun on the hottest day without running hot`, () => {
      const r = hold(spec, 3600, { ambient: 1, dayTemp: 29 });
      expect(r.maxHot).toBe(0);
      expect(r.e.isRunning).toBe(true);
      expect(needle(r.e)).toBeGreaterThan(WARM_AT - 0.02);
      expect(needle(r.e)).toBeLessThan(HOT_FROM); // mid-band while the fan copes
    });

    it(`${name}: stays cool riding along at speed on a warm sunny day`, () => {
      const r = hold(spec, 1800, { throttle: 0.6, driveLoad: 0.5, speed: 12, ambient: 1, dayTemp: 25 });
      expect(r.maxHot).toBe(0);
    });

    if (seconds) {
      it(`${name}: gets hot in about ${seconds / 60} minutes held near the limiter, the needle in the red before the power goes`, () => {
        const r = hold(spec, 1200, REVVED);
        expect(r.hotAt).not.toBeNull();
        expect(r.hotAt).toBeGreaterThan(seconds * 0.75);
        expect(r.hotAt).toBeLessThan(seconds * 1.25);
        expect(r.needleAtHot).toBeGreaterThanOrEqual(HOT_FROM - 0.005);
      });
    } else {
      it(`${name}: never runs hot at full revs standing still, even in full sun on the hottest day`, () => {
        const r = hold(spec, 1800, { throttle: 1, ambient: 1, dayTemp: 29 });
        expect(r.maxHot).toBe(0);
        expect(r.e.isRunning).toBe(true);
      });
    }

    it(`${name}: dry, it runs hot idling within about a minute and stalls within three, on a frosty day or a hot one`, () => {
      for (const day of [{ ambient: 0, dayTemp: -5 }, { ambient: 1, dayTemp: 28 }]) {
        const r = hold(spec, 600, day, { coolant: 0 });
        expect(r.hotAt).toBeLessThan(90);
        expect(r.stallAt).not.toBeNull();
        expect(r.stallAt).toBeLessThan(180);
        expect(r.needleAtHot).toBeGreaterThanOrEqual(HOT_FROM - 0.005);
      }
    });
  }

  it('lasts longest on the Land Rovers and shortest on the Adder', () => {
    const at = (spec) => hold(spec, 1200, REVVED).hotAt;
    const adder = at(ADDER_SPEC);
    const finch = at(FINCH_SPEC);
    const tor = at(TOR_SPEC);
    expect(adder).toBeLessThan(finch);
    expect(finch).toBeLessThan(tor);
  });

  it('still lets a stuck thermostat or a leak cook the Hartley', () => {
    expect(hold(HARTLEY_SPEC, 2400, { throttle: 1, driveLoad: 1, speed: 1, ambient: 1, dayTemp: 18 }, { thermostat: 1 }).stallAt).not.toBeNull();
    expect(hold(HARTLEY_SPEC, 600, { ambient: 0.5, dayTemp: 12 }, { coolant: 0 }).stallAt).not.toBeNull();
  });

  it('puts the needle at the red at the too-hot temperature whatever the coolant level', () => {
    for (const coolant of [1, 0.4, 0.05]) {
      const { e } = vehicleEngine(ADDER_SPEC, 12, { coolant });
      e.coolantC = e.params.hotFromC;
      expect(needle(e)).toBeCloseTo(HOT_FROM, 2);
    }
  });

  it('gets the small radiators hot on a heavy crawl in the sun, not the Hartley', () => {
    const crawl = { throttle: 1, driveLoad: 1, speed: 1, ambient: 1, dayTemp: 18 };
    expect(hold(ADDER_SPEC, 900, crawl).hotAt).not.toBeNull();
    expect(hold(TOR_SPEC, 900, crawl).hotAt).not.toBeNull();
    expect(hold(HARTLEY_SPEC, 900, crawl).maxHot).toBe(0);
  });
});

describe('a stuck thermostat', () => {
  it('runs the needle into the red idling in the sun, and loses power', () => {
    const e = make();
    e.thermostat = 1;
    start(e);
    drive(e, 1200, { ambient: 1 });
    expect(needle(e)).toBeGreaterThan(HOT_FROM);
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

  it('runs too hot from the too-hot temperature of the coolant, up to the stall', () => {
    expect(hotLevel(P.hotFromC, P)).toBe(0);
    expect(hotLevel(P.hotFromC - 10, P)).toBe(0);
    expect(hotLevel((P.hotFromC + P.hotStallC) / 2, P)).toBeCloseTo(0.5);
    expect(hotLevel(P.hotStallC, P)).toBe(1);
    const e = make();
    start(e);
    e.coolantC = P.hotFromC + 4;
    e.update(0.05, {});
    expect(e.hot).toBeGreaterThan(0);
    expect(e.isRunning).toBe(true);
  });

  it('stalls at the stall temperature and will not restart until the coolant is under the restart one', () => {
    const e = make();
    start(e);
    e.coolantC = P.hotStallC - 2;
    e.update(0.05, {});
    expect(e.isRunning).toBe(true);
    e.coolantC = P.hotStallC + 0.5;
    e.update(0.05, {});
    expect(e.isRunning).toBe(false);
    expect(e.heatLocked).toBe(true);
    e.coolantC = P.hotRestartC + 1;
    e.update(0.05, {});
    expect(e.heatLocked).toBe(true);
    e.coolantC = P.hotRestartC - 1;
    e.update(0.05, {});
    expect(e.heatLocked).toBe(false);
  });
});

describe('boiling over', () => {
  it('boils a full radiator with a stuck thermostat over before it stalls, worked hard in the sun', () => {
    const e = make();
    e.thermostat = 1;
    start(e);
    const order = [];
    for (let t = 0; t < 2400 && !order.includes('overheated'); t += 0.5) {
      e.update(0.5, { ambient: 1, throttle: 1, driveLoad: 1, speed: 1 });
      for (const ev of e.events) if (ev.type === 'boilOver' || ev.type === 'overheated') order.push(ev.type);
    }
    expect(order).toEqual(['boilOver', 'overheated']);
    expect(e.coolant).toBeLessThan(0.1);
  });

  it('boils lower the less coolant there is, as the pressure goes', () => {
    expect(boilingC(1, P)).toBe(P.coolantBoilFullC);
    expect(boilingC(0.3, P)).toBeLessThan(boilingC(0.45, P));
    expect(boilingC(0.2, P)).toBeLessThan(boilingC(0.3, P));
    expect(boilingC(0, P)).toBe(P.coolantBoilLowC);
    // Full, it boils over before it would stall; at 115 °C a low one boils and a fuller one doesn't.
    expect(P.coolantBoilFullC).toBeLessThan(P.hotStallC);
    expect(boilsOver(1, P.coolantBoilFullC - 0.5, false, P)).toBe(false);
    expect(boilsOver(1, P.coolantBoilFullC + 0.5, false, P)).toBe(true);
    expect(boilsOver(0.2, 115, false, P)).toBe(true);
    expect(boilsOver(0.45, 115, false, P)).toBe(false);
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
