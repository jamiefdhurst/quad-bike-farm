import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew, fromPlan, DRIVE_PLAN, LANE_PLAN, GATEWAYS_PLAN, newFields } from '../src/world/layoutNew.js';
import { createRoads } from '../src/world/roads.js';
import { createFields } from '../src/world/fields.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { createCattleGrid } from '../src/world/cattleGrid.js';
import { Track } from '../src/world/track.js';
import { visitPlaces, planVisit, Traffic, Visit, DEFAULT_TRAFFIC_PARAMS } from '../src/world/traffic.js';
import { leaveRoute, hasGone, goneBeyond } from '../src/npc/goingHome.js';
import { vergeGrassHeight } from '../src/world/driveProps.js';
import { createRandom } from '../src/core/random.js';
import { planRoad, paintRoadOnGround } from '../src/world/groundTexture.js';

const two = LAYOUT;
const road = two.road;
const net = createRoads(two.roads);
const fields = createFields(two);
const grid = createCattleGrid(two);

describe('the drive on the new farm', () => {
  it('runs from the lane at plan (905, 345) west to the yard at (612, 345): about 290 m, 6 m of tarmac', () => {
    const drive = net.road('farm');
    expect(drive.name).toBe('the drive');
    const [x0, z] = fromPlan([612, 345]);
    const [x1] = fromPlan([905, 345]);
    expect(drive.points).toEqual([[x0, z], [x1, z]]);
    expect(drive.length).toBeGreaterThan(285);
    expect(drive.length).toBeLessThan(295);
    expect(drive.halfWidth * 2).toBe(6);
    expect(drive.surface).toBe('tarmac');
  });

  it('meets the lane where it runs straight, at plan x 905, end to side', () => {
    const [laneX] = fromPlan([LANE_PLAN.x, 0]);
    expect(two.publicLane.x).toBe(laneX);
    expect(net.road('lane').points.at(-1)[0]).toBe(laneX);
    expect(net.road('farm').junction).toEqual({ end: 'end', onto: 'lane' });
    expect(road.toX).toBe(laneX);
  });

  it('is tarmac along its whole length and verge beside it, with no hedge on either side', () => {
    for (let x = road.fromX + 2; x < road.toX - 2; x += 7) {
      expect(fields.tarmacAt(x, road.z), `x ${x}`).toBeGreaterThan(0.9);
      // The bellmouth's corners round the drive's edges out for the last `bellmouth` m (#816): hard standing there, beyond the verge's edge.
      expect(fields.tarmacAt(x, road.z + road.halfWidth + 1), `verge x ${x}`).toBeLessThan(x > road.toX - road.bellmouth - 2 ? 1.1 : 0.1);
      // Nothing between the tarmac and the crops: no hedge within 8 m of the middle, both sides, except at the lane end's own boundary.
      if (x < road.toX - 25) for (const side of [-1, 1]) expect(fields.hedgeDistance(x, road.z + side * 8), `hedge x ${x}`).toBeGreaterThan(1.5);
    }
    const nones = newFields().boundaries.filter((b) => b.kind === 'none').map((b) => b.between.slice().sort().join('|')).sort();
    expect(nones).toEqual(['drive|farmstead', 'drive|lanefield', 'drive|longpiece', 'hill|lane']); // and the green lane's open end, over the ford
  });

  it('is levelled across, so a wheel either side of it stands at the same height', () => {
    const heights = createTerrainHeight(two, new Track(two.trackPoints));
    for (const x of [road.fromX + 20, 150, 250, road.toX - 20]) {
      expect(Math.abs(heights.heightAt(x, road.z - 2.4) - heights.heightAt(x, road.z + 2.4)), `x ${x}`).toBeLessThan(0.05);
    }
  });

  it('has the lane straight past it with no invisible walls round it', () => {
    expect(two.publicLane.minZ).toBeLessThan(-400);
    expect(two.publicLane.maxZ).toBeGreaterThan(500);
  });
});

describe('the cattle grid on the drive', () => {
  it('is on the drive at plan x 878 to 885, across all of its tarmac', () => {
    expect(grid.x).toBeCloseTo(fromPlan([DRIVE_PLAN.grid.x, 0])[0]);
    expect(grid.maxX).toBeLessThanOrEqual(fromPlan([885, 0])[0]);
    expect(grid.minX).toBeGreaterThanOrEqual(fromPlan([878, 0])[0]);
    expect(grid.onGrid(grid.x, road.z)).toBe(true);
    expect(grid.minZ).toBeLessThan(road.z - road.halfWidth);
    expect(grid.maxZ).toBeGreaterThan(road.z + road.halfWidth);
    expect(grid.onGrid(grid.x, road.z + road.halfWidth + 1)).toBe(false);
  });

  it('has the field gate beside it, in the lane boundary and clear of the grid, and no gate across the drive', () => {
    const b = road.bypass;
    expect(Math.abs(b.z - road.z)).toBeGreaterThan(grid.half + 1); // beside the grid, not across it
    expect(b.x).toBeCloseTo(fromPlan([885, 0])[0]);
    expect(b.width).toBeGreaterThan(3);
    expect(road.gate).toBeUndefined(); // the big gate onto the lane is gone
    expect(road.grid.gateOffset).toBeUndefined(); // and so is the gate across the road by the grid
    const gate = GATEWAYS_PLAN.find((g) => g.id === 'bypass');
    expect(gate).toMatchObject({ a: 'drive', b: 'out', gate: true, shut: true });
    const placed = newFields().gateways.find((g) => g.id === 'bypass');
    expect(placed).toMatchObject({ a: 'drive', b: 'out', gate: true, shut: true });
    expect(fields.gates.bypass).toBeTruthy();
    expect(fields.gates.road).toBeUndefined();
  });

  it('leaves the drive an open gap through the lane boundary: the mouth is the grid\'s, and the gate\'s gap does not overlap it', () => {
    const [mouth, gate] = newFields().gateways.filter((g) => g.a === 'drive' && g.b === 'out');
    expect(mouth.at + mouth.half).toBeLessThan(gate.at - gate.half + 0.01);
  });

  it('builds wings that leave the whole carriageway clear, and a sign by the verge facing the lane', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildCattleGrid } = await import('../src/world/driveProps.js');
    const boxes = [];
    const scene = new THREE.Scene();
    const heights = createTerrainHeight(two, new Track(two.trackPoints));
    const group = buildCattleGrid({ scene, layout: two, heights, fixedBox: (...a) => boxes.push(a), grid, random: createRandom(3) });
    expect(group.name).toBe('cattleGrid');
    expect(boxes).toHaveLength(2);
    for (const [, , z, , , hz] of boxes) {
      expect(Math.min(Math.abs(z - hz - road.z), Math.abs(z + hz - road.z)), 'a wing reaches into the carriageway').toBeGreaterThanOrEqual(road.halfWidth);
    }
    group.updateMatrixWorld(true);
    const fights = coplanarOverlaps(group, { gap: 0.003, minArea: 2e-5, textured: true });
    expect(fights.map((f) => `${f.a}/${f.b} at ${f.at.map((v) => v.toFixed(2))}`)).toEqual([]);
  });

  it('closes the gateway round the grid: the wings stand in the lane boundary, kerb to mouth edge, so the only way past is the grid or the field gate (#961)', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildCattleGrid } = await import('../src/world/driveProps.js');
    const boxes = [];
    const heights = createTerrainHeight(two, new Track(two.trackPoints));
    buildCattleGrid({ scene: new THREE.Scene(), layout: two, heights, fixedBox: (...a) => boxes.push(a), grid, random: createRandom(3) });
    const boundaryX = fromPlan([885, 0])[0];
    expect(road.grid.wingX).toBeCloseTo(boundaryX);
    expect(road.grid.mouth).toBe(GATEWAYS_PLAN.find((g) => g.a === 'drive' && g.b === 'out' && !g.id).half);
    const spans = boxes.map(([x, , z, , , hz]) => ({ x, lo: z - hz, hi: z + hz })).sort((p, q) => p.lo - q.lo);
    expect(spans).toHaveLength(2);
    for (const w of spans) expect(w.x).toBeCloseTo(boundaryX);
    // North wing from the mouth's edge to the grid's kerb, south wing from the kerb to the mouth's other edge, within half a metre each end.
    expect(spans[0].lo).toBeLessThan(road.z - road.grid.mouth + 0.5);
    expect(spans[0].hi).toBeGreaterThan(grid.minZ - 0.5);
    expect(spans[1].lo).toBeLessThan(grid.maxZ + 0.5);
    expect(spans[1].hi).toBeGreaterThan(road.z + road.grid.mouth - 0.5);
    expect(spans[0].hi).toBeLessThan(road.z - road.halfWidth);
    expect(spans[1].lo).toBeGreaterThan(road.z + road.halfWidth);
  });

  it('builds reflector posts at the lane end, two a side, standing clear of the carriageway', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildReflectorPosts } = await import('../src/world/driveProps.js');
    const heights = createTerrainHeight(two, new Track(two.trackPoints));
    const group = buildReflectorPosts({ scene: new THREE.Scene(), layout: two, heights, random: createRandom(3) });
    expect(group.children).toHaveLength(4);
    for (const [x, z] of road.reflectors) {
      expect(Math.abs(z - road.z)).toBeGreaterThan(road.halfWidth);
      expect(x).toBeGreaterThan(grid.maxX); // between the grid and the lane
      expect(x).toBeLessThan(road.toX);
    }
  });
});

describe('the verge', () => {
  it('is cut short by the grid and longer by the yard', () => {
    expect(vergeGrassHeight(2)).toBeLessThan(0.15);
    expect(vergeGrassHeight(100)).toBeGreaterThan(vergeGrassHeight(30));
    expect(vergeGrassHeight(250)).toBeGreaterThan(0.5);
    let last = 0;
    for (let d = 0; d <= 290; d += 10) {
      expect(vergeGrassHeight(d)).toBeGreaterThanOrEqual(last);
      last = vergeGrassHeight(d);
    }
  });
});

describe('the girls\' cars and the visitors on the drive', () => {
  const drivePoint = (p) => Math.abs(p.z - road.z) <= road.halfWidth + 6 && p.x >= road.fromX && p.x <= road.toX + 0.01;
  // On the lane (it bends round to the A-road now, #687) or on the A-road a visitor comes in by.
  const lanePoint = (p) => ['lane', 'aRoad'].includes(net.onCarriageway(p.x, p.z)?.id);

  it('takes a girl\'s car out along the drive and over the grid, with no gate to open, and away down the lane', () => {
    const slot = two.cars.finch;
    const route = leaveRoute(slot, two);
    const over = route.findIndex((p) => p.x > grid.maxX);
    expect(over).toBeGreaterThan(0);
    expect(route.some((p) => p.x < grid.minX && Math.abs(p.z - road.z) < road.halfWidth)).toBe(true); // along the drive before it
    expect(route.some((p) => p.x > grid.maxX && p.x < two.publicLane.x && Math.abs(p.z - road.z) < road.halfWidth)).toBe(true); // and on to the lane
    for (const p of route.slice(1)) expect(drivePoint(p) || lanePoint(p), `${p.x}, ${p.z}`).toBe(true);
    const last = route[route.length - 1];
    expect(last.x).toBe(two.publicLane.x);
    expect(last.z).toBeGreaterThan(road.z + 90);
    expect(hasGone(two, { gateX: 0, laneZ: 95 }, { x: last.x, z: last.z })).toBe(true);
    expect(hasGone(two, { gateX: 0, laneZ: 95 }, { x: slot.x, z: slot.z })).toBe(false);
    expect(goneBeyond(two, { gateX: 0, laneZ: 95 }).x).toBeLessThan(two.publicLane.x);
  });

  it('plans a visit that drives in over the grid, goes to the barn and comes back out, with no gate step', () => {
    const places = visitPlaces(two);
    expect(places.open).toBe(true);
    for (const from of [1, -1]) {
      const steps = planVisit({ places, from, to: from, does: 'parcel', leaveOpen: false, farmSpeed: 6 });
      expect(steps.filter((s) => s.type === 'gate')).toEqual([]);
      const drives = steps.filter((s) => s.type === 'drive');
      const over = (path) => path.some((p) => Math.abs(p.x - grid.x) < 5 && Math.abs(p.z - road.z) < road.halfWidth);
      expect(over(drives[0].path), 'in over the grid').toBe(true);
      expect(over(drives[drives.length - 1].path), 'out over the grid').toBe(true);
      for (const p of drives[0].path) expect(drivePoint(p) || lanePoint(p), `${p.x}, ${p.z}`).toBe(true);
    }
  });

  it('runs a whole visit with no gate, and the vehicle gets away', () => {
    const places = visitPlaces(two);
    const visit = new Visit({ kind: 'post', places, from: 1, to: 1, leaveOpen: false, params: { ...DEFAULT_TRAFFIC_PARAMS } });
    let t = 0;
    const events = [];
    while (!visit.done && t < 1500) {
      events.push(...visit.update(0.1, { gate: undefined, gates: {}, blockers: [], swingSeconds: 1.8 }));
      t += 0.1;
    }
    expect(visit.done).toBe(true);
    expect(events.map((e) => e.type)).toContain('arrived');
    expect(events.some((e) => e.type === 'gate')).toBe(false);
  });

  it('sees a vehicle pass the drive\'s mouth on the lane', () => {
    const places = visitPlaces(two);
    expect(places.gate).toEqual({ x: two.publicLane.x, z: road.z });
    const traffic = new Traffic({ places, params: { ...DEFAULT_TRAFFIC_PARAMS }, random: createRandom(5) });
    let passed = 0;
    for (let i = 0; i < 6000 && !passed; i++) passed += traffic.update(0.1, { darkness: 0, blockers: [], swingSeconds: 1.8 }).filter((e) => e.type === 'pass').length;
    expect(passed).toBeGreaterThan(0);
  });
});

describe('the drive\'s old tarmac, painted into the ground', () => {
  const drive = net.road('farm');
  const plan = planRoad(drive, fields, createRandom(5));
  const painted = () => {
    const calls = [];
    const ctx = new Proxy({}, { get: (_, name) => (name === 'calls' ? calls : (...args) => calls.push([name, ...args])), set: () => true });
    paintRoadOnGround(ctx, (x, z) => [x, z], 20, drive, fields, createRandom(5));
    return calls;
  };

  it('lays 70 squares of repair, each inside the carriageway', () => {
    expect(plan.patches).toHaveLength(70);
    for (const q of plan.patches) {
      expect(Math.abs(q.z - drive.points[0][1]) + q.w / 2 * 0.99, `patch at ${q.x}`).toBeLessThanOrEqual(drive.halfWidth + 0.4);
    }
  });

  it('breaks the edges into gravel along the whole drive, on both sides', () => {
    expect(plan.gravel.length / 4).toBeGreaterThan(drive.length * 2 * 4);
    const sides = new Set();
    for (let i = 0; i < plan.gravel.length; i += 4) sides.add(Math.sign(plan.gravel[i + 1] - drive.points[0][1]));
    expect([...sides].sort()).toEqual([-1, 1]);
  });

  it('puts the four potholes on the tarmac, away from the grid, and paints each as water', () => {
    expect(plan.potholes).toHaveLength(4);
    for (const h of plan.potholes) {
      expect(fields.tarmacAt(h.x, h.z), `pothole at ${h.x}`).toBeGreaterThan(0.9);
      expect(Math.abs(h.x - grid.x)).toBeGreaterThan(20);
    }
    expect(painted().filter(([name]) => name === 'ellipse').length).toBeGreaterThanOrEqual(4 * 3);
  });

  it('carries mud and straw out of the gateways at the road\'s edge, thinning away from it', () => {
    expect(plan.washes).toHaveLength(3);
    for (const [i, w] of plan.washes.entries()) {
      expect(w.smears).toHaveLength(16);
      expect(w.straw).toHaveLength(40);
      const gate = road.washes[i];
      const side = Math.sign(gate[1] - road.z);
      // The smears lie from just inside the verge to a few metres in on the tarmac, on the gateway's side of the middle.
      for (const m of w.smears) expect(Math.sign(m.z - road.z) * side).toBeGreaterThanOrEqual(0);
    }
  });

});
