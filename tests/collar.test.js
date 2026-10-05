import { describe, it, expect } from 'vitest';
import { collarSection } from '../src/npc/outfit.js';

describe('collarSection', () => {
  it('stands up from the neckline, folds over and comes back down', () => {
    const rows = collarSection(0);
    const heights = rows.map(([h]) => h);
    expect(heights[0]).toBe(0);
    expect(Math.max(...heights)).toBeGreaterThan(0.015);
    expect(heights[heights.length - 1]).toBeLessThan(0);
    // Moves outwards over the crease so the flap lies outside the stand.
    expect(rows[3][1]).toBeGreaterThan(rows[1][1]);
  });

  it('runs the flap longer towards the opening so it ends in a point', () => {
    const plain = collarSection(0).at(-1)[0];
    const pointed = collarSection(1).at(-1)[0];
    expect(pointed).toBeLessThan(plain);
  });
});
