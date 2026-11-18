import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew, fromPlan, WOOD_PLAN, NOT_MOVED_YET, REPLACED, clippedFields, boundariesOf, placeGateways } from '../src/world/layoutNew.js';
import { createWoods, woodsPlants } from '../src/world/woods.js';
import { createFields } from '../src/world/fields.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { createRandom } from '../src/core/random.js';
import { conkerSpots, leavesInAir, leafCover, DEFAULT_AUTUMN_PARAMS, CONKERS_PER_TREE } from '../src/world/autumn.js';
import { pointInPolygon, polygonArea, polygonBounds, polygonEdges, distanceToEdges } from '../src/world/polygons.js';

// Hollow Wood on the new farm (#683): today's wood carried into the plan's north-west corner, its Run and Trail as they were.
const two = layoutNew(LAYOUT, RAW_LAYOUT);
const W = two.woods;
const old = LAYOUT.woods;
const woods = createWoods(two);
const was = createWoods(LAYOUT);
const outline = W.outline;
const edges = polygonEdges(outline);
const plan = clippedFields();
const woodField = plan.find((f) => f.name === 'wood');
const dx = W.circuit.points[0][0] - old.circuit.points[0][0];
const dz = W.circuit.points[0][1] - old.circuit.points[0][1];
const clearOfEdge = (x, z) => distanceToEdges(edges, x, z);
const sampled = (track) => Array.from({ length: Math.floor(track.totalLength) }, (_, m) => track.sample(m / track.totalLength));

describe('the wood, moved', () => {
  it('has left the list of places still at today\'s numbers, with the log yard', () => {
    for (const k of ['woods', 'logYard', 'anchors.logYard']) {
      expect(NOT_MOVED_YET[k], k).toBeUndefined();
      expect(REPLACED).toContain(k);
    }
    expect(Object.values(NOT_MOVED_YET).join(' ')).not.toMatch(/the wood/);
  });

  it('is the shape of its field, all of it, and is the field the plan names Hollow Wood', () => {
    expect(W.name).toBe('Hollow Wood');
    expect(W.outline).toEqual(woodField.points.map(fromPlan));
    expect(two.fields.find((f) => f.name === 'wood').points).toEqual(W.outline);
    const b = polygonBounds(outline);
    expect([W.minX, W.maxX, W.minZ, W.maxZ]).toEqual([b.minX, b.maxX, b.minZ, b.maxZ]);
    const area = polygonArea(outline);
    expect(area).toBeGreaterThan(27000); // 1.48 times today's 160 by 120 m
    expect(area / ((old.maxX - old.minX) * (old.maxZ - old.minZ))).toBeGreaterThan(1.4);
  });

  it('carries the Hollow Run, the Fern Trail and their markers over by one shift, unchanged in shape', () => {
    old.circuit.points.forEach(([x, z], i) => expect([W.circuit.points[i][0] - x, W.circuit.points[i][1] - z]).toEqual([dx, dz]));
    old.trail.points.forEach(([x, z], i) => {
      expect(W.trail.points[i][0] - x).toBeCloseTo(dx, 9);
      expect(W.trail.points[i][1] - z).toBeCloseTo(dz, 9);
    });
    expect(W.trail.entrance.x - old.trail.entrance.x).toBeCloseTo(dx, 9);
    expect(W.pond.x - old.pond.x).toBeCloseTo(dx, 9);
    expect(W.pond).toMatchObject({ rx: old.pond.rx, rz: old.pond.rz, depth: old.pond.depth, water: old.pond.water });
    expect(W.hump.z - old.hump.z).toBeCloseTo(dz, 9);
    expect(W.bogs).toEqual(old.bogs);
    expect(W.logs).toEqual(old.logs);
    expect(W.whoops).toEqual(old.whoops);
    expect(W.trail).toMatchObject({ roots: old.trail.roots, dips: old.trail.dips, hop: old.trail.hop, postEvery: old.trail.postEvery });
    expect(W.deadwood.slice(0, old.deadwood.length).map(([x, , yaw, len]) => [x - dx, yaw, len])).toEqual(old.deadwood.map(([x, , yaw, len]) => [x, yaw, len]));
  });

  it('keeps the lap of the Hollow Run and of the Fern Trail as today: the same lengths, closed loops', () => {
    expect(woods.track.totalLength).toBeCloseTo(was.track.totalLength, 6);
    expect(woods.trailTrack.totalLength).toBeCloseTo(was.trailTrack.totalLength, 6);
    expect(woods.track.totalLength).toBeGreaterThan(588);
    expect(woods.track.totalLength).toBeLessThan(590);
    expect(woods.trailTrack.totalLength).toBeGreaterThan(389);
    expect(woods.trailTrack.totalLength).toBeLessThan(391);
    for (const track of [woods.track, woods.trailTrack]) {
      const p0 = track.sample(0);
      const p1 = track.sample(1);
      expect(Math.hypot(p0.x - p1.x, p0.z - p1.z)).toBeLessThan(0.5);
    }
    expect(woods.circuitName).toBe('The Hollow Run');
    expect(woods.trailName).toBe('The Fern Trail');
  });

  it('keeps the whole of both loops, and the pond, inside the wood and 6 m clear of its edge', () => {
    for (const p of [...sampled(woods.track), ...sampled(woods.trailTrack)]) {
      expect(pointInPolygon(outline, p.x, p.z)).toBe(true);
      expect(clearOfEdge(p.x, p.z)).toBeGreaterThan(6);
    }
    for (const a of [0, 1.6, 3.1, 4.7]) {
      const x = W.pond.x + Math.cos(a) * W.pond.rx;
      const z = W.pond.z + Math.sin(a) * W.pond.rz;
      expect(clearOfEdge(x, z)).toBeGreaterThan(15);
    }
  });

  it('puts the Run in the middle of the field, 5 m east to clear the corner the outline cuts', () => {
    const run = polygonBounds(W.circuit.points);
    const field = polygonBounds(outline);
    expect(Math.abs((run.minX + run.maxX) / 2 - (field.minX + field.maxX) / 2 - 5)).toBeLessThan(2);
    expect(Math.abs((run.minZ + run.maxZ) / 2 - (field.minZ + field.maxZ) / 2)).toBeLessThan(2);
    expect(WOOD_PLAN.runAt).toEqual([126, 131.5]);
  });
});

describe('the gates and the lead-in', () => {
  const runs = boundariesOf(plan);
  const gateways = placeGateways(runs);
  const between = (a, b) => gateways.find((g) => [g.a, g.b].sort().join('|') === [a, b].sort().join('|'));

  it('has the gateway onto the Wet Meadow at plan x 130 and one onto Back Lane on the west side', () => {
    expect(between('wood', 'wet')).toBeTruthy();
    expect(Math.abs(W.gate.x - fromPlan([130, 0])[0])).toBeLessThan(2);
    const west = gateways.filter((g) => g.a === 'wood' && g.b === 'out');
    expect(west.length).toBe(1);
    expect(W.backLane.x).toBeLessThan(fromPlan([60, 0])[0]); // on the outline's west side
    expect(clearOfEdge(W.backLane.x, W.backLane.z)).toBeLessThan(0.5);
    expect(W.backLane.width).toBeGreaterThanOrEqual(4);
  });

  it('puts the gate in the wood\'s south hedge and builds the old north gate nowhere', () => {
    const [[x0, z0], [x1, z1]] = W.south;
    const t = (W.gate.x - x0) / (x1 - x0);
    expect(Math.abs(W.gate.z - (z0 + (z1 - z0) * t))).toBeLessThan(0.5);
    expect(W.gate).toMatchObject({ width: old.gate.width, open: true });
    expect(two.newFarm).toBe(true);
  });

  it('runs the lead-in from the gate, 12 m straight in, then bending west to join the Run where it always did', () => {
    expect(W.leadIn[0]).toEqual([W.gate.x, W.gate.z]);
    expect(Math.hypot(W.leadIn[1][0] - W.gate.x, W.leadIn[1][1] - W.gate.z)).toBeGreaterThan(10);
    expect(Math.abs(W.leadIn[1][0] - W.gate.x)).toBeLessThan(1);
    const end = W.leadIn[W.leadIn.length - 1];
    expect(end[0]).toBeCloseTo(old.leadIn[2][0] + dx, 6);
    expect(end[1]).toBeCloseTo(old.leadIn[2][1] + dz, 6);
    expect(end).toEqual(W.circuit.points[0]);
    // It never turns back on itself, and no bend is sharper than a quad can take.
    for (let i = 1; i < W.leadIn.length - 1; i++) {
      const a = [W.leadIn[i][0] - W.leadIn[i - 1][0], W.leadIn[i][1] - W.leadIn[i - 1][1]];
      const b = [W.leadIn[i + 1][0] - W.leadIn[i][0], W.leadIn[i + 1][1] - W.leadIn[i][1]];
      const cos = (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b));
      expect(cos).toBeGreaterThan(Math.cos(Math.PI / 3));
    }
    for (const [x, z] of W.leadIn) expect(pointInPolygon(outline, x, z, -0.5)).toBe(true);
  });

  it('joins the Fern Trail\'s sign to the lead-in as it did, 3.4 m off it', () => {
    expect(woods.lineDistance(W.leadIn, W.trail.entrance.x, W.trail.entrance.z)).toBeGreaterThan(2.5);
    expect(woods.lineDistance(W.leadIn, W.trail.entrance.x, W.trail.entrance.z)).toBeLessThan(4.5);
  });

  it('has a clear way in and no step at the gate', () => {
    const heights = createTerrainHeight(two, new Track(two.trackPoints));
    expect(woods.profile(W.gate.x, W.gate.z)).toBeCloseTo(0, 6);
    for (let m = 0; m < 20; m += 1) {
      const a = heights.heightAt(W.gate.x, W.gate.z - m);
      const b = heights.heightAt(W.gate.x, W.gate.z - m - 1);
      expect(Math.abs(a - b)).toBeLessThan(0.35);
    }
  });

  it('is a way through to the girls: the fields know the wood and its two gateways', () => {
    const fields = createFields(two);
    expect(fields.areaOf(W.circuit.points[3][0], W.circuit.points[3][1])).toBe('wood');
    expect(two.gateways.filter((g) => g.a === 'wood' || g.b === 'wood').length).toBeGreaterThanOrEqual(2);
  });
});

describe('the trees, bushes and ground', () => {
  const plants = woodsPlants(woods, two, createRandom(7));

  it('plants today\'s density over the new area: about 250 oaks and 160 hazel and holly', () => {
    const area = polygonArea(outline) / ((old.maxX - old.minX) * (old.maxZ - old.minZ));
    expect(W.trees).toBe(Math.round(old.trees * area));
    expect(W.bushes).toBe(Math.round(old.bushes * area));
    expect(W.trees).toBeGreaterThan(245);
    expect(plants.trees.length).toBe(W.trees);
    expect(plants.bushes.length).toBe(W.bushes);
  });

  it('keeps every trunk inside the hedges and off the track, the pond, the logs and the lead-in', () => {
    for (const [x, z] of plants.trees) {
      expect(pointInPolygon(outline, x, z, 3)).toBe(true);
      expect(woods.trackDistance(x, z)).toBeGreaterThan(W.circuit.halfWidth + 2.5);
      expect(Math.hypot(x - W.pond.x, z - W.pond.z)).toBeGreaterThan(5);
    }
    for (const [x, z] of plants.bushes) expect(pointInPolygon(outline, x, z, 2)).toBe(true);
  });

  it('fills the bands north and south of the Run as well as the middle', () => {
    const run = polygonBounds(W.circuit.points);
    const field = polygonBounds(outline);
    const north = plants.trees.filter(([, z]) => z < run.minZ - 5).length;
    const south = plants.trees.filter(([, z]) => z > run.maxZ + 5).length;
    expect(north).toBeGreaterThan(25);
    expect(south).toBeGreaterThan(25);
    expect(field.maxZ - run.maxZ).toBeGreaterThan(40);
  });

  it('lays the extra deadwood in the bands, inside the wood and off the track', () => {
    expect(W.deadwood.length).toBe(old.deadwood.length + WOOD_PLAN.deadwood.length);
    for (const [x, z] of W.deadwood) {
      expect(pointInPolygon(outline, x, z, 4)).toBe(true);
      expect(woods.trackDistance(x, z)).toBeGreaterThan(W.circuit.halfWidth + 1.5);
    }
  });

  it('stands one veteran oak in the glade by the pond, with nothing else near it', () => {
    expect(W.oak.clear).toBeGreaterThanOrEqual(10);
    expect(Math.hypot(W.oak.x - W.pond.x, W.oak.z - W.pond.z)).toBeLessThan(25);
    expect(woods.trackDistance(W.oak.x, W.oak.z)).toBeGreaterThan(14);
    for (const [x, z] of plants.trees) expect(Math.hypot(x - W.oak.x, z - W.oak.z)).toBeGreaterThanOrEqual(W.oak.clear);
  });

  it('puts the autumn in the whole wood: leaves fall in it and the conkers lie under its oaks', () => {
    const p = DEFAULT_AUTUMN_PARAMS;
    expect(leavesInAir(p, woods, W.circuit.points[4][0], W.circuit.points[4][1])).toBe(p.leafFall);
    expect(leavesInAir(p, woods, W.gate.x, W.gate.z + 40)).toBe(Math.round(p.leafFall * p.leafFallOutside));
    expect(leafCover(woods, W.circuit.points[4][0], W.circuit.points[4][1])).toBe(1);
    const spots = conkerSpots(plants.trees, woods, CONKERS_PER_TREE, createRandom(3));
    expect(spots.length).toBeGreaterThan(plants.trees.length * 3);
    for (const [x, z] of spots) expect(pointInPolygon(outline, x, z)).toBe(true);
  });
});

describe('the girls\' waiting point and the wood\'s budget spot', () => {
  it('waits just inside the gate, short of the trees, and counts as past the gate deeper in', () => {
    expect(woods.waitSpot.x).toBeCloseTo(W.gate.x + 3, 9);
    expect(woods.waitSpot.z).toBeCloseTo(W.gate.z - 3.5, 9);
    expect(woods.inWoods(woods.waitSpot.x, woods.waitSpot.z)).toBe(true);
    expect(woods.pastGate(woods.waitSpot.x, woods.waitSpot.z)).toBe(false);
    expect(woods.pastGate(W.circuit.points[5][0], W.circuit.points[5][1])).toBe(true);
    expect(woods.pastGate(W.gate.x, W.gate.z + 5)).toBe(false);
  });

  it('stands the wood gate budget spot 12 m in from the gate, on the lead-in, where tools/frameBudget.mjs looks from', () => {
    const [x, z] = W.leadIn[1];
    expect([x, z]).toEqual([W.gate.x, W.gate.z - 12]);
    expect(woods.inWoods(x, z, 8)).toBe(true);
    expect(woods.lineDistance(W.leadIn, x, z)).toBeLessThan(0.01);
  });
});

describe('the woodpile at the gate', () => {
  const yard = two.logYard;
  const wet = two.fields.find((f) => f.name === 'wet').points;
  const south = W.south;
  const hedgeZ = (x) => south[0][1] + ((south[1][1] - south[0][1]) * (x - south[0][0])) / (south[1][0] - south[0][0]);

  it('moved with the wood: its anchor is in the Wet Meadow just east of the gate, the hedge at its back', () => {
    expect(two.anchors.logYard).toMatchObject({ x: fromPlan(WOOD_PLAN.logYard)[0], z: fromPlan(WOOD_PLAN.logYard)[1], yaw: 0 });
    expect(pointInPolygon(wet, two.anchors.logYard.x, two.anchors.logYard.z, 5)).toBe(true);
    expect(Math.abs(two.anchors.logYard.x - W.gate.x)).toBeLessThan(20);
    expect(yard.stack.z - hedgeZ(yard.stack.x)).toBeGreaterThan(1.5);
    expect(yard.stack.z - hedgeZ(yard.stack.x)).toBeLessThan(4.5);
    for (const [x, z] of yard.piles) expect(pointInPolygon(wet, x, z, 3)).toBe(true);
    expect(yard.park).toMatchObject({ x: two.anchors.logYard.x, z: two.anchors.logYard.z });
  });

  it('has a lean-to and a chopping block on every farm, clear of the stack, the rounds and the gate', () => {
    const s = yard.scenery;
    expect(s.leanTo.length).toBeGreaterThan(4);
    const lean = { minX: s.leanTo.x - s.leanTo.length / 2 - 0.3, maxX: s.leanTo.x + s.leanTo.length / 2 + 0.3 };
    expect(lean.minX).toBeGreaterThan(yard.stack.x + 3.5); // the working stack is 3.5 m long
    expect(Math.abs(lean.minX - W.gate.x)).toBeGreaterThan(8);
    expect(s.leanTo.z - s.leanTo.depth / 2 - hedgeZ(s.leanTo.x)).toBeGreaterThan(0.9 + 0.2); // against the hedge's face (1.8 m thick), not in it
    expect(s.leanTo.z - s.leanTo.depth / 2 - hedgeZ(s.leanTo.x)).toBeLessThan(2);
    for (const [x, z] of yard.piles) expect(Math.hypot(x - s.block.x, z - s.block.z)).toBeGreaterThan(1.5);
    expect(pointInPolygon(wet, s.block.x, s.block.z, 3)).toBe(true);
  });
});
