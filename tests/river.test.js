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
  it('is the brook widened: as narrow as the stream where it leaves the pasture, wide through the meadow, back to the brook beyond', () => {
    expect(brook.halfAt(brook.minX)).toBeCloseTo(LAYOUT.hill.stream.halfWidth * (0.55 + 0.45), 1);
    expect(brook.halfAt(cx)).toBeCloseTo(R.halfWidth, 1);
    expect(brook.halfAt(R.toX + 5)).toBeLessThan(2.2);
    expect(brook.halfAt(180)).toBeLessThan(2.2);
  });

  it('carries on east to the culvert and the spring, so it never meets the edge of the map', () => {
    expect(brook.maxX).toBeGreaterThan(LAYOUT.publicLane.x);
    expect(brook.culvert).toBeTruthy();
    const f = farmMapFeatures(LAYOUT, fields, new Track(LAYOUT.trackPoints));
    expect(f.stream.filter((p) => p.x > M.maxX).length).toBeGreaterThan(20);
    const b = mapBounds(fields);
    expect(f.areas.find((a) => a.kind === 'riverside')).toBeTruthy();
    expect(b.maxZ).toBeGreaterThan(M.maxZ);
  });

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

  it('is deep out in the stream and drowns an engine at any speed, but not over the crossing or in the brook', () => {
    for (const x of [48, cx - 9, cx + 9, 76]) expect(brook.deepAt(x, brook.zAt(x)), `x ${x}`).toBeCloseTo(1, 5);
    expect(brook.deepAt(cx, brook.zAt(cx))).toBe(0);
    expect(brook.deepAt(160, brook.zAt(160))).toBe(0);
    expect(brook.deepAt(brook.minX + 1, brook.zAt(brook.minX + 1))).toBe(0);
    // A second in the deep puts it past stalling; a dry bank puts nothing in.
    let w = 0;
    for (let t = 0; t < 1; t += 0.05) w = stepWater(w, 0.05, { gulp: deepWaterGulp(1, P), running: true }, P);
    expect(w).toBeGreaterThan(P.waterStallAt);
    expect(deepWaterGulp(0, P)).toBe(0);
    expect(deepWaterGulp(1, P, { scale: 0.4 })).toBeLessThan(deepWaterGulp(1, P));
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
  it('is a field of its own, hedged round, and the river runs through it', () => {
    expect(fields.areaOf(60, 150)).toBe('riverside');
    expect(fields.areaOf(60, 130)).toBe('riverside');
    expect(fields.areaOf(M.maxX + 5, 150)).toBe('out');
    expect(brook.minX).toBe(M.minX);
  });

  it('is entered through a gateway in the pasture\'s east hedge, which routes a girl in and out', () => {
    const into = fields.route({ x: 0, z: 170 }, { x: 55, z: 150 });
    expect(into.length).toBeGreaterThan(1);
    expect(Math.abs(into[0].x - (LAYOUT.hill.pasture.maxX - 2.5))).toBeLessThan(0.1);
    expect(fields.route({ x: 55, z: 150 }, { x: 0, z: 170 }).length).toBeGreaterThan(1);
    // Open at the gateway, shut everywhere else along that hedge.
    const east = fields.hedges.find((h) => h.x1 === LAYOUT.hill.pasture.maxX && h.z1 === LAYOUT.hill.pasture.minZ);
    expect(east.gaps).toHaveLength(1);
    expect(east.gaps[0].at).toBe(M.gate.z);
    expect(fields.hedgeAhead(30, M.gate.z, Math.PI / 2)).toBeGreaterThan(M.maxX - 30 - 1);
    expect(fields.hedgeAhead(30, M.gate.z + 12, Math.PI / 2)).toBeLessThan(6);
  });

  it('is shut in at the east end across the water by a hurdle, which spans the whole river', () => {
    const h = river.hurdle();
    expect(h.x).toBe(M.maxX);
    for (const z of across(M.maxX, 0.5)) {
      if (heights.puddleAt(M.maxX, z) > 0.05 || brook.cutAt(M.maxX, z) > 0.1) expect(Math.abs(z - h.z), `z ${z}`).toBeLessThan(h.half);
    }
    const gap = fields.hedges.find((e) => e.x1 === M.maxX && e.z1 === M.minZ).gaps[0];
    expect(gap.shut).toBe(true);
    expect(gap.at).toBeCloseTo(h.z, 6);
  });

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
