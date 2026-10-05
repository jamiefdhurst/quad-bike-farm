import { describe, it, expect } from 'vitest';
import { Faults, DEFAULT_FAULT_PARAMS, tyreSide, noticeable } from '../src/vehicle/faults.js';
import { EngineModel } from '../src/engine/engineModel.js';

const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const P = DEFAULT_FAULT_PARAMS;
const faults = (params = {}) => new Faults({ ...P, ...params }, seeded(3));
const ride = { running: true, speed: 8, throttle: 0.9 };

describe('faults starting', () => {
  it('start nothing while the quad is parked and off', () => {
    const f = faults({ punctureEvery: 1, beltEvery: 1, cableEvery: 1, carbEvery: 1 });
    for (let i = 0; i < 600; i++) f.update(0.1, { running: false, speed: 0, throttle: 0 });
    expect(f.any).toBe(false);
  });

  it('start in their own kind of use: a puncture and a belt need riding, a belt needs it hard', () => {
    const f = faults({ punctureEvery: 1, beltEvery: 1, cableEvery: 1e9, carbEvery: 1e9 });
    for (let i = 0; i < 100; i++) f.update(0.1, { running: true, speed: 0, throttle: 0 });
    expect(f.any).toBe(false);
    for (let i = 0; i < 100; i++) f.update(0.1, { running: true, speed: 8, throttle: 0.3 });
    expect(f.has('puncture')).toBe(true);
    expect(f.has('belt')).toBe(false);
    for (let i = 0; i < 100; i++) f.update(0.1, ride);
    expect(f.has('belt')).toBe(true);
  });

  it('are rare: over ten minutes of riding, a quad usually gets under two', () => {
    let total = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const f = new Faults({ ...P }, seeded(seed * 7919));
      for (let t = 0; t < 600; t += 0.1) f.update(0.1, ride);
      total += ['puncture', 'belt', 'cable', 'carb'].filter((k) => f.has(k)).length;
    }
    expect(total / 40).toBeGreaterThan(0.3);
    expect(total / 40).toBeLessThan(2);
  });

  it('only one of each at a time, and they get worse until fixed', () => {
    const f = faults();
    f.begin('carb');
    expect(f.begin('carb')).toBe(false);
    const before = f.levels.carb;
    for (let i = 0; i < 100; i++) f.update(0.1, { running: true, speed: 0, throttle: 0 });
    expect(f.levels.carb).toBeGreaterThan(before);
    for (let i = 0; i < 20000; i++) f.update(0.1, { running: true, speed: 0, throttle: 0 });
    expect(f.levels.carb).toBe(1);
  });

  it('a belt only wears while it is being ridden hard', () => {
    const f = faults({ beltEvery: 1e9 });
    f.begin('belt');
    const at = f.levels.belt;
    for (let i = 0; i < 100; i++) f.update(0.1, { running: true, speed: 8, throttle: 0.2 });
    expect(f.levels.belt).toBe(at);
    for (let i = 0; i < 100; i++) f.update(0.1, ride);
    expect(f.levels.belt).toBeGreaterThan(at);
  });
});

describe('puncture', () => {
  it('pulls the bars towards the flat tyre, a rear one half as much', () => {
    const f = faults();
    f.begin('puncture');
    f.levels.puncture = 1;
    f.tyre = 0; // front left
    expect(f.steerPull).toBeCloseTo(P.puncturePull);
    f.tyre = 1; // front right
    expect(f.steerPull).toBeCloseTo(-P.puncturePull);
    f.tyre = 3; // rear right
    expect(f.steerPull).toBeCloseTo(-P.puncturePull / 2);
    expect(tyreSide(2)).toBe(1);
  });

  it('costs a little drive, and nothing without one', () => {
    const f = faults();
    expect(f.steerPull).toBe(0);
    expect(f.driveFactor).toBe(1);
    f.begin('puncture');
    f.levels.puncture = 1;
    expect(f.driveFactor).toBeCloseTo(1 - P.punctureDrag);
  });
});

describe('sticking cable', () => {
  it('passes the throttle straight through when it is healthy', () => {
    const f = faults();
    expect(f.stickThrottle(0.1, 1, true)).toBe(1);
    expect(f.stickThrottle(0.1, 0, true)).toBe(0);
  });

  it('holds the throttle open after you let go, for longer the worse it is', () => {
    const hang = (level) => {
      const f = faults();
      f.begin('cable');
      f.levels.cable = level;
      f.stickThrottle(0.016, 1, true);
      let t = 0;
      while (f.stickThrottle(0.016, 0, true) > 0.05 && t < 30) t += 0.016;
      return t;
    };
    // A slightly stiff cable doesn't hang.
    expect(hang(0.1)).toBeLessThan(0.05);
    expect(hang(0.5)).toBeGreaterThan(1);
    expect(hang(1)).toBeGreaterThan(hang(0.5));
    expect(hang(1)).toBeLessThan(30);
  });

  it('pressing the throttle is never held back, and switching off frees it', () => {
    const f = faults();
    f.begin('cable');
    f.levels.cable = 1;
    f.stickThrottle(0.016, 1, true);
    expect(f.stickThrottle(0.016, 0, true)).toBeGreaterThan(0.9);
    expect(f.stickThrottle(0.016, 0.5, true)).toBeGreaterThan(0.5 - 1e-9);
    expect(f.stickThrottle(0.016, 0, false)).toBe(0);
  });
});

describe('putting it right', () => {
  it('fixing one clears it and says so; nothing to fix does nothing', () => {
    const f = faults();
    expect(f.fix('belt')).toBe(false);
    f.begin('belt');
    f.begin('puncture');
    expect(f.fix('belt')).toBe(true);
    expect(f.has('belt')).toBe(false);
    expect(f.has('puncture')).toBe(true);
    expect(f.slip).toBe(0);
    expect(f.events.at(-1)).toEqual({ type: 'fixed', kind: 'belt' });
    f.fix('puncture');
    expect(f.tyre).toBe(-1);
    expect(f.any).toBe(false);
  });

  it('noticeable ramps from nothing below the threshold', () => {
    expect(noticeable(0.2)).toBe(0);
    expect(noticeable(1)).toBe(1);
    expect(noticeable(0.65)).toBeCloseTo(0.5);
  });
});

describe('in the engine', () => {
  const run = (controls, seconds = 8) => {
    const e = new EngineModel({}, { random: seeded(11) });
    e.setTemperature(1);
    e.setIgnition(true);
    for (let t = 0; t < 8 && !e.isRunning; t += 1 / 60) e.update(1 / 60, { starter: true, choke: 0.4 });
    for (let t = 0; t < seconds; t += 1 / 60) e.update(1 / 60, controls);
    return e;
  };

  it('a slipping belt lets the revs run on past what the load holds', () => {
    const load = { throttle: 1, driveLoad: 0.8, resistLoad: 0.4 };
    const good = run(load);
    const slipping = run({ ...load, slip: 1 });
    expect(slipping.rpm).toBeGreaterThan(good.rpm + 800);
  });

  it('a dirty carb is rougher, weaker and more erratic', () => {
    const clean = run({}, 2);
    const dirty = run({ dirt: 1 }, 2);
    expect(dirty.roughness).toBeGreaterThan(clean.roughness + 0.2);
    expect(dirty.power).toBeLessThan(clean.power);
    expect(dirty.erratic).toBeGreaterThan(clean.erratic);
  });
});
