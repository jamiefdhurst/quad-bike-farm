import { describe, it, expect, vi } from 'vitest';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { createRandom } from '../src/core/random.js';

vi.stubGlobal('document', { createElement: () => fakeCanvas() });
const { rockGeometry } = await import('../src/world/quarryProps.js');

describe("the gravel pit's rocks", () => {
  const rocks = [1, 2, 3, 4, 5, 6].map((seed) => rockGeometry(createRandom(seed)));

  it('are closed and welded: indexed, every edge shared by exactly two triangles, so there are no cracks or loose faces', () => {
    for (const geo of rocks) {
      expect(geo.index).not.toBeNull();
      const edges = new Map();
      const idx = geo.index.array;
      for (let i = 0; i < idx.length; i += 3) {
        for (let k = 0; k < 3; k++) {
          const a = idx[i + k];
          const b = idx[i + ((k + 1) % 3)];
          const key = a < b ? `${a}_${b}` : `${b}_${a}`;
          edges.set(key, (edges.get(key) ?? 0) + 1);
        }
      }
      expect([...edges.values()].every((n) => n === 2)).toBe(true);
    }
  });

  it('are different shapes, about a metre across, with their base near the ground and smooth normals', () => {
    expect(new Set(rocks.map((g) => g.attributes.position.getX(7).toFixed(4))).size).toBeGreaterThan(3);
    for (const geo of rocks) {
      geo.computeBoundingBox();
      const { min, max } = geo.boundingBox;
      expect(max.x - min.x).toBeGreaterThan(0.5);
      expect(max.x - min.x).toBeLessThan(1.3);
      expect(min.y).toBeGreaterThan(-0.05);
      expect(min.y).toBeLessThan(0.1);
      expect(geo.attributes.normal.count).toBe(geo.attributes.position.count);
    }
  });
});
