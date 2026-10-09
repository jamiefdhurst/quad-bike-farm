import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';
import { ManualDrivetrain, DEFAULT_GEARBOX_PARAMS } from '../src/vehicle/manualDrivetrain.js';
import { LAND_ROVER_SPEC } from '../src/vehicle/quadSpecs.js';

// A manual with the clutch up turns at the road's pace in the gear it is in, whatever the throttle does (the CVT quads' revs jump to the throttle's).

function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const DT = 1 / 60;

function running() {
  const engine = new EngineModel({ initialTemperature: 1 }, { random: seededRandom(3) });
  engine.setIgnition(true);
  for (let i = 0; i < 600 && !engine.isRunning; i++) engine.update(DT, { starter: true });
  return engine;
}
const settle = (engine, seconds, controls) => {
  for (let i = 0; i < seconds / DT; i++) engine.update(DT, controls);
  return engine.rpm;
};

describe('engine gear lock', () => {
  it('holds the revs to the road speed at full throttle, instead of the throttle\'s', () => {
    const free = settle(running(), 4, { throttle: 1 });
    const locked = settle(running(), 4, { throttle: 1, gearRpm: 2000, gearLock: 1 });
    expect(free).toBeGreaterThan(5000);
    expect(locked).toBeGreaterThan(1850);
    expect(locked).toBeLessThan(2150);
  });

  it('follows the road speed up and down', () => {
    const e = running();
    const a = settle(e, 3, { throttle: 0.5, gearRpm: 1500, gearLock: 1 });
    const b = settle(e, 3, { throttle: 0.5, gearRpm: 3000, gearLock: 1 });
    const c = settle(e, 3, { throttle: 0, gearRpm: 2000, gearLock: 1 });
    expect(b).toBeGreaterThan(a + 1200);
    expect(c).toBeLessThan(b - 800);
    expect(c).toBeGreaterThan(1800);
  });

  it('leaves it free with the clutch down or in neutral, and below idle\'s worth of road speed', () => {
    const base = settle(running(), 3, { throttle: 1 });
    expect(settle(running(), 3, { throttle: 1, gearRpm: 2000, gearLock: 0 })).toBeCloseTo(base, -2);
    const slow = settle(running(), 3, { throttle: 1, gearRpm: 300, gearLock: 1 });
    expect(slow).toBeGreaterThan(base - 300);
  });

  it('is half-way when the clutch is half-way', () => {
    const half = settle(running(), 4, { throttle: 1, gearRpm: 2000, gearLock: 0.5 });
    const free = settle(running(), 4, { throttle: 1 });
    expect(half).toBeGreaterThan(2000 + 300);
    expect(half).toBeLessThan(free - 300);
  });
});

describe('a gear\'s revs at a road speed', () => {
  it('are speed over the gear\'s top speed times the full-throttle revs', () => {
    const d = new ManualDrivetrain({ maxSpeed: 24 }, { ...DEFAULT_GEARBOX_PARAMS, ...LAND_ROVER_SPEC.gearbox });
    d.setGear(2);
    const rpmAt = (mps) => (mps / d.topSpeed(2)) * 4200;
    expect(rpmAt(d.topSpeed(2))).toBe(4200);
    expect(rpmAt(d.topSpeed(2) / 2)).toBe(2100);
  });
});
