import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { headlessContext } from './helpers/worldModels.js';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew, fromPlan, VILLAGE_PLAN, NEIGHBOUR_LAND_PLAN } from '../src/world/layoutNew.js';
import { villageShape, streetLimitSigns, approachSignSpecs } from '../src/world/village.js';
import { roadNetwork } from '../src/world/roads.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { carParkBays, BAY } from '../src/world/villageTextures.js';
import { HOUSE_DESIGNS } from '../src/world/villageHouses.js';
import { lampPost, phoneBox, streetBench, villageSignAt, signPost } from '../src/world/villageFurniture.js';
import { picnicTable, pillarBox } from '../src/world/villageBuildings.js';
import { Frame } from '../src/world/villageKit.js';

// The village's approach on the new farm (#819): the lane's three houses, the small farm, the signs on the lane and the street, and the fixes folded in with them (#536, #537, #539,
// #542, #543): the pavements, the signs, the street furniture, the pub's car park and the houses' designs.

const two = layoutNew(LAYOUT, RAW_LAYOUT);
const S = villageShape(two);
const V = two.village;
const A = V.approach;
const lane = two.publicLane;
const plan = (x, z) => fromPlan([x, z]);
const inPlanRect = (r, [x0, z0, x1, z1]) => {
  const [a, c] = [plan(x0, z0), plan(x1, z1)];
  return r.minX >= a[0] - 0.01 && r.maxX <= c[0] + 0.01 && r.minZ >= a[1] - 0.01 && r.maxZ <= c[1] + 0.01;
};
const overlap = (a, b, m = 0) => a.minX < b.maxX + m && a.maxX > b.minX - m && a.minZ < b.maxZ + m && a.maxZ > b.minZ - m;
const laneBuildings = S.laneBuildings;
const house = (id) => laneBuildings.find((b) => b.id === id);

describe('the lane\'s approach to Nether Thornby', () => {
  it('stands three houses on the lane\'s east side at plan x 922 to 932 and z 500, 526 and 552, facing the lane', () => {
    for (const [id, z] of [['l1', 500], ['l2', 526], ['l3', 552]]) {
      const b = house(id);
      expect(inPlanRect(b.outer, [921, z - 7, 933, z + 7]), id).toBe(true);
      expect(b.z, id).toBeCloseTo(plan(0, z)[1], 6);
      expect(Math.sin(b.yaw), id).toBeCloseTo(-1, 6); // its front looks west, to the lane
      expect(b.outer.minX, id).toBeGreaterThan(lane.x + lane.halfWidth + 10); // a front garden between it and the lane's tarmac
    }
  });

  it('gives the three a different design each, and the street its own mix of the others', () => {
    expect(A.houses.map((h) => h.design)).toEqual(['gabled', 'thatched', 'bungalow']);
    const designs = new Set(V.cottages.map((c) => c.design ?? 'cottage'));
    for (const d of ['cottage', 'thatched', 'gabled', 'bungalow', 'terrace']) expect(designs.has(d), d).toBe(true);
    for (const c of [...V.cottages, ...A.houses]) if (c.design) expect(HOUSE_DESIGNS).toContain(c.design);
    expect(V.cottages.find((c) => c.design === 'terrace').doors).toHaveLength(3);
  });

  it('puts a small farm at plan x 930 to 984 and z 440 to 480: a stone farmhouse and a barn round a walled yard with its gateway on the lane side', () => {
    expect(inPlanRect(A.farm.yard, [930, 440, 984, 480])).toBe(true);
    const fh = S.laneBuildings.find((b) => b.kind === 'farmhouse');
    const barn = S.laneBuildings.find((b) => b.kind === 'barn');
    expect(fh.wall).toBe('stone');
    expect(barn.wall).toBe('stone');
    for (const b of [fh, barn]) {
      expect(b.outer.minX).toBeGreaterThan(A.farm.yard.minX);
      expect(b.outer.maxX).toBeLessThan(A.farm.yard.maxX);
      expect(b.outer.minZ).toBeGreaterThan(A.farm.yard.minZ);
      expect(b.outer.maxZ).toBeLessThan(A.farm.yard.maxZ);
    }
    expect(overlap(fh.outer, barn.outer, 3)).toBe(false);
    expect(A.farm.gateway.x).toBeCloseTo(A.farm.yard.minX, 6); // in the west wall, on the lane's side
    expect(fh.z).toBeLessThan(barn.z);
    expect(fh.yaw).toBe(0); // the house faces south into the yard
    expect(Math.abs(barn.yaw - Math.PI)).toBeLessThan(1e-6); // the barn's door faces north into it
  });

  it('keeps every building of the approach off the lane, the street, the other buildings, and the neighbour\'s yard and houses', () => {
    for (const b of laneBuildings) {
      expect(b.outer.minX, b.id).toBeGreaterThan(lane.x + lane.halfWidth + 2);
      for (const o of [...S.buildings, ...laneBuildings]) if (o !== b) expect(overlap(b.outer, o.outer, 1.5), `${b.id} ${o.id}`).toBe(false);
      expect(S.roadAt(b.x, b.z).d, b.id).toBeGreaterThan(40); // well north of the street
    }
  });

  it('opens the farm\'s gateway onto a track from the lane, which meets it square in the west wall', () => {
    const track = two.roads.find((r) => r.id === 'farmTrack');
    expect(track.junction).toEqual({ end: 'start', onto: 'lane' });
    const [x0, z0] = track.points[0];
    const [x1, z1] = track.points[track.points.length - 1];
    expect(x0).toBeCloseTo(plan(905, 0)[0], 6);
    expect(x1).toBeCloseTo(A.farm.yard.minX, 6);
    expect(z1).toBeCloseTo(A.farm.gateway.z, 6);
    expect(z0).toBeCloseTo(z1, 6);
    const net = roadNetwork(two);
    expect(net.road('farmTrack')).toBeTruthy();
    expect(net.onCarriageway((x0 + x1) / 2, z0)?.id ?? 'farmTrack').toBe('farmTrack');
    const lanes = NEIGHBOUR_LAND_PLAN.lines.find((l) => l.x === 912);
    expect(lanes.gaps.some(([a, b]) => A.farm.gateway.z > plan(0, a)[1] && A.farm.gateway.z < plan(0, b)[1])).toBe(true); // the lane's hedge is open here
  });
});

describe('the 30 mph signs and the village sign on the approach, and the 20 inside (#537)', () => {
  const specs = approachSignSpecs(V);
  const limit = specs.filter((s) => !s.village);
  const names = specs.filter((s) => s.village);

  it('stands a 30 on each side of the lane at z 486 and z 800 and of the street at x 1262, with a village sign by each pair', () => {
    expect(V.approach.limit).toBe(30);
    expect(limit).toHaveLength(6);
    expect(names).toHaveLength(3);
    const at = (z) => specs.filter((s) => Math.abs(s.z - plan(0, z)[1]) < 6 && Math.abs(s.x - plan(905, 0)[0]) < 12);
    expect(at(486)).toHaveLength(3);
    expect(at(800)).toHaveLength(3);
    const onStreet = specs.filter((s) => Math.abs(s.x - plan(1262, 0)[0]) < 6);
    expect(onStreet).toHaveLength(3);
    for (const s of limit) {
      expect(s.front).toBe(30);
      expect(s.back).toBe('national'); // the traffic leaving the village is told the national limit, not 30 or 20
    }
  });

  it('faces each sign at the traffic coming in: north on the north approach, south on the south, east along the street from the A-road', () => {
    for (const s of specs.filter((q) => Math.abs(q.z - plan(0, 486)[1]) < 6)) expect(Math.cos(s.yaw)).toBeCloseTo(-1, 6);
    for (const s of specs.filter((q) => Math.abs(q.z - plan(0, 800)[1]) < 6)) expect(Math.cos(s.yaw)).toBeCloseTo(1, 6);
    for (const s of specs.filter((q) => Math.abs(q.x - plan(1262, 0)[0]) < 6)) expect(Math.sin(s.yaw)).toBeCloseTo(1, 6);
  });

  it('keeps the lane\'s signs on its verges, clear of the tarmac, and the street\'s off the street\'s pavements', () => {
    for (const s of specs.filter((q) => Math.abs(q.x - plan(905, 0)[0]) < 12)) expect(Math.abs(s.x - lane.x), `${s.x}`).toBeGreaterThan(lane.halfWidth + 0.5);
    for (const s of specs.filter((q) => Math.abs(q.x - plan(1262, 0)[0]) < 6)) expect(S.roadAt(s.x, s.z).d).toBeGreaterThan(S.curb);
  });

  it('puts one 20 sign at each end of the street facing in, with the national limit on its back, and a repeater halfway with 20 both ways, and no others', () => {
    const posts = streetLimitSigns(S);
    expect(posts).toHaveLength(3);
    const [west, east, mid] = posts;
    expect(west.front).toBe(20);
    expect(west.back).toBe('national');
    expect(west.x).toBeLessThan(mid.x);
    expect(Math.sin(west.yaw)).toBeGreaterThan(0.99); // faces east, to the traffic coming in from the lane
    expect(east.front).toBe(20);
    expect(east.back).toBe('national');
    expect(Math.sin(east.yaw)).toBeLessThan(-0.99); // faces west, to the traffic coming in from the A-road
    expect(mid.front).toBe(20);
    expect(mid.back).toBe(20);
    for (const p of posts) expect(p.front === 'national', 'nothing facing in shows the national limit').toBe(false);
    expect(V.limit).toBe(20);
  });
});

describe('the village pavements (#536)', () => {
  it('runs along both sides of the street from just past the lane to the street\'s end, clear of every building and garden', () => {
    const road = S.road;
    const hw = S.roadHalfWidth;
    const first = road[16];
    const last = road[road.length - 1];
    expect(first.x - road[0].x).toBeGreaterThan(10);
    expect(last.x).toBeGreaterThan(plan(1230, 0)[0]);
    for (const b of S.buildings) {
      if (b.kind === 'garage') continue;
      for (let i = 16; i < road.length; i++) for (const side of [-1, 1]) {
        const x = road[i].x + -road[i].tz * side * (hw + S.v.road.pavement * 0.5);
        const z = road[i].z + road[i].tx * side * (hw + S.v.road.pavement * 0.5);
        expect(x > b.outer.minX && x < b.outer.maxX && z > b.outer.minZ && z < b.outer.maxZ, `${b.id} at ${i}`).toBe(false);
      }
    }
  });
});

describe('the pub\'s car park (#542)', () => {
  const c = S.carPark;
  const w = c.maxX - c.minX;
  const d = c.maxZ - c.minZ;
  const entry = [c.entry.minX - c.minX, c.entry.maxX - c.minX];
  const bays = carParkBays(w, d, entry);

  it('has standard bays 2.4 m by 4.8 m and a disabled bay 3.6 m wide', () => {
    expect(BAY).toMatchObject({ w: 2.4, d: 4.8, disabledW: 3.6 });
    const disabled = bays.filter((b) => b.disabled);
    expect(disabled).toHaveLength(1);
    expect(disabled[0].w).toBe(3.6);
    for (const b of bays.filter((q) => !q.disabled)) {
      expect(b.w).toBe(2.4);
      expect(b.d).toBe(4.8);
    }
    expect(bays.filter((b) => !b.disabled).length).toBeGreaterThanOrEqual(12);
  });

  it('keeps every bay inside the car park and off the way in, and no two bays overlap', () => {
    for (const b of bays) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(w);
      expect(b.z).toBeGreaterThanOrEqual(0);
      expect(b.z + b.d).toBeLessThanOrEqual(d);
      if (b.row === 'south') expect(b.x + b.w <= entry[0] || b.x >= entry[1], 'the way in').toBe(true);
      for (const o of bays) if (o !== b) expect(b.x < o.x + o.w && b.x + b.w > o.x && b.z < o.z + o.d && b.z + b.d > o.z).toBe(false);
    }
  });
});

describe('the new buildings, built', () => {
  let village;
  let boxes;
  let carsFor;
  beforeAll(async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildVillage } = await import('../src/world/villageProps.js');
    const make = (seed) => {
      boxes = [];
      const scene = new THREE.Scene();
      let s = seed;
      const random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
      const c = { ...headlessContext(), scene, random, layout: two, heights: createTerrainHeight(two, new Track(two.trackPoints)), fixedBox: (x, y, z, hx, hy, hz) => boxes.push({ x, y, z, hx, hy, hz }) };
      return buildVillage(c);
    };
    village = make(1234);
    carsFor = (seed) => make(seed).cars.map((q) => `${q.kind}${q.colour}${q.bay}`).join();
  });

  it('leaves the farm\'s gateway and its track open: no collider stands across them', () => {
    const gz = A.farm.gateway.z;
    const gx = A.farm.yard.minX;
    for (const dz of [-1.5, 0, 1.5]) for (const x of [gx - 6, gx - 0.3, gx, gx + 0.3, gx + 6]) {
      const hit = boxes.find((b) => Math.abs(x - b.x) < b.hx && Math.abs(gz + dz - b.z) < b.hz);
      expect(hit, `${x} ${gz + dz}`).toBeUndefined();
    }
  });

  it('closes the yard with a wall on its other three sides and both sides of the gateway', () => {
    const y = A.farm.yard;
    const at = (x, z) => boxes.some((b) => Math.abs(x - b.x) < b.hx + 0.05 && Math.abs(z - b.z) < b.hz + 0.05);
    for (let x = y.minX + 1; x < y.maxX; x += 3) {
      expect(at(x, y.minZ), `north ${x}`).toBe(true);
      expect(at(x, y.maxZ), `south ${x}`).toBe(true);
    }
    for (let z = y.minZ + 1; z < y.maxZ; z += 3) {
      expect(at(y.maxX, z), `east ${z}`).toBe(true);
      if (Math.abs(z - A.farm.gateway.z) > 4) expect(at(y.minX, z), `west ${z}`).toBe(true);
    }
  });

  it('parks a different few cars in the pub\'s car park each game, none in the disabled bay', () => {
    expect(carsFor(1)).not.toBe(carsFor(7));
    expect(village.cars.length).toBeGreaterThanOrEqual(4);
    const c = S.carPark;
    const disabled = carParkBays(c.maxX - c.minX, c.maxZ - c.minZ, [c.entry.minX - c.minX, c.entry.maxX - c.minX]).find((b) => b.disabled);
    for (const car of village.cars) expect(car.x > c.minX + disabled.x && car.x < c.minX + disabled.x + disabled.w && car.z < c.minZ + disabled.z + disabled.d).toBe(false);
  });
});

// Nothing floats (#539, #537): each piece of street furniture is one connected thing, every part touching another.
describe('the street furniture is joined together', () => {
  const ctx = () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const mat = (name) => ({ name });
    const M = new Proxy({}, { get: (t, k) => (k === 'blooms' ? [mat('a'), mat('b'), mat('c'), mat('d')] : mat(String(k))) });
    return { M, S: { name: 'Nether Thornby', v: {} }, heights: { heightAt: () => 0 }, random: () => 0.5, furniture: new THREE.Group(), root: new THREE.Group(), groups: [], night: [], fixedBox: () => {} };
  };
  /** How many parts of `group` (its meshes, in the group's frame) are not joined to the ground by a chain of contact within `tol`. */
  const floating = (group, tol = 0.012) => {
    group.updateMatrixWorld(true);
    const boxes = [];
    group.traverse((o) => {
      if (o.isMesh) boxes.push(new THREE.Box3().setFromObject(o).expandByScalar(tol));
    });
    // What stands on the ground (its lowest point within `tol` of y = 0) is held up by it, and what touches that is held by it.
    const grounded = boxes.map((b, i) => (b.min.y <= tol ? i : -1)).filter((i) => i >= 0);
    const seen = new Set(grounded);
    const queue = [...grounded];
    while (queue.length) {
      const i = queue.pop();
      boxes.forEach((b, j) => {
        if (!seen.has(j) && boxes[i].intersectsBox(b)) {
          seen.add(j);
          queue.push(j);
        }
      });
    }
    return boxes.map((_, i) => i).filter((i) => !seen.has(i)).length;
  };

  it('hangs a lamp post\'s lantern from its arm, and the arm from the post', () => {
    const c = ctx();
    lampPost(c, 0, 0, { x: 0, z: 10 });
    expect(floating(c.furniture.children[0])).toBe(0);
  });

  it('builds the telephone kiosk, the village sign, the street bench and the picnic table each in one piece', () => {
    for (const [name, make] of [
      ['kiosk', (c) => phoneBox(c, { x: 0, z: 0 })],
      ['village sign', (c) => villageSignAt(c, 0, 0, 0)],
      ['bench', (c) => streetBench(c, { x: 0, z: 0 })],
      ['picnic table', (c) => picnicTable(c, 0, 0)],
    ]) {
      const c = ctx();
      make(c);
      const g = c.root.children[0];
      expect(floating(g), name).toBe(0);
    }
  });

  it('clamps a sign\'s plate to its post, and the pillar box stands in one piece', () => {
    const c = ctx();
    signPost(c, 0, 0, 0, {}, 0.75, 0.75, { round: true, height: 2.2, back: {} });
    expect(floating(c.furniture.children[0])).toBe(0);
    const f = new Frame({ group: new THREE.Group(), x: 0, z: 0, yaw: 0, y0: 0, fixedBox: () => {} });
    pillarBox(c, f, 0, 0);
    expect(floating(f.group)).toBe(0);
  });
});
