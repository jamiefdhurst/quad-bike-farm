import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createWoods, woodsPlants } from '../src/world/woods.js';
import { createFields } from '../src/world/fields.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { createRandom } from '../src/core/random.js';
import { farmMapFeatures } from '../src/hud/farmMap.js';

const woods = createWoods(LAYOUT);
const fields = createFields(LAYOUT);
const track = new Track(LAYOUT.trackPoints);
const heights = createTerrainHeight(LAYOUT, track);
const T = LAYOUT.woods.trail;
const tt = woods.trailTrack;
const half = LAYOUT.woods.circuit.halfWidth;
const lap = () => Array.from({ length: Math.floor(tt.totalLength) }, (_, m) => woods.trailAt(m));

describe('the Fern Trail', () => {
  it('is a named, big enough loop of single track, narrower than the Hollow Run, inside the wood', () => {
    expect(T.name).toBe('The Fern Trail');
    expect(woods.trail.name).toBe(T.name);
    expect(tt.totalLength).toBeGreaterThan(350);
    expect(T.halfWidth).toBeLessThan(half);
    expect(T.halfWidth).toBeGreaterThanOrEqual(0.9); // a leaning bike needs room
    for (const p of lap()) expect(woods.inWoods(p.x, p.z, 4)).toBe(true);
  });

  it('only meets the Hollow Run at its four crossings', () => {
    let crossings = 0;
    let on = false;
    for (const p of lap()) {
      const d = woods.nearest(p.x, p.z).d;
      const touching = d < half + T.halfWidth;
      if (touching && !on) crossings++;
      on = touching;
    }
    expect(crossings).toBe(4);
  });

  it('never comes within 4 m of itself further round the loop', () => {
    const pts = lap();
    for (let i = 0; i < pts.length; i += 3) {
      for (let j = i + 25; j < pts.length; j += 3) {
        if (pts.length - j + i < 25) continue;
        expect(Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z)).toBeGreaterThan(4);
      }
    }
  });

  it('is rideable: no step steeper than 0.35 along it, and the ground is lower on its bed than beside it', () => {
    let last = null;
    for (let m = 0; m < tt.totalLength; m += 0.5) {
      const p = woods.trailAt(m);
      const y = heights.heightAt(p.x, p.z);
      if (last !== null) expect(Math.abs(y - last)).toBeLessThan(0.35 * 0.5);
      last = y;
    }
    const p = woods.trailAt(100);
    const beside = heights.heightAt(p.x - p.tz * 2.4, p.z + p.tx * 2.4);
    expect(heights.heightAt(p.x, p.z)).toBeLessThan(beside + 0.02);
  });

  it('has dips in the ground that are damp, and a firm bed elsewhere', () => {
    expect(T.dips.length).toBeGreaterThanOrEqual(2);
    const flat = createWoods({ ...LAYOUT, woods: { ...LAYOUT.woods, trail: { ...T, dips: [] } } });
    for (const d of T.dips) {
      const p = woods.trailAt(d.at);
      expect(flat.profile(p.x, p.z) - woods.profile(p.x, p.z)).toBeCloseTo(d.depth, 1);
      expect(woods.mudAt(p.x, p.z)).toBeGreaterThan(0.4);
      const out = woods.trailAt(d.at + d.len / 2 + 1);
      expect(flat.profile(out.x, out.z)).toBeCloseTo(woods.profile(out.x, out.z), 2);
    }
    const dry = woods.trailAt(140);
    expect(woods.mudAt(dry.x, dry.z)).toBeLessThan(0.2);
  });

  it('lays clusters of low roots across the path, none on a crossing, the log or a dip', () => {
    const roots = woods.trail.roots;
    expect(roots.length).toBeGreaterThanOrEqual(24);
    for (const r of roots) {
      expect(r.r).toBeLessThan(0.12); // a bump a wheel rolls over, not a log
      expect(r.len).toBeGreaterThan(2 * T.halfWidth); // right across the path
      expect(woods.nearest(r.x, r.z).d).toBeGreaterThan(half + T.halfWidth + 1);
      expect(Math.abs(r.at - T.hop.at)).toBeGreaterThanOrEqual(7);
      for (const d of T.dips) expect(Math.abs(r.at - d.at)).toBeGreaterThan(d.len / 2);
      // Lying across the way: its long side is square to the way on, give or take the jitter.
      const p = woods.trailAt(r.at);
      const along = Math.abs(Math.cos(r.yaw) * p.tx - Math.sin(r.yaw) * p.tz);
      expect(along).toBeLessThan(0.45);
    }
  });

  it('has one log right across it, thick enough to feel and low enough to hop', () => {
    const hop = woods.trail.hop;
    expect(hop.r).toBeGreaterThanOrEqual(0.15);
    expect(hop.r).toBeLessThanOrEqual(0.25);
    expect(hop.len).toBeGreaterThan(2 * T.halfWidth + 0.4);
    expect(woods.nearest(hop.x, hop.z).d).toBeGreaterThan(half + 2);
    const p = woods.trailAt(hop.at);
    expect(Math.hypot(p.x - hop.x, p.z - hop.z)).toBeLessThan(1e-6);
  });

  it('has way-marker posts about every 28 m, just off the right-hand edge and clear of the Hollow Run', () => {
    const posts = woods.trail.posts;
    expect(posts.length).toBeGreaterThanOrEqual(8);
    expect(posts.length).toBeLessThanOrEqual(Math.ceil(tt.totalLength / T.postEvery));
    for (const p of posts) {
      const c = woods.trailAt(p.at);
      expect(Math.hypot(p.x - c.x, p.z - c.z)).toBeCloseTo(T.halfWidth + 0.7, 1);
      // On the right of the way on: heading (tx, tz), right is (-tz, tx).
      expect((p.x - c.x) * -c.tz + (p.z - c.z) * c.tx).toBeGreaterThan(0);
      expect(woods.nearest(p.x, p.z).d).toBeGreaterThan(half + 1);
    }
  });

  it('keeps the oaks and the sign clear of the path but close enough to steer round', () => {
    const { trees, bushes } = woodsPlants(woods, LAYOUT, createRandom(7));
    for (const [x, z] of trees) expect(woods.trailNearest(x, z).d).toBeGreaterThan(T.halfWidth + 1.1);
    for (const [x, z] of bushes) expect(woods.trailNearest(x, z).d).toBeGreaterThan(T.halfWidth + 0.5);
    expect(woods.treeOk(T.entrance.x, T.entrance.z)).toBe(false);
    expect(trees.some(([x, z]) => woods.trailNearest(x, z).d < T.halfWidth + 3.5)).toBe(true);
  });

  it('starts just off the lead-in, where the sign stands', () => {
    const start = woods.trailAt(0);
    expect(woods.lineDistance(LAYOUT.woods.leadIn, start.x, start.z)).toBeLessThan(8);
    expect(woods.lineDistance(LAYOUT.woods.leadIn, T.entrance.x, T.entrance.z)).toBeLessThan(5);
    expect(Math.hypot(T.entrance.x - start.x, T.entrance.z - start.z)).toBeLessThan(6);
  });

  it('leaves the rest of the wood\'s ground, and the farm, as it was', () => {
    const without = createWoods({ ...LAYOUT, woods: { ...LAYOUT.woods, trail: undefined } });
    expect(without.trail).toBeNull();
    for (let x = -70; x <= 70; x += 7) {
      for (let z = -190; z <= -90; z += 7) {
        if (woods.trailNearest(x, z).d > T.halfWidth + 3) expect(woods.profile(x, z)).toBe(without.profile(x, z));
      }
    }
  });

  it('is on the map with its name, as a path of its own', () => {
    const f = farmMapFeatures(LAYOUT, fields, track);
    expect(f.woodsTrail.points.length).toBeGreaterThan(100);
    expect(f.woodsTrail.half).toBe(T.halfWidth);
    expect(f.labels.some((l) => l.text === T.name)).toBe(true);
  });
});
