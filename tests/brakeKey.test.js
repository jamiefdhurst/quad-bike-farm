import { describe, it, expect } from 'vitest';
import { stepBrakeKey, DEFAULT_BRAKE_KEY_PARAMS as P } from '../src/vehicle/brakeKey.js';

const hold = (seconds, dt = 1 / 60) => {
  let level = 0;
  for (let t = 0; t < seconds - 1e-9; t += dt) level = stepBrakeKey(level, true, dt, P);
  return level;
};

describe('stepBrakeKey', () => {
  it('starts at a part brake, not full', () => {
    expect(stepBrakeKey(0, true, 1 / 60, P)).toBeCloseTo(P.start);
  });

  it('builds to full over the rise time and stays there', () => {
    expect(hold(P.rise / 2)).toBeGreaterThan(P.start);
    expect(hold(P.rise / 2)).toBeLessThan(1);
    expect(hold(P.rise + 0.05)).toBe(1);
    expect(hold(3)).toBe(1);
  });

  it('lets go at once', () => {
    expect(stepBrakeKey(0.8, false, 1 / 60, P)).toBe(0);
  });

  it('is snatched full on with no rise time', () => {
    expect(stepBrakeKey(0, true, 1 / 60, { start: 0.35, rise: 0 })).toBe(1);
  });
});
