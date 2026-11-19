import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew, BACK_LANE_PLAN, OUTLINE_PLAN, fromPlan } from '../src/world/layoutNew.js';
import { roadNetwork } from '../src/world/roads.js';
import { pointInPolygon } from '../src/world/polygons.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';

const two = layoutNew(LAYOUT, RAW_LAYOUT);
const net = roadNetwork(two);
const road = net.road('backLane');

describe('Back Lane', () => {
  it('is 2.5 to 3.4 km of single track joined to the lane at both ends', () => {
    expect(road.length).toBeGreaterThan(2500);
    expect(road.length).toBeLessThan(3400);
    expect(road.halfWidth * 2).toBeCloseTo(3.2, 1);
    expect(road.junctions.map((j) => j.end)).toEqual(['start', 'end']);
    const lane = two.publicLane.x;
    expect(road.samples[0].x).toBeCloseTo(lane, 3);
    expect(road.samples[road.samples.length - 1].x).toBeCloseTo(lane, 3);
  });

  it('keeps outside the farm\'s outline by at least 8 m everywhere', () => {
    const outline = OUTLINE_PLAN.map(([x, z]) => fromPlan([x, z]));
    const edges = outline.map((a, i) => [a, outline[(i + 1) % outline.length]]);
    const dist = (p, [a, b]) => {
      const t = Math.max(0, Math.min(1, ((p.x - a[0]) * (b[0] - a[0]) + (p.z - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2)));
      return Math.hypot(p.x - a[0] - t * (b[0] - a[0]), p.z - a[1] - t * (b[1] - a[1]));
    };
    for (const p of road.samples) {
      if (p.x > fromPlan([880, 0])[0]) continue; // the two ends are on the lane
      expect(pointInPolygon(outline, p.x, p.z)).toBe(false);
      expect(Math.min(...edges.map((e) => dist(p, e)))).toBeGreaterThan(8);
    }
  });

  it('has 12 to 20 passing places 150 to 250 m apart', () => {
    const places = net.passingPlaces('backLane');
    expect(places.length).toBeGreaterThanOrEqual(12);
    expect(places.length).toBeLessThanOrEqual(20);
    for (let i = 1; i < places.length; i++) {
      expect(places[i].s - places[i - 1].s).toBeGreaterThanOrEqual(150);
      expect(places[i].s - places[i - 1].s).toBeLessThanOrEqual(250);
    }
  });

  it('is on the plan\'s line: the plan points are within 3 m of the smoothed centreline', () => {
    for (const pp of BACK_LANE_PLAN.points) {
      const [x, z] = fromPlan(pp);
      expect(Math.min(...road.samples.map((p) => Math.hypot(p.x - x, p.z - z)))).toBeLessThan(3);
    }
  });

  describe('the way along it', () => {
    const heights = createTerrainHeight(two, new Track(two.trackPoints));
    it('has no gap, step or bump over 3 cm along its whole centreline, from the lane at one end to the lane at the other', () => {
      let worst = 0;
      let at = 0;
      let prev = heights.heightAt(road.samples[0].x, road.samples[0].z);
      for (let s = 0.02; s <= road.length; s += 0.02) {
        const p = net.pointAt('backLane', s);
        const h = heights.heightAt(p.x, p.z);
        if (Math.abs(h - prev) > worst) [worst, at] = [Math.abs(h - prev), s];
        prev = h;
      }
      expect(worst, `${at.toFixed(1)} m along`).toBeLessThan(0.03);
    });

    it('cuts no deeper than 1.5 m into a bank anywhere, so no cutting is needed', () => {
      const cuts = net.cuttings(heights.naturalAt, 2, heights.naturalAt);
      expect(cuts.filter((c) => c.road === 'backLane' && !c.flagged)).toEqual([]);
    });
  });
});

describe('the hedges along it', () => {
  it('stand a verge\'s width clear of the carriageway, further out round a passing place', async () => {
    const { hedgeOffset, laneHedgeRuns, JUNCTION_OPEN } = await import('../src/world/laneHedges.js');
    const plain = road.halfWidth + road.verge;
    const bay = road.bays[0];
    expect(hedgeOffset(road, 3, bay.side)).toBeCloseTo(plain, 6);
    expect(hedgeOffset(road, bay.s, bay.side)).toBeCloseTo(plain + bay.bay, 6);
    expect(hedgeOffset(road, bay.s, -bay.side)).toBeCloseTo(plain, 6);
    const runs = laneHedgeRuns(road, [{ s: 500, half: 2.6, side: 1 }]);
    expect(runs.filter((r) => r.side === 1).length).toBe(2);
    expect(runs.filter((r) => r.side === -1).length).toBe(1);
    expect(Math.min(...runs.map((r) => r.from))).toBe(JUNCTION_OPEN);
    expect(Math.max(...runs.map((r) => r.to))).toBeCloseTo(road.length - JUNCTION_OPEN, 6);
  });
});

describe('the signs along it', () => {
  it('has the entry signs at both ends, a passing place sign each way at every bay, bends and chevrons at the hairpins, and the ford\'s signs', async () => {
    const { laneSigns, SIGN_KINDS } = await import('../src/world/laneSigns.js');
    const signs = laneSigns(road);
    const of = (k) => signs.filter((s) => s.kind === k);
    for (const k of SIGN_KINDS) expect(of(k).length, k).toBeGreaterThan(0);
    expect(of('singleTrack').map((s) => s.facing).sort()).toEqual([-1, 1]);
    expect(of('nationalLimit').length).toBe(2);
    expect(of('passingPlace').length).toBe(2 * road.bays.length);
    expect(of('chevron').length).toBe(3 * 2);
    expect(of('gauge').length).toBe(1);
    expect(of('bends').length).toBe(2);
    expect(of('ford').length).toBe(2);
    // Each one stands on the left of the way that reads it.
    for (const s of signs.filter((x) => ['singleTrack', 'nationalLimit', 'bends', 'ford'].includes(x.kind))) expect(s.side).toBe(s.facing);
    for (const s of signs) {
      expect(s.s).toBeGreaterThan(0);
      expect(s.s).toBeLessThan(road.length);
    }
  });
});
