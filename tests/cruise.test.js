import { describe, it, expect } from 'vitest';
import { CruiseControl } from '../src/vehicle/cruise.js';
import { DEFAULT_VEHICLE_PARAMS } from '../src/vehicle/vehicleParams.js';

// A crude bike: throttle pushes, drag and rolling resistance hold it back, so
// some steady part throttle is needed to hold a speed.
function simulate(cruise, { speed, seconds, drag = 0.02, push = 4, slope = 0 }) {
  const dt = 1 / 60;
  let v = speed;
  const trace = [];
  for (let t = 0; t < seconds; t += dt) {
    const throttle = cruise.update(dt, v);
    v += (throttle * push - drag * v * v - 0.3 - slope) * dt;
    trace.push({ t, v, throttle });
  }
  return trace;
}

describe('cruise control', () => {
  const params = { ...DEFAULT_VEHICLE_PARAMS };

  it('settles on the speed it was engaged at', () => {
    const c = new CruiseControl(params);
    c.engage(9, 1);
    const trace = simulate(c, { speed: 9, seconds: 20 });
    const end = trace[trace.length - 1];
    expect(end.v).toBeGreaterThan(8.7);
    expect(end.v).toBeLessThan(9.3);
    expect(end.throttle).toBeGreaterThan(0);
    expect(end.throttle).toBeLessThan(1);
  });

  it('opens the throttle when slowed and closes it when too fast', () => {
    const c = new CruiseControl(params);
    c.engage(8, 0.5);
    const slow = c.update(1 / 60, 5);
    c.engage(8, 0.5);
    const fast = c.update(1 / 60, 11);
    expect(slow).toBeGreaterThan(0.5);
    expect(fast).toBeLessThan(0.5);
  });

  it('holds speed up a slope by finding more throttle', () => {
    const c = new CruiseControl(params);
    c.engage(7, 0.3);
    const trace = simulate(c, { speed: 7, seconds: 30, slope: 1.2 });
    const end = trace[trace.length - 1];
    expect(Math.abs(end.v - 7)).toBeLessThan(0.3);
  });

  it('stays within 0..max and does not wind up while pinned', () => {
    const c = new CruiseControl(params);
    c.engage(15, 1);
    // Held against a wall: no speed at all for a while.
    for (let i = 0; i < 600; i++) {
      const t = c.update(1 / 60, 0, 0.5);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(0.5);
    }
    // Free again and well over speed, it backs off straight away rather than unwinding.
    expect(c.update(1 / 60, 17, 0.5)).toBeLessThan(0.5);
    expect(c.integral).toBeLessThanOrEqual(0.5);
  });

  it('takes the magnitude of a reversing speed', () => {
    const c = new CruiseControl(params);
    c.engage(-3, 0.5);
    expect(c.target).toBe(3);
  });
});
