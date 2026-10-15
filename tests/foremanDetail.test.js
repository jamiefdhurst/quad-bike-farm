import { describe, it, expect } from 'vitest';
import { rackDetailPoints } from '../src/vehicle/foremanDetail.js';

// The red quad's finer detail (TODO 88): where the rack's welds and hooks go, which is the part that is pure.
describe('the Foreman’s rack detail', () => {
  const rack = { z0: 0.48, z1: 0.92, y: 0.84, slats: 5 };

  it('welds every slat to both side rails and both inner rails, and the legs where they start', () => {
    const { welds } = rackDetailPoints(rack);
    expect(welds.filter((w) => Math.abs(w[0]) === 0.41 && w[2] > 0.5 && w[2] < 0.9).length).toBeGreaterThanOrEqual(8); // slats × two sides
    expect(welds.filter((w) => Math.abs(w[0]) === 0.16).length).toBe(8); // slats (4) × two inner rails
    for (const [, , z] of welds) expect(z).toBeGreaterThanOrEqual(rack.z0 - 1e-9), expect(z).toBeLessThanOrEqual(rack.z1 + 1e-9);
  });

  it('puts two tie-down hooks on each outer rail, outside it, and the rear rack (which runs backwards) the same', () => {
    for (const r of [rack, { z0: -0.8, z1: -1.0, y: 0.92, slats: 3 }]) {
      const { hooks } = rackDetailPoints(r);
      expect(hooks.length).toBe(4);
      for (const [x, , z, side] of hooks) {
        expect(Math.abs(x)).toBeGreaterThan(0.41);
        expect(Math.sign(x)).toBe(side);
        expect(z).toBeGreaterThan(Math.min(r.z0, r.z1));
        expect(z).toBeLessThan(Math.max(r.z0, r.z1));
      }
    }
  });
});
