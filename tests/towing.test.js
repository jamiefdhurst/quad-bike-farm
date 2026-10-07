import { describe, it, expect } from 'vitest';
import { towLoad, towEffect, DEFAULT_TOW_PARAMS as P } from '../src/vehicle/towing.js';

describe('towing', () => {
  it('weighs the trailer, the girl and what is loaded', () => {
    expect(towLoad(0, 0)).toBe(P.emptyKg);
    expect(towLoad(1, 2)).toBe(P.emptyKg + P.girlKg + 2 * P.itemKg);
  });

  it('costs nothing with nothing hitched, and more the more is in it', () => {
    expect(towEffect(0, false)).toEqual({ driveFactor: 1, brakeFactor: 1 });
    const empty = towEffect(towLoad(0, 0), false);
    const full = towEffect(towLoad(1, 3), false);
    expect(empty.driveFactor).toBeLessThan(1);
    expect(full.driveFactor).toBeLessThan(empty.driveFactor);
    expect(full.brakeFactor).toBeLessThan(empty.brakeFactor);
  });

  it('never takes more than the floor, and the tractor barely notices', () => {
    expect(towEffect(5000, false).driveFactor).toBe(P.minDrive);
    expect(towEffect(5000, false).brakeFactor).toBe(P.minBrake);
    const kg = towLoad(1, 3);
    expect(towEffect(kg, true).driveFactor).toBeGreaterThan(towEffect(kg, false).driveFactor);
    expect(towEffect(kg, true).driveFactor).toBeGreaterThan(0.9);
  });
});
