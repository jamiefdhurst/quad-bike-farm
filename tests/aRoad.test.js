import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew, fromPlan, A_ROAD_PLAN, LANE_PLAN, BACK_LANE_PLAN, STREET_STUB_PLAN } from '../src/world/layoutNew.js';
import { roadNetwork } from '../src/world/roads.js';
import { neighbourLandShape, hedgeStretches } from '../src/world/neighbourLand.js';
import { junctionSites, junctionFittings, junctionBreaks, catsEyes, layByOf, bendBins } from '../src/world/aRoadFittings.js';
import { laneHedgeRuns, sidePoint, hedgeOffset } from '../src/world/laneHedges.js';
import { aRoadOut, junctionSOf } from '../src/world/laneRoutes.js';
import { aRoadGaps } from '../src/world/aRoadProps.js';
import { cottagePlans, cottageBoxes } from '../src/world/laneFittingsProps.js';

const two = LAYOUT;
const net = roadNetwork(two);
const lane = net.road('lane');
const aRoad = net.road('aRoad');
const back = net.road('backLane');
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

describe('the A-road down the valley (#687)', () => {
  it('runs the length of the ground, curving, from the map\'s north edge to its south, two lanes wide', () => {
    const [x0, z0] = fromPlan(A_ROAD_PLAN.points[0]);
    const [x1, z1] = fromPlan(A_ROAD_PLAN.points.at(-1));
    expect(aRoad.samples[0]).toMatchObject({ x: x0, z: z0 });
    expect(aRoad.samples.at(-1)).toMatchObject({ x: x1, z: z1 });
    expect(aRoad.length).toBeGreaterThan(1300); // the map's 1,040 m and 150 m past each edge (#1025)
    expect(aRoad.length).toBeLessThan(1400);
    expect(aRoad.samples[0].z).toBeLessThan(two.ground.minZ - 140);
    expect(aRoad.samples.at(-1).z).toBeGreaterThan(two.ground.maxZ + 140);
    const xs = aRoad.samples.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(10); // it curves
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(60);
    for (const p of aRoad.samples) {
      expect(p.x).toBeLessThan(two.ground.maxX - 10);
    }
    expect(aRoad.markings).toMatchObject({ centre: 'dashed', edge: true });
    expect(aRoad.halfWidth * 2).toBeGreaterThan(7);
  });

  it('has what leaves by its north end go 190 m from the junction before it is gone (#1025)', () => {
    const out = aRoadOut(net, junctionSOf(net), true);
    expect(out.at(-1).z).toBeLessThan(two.ground.minZ - 140);
    expect(Math.abs(out.at(-1).z - lane.samples[0].z)).toBeGreaterThan(180);
  });

  it('is wider than the lane, which is wider than Back Lane: a major road, a real lane, a single track', () => {
    expect(aRoad.halfWidth).toBeGreaterThan(lane.halfWidth);
    expect(lane.halfWidth).toBeGreaterThan(back.halfWidth);
    expect(lane.halfWidth * 2).toBeGreaterThan(4.6); // two lanes, not narrow (Jamie, 19 November)
    expect(lane.markings.centre).toBe('dashed');
    expect(lane.bays).toEqual([]); // no passing places: it is two lanes
  });
});

describe('the lane bends round to the A-road in the north and runs straight on south (#687)', () => {
  it('starts on the A-road\'s middle at the junction, bends round through the plan\'s bend, and Back Lane leaves it where it did', () => {
    const [jx, jz] = fromPlan([1291, -30]);
    expect(dist(lane.samples[0], { x: jx, z: jz })).toBeLessThan(0.5);
    const near = (plan) => Math.min(...lane.samples.map((p) => dist(p, { x: fromPlan(plan)[0], z: fromPlan(plan)[1] })));
    expect(near([936, -26])).toBeLessThan(3);
    expect(near(BACK_LANE_PLAN.points[0])).toBeLessThan(0.6); // Back Lane's north end is on the lane
    expect(near(BACK_LANE_PLAN.points.at(-1))).toBeLessThan(0.6); // and so is its south end
    expect(lane.junctions).toEqual([{ end: 'start', onto: 'aRoad' }]);
    // The lane's start is on the A-road's centreline.
    expect(Math.min(...aRoad.samples.map((p) => dist(p, lane.samples[0])))).toBeLessThan(1);
  });

  it('is straight at plan x 905 from z 40 to where the ground ends, and ends there', () => {
    const [lx] = fromPlan([LANE_PLAN.x, 0]);
    for (const p of lane.samples) if (p.z > fromPlan([0, 40])[1]) expect(p.x).toBeCloseTo(lx, 6);
    expect(lane.samples.at(-1).z).toBeCloseTo(two.ground.maxZ, 6);
    expect(two.publicLane.x).toBe(lx);
  });

  it('meets the A-road with a bellmouth and a give-way line at its end, and the village street\'s stub meets it at plan (1292, 718)', () => {
    const stub = net.road('streetEnd');
    expect(lane.bellmouth).toBeTruthy();
    expect(lane.markings.giveWay).toBe('start');
    expect(stub.markings.giveWay).toBe('end');
    const [sx, sz] = fromPlan(STREET_STUB_PLAN.to);
    expect(dist(stub.samples.at(-1), { x: sx, z: sz })).toBeLessThan(0.5);
    expect(Math.min(...aRoad.samples.map((p) => dist(p, stub.samples.at(-1))))).toBeLessThan(1);
    expect(stub.junctions).toEqual([{ end: 'end', onto: 'aRoad' }]);
  });
});

describe('the junctions\' furniture', () => {
  const sites = junctionSites(net, two.junctions);
  const fittings = junctionFittings(sites);

  it('has two junctions: the lane north (Kelby 4) and the village street (Ashwell 3)', () => {
    expect(sites.map((s) => s.id)).toEqual(['north', 'village']);
    expect(sites.map((s) => s.lines[0])).toEqual(['Kelby 4', 'Ashwell 3']);
    for (const s of sites) expect(Math.min(...aRoad.samples.map((p) => dist(p, s.mouth)))).toBeLessThan(1);
  });

  it('puts at each a give-way sign, a fingerpost, a grit bin or heap and the speed limit disc, off the tarmac and on the right sides', () => {
    for (const s of sites) {
      const mine = fittings.filter((f) => f.site === s.id);
      expect(mine.map((f) => f.kind).sort()).toEqual([s.id === 'north' ? 'gritBin' : 'gritHeap', 'fingerpost', 'giveWay', 'nationalLimit'].sort());
      for (const f of mine) {
        expect(net.onCarriageway(f.x, f.z), `${s.id} ${f.kind}`).toBeNull();
        const toward = { x: Math.sin(f.yaw), z: Math.cos(f.yaw) };
        if (f.kind === 'giveWay') expect(toward.x * s.out.x + toward.z * s.out.z).toBeLessThan(-0.9); // faces the driver coming in
        if (f.kind === 'giveWay') expect((f.x - s.mouth.x) * s.left.x + (f.z - s.mouth.z) * s.left.z).toBeGreaterThan(0); // on their left
        if (f.kind === 'nationalLimit') expect(toward.x * s.out.x + toward.z * s.out.z).toBeLessThan(-0.9); // across the A-road, facing the minor road
      }
    }
  });

  it('breaks the A-road\'s edge lines at each mouth, and has cat\'s eyes down its middle elsewhere', () => {
    const breaks = junctionBreaks(net, aRoad);
    expect(breaks).toHaveLength(2);
    const eyes = catsEyes(aRoad, aRoad.eyes ?? 18, breaks);
    expect(eyes.length).toBeGreaterThan(50);
    for (const e of eyes) expect(Math.min(...aRoad.samples.map((p) => dist(p, e)))).toBeLessThan(0.6);
    for (const b of breaks) for (const e of eyes) expect(Math.abs(aRoad.samples.reduce((best, p) => (dist(p, e) < dist(best, e) ? p : best)).s - b.s)).toBeGreaterThan(b.half - 1);
  });

  it('has a lay-by on the east side with the bus stop flag past it', () => {
    const by = layByOf(aRoad, two.aRoadFittings.layBy);
    expect(by.side).toBe(1);
    expect(by.length).toBeGreaterThanOrEqual(20);
    expect(net.onCarriageway(by.flag.x, by.flag.z)).toBeNull();
    const p = aRoad.samples.reduce((best, q) => (dist(q, by.flag) < dist(best, by.flag) ? q : best));
    expect(by.flag.x).toBeGreaterThan(p.x + aRoad.halfWidth + by.width); // beyond the bay, on the east verge
  });

  it('puts the grit bin on the outside of the northern bend', () => {
    const [bin] = bendBins(lane, two.laneFittings.gritBins.map((p) => [p.x, p.z]));
    expect(net.onCarriageway(bin.x, bin.z)).toBeNull();
    const [bx, bz] = fromPlan([905, -2]);
    expect(dist(bin, { x: bx, z: bz })).toBeLessThan(5);
  });
});

describe('the lane is one other people use (#687)', () => {
  const F = two.laneFittings;

  it('has the pair of cottages at about plan (920 to 940, 420 to 440) facing the lane, with their gardens clear of every road and hedge', () => {
    const plans = cottagePlans(F.cottages);
    expect(plans).toHaveLength(2);
    const land = neighbourLandShape(two);
    for (const b of plans) {
      expect(b.x).toBeGreaterThan(fromPlan([920, 0])[0]);
      expect(b.x).toBeLessThan(fromPlan([940, 0])[0]);
      expect(b.z).toBeGreaterThan(fromPlan([0, 418])[1]);
      expect(b.z).toBeLessThan(fromPlan([0, 442])[1]);
      for (const q of cottageBoxes(b, F.cottages.gardenDepth)) {
        const [lo, hi] = [{ x: q.x - q.hx, z: q.z - q.hz }, { x: q.x + q.hx, z: q.z + q.hz }];
        expect(lo.x).toBeGreaterThan(two.publicLane.x + two.publicLane.halfWidth); // clear of the lane's tarmac
        for (const s of hedgeStretches(land)) expect(lo.x < s.x + s.hx && hi.x > s.x - s.hx && lo.z < s.z + s.hz && hi.z > s.z - s.hz, `${b.id} / hedge`).toBe(false);
      }
    }
  });

  it('has one more field gateway on its east side, a postbox and a bin stand at the end of our drive, off the tarmac', () => {
    expect(F.gateways).toHaveLength(1);
    const line = land().lines.find((l) => l.axis === 'x' && l.at === fromPlan([912, 0])[0]);
    for (const g of F.gateways) expect(line.gaps.some(([a, b]) => g.z > a && g.z < b && b - a >= g.width)).toBe(true);
    for (const p of [F.postbox, F.binStand]) {
      expect(net.onCarriageway(p.x, p.z)).toBeNull();
      expect(p.x).toBeLessThan(two.publicLane.x - two.publicLane.halfWidth); // on the west verge
      expect(Math.abs(p.z - two.road.z)).toBeLessThan(15); // at the drive's mouth
      expect(Math.abs(p.z - two.road.z)).toBeGreaterThan(two.road.halfWidth);
    }
  });
});

function land() {
  return two.neighbourLand;
}

describe('her land is cut back where the roads go through it (#569, #687)', () => {
  const stretches = hedgeStretches(neighbourLandShape(two));
  const roads = ['lane', 'aRoad', 'streetEnd', 'backLane', 'farm', 'neighbour'].map((id) => net.road(id));
  const nearest = (x, z, r) => Math.min(...r.samples.map((p) => Math.hypot(p.x - x, p.z - z)));

  it('has no hedge across any road, and none within a metre of the tarmac', () => {
    for (const s of stretches) {
      const along = s.axis === 'x' ? [s.from, s.to] : [s.from, s.to];
      for (let t = along[0]; t <= along[1]; t += 1.5) {
        const [x, z] = s.axis === 'x' ? [s.at, t] : [t, s.at];
        for (const r of roads) {
          if (r.id === 'neighbour') continue; // her own track goes through her lane hedge's gap, which the stretches leave
          expect(nearest(x, z, r), `${s.axis}${s.at} at ${t} near ${r.id}`).toBeGreaterThan(r.halfWidth + 1);
        }
      }
    }
  });

  it('keeps her east hedge short of the A-road\'s verge and her north edge short of the bend and the lane\'s tarmac', () => {
    const fields = neighbourLandShape(two).fields;
    const east = Math.max(...fields.map((f) => f.maxX));
    for (const p of aRoad.samples) if (p.z < fields[0].maxZ + 500 && p.z > fields[0].minZ - 5) expect(p.x - aRoad.halfWidth - east).toBeGreaterThan(2);
    const north = Math.min(...fields.map((f) => f.minZ));
    expect(north).toBeGreaterThan(fromPlan([0, -31])[1] + lane.halfWidth + 5);
  });
});

describe('the A-road\'s hedges and the lane\'s side have no invisible wall (#687)', () => {
  it('has no invisible box on the new farm\'s lane, and none across any road\'s middle line, walked from end to end', () => {
    const hedges = hedgeStretches(neighbourLandShape(two));
    const gaps = aRoadGaps(net, aRoad, two);
    const runs = laneHedgeRuns(aRoad, gaps);
    for (const r of net.roads) {
      if (!['lane', 'aRoad', 'streetEnd', 'backLane', 'farm'].includes(r.id)) continue;
      for (let s = 0; s <= r.length; s += 0.5) {
        const p = r.samples.reduce((best, q) => (Math.abs(q.s - s) < Math.abs(best.s - s) ? q : best), r.samples[0]);
        for (const h of hedges) expect(p.x > h.x - h.hx - 0.3 && p.x < h.x + h.hx + 0.3 && p.z > h.z - h.hz - 0.3 && p.z < h.z + h.hz + 0.3, `${r.id} at ${s}`).toBe(false);
      }
    }
    // The A-road's own hedges stand off its middle line by the carriageway and the verge.
    for (const run of runs) {
      const mid = (run.from + run.to) / 2;
      const q = sidePoint(aRoad, mid, run.side, hedgeOffset(aRoad, mid, run.side));
      expect(net.onCarriageway(q.x, q.z)).toBeNull();
      expect(hedgeOffset(aRoad, mid, run.side)).toBeGreaterThan(aRoad.halfWidth + 1);
    }
  });
});
