import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createWoods, woodsPlants } from '../src/world/woods.js';
import { createFields } from '../src/world/fields.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { createRandom } from '../src/core/random.js';

const woods = createWoods(LAYOUT);
const fields = createFields(LAYOUT);
const track = new Track(LAYOUT.trackPoints);
const heights = createTerrainHeight(LAYOUT, track);
const h = heights.heightAt;
const W = LAYOUT.woods;
const half = W.circuit.halfWidth;

/** The circuit's points at every metre round. */
const lap = () => Array.from({ length: Math.floor(woods.track.totalLength) }, (_, m) => woods.at(m));

describe('the wood through the north gate', () => {

  it('has its own circuit name, different from the home track', () => {
    expect(W.circuit.name).toBeTruthy();
    expect(W.circuit.name).not.toBe(LAYOUT.trackName);
    expect(woods.circuitName).toBe(W.circuit.name);
  });

  it('leaves the farm exactly as it was', () => {
    const flat = createTerrainHeight({ ...LAYOUT, woods: undefined }, track).heightAt;
    for (let x = -80; x <= 200; x += 7) for (let z = -80; z <= 80; z += 7) expect(h(x, z)).toBe(flat(x, z));
    for (let x = -80; x <= 80; x += 2) expect(h(x, -79.9)).toBe(flat(x, -79.9));
  });

  it('runs in over the gate with no step in the ground', () => {
    for (let x = -80; x <= 80; x += 4) expect(Math.abs(h(x, -80.2) - h(x, -79.8))).toBeLessThan(0.05);
    expect(Math.abs(woods.profile(W.gate.x, -80))).toBeLessThan(1e-9);
  });


  it('is hedged on its other three sides', () => {
    const lines = fields.hedges.filter((e) => e.z1 <= W.minZ + 0.1 || e.x1 === W.minX || e.x1 === W.maxX);
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });

});

describe('the Hollow Run', () => {
  const pts = lap();

  it('stays inside the wood, clear of the hedges', () => {
    for (const p of pts) expect(woods.inWoods(p.x, p.z, half + 4)).toBe(true);
  });

  it('never crosses or runs close alongside itself', () => {
    let worst = Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      for (let j = i + 25; j < pts.length; j += 2) {
        if (pts.length - (j - i) < 25) continue;
        worst = Math.min(worst, Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z));
      }
    }
    expect(worst).toBeGreaterThan(half * 2 + 8);
  });

  it('has no bend a quad cannot take', () => {
    let tightest = Infinity;
    for (let m = 0; m < pts.length; m++) {
      const a = pts[(m - 4 + pts.length) % pts.length];
      const b = pts[m];
      const c = pts[(m + 4) % pts.length];
      const ab = Math.hypot(b.x - a.x, b.z - a.z);
      const bc = Math.hypot(c.x - b.x, c.z - b.z);
      const ac = Math.hypot(c.x - a.x, c.z - a.z);
      const area2 = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
      if (area2 > 1e-6) tightest = Math.min(tightest, (ab * bc * ac) / (2 * area2));
    }
    expect(tightest).toBeGreaterThan(4.5);
  });

  it('is a different sort of lap from the home track: narrower, twistier, hillier', () => {
    expect(half).toBeLessThan(LAYOUT.trackHalfWidth);
    expect(woods.track.totalLength).toBeGreaterThan(450);
    let climb = 0;
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of pts) {
      const y = h(p.x, p.z);
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
    climb = hi - lo;
    expect(climb).toBeGreaterThan(2.5);
  });

  it('is not too steep to ride along, including over the whoops and up the swell', () => {
    let steepest = 0;
    for (let m = 1; m < pts.length; m++) steepest = Math.max(steepest, Math.abs(h(pts[m].x, pts[m].z) - h(pts[m - 1].x, pts[m - 1].z)));
    expect(steepest).toBeLessThan(0.4);
  });

  it('is bedded below the ground beside it, with a berm on the outside of its tight bends', () => {
    let berms = 0;
    for (const p of pts) {
      const bed = h(p.x, p.z);
      const beside = [h(p.x - p.tz * (half + 1.6), p.z + p.tx * (half + 1.6)), h(p.x + p.tz * (half + 1.6), p.z - p.tx * (half + 1.6))];
      if (Math.max(...beside) - bed > 0.35) berms++;
    }
    expect(berms).toBeGreaterThan(20);
  });

  it('has whoops on its first straight, each lifting the track by about their height', () => {
    expect(woods.whoops).toHaveLength(W.whoops.count);
    const without = createTerrainHeight({ ...LAYOUT, woods: { ...W, whoops: { ...W.whoops, count: 0 } } }, track).heightAt;
    for (const p of woods.whoops) expect(h(p.x, p.z) - without(p.x, p.z)).toBeCloseTo(W.whoops.rise, 1);
    const last = woods.whoops[woods.whoops.length - 1];
    expect(h(last.x + last.tx * 12, last.z + last.tz * 12) - without(last.x + last.tx * 12, last.z + last.tz * 12)).toBeCloseTo(0, 5);
  });

  it('is muddy underfoot, and has its bogs on the track', () => {
    for (const p of [pts[40], pts[300]]) expect(heights.mudAt(p.x, p.z)).toBeGreaterThan(0.7);
    expect(heights.bogs.length).toBe(LAYOUT.bogs.length + W.bogs.length);
    for (const b of woods.bogs) expect(woods.nearest(b.x, b.z).d).toBeLessThan(0.3);
  });


  it('has logs across the track that leave a gap to ride through', () => {
    expect(woods.logs).toHaveLength(W.logs.length);
    for (const l of woods.logs) {
      const reach = Math.abs(woods.nearest(l.x, l.z).d);
      expect(reach).toBeLessThan(half);
      // The log covers the far edge but not the whole width.
      expect(l.len).toBeLessThan(half * 2 - 1);
    }
  });
});

describe('the pond and the trees', () => {
  it('has a pond that holds water like the south one, clear of the track', () => {
    const p = woods.pond;
    expect(woods.waterAt(p.x, p.z)).toBe(1);
    expect(heights.puddleAt(p.x, p.z)).toBe(1);
    expect(woods.waterAt(p.x + p.rx * 1.2, p.z)).toBe(0);
    expect(woods.trackDistance(p.x, p.z) - p.rx).toBeGreaterThan(half);
    // Shin to knee deep at its edge, like the meadow's.
    expect(p.water).toBeLessThan(0.7);
  });

  it('plants the trees clear of the track, the pond and the bogs, and not too close together', () => {
    const { trees, bushes } = woodsPlants(woods, LAYOUT, createRandom(7));
    expect(trees.length).toBeGreaterThanOrEqual(W.trees * 0.9);
    expect(bushes.length).toBeGreaterThan(W.bushes * 0.8);
    for (const [x, z] of trees) {
      expect(woods.trackDistance(x, z)).toBeGreaterThan(half + 2.4);
      expect(woods.inWoods(x, z, 3)).toBe(true);
      expect(Math.hypot((x - woods.pond.x) / woods.pond.rx, (z - woods.pond.z) / woods.pond.rz)).toBeGreaterThan(1.4);
      for (const b of woods.bogs) expect(Math.hypot(x - b.x, z - b.z)).toBeGreaterThan(b.radius);
    }
    for (let i = 0; i < trees.length; i++) for (let j = i + 1; j < trees.length; j++) expect(Math.hypot(trees[i][0] - trees[j][0], trees[i][1] - trees[j][1])).toBeGreaterThan(5.9);
  });

  it('keeps the trees off the lead-in from the gate', () => {
    const { trees } = woodsPlants(woods, LAYOUT, createRandom(3));
    for (const [x, z] of trees) expect(Math.abs(x - W.gate.x) < half + 2.4 && z > W.maxZ - 24).toBe(false);
  });

});
