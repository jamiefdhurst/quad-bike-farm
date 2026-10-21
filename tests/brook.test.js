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

  it('goes under the lane in a culvert: no channel across the tarmac and its verges, so the road is as level as it was', () => {
    const without = createTerrainHeight({ ...LAYOUT, hill: { ...LAYOUT.hill, brook: undefined } }, new Track(LAYOUT.trackPoints)).heightAt;
    for (const x of [lane.x - lane.halfWidth, lane.x, lane.x + lane.halfWidth]) {
      for (const z of [brook.zAt(x) - 1, brook.zAt(x), brook.zAt(x) + 1]) expect(heights.heightAt(x, z)).toBeCloseTo(without(x, z), 6);
    }
    expect(brook.mouths.map((m) => m.side)).toEqual([-1, 1]);
    expect(brook.waterAt(lane.x, brook.zAt(lane.x))).toBe(0);
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

  it('flows downhill to the west: the ground it starts on, by the spring beside the lane, is higher than where it joins the pasture\'s stream', () => {
    const at = (x) => heights.heightAt(x, brook.zAt(x));
    expect(at(brook.maxX - 30) - at(brook.minX)).toBeGreaterThan(4);
    // And never climbs more than a metre against the flow over any 20 m.
    for (let x = brook.minX; x < brook.maxX - 20; x += 5) expect(at(x + 20) - at(x), `x ${x}`).toBeGreaterThan(-1);
  });

  it('is drawn on the map from the hedge on', () => {
    const f = farmMapFeatures(LAYOUT, createFields(LAYOUT), new Track(LAYOUT.trackPoints));
    const beyond = f.stream.filter((p) => p.x > LAYOUT.hill.pasture.maxX);
    expect(beyond.length).toBeGreaterThan(10);
    expect(Math.max(...beyond.map((p) => p.x))).toBeLessThanOrEqual(f.bounds.maxX);
  });

  it('keeps the plain distant trees away from her yard and the lane beside it', () => {
    expect(nearNeighbourYard(LAYOUT, 245, 125, 45)).toBe(true);
    expect(nearNeighbourYard(LAYOUT, 180, 120, 45)).toBe(true);
    expect(nearNeighbourYard(LAYOUT, 20, 20, 45)).toBe(false);
  });
});
