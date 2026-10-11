import { describe, it, expect } from 'vitest';
import { RiderLean, DEFAULT_RIDER_LEAN_PARAMS, RIDER_LEAN_RANGES } from '../src/vehicle/riderLean.js';

const run = (r, s, seconds = 3) => {
  for (let i = 0; i < seconds * 60; i++) r.update(1 / 60, s);
  return r;
};

describe('rider lean', () => {
  it('has a range for every param', () => {
    expect(Object.keys(RIDER_LEAN_RANGES).sort()).toEqual(Object.keys(DEFAULT_RIDER_LEAN_PARAMS).sort());
  });

  it('leans to the inside, left for positive bars', () => {
    const l = run(new RiderLean(), { bars: 1, speed: 10, aboard: true });
    expect(l.shift).toBeCloseTo(DEFAULT_RIDER_LEAN_PARAMS.maxShift, 1);
    expect(l.torque).toBeGreaterThan(0);
    const r = run(new RiderLean(), { bars: -1, speed: 10, aboard: true });
    expect(r.torque).toBeLessThan(0);
  });

  it('takes a moment to get the weight over', () => {
    const l = run(new RiderLean(), { bars: 1, speed: 10, aboard: true }, 0.1);
    expect(l.shift).toBeLessThan(DEFAULT_RIDER_LEAN_PARAMS.maxShift * 0.5);
  });

  it('asks for less at slow speed, nothing reversing or with nobody on', () => {
    const fast = run(new RiderLean(), { bars: 1, speed: 10, aboard: true }).shift;
    expect(run(new RiderLean(), { bars: 1, speed: 3, aboard: true }).shift).toBeLessThan(fast);
    expect(run(new RiderLean(), { bars: 1, speed: -3, aboard: true }).shift).toBe(0);
    const empty = run(new RiderLean(), { bars: 1, speed: 10, aboard: false });
    expect(empty.torque).toBe(0);
  });

  it('a girl leans less, and the weight comes back to the middle', () => {
    const girl = run(new RiderLean(), { bars: 1, speed: 10, aboard: true, girl: true }).shift;
    expect(girl).toBeLessThan(DEFAULT_RIDER_LEAN_PARAMS.maxShift);
    const l = run(new RiderLean(), { bars: 1, speed: 10, aboard: true });
    run(l, { bars: 0, speed: 10, aboard: true });
    expect(Math.abs(l.shift)).toBeLessThan(0.01);
  });
});
