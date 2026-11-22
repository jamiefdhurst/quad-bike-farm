import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { Flock, DEFAULT_FLOCK_PARAMS, FLOCK_PARAM_RANGES } from '../src/world/flock.js';
import { moorFlockOn, moorFlockAllowed, moorFlockCentre, LANE_FLOCK_REACH } from '../src/world/moorFlock.js';
import { createRandom } from '../src/core/random.js';

const two = LAYOUT;
const heights = createTerrainHeight(two, new Track(two.trackPoints));
const moor = heights.moor;
const gridZ = two.moor.grids.map((g) => g.near[1]).sort((a, b) => a - b);
const allowed = moorFlockAllowed(moor, gridZ);
const centre = moorFlockCentre(moor, two.moor.gate);

describe('the Moor\'s summer flock (#821)', () => {
  it('is up from May to September and not the rest of the year', () => {
    const months = Array.from({ length: 12 }, (_, month) => moorFlockOn({ month }));
    expect(months).toEqual([false, false, false, false, true, true, true, true, true, false, false, false]);
  });

  it('is twelve sheep by default, tunable, and none with the count at 0', () => {
    expect(DEFAULT_FLOCK_PARAMS.moorCount).toBe(12);
    expect(FLOCK_PARAM_RANGES.moorCount).toEqual([0, 30, 1]);
  });

  it('may stand on the common, and on the lane\'s west half between the grids, but not on the lane outside them, in a flush, on a peat bank or at the wall', () => {
    const z = (gridZ[0] + gridZ[1]) / 2;
    const edge = moor.laneEdge(z);
    expect(allowed(edge - 40, z + 10)).toBe(moor.clear(edge - 40, z + 10) && moor.wetAt(edge - 40, z + 10) <= 0.3 && moor.reliefAt(edge - 40, z + 10) <= 0.25);
    expect(allowed(edge + LANE_FLOCK_REACH - 0.2, z)).toBe(true);
    expect(allowed(edge + LANE_FLOCK_REACH + 1, z)).toBe(false); // the east half and the farm's verge
    expect(allowed(moor.laneEdge(gridZ[0] - 20) + 0.5, gridZ[0] - 20)).toBe(false);
    expect(allowed(moor.laneEdge(gridZ[0] - 20) - 5, gridZ[0] - 20)).toBe(moor.clear(moor.laneEdge(gridZ[0] - 20) - 5, gridZ[0] - 20)); // the verge only counts between the grids // on the lane short of the first grid
    const f = two.moor.flushes[0];
    expect(allowed(f.x, f.z)).toBe(false);
    expect(allowed(two.moor.wall.points[3][0], two.moor.wall.points[3][1])).toBe(false);
  });

  it('is put down on the common by the moor gate, twelve of them, all on allowed ground, and keeps to it for ten minutes of grazing', () => {
    const random = createRandom(7);
    const flock = new Flock({ allowed, random, params: { ...DEFAULT_FLOCK_PARAMS }, count: DEFAULT_FLOCK_PARAMS.moorCount });
    expect(flock.place(centre)).toBe(12);
    for (const s of flock.sheep) expect(allowed(s.x, s.z)).toBe(true);
    let onLane = 0;
    for (let i = 0; i < 600 * 10; i++) {
      flock.update(0.1, []);
      onLane += flock.sheep.filter((s) => s.x >= moor.laneEdge(s.z) - 2.2).length;
    }
    for (const s of flock.sheep) expect(allowed(s.x, s.z)).toBe(true);
    expect(onLane).toBeGreaterThan(0); // they do wander onto the road, for Amy to watch for
  });
});
