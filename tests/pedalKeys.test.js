import { describe, it, expect } from 'vitest';
import { stepPedalKey, DEFAULT_BRAKE_KEY_PARAMS, DEFAULT_THROTTLE_KEY_PARAMS } from '../src/vehicle/pedalKeys.js';

const hold = (seconds, p, dt = 1 / 60) => {
  let level = 0;
  for (let t = 0; t < seconds - 1e-9; t += dt) level = stepPedalKey(level, true, dt, p);
  return level;
};

describe.each([
  ['brake', DEFAULT_BRAKE_KEY_PARAMS],
  ['throttle', DEFAULT_THROTTLE_KEY_PARAMS],
])('stepPedalKey for the %s', (name, P) => {
  it('starts part way in, not full', () => {
    expect(stepPedalKey(0, true, 1 / 60, P)).toBeCloseTo(P.start);
  });

  it('builds to full over the rise time and stays there', () => {
    expect(hold(P.rise / 2, P)).toBeGreaterThan(P.start);
    expect(hold(P.rise / 2, P)).toBeLessThan(1);
    expect(hold(P.rise + 0.05, P)).toBe(1);
    expect(hold(3, P)).toBe(1);
  });

  it('lets go at once', () => {
    expect(stepPedalKey(0.8, false, 1 / 60, P)).toBe(0);
  });
});

describe('stepPedalKey', () => {
  it('is full on at once with no rise time', () => {
    expect(stepPedalKey(0, true, 1 / 60, { start: 0.35, rise: 0 })).toBe(1);
  });

  it('gets a short blip past where the rev-off and the drag challenge count one', () => {
    expect(hold(0.15, DEFAULT_THROTTLE_KEY_PARAMS)).toBeGreaterThan(0.3);
  });
});
