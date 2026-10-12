import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';

describe("The girls' cars' parking", () => {
  const { cars, road, dutchBarn } = LAYOUT;

  it('stands both cars on the tarmac pad in front of the Dutch barn, with room to walk between them', () => {
    for (const c of Object.values(cars)) {
      expect(Math.hypot(c.x - road.pad.x, c.z - road.z)).toBeLessThan(road.pad.radius - 1.5);
      expect(c.z).toBeGreaterThan(dutchBarn.z + dutchBarn.halfZ + 2); // clear of the barn's front edge
    }
    expect(Math.abs(cars.fiesta.x - cars.corsa.x)).toBeGreaterThanOrEqual(5);
  });

  it('has no hard-standing by the main barn any more', () => {
    expect(LAYOUT.carStanding).toBeUndefined();
  });
});
