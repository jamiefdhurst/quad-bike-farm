import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { bogGrip, DEFAULT_BOG_PARAMS } from '../src/vehicle/bog.js';

const two = layoutNew(LAYOUT, RAW_LAYOUT);
const heights = createTerrainHeight(two, new Track(two.trackPoints));
const flush = two.moor.flushes[0];

describe('the Moor\'s wet flushes bog a quad (#821)', () => {
  it('is a deep bog in a flush\'s middle, less at its edge and none on the dry heather beside it', () => {
    const middle = heights.bogAt(flush.x, flush.z);
    const edge = heights.bogAt(flush.x + flush.rx * 0.85, flush.z);
    const dry = heights.bogAt(flush.x + flush.rx * 1.5, flush.z);
    expect(middle).toBeGreaterThan(0.8);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(middle);
    expect(dry).toBe(0);
  });

  it('every flush bogs at its middle, loses grip there, and is muddy underfoot', () => {
    for (const f of two.moor.flushes) {
      expect(heights.bogAt(f.x, f.z)).toBeGreaterThan(0.8);
      expect(bogGrip(heights.bogAt(f.x, f.z), DEFAULT_BOG_PARAMS)).toBeLessThan(0.45);
      expect(heights.mudAt(f.x, f.z)).toBe(1);
    }
  });

  it('is a bog only on the Moor: today\'s farm has the same bogs as before', () => {
    expect(createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints)).moor).toBeNull();
  });
});
