import { describe, it, expect } from 'vitest';
import { tileInstances, distanceToTile, inDrawDistance } from '../src/world/tiles.js';

describe('tiles', () => {
  it('puts each instance in the tile it stands in, keeping their order', () => {
    const tiles = tileInstances([{ x: 1, z: 1 }, { x: 35, z: 2 }, { x: 5, z: 9 }, { x: -3, z: 4 }], 30);
    expect(tiles.map((t) => [t.key, t.indices])).toEqual([['0,0', [0, 2]], ['1,0', [1]], ['-1,0', [3]]]);
  });

  it('bounds a tile by what is in it, not by its square', () => {
    const [t] = tileInstances([{ x: 4, z: 6 }, { x: 10, z: 2 }], 30);
    expect([t.minX, t.maxX, t.minZ, t.maxZ]).toEqual([4, 10, 2, 6]);
  });

  it('leaves out empty tiles', () => {
    expect(tileInstances([{ x: 0, z: 0 }, { x: 100, z: 100 }], 10)).toHaveLength(2);
    expect(tileInstances([], 10)).toEqual([]);
  });

  it('measures from the nearest edge, nothing from inside', () => {
    const t = { minX: 0, maxX: 10, minZ: 0, maxZ: 10 };
    expect(distanceToTile(t, 5, 5)).toBe(0);
    expect(distanceToTile(t, 13, 5)).toBe(3);
    expect(distanceToTile(t, 13, 14)).toBe(5);
  });

  it('draws within the distance, and everything when there is no limit', () => {
    const t = { minX: 0, maxX: 10, minZ: 0, maxZ: 10 };
    expect(inDrawDistance(t, 80, 5, 75)).toBe(true);
    expect(inDrawDistance(t, 90, 5, 75)).toBe(false);
    expect(inDrawDistance(t, 900, 5, 0)).toBe(true);
    expect(inDrawDistance(t, 900, 5, undefined)).toBe(true);
  });
});
