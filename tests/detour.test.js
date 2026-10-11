import { describe, it, expect } from 'vitest';
import { detourVia, segmentHits } from '../src/npc/detour.js';

// A barn 10 by 9 centred on the origin, doorway in the +x wall.
const barn = { minX: -5, maxX: 5, minZ: -4.5, maxZ: 4.5, door: { x: 5, z: 0, halfWidth: 2.3 } };
const shed = { minX: 20, maxX: 24, minZ: -2, maxZ: 2 };

describe('segmentHits', () => {
  const r = { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
  it('sees a line through a box, and misses one beside it', () => {
    expect(segmentHits(r, { x: -3, z: 0 }, { x: 3, z: 0 })).toBe(true);
    expect(segmentHits(r, { x: -3, z: 2 }, { x: 3, z: 2 })).toBe(false);
    expect(segmentHits(r, { x: -3, z: 0 }, { x: -2, z: 0 })).toBe(false);
    expect(segmentHits(r, { x: 0, z: -3 }, { x: 0, z: 3 })).toBe(true);
  });
});

describe('detourVia', () => {
  it('leaves a clear way alone', () => {
    expect(detourVia({ x: 10, z: 10 }, { x: 30, z: 10 }, [barn, shed])).toBeNull();
  });

  it('sends her round a corner from the back of the barn to the yard, the near way', () => {
    const via = detourVia({ x: -8, z: 1 }, { x: 14, z: 1 }, [barn]);
    expect(Math.abs(via.x)).toBeGreaterThan(5);
    expect(Math.abs(via.z)).toBeGreaterThan(4.5);
    expect(via.z).toBeGreaterThan(0); // she is a little south of the middle, so the south corner is shorter
  });

  it('keeps the corner she chose once she is on the way', () => {
    const first = detourVia({ x: -8, z: 0.1 }, { x: 14, z: 0 }, [barn]);
    const later = detourVia({ x: -8, z: -0.2 }, { x: 14, z: 0 }, [barn], undefined, first);
    expect(later).toEqual(first);
  });

  it('goes on round the second corner from the first', () => {
    const first = detourVia({ x: -8, z: 3 }, { x: 14, z: 3 }, [barn]);
    const second = detourVia({ x: first.x, z: first.z }, { x: 14, z: 3 }, [barn]);
    expect(second).toEqual({ x: 6.5, z: 6 }); // still behind the barn from the first corner: the next one along
    expect(detourVia(second, { x: 14, z: 3 }, [barn])).toBeNull(); // and from there it is clear
  });

  it('lines up on the doorway to go in, and goes straight in once there', () => {
    const lineUp = detourVia({ x: 12, z: 6 }, { x: -2, z: 0 }, [barn]);
    expect(lineUp).toEqual({ x: 6.8, z: 0 });
    expect(detourVia({ x: 6.8, z: 0 }, { x: -2, z: 0 }, [barn])).toBeNull();
  });

  it('takes her round the back and to the door when she is behind the barn and going in', () => {
    const via = detourVia({ x: -9, z: 0 }, { x: -2, z: 0 }, [barn]);
    expect(Math.abs(via.z)).toBeGreaterThan(4.5);
  });

  it('takes her out through the door from inside', () => {
    expect(detourVia({ x: -3, z: 2 }, { x: 14, z: 6 }, [barn])).toEqual({ x: 3.8, z: 0 });
    expect(detourVia({ x: 4, z: 0.5 }, { x: 14, z: 6 }, [barn])).toEqual({ x: 6.8, z: 0 });
    expect(detourVia({ x: 6.2, z: 0.5 }, { x: 14, z: 6 }, [barn])).toBeNull();
  });

  it('leaves her alone inside', () => {
    expect(detourVia({ x: -3, z: 2 }, { x: 2, z: -2 }, [barn])).toBeNull();
  });

  it('does not send her round the barn to a spot hard against its wall', () => {
    expect(detourVia({ x: -9, z: 0 }, { x: 5.4, z: -4.5 }, [barn])).not.toBeNull(); // a corner of the way, not the wall itself
    expect(detourVia({ x: 0, z: -9 }, { x: 0, z: -5.3 }, [barn])).toBeNull(); // a quad parked by the north wall
  });

  it('goes round a building with no door, and does not mind where she is against its wall', () => {
    expect(detourVia({ x: 18, z: 0 }, { x: 30, z: 0 }, [shed])).not.toBeNull();
    expect(detourVia({ x: 19.7, z: 0 }, { x: 30, z: 0 }, [shed])).toBeNull(); // hard against it: her own steering
  });
});
