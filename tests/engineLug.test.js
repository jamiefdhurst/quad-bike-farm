import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';

// Small seeded PRNG so runs are repeatable.
function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DT = 1 / 60;

function running({ temperature = 1, choke = 0, seed = 1 } = {}) {
  const engine = new EngineModel({ initialTemperature: temperature }, { random: seededRandom(seed) });
  engine.setIgnition(true);
  for (let i = 0; i < 600 && !engine.isRunning; i++) engine.update(DT, { starter: true, choke });
  engine.update(DT, { choke });
  return engine;
}

/** Runs for `seconds` with fixed controls; returns the mean rpm over the last second and whether it stalled. */
function hold(engine, seconds, controls) {
  let stalled = false;
  let sum = 0;
  let n = 0;
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    engine.update(DT, controls);
    if (engine.events.some((e) => e.type === 'stalled')) stalled = true;
    if (i >= steps - 60) {
      sum += engine.rpm;
      n++;
    }
  }
  return { rpm: sum / n, stalled };
}

describe('labouring under drive load', () => {
  it('holds the revs lower the heavier the load, and flares back up when it goes', () => {
    const engine = running();
    const free = hold(engine, 2, { throttle: 1 }).rpm;
    const cruise = hold(engine, 2, { throttle: 1, driveLoad: 0.25 }).rpm;
    const climb = hold(engine, 2, { throttle: 1, driveLoad: 0.7, resistLoad: 0.6 }).rpm;
    const flare = hold(engine, 2, { throttle: 1 }).rpm;
    expect(free).toBeGreaterThan(engine.params.maxRpm - 100);
    expect(cruise).toBeLessThan(free - 300);
    expect(climb).toBeLessThan(cruise - 700);
    expect(climb).toBeGreaterThan(engine.params.idleRpmWarm + 1500);
    expect(flare).toBeGreaterThan(free - 100);
  });

  it('never stalls warm, however hard it is held down', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const engine = running({ seed });
      for (const throttle of [0.2, 0.5, 1]) {
        const r = hold(engine, 10, { throttle, driveLoad: 1, resistLoad: 1 });
        expect(r.stalled).toBe(false);
        expect(r.rpm).toBeGreaterThan(engine.params.idleRpmWarm);
      }
    }
  });

  it('stalls stone cold on choke when lugged up something steep', () => {
    let stalls = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const engine = running({ temperature: 0, choke: 1, seed });
      hold(engine, 2, { choke: 1 });
      const events = [];
      for (let i = 0; i < 180 && engine.isRunning; i++) {
        engine.update(DT, { choke: 1, throttle: 1, driveLoad: 1, resistLoad: 0.95 });
        events.push(...engine.events);
      }
      if (events.some((e) => e.type === 'stalled' && e.reason === 'lowRpm')) stalls++;
    }
    expect(stalls).toBe(10);
  });

  it('labours but keeps going stone cold when only pulling away on the flat', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const engine = running({ temperature: 0, choke: 1, seed });
      hold(engine, 2, { choke: 1 });
      const r = hold(engine, 3, { choke: 1, throttle: 1, driveLoad: 0.8, resistLoad: 0.1 });
      expect(r.stalled).toBe(false);
      expect(engine.targetRpm).toBeLessThan(engine.freeTargetRpm - 1000);
    }
  });

  it('runs lumpier labouring when cold, not when warm', () => {
    const cold = running({ temperature: 0.3, choke: 0.7 });
    hold(cold, 1, { choke: 0.7 });
    cold.update(DT, { choke: 0.7, throttle: 1 });
    const before = cold.roughness;
    cold.update(DT, { choke: 0.7, throttle: 1, driveLoad: 0.8, resistLoad: 0.6 });
    expect(cold.roughness).toBeGreaterThan(before + 0.1);

    const warm = running();
    warm.update(DT, { throttle: 1 });
    const warmBefore = warm.roughness;
    warm.update(DT, { throttle: 1, driveLoad: 0.8, resistLoad: 0.6 });
    expect(warm.roughness).toBeCloseTo(warmBefore, 2);
  });

  it('is turned over above idle on the overrun', () => {
    const engine = running();
    const idle = hold(engine, 3, {}).rpm;
    const overrun = hold(engine, 3, { overrunRpm: 600 }).rpm;
    expect(overrun - idle).toBeGreaterThan(450);
    expect(overrun - idle).toBeLessThan(750);
  });

  it('behaves exactly as before with no drive load', () => {
    const a = running({ seed: 4 });
    const b = running({ seed: 4 });
    for (let i = 0; i < 300; i++) {
      const throttle = i % 120 < 60 ? 1 : 0;
      a.update(DT, { throttle });
      b.update(DT, { throttle, driveLoad: 0, resistLoad: 0, overrunRpm: 0 });
    }
    expect(b.rpm).toBe(a.rpm);
  });
});
