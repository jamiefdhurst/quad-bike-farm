import { describe, it, expect } from 'vitest';
import { FuelSystem, DEFAULT_FUEL_PARAMS } from '../src/vehicle/fuelSystem.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';

const FULL_RPM = DEFAULT_ENGINE_PARAMS.maxRpm;

function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DT = 1 / 20;

function makeFuel(overrides = {}) {
  return new FuelSystem({ ...DEFAULT_FUEL_PARAMS, startTap: 'on', ...overrides });
}

/** Seconds until the float bowl runs dry at a steady engine state, or Infinity. */
function secondsToDry(fuel, engineState, limit = 20000) {
  for (let t = 0; t < limit; t += DT) {
    fuel.update(DT, engineState);
    if (fuel.bowl <= 0) return t;
  }
  return Infinity;
}

describe('fuel system', () => {
  it('starts with the tap OFF by default', () => {
    const fuel = new FuelSystem(DEFAULT_FUEL_PARAMS);
    expect(fuel.tap).toBe('off');
    // The float bowl starts full, so it would start, run briefly, then starve.
    expect(fuel.bowlLevel).toBe(1);
  });

  it('lasts roughly 25 minutes flat out from a full tank', () => {
    const fuel = makeFuel({ startLitres: DEFAULT_FUEL_PARAMS.tankCapacity });
    fuel.tap = 'reserve';
    const t = secondsToDry(fuel, { rpm: FULL_RPM, throttle: 1, choke: 0, running: true });
    expect(t / 60).toBeGreaterThan(22);
    expect(t / 60).toBeLessThan(35);
  });

  it('lasts many times longer at idle', () => {
    const flat = makeFuel({ startLitres: 1 });
    flat.tap = 'reserve';
    const idle = makeFuel({ startLitres: 1 });
    idle.tap = 'reserve';
    const tFlat = secondsToDry(flat, { rpm: FULL_RPM, throttle: 1, choke: 0, running: true });
    const tIdle = secondsToDry(idle, { rpm: 1150, throttle: 0, choke: 0, running: true }, 200000);
    expect(tIdle).toBeGreaterThan(tFlat * 10);
  });

  it('runs dry with the reserve still in the tank when the tap is ON', () => {
    const fuel = makeFuel({ startLitres: 3 });
    secondsToDry(fuel, { rpm: 6000, throttle: 1, choke: 0, running: true });
    expect(fuel.litres).toBeCloseTo(DEFAULT_FUEL_PARAMS.reserveLitres, 2);
    fuel.cycleTap(); // to reserve
    expect(fuel.tap).toBe('reserve');
    fuel.update(1, { rpm: 0, throttle: 0, choke: 0, running: false });
    expect(fuel.bowl).toBeGreaterThan(0);
  });

  it('starves with the tap OFF even with a full tank', () => {
    const fuel = makeFuel({ startLitres: 10 });
    fuel.tap = 'off';
    const t = secondsToDry(fuel, { rpm: 3000, throttle: 0.5, choke: 0, running: true });
    expect(t).toBeLessThan(60);
    expect(fuel.litres).toBe(10);
  });

  it('only takes as much as fits', () => {
    const fuel = makeFuel({ startLitres: 11 });
    expect(fuel.add(5)).toBeCloseTo(1, 5);
    expect(fuel.level).toBeCloseTo(1, 5);
  });
});

describe('engine running out of fuel', () => {
  function warmEngineWithFuel(litres, seed = 1) {
    const engine = new EngineModel({ initialTemperature: 1 }, { random: seededRandom(seed) });
    const fuel = makeFuel({ startLitres: litres });
    engine.setIgnition(true);
    const step = (controls = {}) => {
      fuel.update(1 / 60, { rpm: engine.rpm, throttle: engine.throttle, choke: engine.choke, running: engine.isRunning });
      engine.update(1 / 60, { ...controls, fuel: fuel.bowlLevel });
    };
    return { engine, fuel, step };
  }

  it('stumbles, then stalls when the tank runs dry, and will not restart until refuelled', () => {
    const { engine, fuel, step } = warmEngineWithFuel(DEFAULT_FUEL_PARAMS.reserveLitres + 0.05);
    for (let i = 0; i < 300 && !engine.isRunning; i++) step({ starter: true });
    expect(engine.isRunning).toBe(true);

    let maxRoughness = 0;
    let stall = null;
    for (let i = 0; i < 60 * 600 && !stall; i++) {
      step({ throttle: 0.6 });
      if (engine.isRunning) maxRoughness = Math.max(maxRoughness, engine.roughness);
      stall = engine.events.find((e) => e.type === 'stalled');
    }
    expect(stall?.reason).toBe('noFuel');
    // It ran lean and rough before it died.
    expect(maxRoughness).toBeGreaterThan(0.4);

    // Cranking does nothing with the tap on ON and only the reserve left.
    for (let i = 0; i < 60 * 5; i++) step({ starter: true });
    expect(engine.isRunning).toBe(false);

    // Switching to reserve lets it start again.
    fuel.tap = 'reserve';
    for (let i = 0; i < 60 * 3; i++) step({});
    for (let i = 0; i < 60 * 5 && !engine.isRunning; i++) step({ starter: true });
    expect(engine.isRunning).toBe(true);
  });

  it('starts again after pouring fuel into an empty tank', () => {
    const { engine, fuel, step } = warmEngineWithFuel(0);
    for (let i = 0; i < 60 * 5; i++) step({ starter: true });
    expect(engine.isRunning).toBe(false);
    fuel.add(5);
    for (let i = 0; i < 60 * 3; i++) step({});
    for (let i = 0; i < 60 * 5 && !engine.isRunning; i++) step({ starter: true });
    expect(engine.isRunning).toBe(true);
  });
});

describe('fuel running away from the tap on a bank', () => {
  const run = { rpm: 3000, throttle: 0.5, choke: 0, running: true };

  it('leaves a well-filled tank alone on a steep climb', () => {
    const f = makeFuel({ startLitres: 8 });
    f.bowl = 0;
    f.update(1, { ...run, climb: 0.5 });
    expect(f.uncovered).toBe(false);
    expect(f.bowl).toBeGreaterThan(0);
  });

  it('stops the bowl filling on a steep bank with the tank low, and starts again on the level', () => {
    const f = makeFuel({ startLitres: 2.5, reserveLitres: 0 });
    f.bowl = 0;
    f.update(1, { ...run, climb: 0.35 });
    expect(f.uncovered).toBe(true);
    expect(f.bowl).toBe(0);
    f.update(1, { ...run, climb: 0 });
    expect(f.uncovered).toBe(false);
    expect(f.bowl).toBeGreaterThan(0);
  });

  it('uncovers on a gentler bank the less is left', () => {
    const more = makeFuel({ startLitres: 3 });
    const less = makeFuel({ startLitres: 0.5 });
    expect(more.coversTap(0.2)).toBe(true);
    expect(less.coversTap(0.2)).toBe(false);
    expect(less.coversTap(0.05)).toBe(true); // never on nearly level ground
  });

  it('starves a running quad on the bank until it dies, and not downhill', () => {
    const f = makeFuel({ startLitres: 2.5, reserveLitres: 0 });
    let t = 0;
    while (f.bowl > 0 && t < 120) { f.update(DT, { ...run, climb: -0.4 }); t += DT; }
    expect(f.bowl).toBeGreaterThan(0);
    t = 0;
    while (f.bowl > 0 && t < 120) { f.update(DT, { ...run, climb: 0.4 }); t += DT; }
    expect(f.bowl).toBe(0);
    expect(t).toBeLessThan(10);
  });

  it('does nothing for a vehicle with no tap, or with the tap off', () => {
    expect(makeFuel({ startLitres: 1, noTap: true }).coversTap(0.8)).toBe(true);
    expect(makeFuel({ startLitres: 1, startTap: 'off' }).coversTap(0.8)).toBe(true);
  });
});
