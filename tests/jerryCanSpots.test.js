import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { randomJerryCanSpot, randomJerryCanSpots } from '../src/world/spawns.js';
import { createRandom } from '../src/core/random.js';

describe('where the jerry cans start', () => {
  it('puts the three cans at three different spots, each within the jitter of its spot', () => {
    for (let seed = 1; seed < 40; seed++) {
      const cans = randomJerryCanSpots(LAYOUT, createRandom(seed), 3);
      expect(new Set(cans.map((c) => c.where)).size).toBe(3);
      for (const c of cans) {
        const spot = LAYOUT.jerryCanSpots.find((s) => s.where === c.where);
        expect(Math.hypot(c.x - spot.x, c.z - spot.z)).toBeLessThanOrEqual(LAYOUT.jerryCanJitter * Math.SQRT2 + 1e-9);
      }
    }
  });

  it('varies from game to game, for the diesel and pre-mix cans as well as the petrol one', () => {
    const where = [0, 1, 2].map(() => new Set());
    for (let seed = 1; seed < 60; seed++) randomJerryCanSpots(LAYOUT, createRandom(seed), 3).forEach((c, i) => where[i].add(c.where));
    for (const s of where) expect(s.size).toBeGreaterThan(2);
  });

  it('gives the first can the place it always had for a seed', () => {
    for (let seed = 1; seed < 10; seed++) expect(randomJerryCanSpots(LAYOUT, createRandom(seed), 3)[0]).toEqual(randomJerryCanSpot(LAYOUT, createRandom(seed)));
  });

  it('never has more cans than spots', () => {
    expect(randomJerryCanSpots(LAYOUT, createRandom(1), 99)).toHaveLength(LAYOUT.jerryCanSpots.length);
  });
});
