import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew, fromPlan, VILLAGE_PLAN, STREET_STUB_PLAN, RIVER_PLAN, NOT_MOVED_YET, REPLACED, villageLayout } from '../src/world/layoutNew.js';
import { villageShape, roadMarks, OAK_CROWN } from '../src/world/village.js';
import { roadNetwork } from '../src/world/roads.js';
import { createBrook } from '../src/world/brook.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { neighbourFarmShape, laneBarriers } from '../src/world/neighbourFarm.js';

// Nether Thornby on the new farm (#688): across the lane, its street east to the A-road, the garage on the lane, the brook under the lane's bridge.
const two = layoutNew(LAYOUT, RAW_LAYOUT);
const S = villageShape(two);
const net = roadNetwork(two);
const lane = two.publicLane;
const plan = (x, z) => fromPlan([x, z]);
const inPlanRect = (b, [x0, z0, x1, z1], m = 0) => {
  const [a, c] = [plan(x0, z0), plan(x1, z1)];
  return b.minX >= a[0] - m && b.maxX <= c[0] + m && b.minZ >= a[1] - m && b.maxZ <= c[1] + m;
};
const overlap = (a, b, m = 0) => a.minX < b.maxX + m && a.maxX > b.minX - m && a.minZ < b.maxZ + m && a.maxZ > b.minZ - m;
const planRect = ([x0, z0, x1, z1]) => ({ minX: plan(x0, z0)[0], minZ: plan(x0, z0)[1], maxX: plan(x1, z1)[0], maxZ: plan(x1, z1)[1] });

describe('the village is across the lane on the new farm', () => {
  it('is no longer on the list of places at today\'s numbers, and is one of the things the new farm puts in place of today\'s', () => {
    expect(NOT_MOVED_YET.village).toBeUndefined();
    expect(NOT_MOVED_YET['anchors.village']).toBeUndefined();
    expect(REPLACED).toEqual(expect.arrayContaining(['village', 'anchors.village']));
  });

  it('stands east of the lane, called Nether Thornby, with no walls round it and no gate shutting its street', () => {
    expect(S.name).toBe('Nether Thornby');
    expect(S.area.minX).toBeGreaterThan(lane.x);
    expect(S.eastward).toBe(true);
    expect(S.closed).toBe(false);
    expect(S.walls).toEqual([]);
    expect(S.beyond).toEqual([]);
    expect(S.laneGap).toBeNull();
    expect(two.village.end).toBeUndefined();
  });

  it('is placed from its anchor: the same absolute numbers with the plan written from another anchor', () => {
    const other = villageLayout({ ...VILLAGE_PLAN, anchor: [1100, 650] }).village;
    expect(other.pub).toEqual(two.village.pub);
    expect(other.garage.pumps.spots).toEqual(two.village.garage.pumps.spots);
    expect(other.cottages.map((c) => [c.x, c.z])).toEqual(two.village.cottages.map((c) => [c.x, c.z]));
  });
});

describe('the street', () => {
  const street = net.road('street');
  const stub = net.road('streetEnd');

  it('leaves the lane\'s east edge at about plan (908, 720) and runs east to the stub at the A-road', () => {
    const first = street.points[0];
    expect(first[0]).toBeGreaterThanOrEqual(lane.x);
    expect(first[0]).toBeLessThanOrEqual(lane.x + lane.halfWidth + 0.5);
    expect(first[1]).toBeCloseTo(plan(908, 720)[1], -0.5);
    expect(street.junction).toEqual({ end: 'start', onto: 'lane' });
    const last = street.points[street.points.length - 1];
    const [sx, sz] = plan(...STREET_STUB_PLAN.from);
    expect(Math.hypot(last[0] - sx, last[1] - sz)).toBeLessThan(1.5);
    expect(stub.points[stub.points.length - 1]).toEqual(plan(1292, 718));
    for (let i = 1; i < street.points.length; i++) expect(street.points[i][0]).toBeGreaterThan(street.points[i - 1][0]);
  });

  it('is 325 m or more of street, smooth, between the lane and the A-road\'s stub', () => {
    expect(street.length).toBeGreaterThan(320);
    for (let i = 1; i < S.road.length; i++) expect(Math.hypot(S.road[i].x - S.road[i - 1].x, S.road[i].z - S.road[i - 1].z)).toBeLessThan(2.1);
  });

  it('reaches the lane\'s east edge, so the road can be clamped to it with no gap', () => {
    expect(S.laneEdge).toBeCloseTo(lane.x + lane.halfWidth, 6);
    expect(S.road[S.mouth].x).toBeGreaterThanOrEqual(S.laneEdge);
    if (S.mouth > 0) expect(S.road[S.mouth - 1].x).toBeLessThan(S.laneEdge);
  });

  it('has its give-way line across the south half, the way out onto the lane keeps left, and not on the north', () => {
    const { giveWay } = roadMarks(S);
    expect(giveWay.length).toBeGreaterThan(0);
    for (const m of giveWay) expect(m.a).toBeGreaterThanOrEqual(0); // positive is the right of a road that runs east: the south
  });
});

describe('the bridge and the brook', () => {
  const brook = createBrook(two);

  it('carries the lane over the brook at about plan z 655, with no channel across the tarmac', () => {
    expect(brook.bridge).toBe(true);
    expect(brook.culvert.x).toBe(lane.x);
    expect(brook.zAt(lane.x)).toBeGreaterThan(plan(0, 648)[1]);
    expect(brook.zAt(lane.x)).toBeLessThan(plan(0, 662)[1]);
    for (let d = -lane.halfWidth; d <= lane.halfWidth; d += 0.5) expect(brook.cutAt(lane.x + d, brook.zAt(lane.x + d))).toBe(0);
  });

  it('runs on east past the north of the street, always north of the buildings\' gardens, to a spring short of the A-road', () => {
    expect(brook.maxX).toBeCloseTo(plan(RIVER_PLAN.points.at(-1)[0], 0)[0], 3);
    for (let x = lane.x + 20; x < brook.maxX; x += 5) {
      expect(brook.zAt(x), `x ${x}`).toBeLessThan(S.road.reduce((best, p) => (Math.abs(p.x - x) < Math.abs(best.x - x) ? p : best)).z - 30);
    }
    for (const b of S.buildings) {
      const z = brook.zAt(b.x);
      if (b.kind !== 'garage') expect(b.outer.minZ - (z + brook.halfAt(b.x)), b.id).toBeGreaterThan(4);
    }
  });
});

describe('the garage is on the lane', () => {
  const g = S.garage;
  const fc = S.forecourt;

  it('stands on the lane\'s east side at plan (932 to 954, 588 to 597), facing south', () => {
    expect(inPlanRect(g.outer, [932, 588, 954, 597.4])).toBe(true);
    expect(g.yaw).toBe(0);
    expect(g.outer.minX).toBeGreaterThan(lane.x + lane.halfWidth);
  });

  it('has its forecourt south of it along the lane, reaching the lane\'s edge for its own mouth, and the pumps in a row on it', () => {
    expect(fc.minZ).toBeGreaterThanOrEqual(g.outer.maxZ - 1);
    expect(fc.maxZ).toBeCloseTo(plan(0, 612)[1], 6);
    expect(fc.minX).toBeLessThanOrEqual(lane.x + lane.halfWidth);
    expect(fc.minX).toBeGreaterThan(lane.x);
    expect(fc.maxX).toBeCloseTo(plan(953, 0)[0], 6);
    expect(two.village.garage.pumps.xs).toEqual([922, 930, 938].map((x) => plan(x, 0)[0]));
    expect(two.village.garage.pumps.z).toBeCloseTo(plan(0, 606)[1], 6);
    for (const x of two.village.garage.pumps.xs) expect(x > fc.minX && x < fc.maxX).toBe(true);
  });

  it('is nowhere near the street, so its pavement has no gap for it and the forecourt is hard standing of its own', () => {
    expect(S.roadAt(g.x, g.z).d).toBeGreaterThan(100);
    expect(S.tarmacAt((fc.minX + fc.maxX) / 2, (fc.minZ + fc.maxZ) / 2)).toBe(1);
  });
});

describe('what stands along the street', () => {
  it('puts the pub north of the street with its car park to the west, and the girls\' stop in the car park', () => {
    expect(inPlanRect(S.pub.outer, [970, 692, 992, 704])).toBe(true);
    expect(S.pub.yaw).toBe(0);
    expect(S.carPark).toMatchObject(planRect([932, 690, 964, 712]));
    expect(S.carPark.maxX).toBeLessThan(S.pub.outer.minX);
    const p = S.pubStop;
    expect(p.x > S.carPark.minX && p.x < S.carPark.maxX && p.z > S.carPark.minZ && p.z < S.carPark.maxZ).toBe(true);
  });

  it('puts the shop south of the street with its front to the north, the phone box and bus stop beside it', () => {
    expect(inPlanRect(S.shop.outer, [980, 727, 994, 737])).toBe(true);
    expect(S.shop.yaw).toBeCloseTo(Math.PI, 6);
    const there = (p) => Math.hypot(p.x - S.shop.x, p.z - S.shop.z);
    expect(there(S.v.phone)).toBeLessThan(25);
    expect(there(S.v.busStop)).toBeLessThan(25);
    expect(S.v.phone.z).toBeGreaterThan(S.roadAt(S.v.phone.x, S.v.phone.z).at.z);
  });

  it('puts the green with its oak at about plan (1022, 699), between the pub and the brook', () => {
    expect(S.v.green.x).toBeCloseTo(plan(1022, 0)[0], 6);
    expect(S.v.green.z).toBeCloseTo(plan(0, 699)[1], 6);
    expect(S.v.green.x).toBeGreaterThan(S.pub.outer.maxX);
    expect(S.v.trees.some((t) => Math.hypot(t.x - S.v.green.x, t.z - S.v.green.z) < 3)).toBe(true);
  });

  it('puts the village sign at the junction', () => {
    expect(Math.hypot(S.v.sign.x - S.road[0].x, S.v.sign.z - S.road[0].z)).toBeLessThan(20);
  });

  it('puts twelve houses along it, the north side from x 1052 to 1226 and the south from 1036 to 1171, each facing the street', () => {
    const cottages = S.buildings.filter((b) => b.kind === 'cottage');
    expect(cottages).toHaveLength(12);
    const north = cottages.filter((b) => b.yaw === 0);
    const south = cottages.filter((b) => Math.abs(b.yaw - Math.PI) < 1e-6);
    expect(north).toHaveLength(7);
    expect(south).toHaveLength(5);
    for (const b of north) {
      expect(inPlanRect(b.outer, [1052, 690, 1226, 704]), b.id).toBe(true);
      expect(b.z, b.id).toBeLessThan(S.roadAt(b.x, b.z).at.z); // north of the street, its front (+z) to it
    }
    for (const b of south) {
      expect(inPlanRect(b.outer, [1036, 725, 1171, 736]), b.id).toBe(true);
      expect(b.z, b.id).toBeGreaterThan(S.roadAt(b.x, b.z).at.z);
    }
  });

  it('keeps every building off each other, inside its area and clear of the road and its pavements', () => {
    for (const b of S.buildings) {
      expect(b.outer.minX, b.id).toBeGreaterThan(S.area.minX);
      expect(b.outer.maxX, b.id).toBeLessThan(S.area.maxX);
      expect(b.outer.minZ, b.id).toBeGreaterThan(S.area.minZ);
      expect(b.outer.maxZ, b.id).toBeLessThan(S.area.maxZ);
      for (const o of S.buildings) if (o !== b) expect(overlap(b.outer, o.outer, 1.5), `${b.id} ${o.id}`).toBe(false);
      if (b.kind === 'garage') continue;
      for (let x = b.outer.minX; x <= b.outer.maxX; x += 1) {
        for (const z of [b.outer.minZ, b.outer.maxZ]) expect(S.roadAt(x, z).d, `${b.id} ${x}`).toBeGreaterThan(S.curb + 1.5);
      }
    }
  });

  it('keeps every oak\'s crown off every building', () => {
    for (const t of S.v.trees) expect(S.builtAt(t.x, t.z, OAK_CROWN * t.scale * 0.5), `${t.x}`).toBe(false);
  });

  it('opens the car park onto the street with a dropped kerb inside its width, on the north side', () => {
    const e = S.carPark.entry;
    expect(e.minX).toBeGreaterThan(S.carPark.minX);
    expect(e.maxX).toBeLessThan(S.carPark.maxX);
    expect(e.minZ).toBe(S.carPark.maxZ);
    expect(S.carPark.maxZ).toBeLessThan(S.roadAt((e.minX + e.maxX) / 2, e.minZ).at.z - S.curb);
  });
});

describe('what is left clear (#715, #716)', () => {
  const clear = Object.fromEntries(Object.entries(VILLAGE_PLAN.clear).map(([k, r]) => [k, planRect(r)]));
  const stands = () => [
    ...S.buildings.map((b) => [b.id, b.outer]),
    ['car park', S.carPark], ['forecourt', S.forecourt],
    ...S.v.trees.map((t, i) => [`oak ${i}`, { minX: t.x - 0.5, maxX: t.x + 0.5, minZ: t.z - 0.5, maxZ: t.z + 0.5 }]),
    ...S.v.pub.benches.map((p, i) => [`bench ${i}`, { minX: p.x - 1, maxX: p.x + 1, minZ: p.z - 1, maxZ: p.z + 1 }]),
  ];

  it('has nothing on the church\'s plot, the hall or the playing field', () => {
    for (const [name, r] of Object.entries(clear)) for (const [what, o] of stands()) expect(overlap(r, o), `${what} on ${name}`).toBe(false);
  });

  it('has the church\'s plot, the hall and the field where the plan draws them, clear of the street', () => {
    expect(clear.church).toMatchObject({ minX: plan(1228, 0)[0], maxX: plan(1280, 0)[0] });
    expect(clear.hall.maxX).toBeCloseTo(plan(1200, 0)[0], 6);
    expect(clear.field.minZ).toBeCloseTo(plan(0, 756)[1], 6);
    for (const r of Object.values(clear)) for (let x = r.minX; x <= r.maxX; x += 2) expect(S.roadAt(x, r.minZ).d).toBeGreaterThan(S.curb);
  });
});

describe('the rest of the farm around it', () => {
  it('has no invisible wall along the lane at the village (the lane\'s west barrier on today\'s farm has a gap there)', () => {
    expect(laneBarriers(two)).toEqual([]);
    expect(neighbourFarmShape(two)).toBeTruthy();
  });

  it('lays the ground to the land\'s own lie, not a plane along the street, and flat under each building, the car park and the forecourt', () => {
    const heights = createTerrainHeight(two, new Track(two.trackPoints));
    expect(S.areaWeight(S.pub.x, S.pub.z)).toBe(0);
    expect(S.planeAt(S.pub.x, () => 1234, S.pub.z)).toBe(1234);
    for (const b of S.buildings) {
      const ys = [];
      for (const dx of [-0.8, 0, 0.8]) for (const dz of [-0.8, 0, 0.8]) ys.push(heights.heightAt(b.x + dx * b.halfX, b.z + dz * b.halfZ));
      expect(Math.max(...ys) - Math.min(...ys), b.id).toBeLessThan(0.01);
    }
    const c = S.carPark;
    expect(Math.abs(heights.heightAt(c.minX + 1, c.minZ + 1) - heights.heightAt(c.maxX - 1, c.maxZ - 1))).toBeLessThan(0.01);
    // The forecourt follows the land (it falls east 6% along 46 m): only the pumps' island is level, and the MOT bay level with the garage's floor.
    const { xs, z } = two.village.garage.pumps;
    const island = xs.map((x) => heights.heightAt(x, z));
    expect(Math.max(...island) - Math.min(...island)).toBeLessThan(0.01);
    const g = S.garage;
    const bay = { x: g.x - 4.4, z: g.z + g.halfZ + 2.4 };
    expect(Math.abs(heights.heightAt(bay.x, bay.z) - heights.heightAt(g.x, g.z))).toBeLessThan(0.01);
  });

  it('makes the village\'s street a road the grip code knows as tarmac, out to its pavements', () => {
    const mid = S.road[Math.floor(S.road.length / 2)];
    expect(net.surfaceAt(mid.x, mid.z)).toMatchObject({ road: 'street', surface: 'tarmac' });
  });
});
