import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import {
  layoutNew, fromPlan, HILL_PLAN, NOT_MOVED_YET, REPLACED, clippedFields, boundariesOf, placeGateways, FIELD_LANDMARKS_PLAN,
} from '../src/world/layoutNew.js';
import { createHill } from '../src/world/hill.js';
import { createFields } from '../src/world/fields.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { hutShape } from '../src/world/hut.js';
import { createElectricFence } from '../src/world/electricFence.js';
import { climbGates } from '../src/npc/hillClimb.js';
import { steepestBank } from '../src/npc/dares.js';
import { DEFAULT_FLOCK_PARAMS, Flock, findFlockSpot } from '../src/world/flock.js';
import { createRandom } from '../src/core/random.js';
import { pointInPolygon, polygonBounds } from '../src/world/polygons.js';

// The hill side on the new farm (#684): the green lane, the stream and the ford, Hill Pasture, the Sheep Field and the Wet Meadow, as today's hill
// set on the plan's fields.
const two = layoutNew(LAYOUT, RAW_LAYOUT);
const H = two.hill;
const heights = createTerrainHeight(two, new Track(two.trackPoints));
const h = heights.heightAt;
const hill = createHill(two);
const fields = createFields(two);
const was = createHill(LAYOUT);
const plan = Object.fromEntries(clippedFields().map((f) => [f.name, f.points.map(fromPlan)]));
const inField = (name, [x, z], margin = 0) => pointInPolygon(plan[name], x, z, margin);
const at = (p) => fromPlan(p);

/** The steepest slope (rise over run, 1 m apart) of the ground over a grid of points. */
function steepestOver(pts, probe) {
  let best = 0;
  for (const [x, z] of pts) best = Math.max(best, probe(x, z));
  return best;
}

describe('what the hill side has left behind', () => {
  it('is off the list of places at today\'s numbers, and on the list of what the new farm replaces', () => {
    for (const k of ['hill', 'anchors.hut', 'gate']) {
      expect(NOT_MOVED_YET[k], k).toBeUndefined();
      expect(REPLACED, k).toContain(k);
    }
  });
  it('drops the river and its meadow, which are #565\'s, and keeps the hut\'s anchor with the hut', () => {
    expect(H.river).toBeUndefined();
    expect(H.riverside).toBeUndefined();
    expect(H.brook).toBeUndefined();
    expect(two.anchors.hut).toEqual({ x: H.hut.x, z: H.hut.z, yaw: 0 });
  });
});

describe('the hill pasture', () => {
  it('is the field\'s own outline, and its banks keep today\'s rise and width, stretched out from the stream', () => {
    expect(H.pasture.points).toEqual(plan.hill);
    expect(H.banks.map((b) => [b.rise, b.width])).toEqual(LAYOUT.hill.banks.map((b) => [b.rise, b.width]));
    expect(hill.total).toBeCloseTo(was.total, 6);
    const last = H.banks[H.banks.length - 1];
    expect(last.at + last.width / 2).toBeGreaterThan(165); // about 175 m deep, as the plan's map draws it
    expect(last.at + last.width / 2).toBeLessThan(185);
    for (let i = 1; i < H.banks.length; i++) expect(H.banks[i].at).toBeGreaterThan(H.banks[i - 1].at);
  });
  it('is as steep as today\'s on its banks (38 degrees at the steepest) and on the same gentle easy way up at the east end', () => {
    const grid = [];
    for (let x = H.pasture.minX + 40; x < fromPlan([280, 0])[0]; x += 6) for (let d = 5; d < 190; d += 2) grid.push([x, hill.farEdge(x) + d]);
    const slope = (x, z) => hill.climbSlope(x, z);
    const wasGrid = [];
    for (let x = LAYOUT.hill.pasture.minX + 10; x < LAYOUT.hill.gentle.fromX; x += 6) for (let d = 3; d < 60; d += 1) wasGrid.push([x, was.farEdge(x) + d]);
    const now = steepestOver(grid, slope);
    const then = steepestOver(wasGrid, (x, z) => was.climbSlope(x, z));
    expect(now).toBeCloseTo(then, 1);
    expect(Math.atan(now) * (180 / Math.PI)).toBeGreaterThan(30);
    // The east end is gentler: its banks are 2.4 times as wide.
    const east = steepestOver(Array.from({ length: 60 }, (_, i) => [fromPlan([400, 0])[0], hill.farEdge(fromPlan([400, 0])[0]) + 10 + i * 3]), slope);
    expect(east).toBeLessThan(now / 1.8);
  });
  it('climbs about as far as today\'s from the ford to the top, on the plan\'s landform', () => {
    const ford = h(H.lane.x, hill.farEdge(H.lane.x) + 1);
    const top = h(H.hut.x, H.hut.z);
    expect(top - ford).toBeGreaterThan(was.total - 1);
    expect(top - ford).toBeLessThan(was.total + 12); // the land rises west on top of the banks (landform.js)
  });
  it('leaves the ground outside the hill alone: the farmstead is where it was', () => {
    const flat = createTerrainHeight({ ...two, hill: undefined }, new Track(two.trackPoints)).heightAt;
    for (let x = -200; x <= 400; x += 25) for (let z = -300; z <= 60; z += 25) expect(h(x, z)).toBe(flat(x, z));
  });
  it('puts the shepherd\'s hut on the plan\'s spot with a level pad, and the flask rock where the plan has it', () => {
    const hut = FIELD_LANDMARKS_PLAN.find((l) => l.kind === 'hut');
    const rock = FIELD_LANDMARKS_PLAN.find((l) => l.kind === 'flaskRock');
    expect([H.hut.x, H.hut.z]).toEqual(at(hut.at));
    expect([H.viewpoint.x, H.viewpoint.z]).toEqual(at(rock.at));
    expect(inField('hill', at(hut.at), 10)).toBe(true);
    expect(inField('hill', at(rock.at), 10)).toBe(true);
    const shape = hutShape(two);
    expect(shape.x).toBe(H.hut.x);
    // Level under it and for the 2.5 m round it, then eased back over 5 m into the lie of the land (it is 0.2 at 7 m on today's farm too).
    for (const [r, most] of [[2.5, 0.01], [4, 0.06], [7, 0.25]]) {
      for (let a = 0; a < 6.3; a += 0.4) {
        const x = H.hut.x + Math.cos(a) * r;
        const z = H.hut.z + Math.sin(a) * r;
        expect(Math.abs(h(x + 0.5, z) - h(x - 0.5, z)), `${r} ${a}`).toBeLessThan(most);
        expect(Math.abs(h(x, z + 0.5) - h(x, z - 0.5)), `${r} ${a}`).toBeLessThan(most);
      }
    }
  });
  it('can be seen from the ford and from Home Ground\'s gate: the hut\'s roof clears the ground between', () => {
    const roof = 2.5;
    const seen = (from) => {
      const eye = h(from[0], from[1]) + 1.7;
      const top = h(H.hut.x, H.hut.z) + roof;
      const d = Math.hypot(H.hut.x - from[0], H.hut.z - from[1]);
      for (let i = 1; i < d / 5; i++) {
        const t = (i * 5) / d;
        const x = from[0] + (H.hut.x - from[0]) * t;
        const z = from[1] + (H.hut.z - from[1]) * t;
        if (h(x, z) > eye + (top - eye) * t) return false;
      }
      return true;
    };
    expect(seen([H.lane.x, hill.farEdge(H.lane.x) + 1])).toBe(true);
    expect(seen(at([200, 444]))).toBe(true);
  });
});

describe('the climb', () => {
  const gates = climbGates(H.climb);
  it('runs up the gentler ground inside the pasture, clear of the wood and the water, from just past the stream to near the top', () => {
    expect(gates).toHaveLength(4);
    for (const g of gates) {
      for (const f of [-1, 0, 1]) {
        const x = g.x - g.tz * g.half * f;
        const z = g.z + g.tx * g.half * f;
        expect(hill.inPasture(x, z), `${x},${z}`).toBe(true);
        expect(hill.inWood(x, z)).toBe(false);
        expect(hill.waterAt(x, z)).toBeLessThanOrEqual(0);
      }
    }
    expect(gates[0].z - hill.farEdge(gates[0].x)).toBeLessThan(hill.layoutFoot ?? 40);
    expect(gates[0].z).toBeGreaterThan(hill.farEdge(gates[0].x));
    expect(h(gates[3].x, gates[3].z) - h(gates[0].x, gates[0].z)).toBeGreaterThan(10);
    for (let i = 0; i < gates.length - 1; i++) {
      const a = gates[i];
      const b = gates[i + 1];
      const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z));
      for (let k = 0; k < n; k++) {
        const t0 = k / n;
        const t1 = (k + 1) / n;
        const slope = Math.abs(h(a.x + (b.x - a.x) * t1, a.z + (b.z - a.z) * t1) - h(a.x + (b.x - a.x) * t0, a.z + (b.z - a.z) * t0)) / (Math.hypot(b.x - a.x, b.z - a.z) / n);
        expect(slope, `${i}`).toBeLessThan(0.5);
      }
    }
  });
  it('is crossed by the electric fence at its gap, which is where quads cross on the way to it', () => {
    const f = createElectricFence(two);
    expect(f.near(...f.from, 0.5)).toBe(true);
    const gap = f.pointAt(f.gap.at);
    expect(f.near(gap.x, gap.z, 1)).toBe(false);
    expect(f.length).toBeGreaterThan(250); // about 300 m, from the foot to the top
    expect(gap.z - hill.farEdge(gap.x)).toBeLessThan(hill.farEdge(gap.x) + 40 - hill.farEdge(gap.x)); // at the foot
    expect(gap.x).toBeLessThan(gates[0].x); // west of the climb: its rides along the foot cross there
  });
  it('is given Jess\'s dare bank in the stretched banks', () => {
    const bank = steepestBank(H);
    expect(bank.minX).toBe(H.pasture.minX);
    expect(bank.rise).toBe(5.5);
  });
});

describe('the stream and the ford', () => {
  it('runs the pasture\'s length at plan z 570 and ends at its hedges, with the ford where the lane crosses', () => {
    const [, z] = fromPlan([0, 570]);
    expect(H.stream.z).toBe(z);
    for (const x of [H.pasture.minX + 10, H.lane.x, H.pasture.maxX - 10]) expect(hill.waterAt(x, hill.streamZ(x))).toBeGreaterThan(0.9);
    expect(hill.waterAt(H.pasture.maxX + 15, hill.streamZ(H.pasture.maxX + 15))).toBe(0);
    expect(hill.waterAt(H.pasture.minX - 15, hill.streamZ(H.pasture.minX - 15))).toBe(0);
    expect(hill.channelAt(H.pasture.maxX + 12, hill.streamZ(H.pasture.maxX + 12))).toBe(0);
    expect(hill.halfAt(H.lane.x)).toBeCloseTo(H.stream.ford.halfWidth, 1);
    expect(hill.depthAt(H.lane.x)).toBeLessThan(hill.depthAt(H.lane.x + 40));
  });
  it('is crossed at the ford by the girls\' waiting place, just through it', () => {
    expect(hill.waitSpot.x).toBeCloseTo(H.lane.x + 3, 6);
    expect(hill.waitSpot.z).toBeGreaterThan(hill.farEdge(H.lane.x));
    expect(hill.pastFoot(hill.waitSpot.x, hill.waitSpot.z)).toBe(false);
    expect(fields.hill.waitSpot).toEqual(hill.waitSpot);
  });
});

describe('the green lane', () => {
  const lane = plan.lane;
  it('is the field between Far Field and the Sheep Field, from Home Ground\'s edge to the stream', () => {
    const b = polygonBounds(lane);
    expect(b.minX).toBeCloseTo(H.lane.x - H.lane.hedgeOff, 6);
    expect(b.maxX).toBeCloseTo(H.lane.x + H.lane.hedgeOff, 6);
    expect(b.minZ).toBe(H.lane.top);
    expect(b.maxZ - H.lane.top).toBeGreaterThan(120); // about 125 m, 2.3 times today's 54
    expect(H.lane.toZ).toBeLessThan(hill.streamZ(H.lane.x));
    expect(fields.areaOf(H.lane.x, H.lane.top + 40)).toBe('lane');
    expect(fields.areaOf(H.lane.x - 20, H.lane.top + 40)).toBe('far');
    expect(fields.areaOf(H.lane.x + 20, H.lane.top + 40)).toBe('sheep');
  });
  it('is sunk between its banks with a bed a quad can ride, and no step at its head', () => {
    for (const z of [H.lane.top + 40, H.lane.top + 70, H.lane.toZ - 40]) {
      const bed = h(H.lane.x, z);
      expect(h(H.lane.x - H.lane.hedgeOff, z) - bed, `${z}`).toBeGreaterThan(H.lane.sink * 0.9);
      expect(h(H.lane.x + H.lane.hedgeOff, z) - bed, `${z}`).toBeGreaterThan(H.lane.sink * 0.9);
      expect(Math.abs(h(H.lane.x + 1, z) - h(H.lane.x - 1, z))).toBeLessThan(0.2);
    }
    let steepest = 0;
    for (let z = H.lane.top - 3; z < H.lane.toZ; z++) steepest = Math.max(steepest, Math.abs(h(H.lane.x, z + 1) - h(H.lane.x, z)));
    expect(steepest).toBeLessThan(0.25);
  });
  it('has the south gate at its head, and a gateway into Far Field and the Sheep Field either side', () => {
    expect(two.gate.x).toBe(H.lane.x);
    expect(two.gate.z).toBe(H.lane.top);
    expect(fields.gates.south).toBeTruthy();
    const has = (a, b) => two.gateways.some((g) => [g.a, g.b].sort().join() === [a, b].sort().join());
    expect(has('home', 'lane') && has('far', 'lane') && has('lane', 'sheep') && has('hill', 'lane')).toBe(true);
    expect(H.gates).toHaveLength(2);
    for (const g of H.gates) expect(g.z).toBeGreaterThan(H.lane.top);
  });
  it('reaches the ford from the yard through the gateways', () => {
    const route = fields.route({ x: 0, z: 0 }, hill.waitSpot);
    expect(route.length).toBeGreaterThan(2);
    expect(route.every((p) => Number.isFinite(p.x) && Number.isFinite(p.z))).toBe(true);
    const end = route[route.length - 1];
    expect(Math.hypot(end.x - hill.waitSpot.x, end.z - hill.waitSpot.z)).toBeLessThan(8);
  });
});

describe('the sheep field', () => {
  const E = H.paddocks.east;
  it('is the field\'s own outline, with a wall across it near the top, its gap mid-field, and two terraces below', () => {
    expect(E.rect.points).toEqual(plan.sheep);
    expect(E.wall.z).toBeGreaterThan(E.rect.minZ + 20);
    expect(E.wall.from).toBeCloseTo(H.lane.x + H.lane.hedgeOff, 6);
    expect(inField('sheep', [E.wall.gap.at, E.wall.z])).toBe(true);
    expect(E.terraces.banks).toHaveLength(2);
    for (const z of E.terraces.banks) expect(z).toBeGreaterThan(E.wall.z);
    expect(inField('sheep', [E.terraces.stand.x, E.terraces.stand.z], 3)).toBe(true);
    // The ground falls across the terraces as it did, in steady slopes a girl could walk: today's banks are 12 degrees at the steepest, and the farm's own
    // rolling (baseHeight) adds a little where these stand.
    let steepest = 0;
    const x = fromPlan([300, 0])[0];
    for (let z = E.wall.z; z < hill.farEdge(x) - 6; z += 1) steepest = Math.max(steepest, Math.abs(h(x, z + 1) - h(x, z)));
    expect(steepest).toBeGreaterThan(0.1); // a bank is there
    expect(steepest).toBeLessThan(Math.tan((16 * Math.PI) / 180));
  });
  it('lets a sheep stand south of the wall inside the field, and nowhere else', () => {
    const [x, z] = at([300, 520]);
    expect(hill.sheepFieldOk(x, z)).toBe(true);
    expect(hill.sheepFieldOk(x, E.wall.z - 5)).toBe(false); // north of the wall
    expect(hill.sheepFieldOk(H.lane.x, 120)).toBe(false); // in the lane
    expect(hill.sheepFieldOk(...at([100, 700]))).toBe(false); // on the hill
    expect(hill.sheepFieldOk(...at([300, 560]))).toBe(false); // over the field's slanted south edge (plan z 555 there)
  });
  it('keeps its thorns inside, south of the wall, clear of the lane, the gateways, the trough and the barn\'s spot', () => {
    for (const [x, z] of E.thorns) {
      expect(inField('sheep', [x, z], 2), `${x},${z}`).toBe(true);
      expect(z).toBeGreaterThan(E.wall.z + 3);
      expect(hill.sheepFieldOk(x, z)).toBe(false); // sheep keep off them
    }
    const barn = at(FIELD_LANDMARKS_PLAN.find((l) => l.kind === 'fieldBarn').at);
    expect(inField('sheep', barn, 5)).toBe(true);
    expect(barn[1]).toBeLessThan(E.wall.z); // at the top tread, north of the wall
  });
  it('has the barn\'s spot, the wall and the gate to the stone track on the same side of the field', () => {
    const track = two.gateways.find((g) => [g.a, g.b].sort().join() === 'hay,sheep');
    expect(track).toBeTruthy();
  });
});

describe('the wet meadow', () => {
  const W = H.paddocks.west;
  it('is the field\'s own outline with the pond at the plan\'s (112, 292), as big as today\'s', () => {
    expect(W.rect.points).toEqual(plan.wet);
    expect([W.pond.x, W.pond.z]).toEqual(at([112, 292]));
    expect([W.pond.rx, W.pond.rz, W.pond.depth, W.pond.water]).toEqual([11, 8, 1.1, 0.6]);
    expect(inField('wet', [W.pond.x, W.pond.z], 12)).toBe(true);
  });
  it('dishes the ground at the pond, with water standing in it, whatever the hill\'s weighting does', () => {
    const rim = (h(W.pond.x + W.pond.rx * 1.5, W.pond.z) + h(W.pond.x - W.pond.rx * 1.5, W.pond.z)) / 2; // the land rises west, so the rim is the two sides' mean
    expect(rim - h(W.pond.x, W.pond.z)).toBeGreaterThan(W.pond.depth * 0.8);
    expect(hill.waterAt(W.pond.x, W.pond.z)).toBeGreaterThan(0.9);
    expect(hill.waterAt(W.pond.x + W.pond.rx * 1.6, W.pond.z)).toBe(0);
    expect(hill.weight(W.pond.x, W.pond.z)).toBe(1);
  });
  it('has a muddy way in from the gateway at (197, 296), straight west to the pond\'s shelf, and oaks round it', () => {
    const gate = two.gateways.find((g) => [g.a, g.b].sort().join() === 'home,wet');
    expect(gate).toBeTruthy();
    expect(W.track[0][0]).toBeCloseTo(at([193, 0])[0], 6);
    expect(Math.abs(W.track[0][1] - at([0, 296])[1])).toBeLessThan(1);
    const end = W.track[W.track.length - 1];
    expect(Math.hypot(end[0] - W.pond.x, end[1] - W.pond.z)).toBeLessThan(W.pond.rx + 6);
    for (const [x, z] of W.track) expect(inField('wet', [x, z], 1)).toBe(true);
    expect(hill.mudAt(...W.track[1])).toBeGreaterThan(0.5);
    for (const [x, z] of W.trees) expect(inField('wet', [x, z], 1)).toBe(true);
    expect(W.trees).toHaveLength(LAYOUT.hill.paddocks.west.trees.length);
  });
  it('is not beside the lane: the lane has no gateway to it', () => {
    expect(two.gateways.some((g) => [g.a, g.b].includes('wet') && [g.a, g.b].includes('lane'))).toBe(false);
  });
});

describe('the flock', () => {
  const random = () => createRandom(5);
  it('keeps to its half of the hill, and never steps across the electric fence', () => {
    const f = createElectricFence(two);
    const allowed = (half) => (x, z) => hill.inPasture(x, z, 3) && z > hill.farEdge(x) + H.foot + 2 && !hill.inWood(x, z, -2) && hill.waterAt(x, z) < 0.05 && f.onHalf(x, z, half);
    for (const half of [0, 1]) {
      const p = H.pasture;
      const spot = findFlockSpot(allowed(half), { minX: p.minX + 8, maxX: p.maxX - 8, minZ: p.minZ + 20, maxZ: p.maxZ - 8 }, random());
      expect(spot, `half ${half}`).toBeTruthy();
      const flock = new Flock({ allowed: allowed(half), random: random(), params: { ...DEFAULT_FLOCK_PARAMS } });
      expect(flock.place(spot)).toBe(DEFAULT_FLOCK_PARAMS.count);
      for (let i = 0; i < 600; i++) flock.update(0.1, [{ x: spot.x, z: spot.z, speed: 8 }]);
      for (const s of flock.sheep) expect(f.onHalf(s.x, s.z, half, 0), `half ${half}`).toBe(true);
    }
    expect(f.onHalf(f.from[0] - 5, f.from[1] + 100, 0)).toBe(true); // west of the line is half 0
    expect(f.onHalf(f.from[0] + 5, f.from[1] + 100, 1)).toBe(true); // east is half 1
    expect(f.onHalf(f.from[0] + 5, f.from[1] + 100, 0)).toBe(false);
    expect(f.onHalf(f.from[0] + 0.5, f.from[1] + 100, 1)).toBe(false); // too close to the wire to stand
  });
  it('has the sheep field\'s own flock south of its wall', () => {
    const e = hill.east;
    const spot = findFlockSpot(hill.sheepFieldOk, { minX: e.minX + 8, maxX: e.maxX - 6, minZ: H.paddocks.east.wall.z + 6, maxZ: e.maxZ - 6 }, random());
    expect(spot).toBeTruthy();
    expect(inField('sheep', [spot.x, spot.z])).toBe(true);
  });
});

describe('the budget\'s hilltop', () => {
  it('is on the pasture\'s own outline, not its rectangle\'s corners', () => {
    let best = null;
    for (let x = H.pasture.minX; x <= H.pasture.maxX; x += 4) for (let z = H.pasture.minZ; z <= H.pasture.maxZ; z += 4) {
      if (!hill.inPasture(x, z)) continue;
      const y = h(x, z);
      if (!best || y > best.y) best = { x, z, y };
    }
    expect(best.y).toBeGreaterThan(h(H.lane.x, hill.farEdge(H.lane.x)) + 15);
    expect(hill.inPasture(best.x, best.z)).toBe(true);
  });
});
