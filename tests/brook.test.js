import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createBrook } from '../src/world/brook.js';
import { createHill } from '../src/world/hill.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { neighbourFarmShape, nearNeighbourYard } from '../src/world/neighbourFarm.js';
import { createFields } from '../src/world/fields.js';
import { farmMapFeatures } from '../src/hud/farmMap.js';

const brook = createBrook(LAYOUT);
const hill = createHill(LAYOUT);
const heights = createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints));
const lane = LAYOUT.publicLane;
const S = neighbourFarmShape(LAYOUT);

describe('the brook', () => {
  it('exists, and carries the pasture\'s stream on from the hedge with no step', () => {
    expect(brook).toBeTruthy();
    expect(brook.minX).toBe(LAYOUT.hill.pasture.maxX);
    expect(brook.zAt(brook.minX)).toBeCloseTo(hill.streamZ(brook.minX), 6);
    expect(brook.depthAt(brook.minX + 0.01)).toBeCloseTo(LAYOUT.hill.stream.depth, 1);
    expect(hill.channelAt(brook.minX + 5, hill.streamZ(brook.minX + 5))).toBe(0); // the hill's own channel stops at the hedge
  });

  it('runs on past the south of the neighbour\'s yard, well clear of its wall and levelled ground', () => {
    for (let x = S.outline.minX - 10; x <= S.outline.maxX + 10; x += 2) {
      expect(brook.zAt(x) - brook.halfAt(x) - S.outline.maxZ, `x ${x}`).toBeGreaterThan(5);
    }
  });


  it('is cut into the ground with water standing in the middle of it, and dry on the bank', () => {
    for (const x of [60, 100, 150, 190, 225]) {
      const z = brook.zAt(x);
      expect(brook.cutAt(x, z), `cut ${x}`).toBeGreaterThan(0.3);
      expect(brook.waterAt(x, z), `water ${x}`).toBeGreaterThan(0.5);
      expect(brook.waterAt(x, z + 6)).toBe(0);
      expect(heights.puddleAt(x, z)).toBeGreaterThan(0.5);
    }
  });


  it('is drawn on the map from the hedge on', () => {
    const f = farmMapFeatures(LAYOUT, createFields(LAYOUT), new Track(LAYOUT.trackPoints));
    const beyond = f.stream.filter((p) => p.x > LAYOUT.hill.pasture.maxX);
    expect(beyond.length).toBeGreaterThan(10);
    expect(Math.max(...beyond.map((p) => p.x))).toBeLessThanOrEqual(f.bounds.maxX);
  });

});
