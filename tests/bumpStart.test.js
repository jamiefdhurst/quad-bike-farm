import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { rollTurn, rollCatch, rollSpeedFor } from '../src/engine/bumpStart.js';

const P = DEFAULT_ENGINE_PARAMS;
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

/** A flat-battery engine rolled at `gearRpm` with the clutch out for up to `seconds`. Returns whether it caught. */
function roll(params, { gearRpm, gearLock = 1, seconds = 6, choke = 0.5, battery = 0, seed = 3 }) {
  const e = new EngineModel(params, { random: seeded(seed) });
  e.battery = battery;
  e.setTemperature(1);
  e.setIgnition(true);
  for (let t = 0; t < seconds && !e.isRunning; t += 1 / 60) e.update(1 / 60, { gearRpm, gearLock, choke });
  return e;
}

describe('rollTurn', () => {
  it('does nothing with the clutch in or too slowly', () => {
    expect(rollTurn(3000, 0.2, P)).toBe(0);
    expect(rollTurn(P.maxRpm * (P.rollMinFraction - 0.01), 1, P)).toBe(0);
  });
  it('turns it faster the faster it rolls, up to a starter\'s speed', () => {
    const slow = rollTurn(P.maxRpm * 0.15, 1, P);
    const fast = rollTurn(P.maxRpm * 0.3, 1, P);
    expect(slow).toBeGreaterThan(0);
    expect(fast).toBeGreaterThan(slow);
    expect(rollTurn(P.maxRpm, 1, P)).toBe(1);
  });
  it('catches more readily on a two-stroke', () => {
    expect(rollCatch({ ...P, strokes: 2 })).toBeGreaterThan(rollCatch({ ...P, strokes: 4 }));
  });
  it('wants more road speed in a higher gear', () => {
    expect(rollSpeedFor(8, P)).toBeGreaterThan(rollSpeedFor(4, P));
  });
});

describe('bump-starting', () => {
  it('fires a two-stroke with a flat battery', () => {
    const e = roll({ strokes: 2 }, { gearRpm: 0.4 * P.maxRpm });
    expect(e.isRunning).toBe(true);
  });
  it('cranks without the battery or the starter whirr', () => {
    const e = new EngineModel({}, { random: seeded(5) });
    e.battery = 0;
    e.setIgnition(true);
    e.update(1 / 60, { gearRpm: 0.4 * P.maxRpm, gearLock: 1 });
    expect(e.state).toBe('cranking');
    expect(e.events).not.toContain('starterOn');
  });
  it('does not turn over with the clutch in, with the key off or when seized', () => {
    const inn = roll({ strokes: 2 }, { gearRpm: 0.4 * P.maxRpm, gearLock: 0 });
    expect(inn.isRunning).toBe(false);
    expect(inn.state).not.toBe('cranking');
    const off = new EngineModel({ strokes: 2 }, { random: seeded(2) });
    for (let t = 0; t < 3; t += 1 / 60) off.update(1 / 60, { gearRpm: 0.4 * P.maxRpm, gearLock: 1 });
    expect(off.isRunning).toBe(false);
    const seized = new EngineModel({ strokes: 2 }, { random: seeded(2) });
    seized.setIgnition(true);
    seized.seized = true;
    seized.update(1 / 60, { gearRpm: 0.4 * P.maxRpm, gearLock: 1 });
    expect(seized.state).not.toBe('cranking');
  });
  it('stops turning when the clutch goes in again', () => {
    const e = new EngineModel({}, { random: seeded(9) });
    e.setIgnition(true);
    e.update(1 / 60, { gearRpm: 0.4 * P.maxRpm, gearLock: 1 });
    expect(e.state).toBe('cranking');
    e.update(1 / 60, { gearRpm: 0.4 * P.maxRpm, gearLock: 0 });
    expect(e.state).toBe('ignition');
  });
  it('is slower to catch on a four-stroke, and a longer roll helps', () => {
    let two = 0;
    let four = 0;
    for (let seed = 1; seed <= 20; seed++) {
      two += roll({ strokes: 2 }, { gearRpm: 0.2 * P.maxRpm, seconds: 2, seed }).isRunning ? 1 : 0;
      four += roll({ strokes: 4 }, { gearRpm: 0.2 * P.maxRpm, seconds: 2, seed }).isRunning ? 1 : 0;
    }
    expect(two).toBeGreaterThanOrEqual(four);
    expect(roll({ strokes: 4 }, { gearRpm: 0.35 * P.maxRpm, seconds: 20, seed: 4 }).isRunning).toBe(true);
  });
  it('will not fire on an empty tank', () => {
    const e = new EngineModel({ strokes: 2 }, { random: seeded(1) });
    e.setTemperature(1);
    e.setIgnition(true);
    for (let t = 0; t < 4; t += 1 / 60) e.update(1 / 60, { gearRpm: 0.4 * P.maxRpm, gearLock: 1, fuel: 0 });
    expect(e.isRunning).toBe(false);
  });
});
