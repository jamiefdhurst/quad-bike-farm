import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { createFields } from '../src/world/fields.js';
import { createRiver } from '../src/world/river.js';
import { Track } from '../src/world/track.js';
import { DEFAULT_ENGINE_PARAMS as P } from '../src/engine/engineParams.js';
import { deepWaterGulp, stepWater } from '../src/engine/water.js';
import { farmMapFeatures, mapBounds } from '../src/hud/farmMap.js';

const heights = createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints));
const brook = heights.brook;
const fields = createFields(LAYOUT);
const river = createRiver(LAYOUT, brook);
const R = LAYOUT.hill.river;
const M = LAYOUT.hill.riverside;
const cx = R.crossing.x;
const across = (x, step = 0.5) => {
  const zc = brook.zAt(x);
  const out = [];
  for (let d = -brook.halfAt(x) - 3; d <= brook.halfAt(x) + 3; d += step) out.push(zc + d);
  return out;
};

describe('the river', () => {


  it('keeps its banks level across and its water in them: the ground either side of it is at one height, the water below both', () => {
    for (const x of [50, 58, 74]) {
      const zc = brook.zAt(x);
      const a = heights.heightAt(x, zc - brook.halfAt(x) - 2.5);
      const b = heights.heightAt(x, zc + brook.halfAt(x) + 2.5);
      expect(Math.abs(a - b), `x ${x}`).toBeLessThan(0.5);
      const surface = heights.heightAt(x, zc) + brook.waterDepthAt(x);
      expect(surface, `x ${x}`).toBeLessThan(Math.min(a, b));
    }
  });

});

describe('the crossing', () => {
  it('is a wade: shallow all the way across between the posts, under what takes in water at a gallop', () => {
    for (const x of [cx - R.crossing.half + 0.3, cx, cx + R.crossing.half - 0.3]) {
      for (const z of across(x)) {
        expect(heights.puddleAt(x, z), `${x},${z}`).toBeLessThan(P.waterDepthFrom);
        expect(brook.deepAt(x, z)).toBe(0);
      }
      const zc = brook.zAt(x);
      expect(brook.waterDepthAt(x)).toBeCloseTo(R.crossing.water, 2);
      expect(heights.heightAt(x, zc) + brook.waterDepthAt(x) - heights.heightAt(x, zc)).toBeLessThan(0.3);
    }
  });

  it('has a bed with no hole in it: the ground along any line across never drops more than a quad can take', () => {
    for (const x of [cx - 3, cx, cx + 3]) {
      const zs = across(x, 0.5);
      for (let i = 1; i < zs.length; i++) expect(Math.abs(heights.heightAt(x, zs[i]) - heights.heightAt(x, zs[i - 1])), `${x},${zs[i]}`).toBeLessThan(0.4);
    }
  });

  it('is marked by a line of posts across the river at each end of the shallows, the posts standing in the shallows or on the bank', () => {
    const posts = river.posts();
    expect(posts).toHaveLength(R.crossing.posts * 2);
    for (const p of posts) {
      expect(Math.abs(p.x - cx)).toBeLessThanOrEqual(R.crossing.half);
      expect(brook.deepAt(p.x, p.z)).toBe(0);
    }
    expect(new Set(posts.map((p) => p.line))).toEqual(new Set([-1, 1]));
    expect(river.zoneAt(cx, brook.zAt(cx))).toBe('crossing');
    expect(river.zoneAt(cx - 12, brook.zAt(cx - 12))).toBe('deep');
  });

  it('has a worn muddy landing on each bank, and none away from it', () => {
    const zc = brook.zAt(cx);
    expect(heights.mudAt(cx, zc - brook.halfAt(cx) - 1.2)).toBeGreaterThan(0.5);
    expect(heights.mudAt(cx, zc + brook.halfAt(cx) + 1.2)).toBeGreaterThan(0.5);
    expect(heights.mudAt(cx - 20, brook.zAt(cx - 20) + brook.halfAt(cx - 20) + 1.2)).toBeLessThan(0.1);
  });
});

describe('the riverside meadow', () => {



  it('stands its willows on the banks, clear of the water and the crossing', () => {
    const w = river.willows();
    expect(w.length).toBeGreaterThan(2);
    for (const t of w) {
      expect(brook.waterAt(t.x, t.z)).toBe(0);
      expect(Math.abs(t.x - cx)).toBeGreaterThan(R.crossing.half + 3);
      expect(t.x).toBeGreaterThan(M.minX);
      expect(t.x).toBeLessThan(M.maxX);
    }
  });
});
