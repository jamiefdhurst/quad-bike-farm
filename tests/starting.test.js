import { describe, it, expect } from 'vitest';
import { StartingAttempt, DEFAULT_STARTING_PARAMS } from '../src/npc/startingAttempt.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { FuelSystem, DEFAULT_FUEL_PARAMS } from '../src/vehicle/fuelSystem.js';

function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DT = 1 / 60;

/** A quad as far as she's concerned: engine, fuel and choke, run until she's done. */
function attempt({ temperature, tap = 'off', seed = 1, params = DEFAULT_STARTING_PARAMS, seconds = 400 }) {
  const random = seededRandom(seed);
  const engine = new EngineModel({ initialTemperature: temperature }, { random: seededRandom(seed + 100) });
  const fuel = new FuelSystem({ ...DEFAULT_FUEL_PARAMS, startTap: tap });
  const quad = { engine, fuel, choke: 0 };
  const a = new StartingAttempt(quad, { random, params });
  const events = [];
  for (let i = 0; i < seconds / DT && !a.done; i++) {
    events.push(...a.update(DT));
    fuel.update(DT, { rpm: engine.rpm, throttle: 0, choke: quad.choke, running: engine.isRunning });
    engine.update(DT, { starter: a.starter, choke: quad.choke, fuel: fuel.bowlLevel });
  }
  return { a, engine, fuel, quad, events };
}

describe('her starting a quad', () => {
  it('usually gets a cold quad going with the tap off, and leaves it warm with the choke off', () => {
    let started = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const { a, engine, quad } = attempt({ temperature: 0, seed });
      if (a.result === 'running') {
        started++;
        expect(engine.isRunning).toBe(true);
        expect(quad.choke).toBe(0);
      }
    }
    expect(started).toBeGreaterThan(15);
    expect(started).toBeLessThan(30); // she doesn't always manage
  });

  it('gives up after a few goes and switches it off', () => {
    const never = { ...DEFAULT_STARTING_PARAMS, tapCheckChance: 0, rememberChance: 0 };
    const { a, engine, events } = attempt({ temperature: 0, tap: 'off', params: never });
    expect(a.result).toBe('gaveUp');
    expect(events.filter((e) => e === 'crank').length).toBe(never.maxBursts);
    expect(engine.ignitionOn).toBe(false);
  });

  it('remembers the tap or the choke between goes some of the time', () => {
    let remembered = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const forgetful = { ...DEFAULT_STARTING_PARAMS, tapCheckChance: 0, coldChokeChance: 0 };
      if (attempt({ temperature: 0, seed, params: forgetful }).events.includes('remembered')) remembered++;
    }
    expect(remembered).toBeGreaterThan(5);
  });

  it('starts a warm quad straight away when she leaves the choke alone', () => {
    const sensible = { ...DEFAULT_STARTING_PARAMS, warmChokeChance: 0 };
    const { a, events } = attempt({ temperature: 1, tap: 'on', params: sensible });
    expect(a.result).toBe('running');
    expect(events.filter((e) => e === 'crank').length).toBe(1);
  });

  it('says it has flooded once, after a failed go, when the plug is fouled', () => {
    const forgetful = { ...DEFAULT_STARTING_PARAMS, rememberChance: 0 };
    const a = new StartingAttempt({ engine: Object.assign(new EngineModel({ initialTemperature: 1 }), { fouling: 0.8 }), fuel: new FuelSystem({ ...DEFAULT_FUEL_PARAMS, startTap: 'on' }), choke: 0 }, { params: forgetful });
    a.rethink();
    expect(a.events).toContain('flooded');
    a.events = [];
    a.rethink();
    expect(a.events).not.toContain('flooded');
  });
});
