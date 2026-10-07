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

describe('what stands in the tipping trailer', () => {
  it('fits between the sides and the front wall, and clear of its neighbours, whichever item is in whichever spot', async () => {
    const { CARGO_SPOTS, CARGO_YAWS, CARGO_YAW, CARGO_FOOTPRINTS, TIP_TRAILER_SPEC: S } = await import('../src/vehicle/tipTrailerModel.js');
    const inner = S.halfWidth - 0.04; // the side wall is 0.04 thick
    const front = S.frontZ - 0.04;
    const turned = ([name, { w, d }]) => (Math.abs(Math.sin(CARGO_YAWS[name] ?? CARGO_YAW)) > 0.5 ? { w: d, d: w } : { w, d });
    const prints = Object.entries(CARGO_FOOTPRINTS).map(turned);
    for (const spot of CARGO_SPOTS) {
      for (const f of prints) {
        expect(Math.abs(spot.x) + f.w / 2).toBeLessThanOrEqual(inner);
        expect(spot.z + f.d / 2).toBeLessThanOrEqual(front);
      }
    }
    // The two widest things that could be side by side (three cans, the toolbox and the leads between them) need the spots' spacing.
    const widths = [...Array(3).fill(prints[0].w), prints[1].w, prints[2].w].sort((x, y) => y - x);
    for (let i = 1; i < CARGO_SPOTS.length; i++) expect(CARGO_SPOTS[i].x - CARGO_SPOTS[i - 1].x).toBeGreaterThanOrEqual((widths[0] + widths[1]) / 2);
  });
});
