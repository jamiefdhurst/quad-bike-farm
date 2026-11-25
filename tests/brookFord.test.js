import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { roadNetwork } from '../src/world/roads.js';
import { riversidePlaces } from '../src/world/riverPlaces.js';
import { waterGulp } from '../src/engine/water.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';

// The ford where the grass boundary track crosses the east brook (#1060): a raised bed with a short ramp at each end, a wade, and a worn landing on each bank.

const track = new Track(LAYOUT.trackPoints);
const heights = createTerrainHeight(LAYOUT, track);
const brook = heights.brook;
const net = roadNetwork(LAYOUT);
const loop = net.road('boundaryTrack');

// Where the boundary track meets the brook's line, found from the track and the brook alone (not from the ford).
const meets = (() => {
  const out = [];
  for (let s = 0; s + 0.25 <= loop.length; s += 0.25) {
    const p = net.pointAt('boundaryTrack', s);
    const q = net.pointAt('boundaryTrack', s + 0.25);
    if (p.x < brook.minX || p.x > brook.maxX) continue;
    const a = p.z - brook.zAt(p.x);
    const b = q.z - brook.zAt(q.x);
    if (a * b <= 0) out.push({ x: p.x + ((q.x - p.x) * a) / (a - b), z: p.z + ((q.z - p.z) * a) / (a - b) });
  }
  return out;
})();
const at = meets[0];
const standing = (x, z) => Math.max(0, brook.cutAt(x, z) - (brook.depthAt(x) - brook.waterDepthAt(x)));
const fast = 9; // m/s: well over the speed a wade is safe at
const level = 3; // m either side of the track's middle the ford's bed is level, about 6 m

describe('the boundary track and the east brook (#1060)', () => {
  it('meets the brook once, past the river, going across it', () => {
    expect(meets).toHaveLength(1);
    expect(brook.riverK(at.x)).toBe(0);
  });

  it('crosses it by a ford whose level bed the whole width of the track lies on', () => {
    const ford = brook.ford();
    expect(ford).not.toBeNull();
    expect(Math.abs(ford.x - at.x)).toBeLessThan(ford.reach - loop.halfWidth);
    expect(ford.reach * 2).toBeGreaterThanOrEqual(5.5);
    expect(ford.reach * 2).toBeLessThanOrEqual(7);
    // The ford's middle is on the track.
    let best = Infinity;
    for (let s = 0; s <= loop.length; s += 0.5) {
      const p = net.pointAt('boundaryTrack', s);
      best = Math.min(best, Math.hypot(p.x - ford.x, p.z - ford.z));
    }
    expect(best).toBeLessThan(loop.halfWidth);
  });

  it('has at most 0.2 m of water standing anywhere over the ford\'s level bed, none of it deep, and no gulp for an engine ridden through fast', () => {
    const worst = { stand: 0, deep: 0, gulp: 0 };
    for (let x = at.x - level; x <= at.x + level + 1e-6; x += 0.25) {
      const half = brook.halfAt(x);
      for (let z = brook.zAt(x) - half - 1.5; z <= brook.zAt(x) + half + 1.5; z += 0.1) {
        worst.stand = Math.max(worst.stand, standing(x, z));
        worst.deep = Math.max(worst.deep, brook.deepAt(x, z));
        worst.gulp = Math.max(worst.gulp, waterGulp(brook.waterAt(x, z), fast, DEFAULT_ENGINE_PARAMS));
      }
    }
    expect(worst.stand).toBeGreaterThan(0.05); // it is still water
    expect(worst.stand).toBeLessThanOrEqual(0.2 + 1e-6); // at most 0.2 m, give or take the sums' rounding
    expect(worst.deep).toBe(0);
    expect(worst.gulp).toBe(0);
  });

  it('leaves the brook as it was beyond its ramps, and its surface where it was over it', () => {
    for (const side of [-1, 1]) {
      const x = at.x + side * 8;
      expect(standing(x, brook.zAt(x))).toBeGreaterThan(0.3);
      expect(waterGulp(brook.waterAt(x, brook.zAt(x)), fast, DEFAULT_ENGINE_PARAMS)).toBeGreaterThan(0);
    }
    // The water's surface (the ground at the middle less the cut plus the water) has no step at the ford.
    const surface = (x) => heights.heightAt(x, brook.zAt(x)) + brook.waterDepthAt(x);
    for (let x = at.x - 7; x < at.x + 7; x += 0.5) expect(Math.abs(surface(x + 0.5) - surface(x)), `${x}`).toBeLessThan(0.06);
  });

  it('comes down each bank to the water by a worn landing: no step over 0.15 m in half a metre along the track, and mud on both banks', () => {
    for (const dx of [-1, 0, 1]) {
      const x = at.x + dx;
      let last = null;
      for (let z = brook.zAt(x) - 8; z <= brook.zAt(x) + 8; z += 0.5) {
        const h = heights.heightAt(x, z);
        if (last !== null) expect(Math.abs(h - last), `${x.toFixed(1)}, ${z.toFixed(1)}`).toBeLessThan(0.15);
        last = h;
      }
    }
    for (const side of [-1, 1]) {
      const edge = brook.zAt(at.x) + side * brook.halfAt(at.x);
      expect(brook.mudAt(at.x, edge + side * 1.5)).toBeGreaterThan(0.5);
    }
    expect(brook.mudAt(at.x + 15, brook.zAt(at.x + 15) + brook.halfAt(at.x + 15) + 1.5)).toBe(0);
  });

  it('keeps the brook\'s rushes, sedge and reeds off its landings', () => {
    const places = riversidePlaces(LAYOUT, brook, { roads: net });
    const ford = brook.ford();
    const on = (p) => Math.abs(p.x - ford.x) < ford.reach && Math.abs(p.z - ford.z) < brook.halfAt(ford.x) + 5;
    expect([...places.rushes, ...places.sedge, ...places.brookReeds].filter(on)).toEqual([]);
  });
});
