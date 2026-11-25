import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { riversidePlaces, waterEdge, fenceStretches } from '../src/world/riverPlaces.js';
import { roadNetwork } from '../src/world/roads.js';

// The river's banks shaped from its bends, and the brook's past Brook Meadow (#999): a gravel bar inside each bend, a cut bank outside, rushes and sedge at
// the wet edges, a field that comes back to the land's own lie, drinking places a cow walks down to, and the brook's reeds and stock fence to the lane.

const heights = createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints));
const brook = heights.brook;
const roads = roadNetwork(LAYOUT);
const places = riversidePlaces(LAYOUT, brook, { roads });
const surface = (x) => heights.heightAt(x, brook.zAt(x)) + brook.waterDepthAt(x);
/** Metres the ground stands above the water `u` m out from the line towards `side`. */
const above = (x, side, u) => heights.heightAt(x, brook.zAt(x) + side * u) - surface(x);

describe('the river\'s bends (#999)', () => {
  const bends = brook.bends();

  it('has its bends: six, alternating sides, along the river where it is the river', () => {
    expect(bends.length).toBe(6);
    for (let i = 1; i < bends.length; i++) expect(bends[i].out).toBe(-bends[i - 1].out);
  });

  it('has a gravel bar on the inside of each bend: a shelf out of the water at most 0.3 m above it for 1.5 m and more, painted as gravel', () => {
    for (const b of bends) {
      const inside = -b.out;
      let run = 0;
      let best = 0;
      for (let u = 0; u < brook.halfAt(b.x) + 6; u += 0.1) {
        const h = above(b.x, inside, u);
        if (h >= -0.02 && h <= 0.3 && brook.barAt(b.x, brook.zAt(b.x) + inside * u) > 0.5) best = Math.max(best, (run += 0.1));
        else run = 0;
      }
      expect(best, `bend at x ${b.x.toFixed(0)}`).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('has a bank at least 0.6 m cut on the outside of each bend, steep, for 10 m and more of it (a drinking place may break it)', () => {
    for (const b of bends) {
      let cut = 0;
      for (let x = b.x - 10; x <= b.x + 10; x += 0.5) {
        const edge = waterEdge(brook, x, b.out);
        const top = above(x, b.out, edge + 0.6);
        const steep = above(x, b.out, edge - 0.5) < -0.3; // 0.3 m under the water half a metre in from the edge: the face is a wall, not a slope
        if (top >= 0.6 && steep) cut += 0.5;
      }
      expect(cut, `bend at x ${b.x.toFixed(0)}`).toBeGreaterThanOrEqual(10);
    }
  });

  it('keeps the water\'s edge level and the field beyond it on the land\'s own lie, rolling rather than a plane', () => {
    const lie = [];
    for (let x = -60; x <= 140; x += 2) {
      const zc = brook.zAt(x);
      const far = brook.halfAt(x) + LAYOUT.hill.river.level + 6; // beyond the furthest the levelling reaches and the hummocks
      for (const side of [-1, 1]) {
        const z = zc + side * far;
        if (brook.notchAt(x, z).k > 0) continue;
        expect(Math.abs(heights.heightAt(x, z) - heights.naturalAt(x, z)), `${x}, ${side}`).toBeLessThan(0.05);
      }
      // 4 m back from the water the bank is not one height across: it is the levelled middle plus hummocks plus some of the land's lie.
      lie.push(heights.heightAt(x, zc - brook.halfAt(x) - 4) - heights.naturalAt(x, zc));
    }
    const mean = lie.reduce((a, b) => a + b, 0) / lie.length;
    const spread = Math.sqrt(lie.reduce((a, b) => a + (b - mean) ** 2, 0) / lie.length);
    expect(spread).toBeGreaterThan(0.05);
    expect(brook.levelK(0, brook.zAt(0) + brook.halfAt(0) + 0.2)).toBeCloseTo(1, 5);
  });

  it('leaves the drinking places a cow walks down: from the field to the water at no more than 1 in 3', () => {
    for (const d of brook.drinks) {
      const edge = waterEdge(brook, d.x, d.side);
      let last = above(d.x, d.side, edge);
      for (let u = edge + 0.5; u <= edge + 5; u += 0.5) {
        const h = above(d.x, d.side, u);
        expect((h - last) / 0.5, `drink at ${d.x.toFixed(0)}`).toBeLessThan(0.34);
        last = h;
      }
    }
  });
});

describe('the wet edges (#999)', () => {
  it('has rushes on the water\'s edge and sedge just behind, both banks, none on the crossing\'s landings or at the drinking places', () => {
    expect(places.rushes.length).toBeGreaterThan(250);
    expect(places.sedge.length).toBeGreaterThan(150);
    const cross = brook.crossing();
    for (const [list, reach] of [[places.rushes, 0.9], [places.sedge, 2.6]]) {
      for (const p of list) {
        const side = Math.sign(p.z - brook.zAt(p.x));
        const off = Math.abs(p.z - brook.zAt(p.x)) - waterEdge(brook, p.x, side);
        expect(off, `${p.x}, ${p.z}`).toBeGreaterThan(-0.5);
        expect(off, `${p.x}, ${p.z}`).toBeLessThan(reach);
        expect(Math.abs(p.x - cross.x)).toBeGreaterThan(cross.reach + 2);
        expect(brook.drinks.some((d) => d.side === side && Math.abs(d.x - p.x) < 4)).toBe(false);
      }
    }
    for (const side of [-1, 1]) expect(places.rushes.filter((p) => Math.sign(p.z - brook.zAt(p.x)) === side).length).toBeGreaterThan(100);
  });
});

describe('the brook past Brook Meadow (#999)', () => {
  const meadow = LAYOUT.hill.riverside;
  const lane = LAYOUT.publicLane;

  it('has banks: its water in a channel with a steep little bank either side, 0.3 m and more above it', () => {
    for (let x = meadow.maxX + 60; x < lane.x - 10; x += 20) {
      for (const side of [-1, 1]) {
        const edge = waterEdge(brook, x, side);
        expect(above(x, side, edge + 0.7), `${x}, ${side}`).toBeGreaterThan(0.25);
      }
    }
  });

  it('has reeds along it to the lane\'s verge, at its water\'s edge', () => {
    expect(places.brookReeds.length).toBeGreaterThan(50);
    expect(Math.max(...places.brookReeds.map((r) => r.x))).toBeGreaterThan(lane.x - 30);
    for (const r of places.brookReeds) {
      const side = Math.sign(r.z - brook.zAt(r.x));
      expect(Math.abs(Math.abs(r.z - brook.zAt(r.x)) - waterEdge(brook, r.x, side))).toBeLessThan(1);
    }
  });

  it('has a stock fence on its north bank from Brook Meadow\'s river gate to the lane\'s verge, out of the water', () => {
    const { points } = places.fence;
    expect(points[0][0]).toBeLessThan(meadow.maxX + 1);
    expect(points[points.length - 1][0]).toBeGreaterThan(lane.x - lane.halfWidth - 3);
    expect(points[points.length - 1][0]).toBeLessThan(lane.x - lane.halfWidth);
    for (const [[ax, az], [bx, bz]] of fenceStretches(places.fence)) {
      for (let t = 0; t <= 1; t += 0.05) {
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        expect(brook.waterAt(x, z), `${x}, ${z}`).toBe(0);
        expect(z).toBeLessThan(brook.zAt(x));
      }
    }
  });

  it('leaves its fence open where the boundary track crosses the brook, and at a gap into the strip of Low Ley south of it', () => {
    const stretches = fenceStretches(places.fence);
    for (const [[ax, az], [bx, bz]] of stretches) {
      for (let t = 0; t <= 1; t += 0.02) expect(roads.surfaceAt(ax + (bx - ax) * t, az + (bz - az) * t)).toBeNull();
    }
    expect(places.fence.gaps.length).toBeGreaterThanOrEqual(3); // the track, the farm's east hedge and the gap
    expect(places.fence.gaps.some(([a, b]) => b - a >= 4.9)).toBe(true);
  });
});
