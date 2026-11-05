import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { boundaryTreeBlocked } from '../src/world/boundaryTrees.js';
import { createQuarry, dealtLayout } from '../src/world/quarry.js';

describe('the farm\'s boundary tree line', () => {
  it('keeps off the pit\'s lead-in road, which runs from the gate across the line\'s two rows', () => {
    for (const seed of [1, 51, 123, 4242]) {
      const layout = dealtLayout(LAYOUT, seed);
      const lead = createQuarry(layout).roadPoints.filter((p) => p.t === 0);
      expect(lead.length, `seed ${seed}`).toBeGreaterThan(2);
      for (const p of lead) expect(boundaryTreeBlocked(layout, p.x, p.z), `seed ${seed} at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`).toBe(true);
    }
  });

  it('still keeps off the wood and still stands along the rest of the north boundary', () => {
    const w = LAYOUT.woods;
    expect(boundaryTreeBlocked(LAYOUT, (w.minX + w.maxX) / 2, (w.minZ + w.maxZ) / 2)).toBe(true);
    expect(boundaryTreeBlocked(LAYOUT, -100, -LAYOUT.fieldHalf - 10)).toBe(false); // west of the wood
    expect(boundaryTreeBlocked(LAYOUT, 220, -LAYOUT.fieldHalf - 10)).toBe(false); // east of the pit's field
    expect(boundaryTreeBlocked(LAYOUT, LAYOUT.fieldHalf + 0.5, -58)).toBe(false); // the east hedgerow oaks
    expect(boundaryTreeBlocked({ ...LAYOUT, quarry: undefined, woods: undefined }, 150, -92)).toBe(false);
  });
});
