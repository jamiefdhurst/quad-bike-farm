import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';

describe("The girls' cars' parking", () => {
  const { cars, road, dutchBarn } = LAYOUT;

  it('stands the cars on the tarmac pad in front of the Dutch barn, with room to walk between them', () => {
    for (const c of Object.values(cars)) {
      // every corner of a car's footprint (about 4.1 by 1.7 m, nosed in) on the tarmac, with half a metre to spare
      for (const [dx, dz] of [[-0.85, -2.05], [0.85, -2.05], [-0.85, 2.05], [0.85, 2.05]]) expect(Math.hypot(c.x + dx - road.pad.x, c.z + dz - road.z)).toBeLessThan(road.pad.radius - 0.5);
      expect(c.z).toBeGreaterThan(dutchBarn.z + dutchBarn.halfZ + 2); // clear of the barn's front edge
    }
    const xs = Object.values(cars).map((c) => c.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(5); // yours too, in the same row (#491)
    expect(new Set(Object.values(cars).map((c) => c.z)).size).toBe(1);
  });

  it('has no hard-standing by the main barn any more', () => {
    expect(LAYOUT.carStanding).toBeUndefined();
  });
});
