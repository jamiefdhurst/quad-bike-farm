import { describe, it, expect } from 'vitest';
import { Knack, DEFAULT_KNACK_PARAMS } from '../src/engine/knack.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { FuelSystem, DEFAULT_FUEL_PARAMS } from '../src/vehicle/fuelSystem.js';
import { StartingAttempt, DEFAULT_STARTING_PARAMS } from '../src/npc/startingAttempt.js';
import { QUAD_SPECS } from '../src/vehicle/quadSpecs.js';

const DT = 1 / 60;
const params = { ...DEFAULT_KNACK_PARAMS, knackBlips: 2 };

function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blip(k, times) {
  for (let i = 0; i < times; i++) {
    for (let j = 0; j < 12; j++) k.update(DT, 1, false);
    for (let j = 0; j < 12; j++) k.update(DT, 0, false);
  }
}

describe('the knack', () => {
  it('needs the blips before a cold start, and lets a warm one off', () => {
    const k = new Knack(params);
    expect(k.catchFactor(0)).toBe(params.knackMissFactor);
    blip(k, 1);
    expect(k.primed).toBe(false);
    blip(k, 1);
    expect(k.primed).toBe(true);
    expect(k.catchFactor(0)).toBe(1);
    expect(new Knack(params).catchFactor(0.9)).toBe(1);
  });

  it('counts a held throttle as one blip, and forgets them after the window', () => {
    const k = new Knack(params);
    for (let i = 0; i < 120; i++) k.update(DT, 1, false);
    expect(k.count).toBe(1);
    k.update(DT, 0, false);
    blip(k, 1);
    expect(k.primed).toBe(true);
    for (let i = 0; i < (params.knackWindow + 1) / DT; i++) k.update(DT, 0, false);
    expect(k.primed).toBe(false);
  });

  it('is always primed on a quad with no knack', () => {
    expect(new Knack(DEFAULT_KNACK_PARAMS).primed).toBe(true);
  });

  it('no quad has one now (the green lost it so the girls can start it), and the blue runs rich on choke sooner', () => {
    const green = QUAD_SPECS.find((s) => s.id === 'rb300');
    const blue = QUAD_SPECS.find((s) => s.id === 'bruin');
    expect(green.engine.knackBlips ?? 0).toBe(0);
    expect(QUAD_SPECS.filter((s) => s.engine.knackBlips).length).toBe(0);
    expect(blue.engine.chokeEnrichment).toBeGreaterThan(1);
  });
});

/** Cranks a cold engine with full choke for a while, optionally blipping the throttle twice first. */
function coldStart(withBlips, seed) {
  const engine = new EngineModel({ ...params, initialTemperature: 0, catchChance: 0.45 }, { random: seededRandom(seed) });
  engine.setIgnition(true);
  const go = (seconds, controls) => {
    for (let i = 0; i < seconds / DT; i++) engine.update(DT, { choke: 1, ...controls(i * DT) });
  };
  if (withBlips) {
    go(1.6, (t) => ({ throttle: t % 0.8 < 0.3 ? 1 : 0 }));
  }
  go(6, () => ({ starter: !engine.isRunning }));
  return engine.isRunning;
}

describe('starting a quad with a knack', () => {
  it('rarely catches cold without the blips, and usually does with them', () => {
    let without = 0;
    let withBlips = 0;
    for (let seed = 1; seed <= 20; seed++) {
      if (coldStart(false, seed)) without++;
      if (coldStart(true, seed)) withBlips++;
    }
    expect(withBlips).toBeGreaterThan(without + 8);
  });

  it('a girl who knows the trick blips the throttle twice before cranking', () => {
    const engine = new EngineModel({ ...params, initialTemperature: 0 }, { random: seededRandom(3) });
    const fuel = new FuelSystem({ ...DEFAULT_FUEL_PARAMS, startTap: 'on' });
    const quad = { engine, fuel, choke: 0, helperThrottle: 0 };
    const a = new StartingAttempt(quad, { random: () => 0.01, params: { ...DEFAULT_STARTING_PARAMS, knackChance: 1 } });
    const events = [];
    let crankedAt = null;
    for (let i = 0; i < 20 / DT && !a.done; i++) {
      events.push(...a.update(DT));
      if (a.starter && crankedAt === null) crankedAt = engine.knack.count;
      engine.update(DT, { starter: a.starter, throttle: quad.helperThrottle, choke: quad.choke, fuel: 1 });
    }
    expect(events).toContain('knack');
    expect(crankedAt).toBe(2);
    expect(quad.helperThrottle).toBe(0);
  });

  it('a girl who does not know it remembers after a failed go', () => {
    const engine = new EngineModel({ ...params, knackMissFactor: 0, initialTemperature: 0 }, { random: seededRandom(5) });
    const fuel = new FuelSystem({ ...DEFAULT_FUEL_PARAMS, startTap: 'on' });
    const quad = { engine, fuel, choke: 0, helperThrottle: 0 };
    const a = new StartingAttempt(quad, { random: () => 0.5, params: { ...DEFAULT_STARTING_PARAMS, knackChance: 0, rememberChance: 1, maxBursts: 3 } });
    const events = [];
    for (let i = 0; i < 40 / DT && !a.done; i++) {
      events.push(...a.update(DT));
      engine.update(DT, { starter: a.starter, throttle: quad.helperThrottle, choke: quad.choke, fuel: 1 });
    }
    expect(events).toContain('remembered');
    expect(events).toContain('knack');
  });
});
