import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew, FARMSTEAD_PLAN as P, PLAN_ORIGIN, fromPlan, boundariesOf, clippedFields } from '../src/world/layoutNew.js';
import { barnFrame, barnShape, insideBarn, wallBoxes, outsideDoor } from '../src/world/barn.js';
import { pointInPolygon, distanceToEdges, polygonEdges } from '../src/world/polygons.js';
import { spawnKeepOut } from '../src/world/spawns.js';
import { leaveRoute } from '../src/npc/goingHome.js';
import { farmsteadPlaces, benchSpot } from '../src/console/gameHost.js';

// The farmstead on the new farm (#682): where everything stands, in the plan's own metres (docs/farm-plan.md).
const two = LAYOUT;
const plan = ({ x, z }) => [x + PLAN_ORIGIN[0], z + PLAN_ORIGIN[1]];
const inPlanRect = ([x, z], [x0, z0, x1, z1], m = 0) => x >= x0 + m && x <= x1 - m && z >= z0 + m && z <= z1 - m;
const fields = Object.fromEntries(clippedFields().map((f) => [f.name, f.points]));
const inField = (name, [x, z], margin = 0) => pointInPolygon(fields[name], x, z, margin);

describe('the barn', () => {
  const f = barnFrame(two);
  it('is turned a quarter left, the code that builds it saying it can', () => {
    expect(two.anchors.barn).toMatchObject({ yaw: -Math.PI / 2, turnable: true });
    expect(two.anchors.yard).toMatchObject({ yaw: -Math.PI / 2, turnable: true });
    expect(f.turned).toBe(true);
  });
  it('stands inside plan (498 to 524, 319 to 337), the doors facing south onto the yard', () => {
    for (const w of wallBoxes(two)) {
      for (const [x, z] of [[w.x - w.hx, w.z - w.hz], [w.x + w.hx, w.z + w.hz]]) expect(inPlanRect(plan({ x, z }), [498, 319, 524, 337]), `${w.id} at ${x}, ${z}`).toBe(true);
    }
    const out = outsideDoor(two, 3);
    expect(out.z).toBeGreaterThan(two.barn.z + two.barn.halfX); // south
    expect(plan(out)[1]).toBeGreaterThan(335);
    expect(inPlanRect(plan(out), P.slab)).toBe(true); // out of the doors is the yard
  });
  it('has the bell by its doors, the tanks by its east end and the generator along its west wall', () => {
    const outer = barnShape(two).outer;
    const corners = [f.toWorld(outer.minX, outer.minZ), f.toWorld(outer.maxX, outer.maxZ)];
    const east = Math.max(corners[0].x, corners[1].x);
    const west = Math.min(corners[0].x, corners[1].x);
    expect(Math.abs(two.fuelTank.x - east)).toBeLessThan(4);
    expect(two.generator.x).toBeLessThan(west + 0.5);
    const door = f.toWorld(two.barn.x + two.barn.halfX, two.barn.z);
    expect(Math.hypot(two.bell.x - door.x, two.bell.z - door.z)).toBeLessThan(10);
    expect(two.jumperRail.yaw).toBeCloseTo(-Math.PI / 2, 6); // its fittings turn with it
  });
  it('seats the girls on bales scattered inside it', () => {
    expect(two.barnBaleSpots.length).toBeGreaterThanOrEqual(4);
    for (const [x, z] of two.barnBaleSpots) expect(insideBarn(two, x, z)).toBe(true);
    // And you can work at the bench: the bay, the bench and where she stands are inside it, and the console's `tp me bench` puts you in front of it.
    for (const p of [two.bay, two.bench, benchSpot(two)]) expect(insideBarn(two, p.x, p.z)).toBe(true);
    expect(insideBarn(two, two.helmetHooks.stand.x, two.helmetHooks.stand.z)).toBe(true);
  });
});

describe('where a vehicle may not start', () => {
  it('keeps clear of the barn\'s doorways on the turned barn: out of the doors, south of them, not east where they used to face', () => {
    const keep = spawnKeepOut(two);
    const doorway = keep.find((k) => k.what === 'the barn doorway');
    expect(doorway.z).toBeGreaterThan(two.barn.z + two.barn.halfX); // south of the door wall
    expect(keep.find((k) => k.what === 'the extension doorway')).toBeUndefined(); // one building, one pair of doors
  });
});

describe('the yard, stackyard, orchard and garden', () => {
  const places = farmsteadPlaces(two);
  it('has a concrete yard over plan (425 to 615, 317 to 415), with the drive coming in on its east side at z 345', () => {
    const { slab } = two.farmstead;
    expect([slab.minX, slab.minZ, slab.maxX, slab.maxZ].map((v, i) => v + PLAN_ORIGIN[i % 2])).toEqual(P.slab);
    expect(two.road.z + PLAN_ORIGIN[1]).toBe(345);
    expect(two.gateways.some((g) => g.a === 'farmstead' && g.b === 'drive')).toBe(true);
  });
  it('has the yard\'s spawns and the player on it', () => {
    for (const q of two.spawn.quads) expect(inPlanRect(plan(q), P.slab), `${q.x}, ${q.z}`).toBe(true);
    expect(inPlanRect(plan(two.spawn.player), P.slab)).toBe(true);
  });
  it('has the Dutch barn at the stackyard\'s north with its bales stacked', () => {
    const d = plan(two.dutchBarn);
    const r = [P.stackyard[0], P.stackyard[1], P.stackyard[2], P.stackyard[3]];
    expect(inPlanRect([d[0] - two.dutchBarn.halfX, d[1] - two.dutchBarn.halfZ], r)).toBe(true);
    expect(inPlanRect([d[0] + two.dutchBarn.halfX, d[1] + two.dutchBarn.halfZ], r)).toBe(true);
    expect(d[1]).toBeLessThan((r[1] + r[3]) / 2); // in its north half
    expect(two.dutchBarn.layers).toBeGreaterThan(1); // the stack is round bales more than one high
    for (const b of two.strawBaleSpots.slice(-2)) expect(inPlanRect(plan({ x: b[0], z: b[1] }), r)).toBe(true);
  });
  it('has the hens\' run and the pig\'s ark in the orchard, with the feed bin by them', () => {
    const o = P.orchard;
    for (const r of [two.farmAnimals.pen, two.farmAnimals.sty]) {
      expect(inPlanRect(plan({ x: r.minX, z: r.minZ }), o)).toBe(true);
      expect(inPlanRect(plan({ x: r.maxX, z: r.maxZ }), o)).toBe(true);
    }
    expect(inPlanRect(plan(two.farmAnimals.bin), o)).toBe(true);
    expect(inPlanRect(plan(two.farmAnimals.bucket), o)).toBe(true);
    expect(two.farmstead.orchard).toEqual(expect.objectContaining({ minX: o[0] - PLAN_ORIGIN[0] }));
  });
  it('has a garden plot of lawn behind a wall, its gate on the yard side, and no house yet', () => {
    const g = two.farmstead.garden;
    expect([g.minX, g.minZ, g.maxX, g.maxZ].map((v, i) => v + PLAN_ORIGIN[i % 2])).toEqual(P.garden.rect);
    expect(g.gate.x + PLAN_ORIGIN[0]).toBe(P.garden.gate.x);
    const lawn = two.lawns.garden;
    expect(lawn.minX).toBeGreaterThan(g.minX);
    expect(lawn.maxZ).toBeLessThan(g.maxZ);
    expect(two.farmhouse).toBeUndefined(); // #693
  });
  it('parks the girls\' cars beside the garden, plan (572 to 612, 319 to 333), nosed in to its wall', () => {
    expect(Object.keys(two.cars).sort()).toEqual(Object.keys(LAYOUT.cars).sort());
    for (const c of Object.values(two.cars)) {
      expect(inPlanRect(plan(c), [572, 319, 612, 333])).toBe(true);
      expect(inField('farmstead', plan(c), 2)).toBe(true);
      expect(c.yaw).toBeCloseTo(Math.PI, 6);
    }
    const xs = Object.values(two.cars).map((c) => c.x).sort((a, b) => a - b);
    expect(xs[1] - xs[0]).toBeGreaterThan(5); // room for a girl between them
  });
  it('sends a girl home from each car along the drive and out onto the lane', () => {
    for (const c of Object.values(two.cars)) {
      const route = leaveRoute(c, two);
      expect(inField('farmstead', plan(route[0]))).toBe(true);
      expect(route.at(-1).x).toBeCloseTo(two.publicLane.x, 1);
      for (const p of route.slice(0, 3)) expect(plan(p)[1]).toBeGreaterThan(335); // on the drive's side of the garden's wall
    }
  });
  it('has the muck heap behind where the cattle shed will be, about plan (486, 416)', () => {
    const m = plan(two.muckHeap);
    expect(Math.hypot(m[0] - 486, m[1] - 416)).toBeLessThan(1);
    expect(two.muckHeap.halfX).toBe(LAYOUT.muckHeap.halfX);
  });
  it('has a tp place for each: stackyard, orchard, garden, cars, all in the farmstead', () => {
    for (const k of ['stackyard', 'orchard', 'garden', 'cars']) {
      expect(places[k], k).toBeDefined();
      expect(inField('farmstead', plan(places[k])), k).toBe(true);
    }
  });
});

describe('what is kept clear for later', () => {
  const clear = two.farmstead.keptClear;
  it('is the machinery shed, grain store, cattle shed with its clamp, the sheep pens, the scrap corner, the last 11 kV pole and the lorry\'s turning circle, at the plan\'s places', () => {
    expect(clear.map((k) => [k.name, k.by])).toEqual([['machinery shed', '#617'], ['grain store', '#699'], ['cattle shed and clamp', '#694'], ['sheep pens', '#695'], ['scrap corner', '#712'], ['11 kV pole', '#711'], ['lorry turning circle', '#816']]);
    expect(clear.map((k) => [k.minX, k.minZ, k.maxX, k.maxZ].map((v, i) => v + PLAN_ORIGIN[i % 2]))).toEqual(P.keptClear.map((k) => k.rect));
  });
  it('has nothing of ours standing in any of them: no building, bale, vehicle spot, seat, can, animal or heap', () => {
    const points = [
      ...two.spawn.quads, ...Object.values(two.cars), ...two.jerryCanSpots, ...two.restSpots, ...two.strawBaleSpots.map(([x, z]) => ({ x, z })), two.harrows, two.silage, two.bell,
      two.fuelTank, two.dieselBowser, two.trailer, two.tipTrailer, two.sprayer, two.hose, two.muckHeap, two.dutchBarn, two.barn, two.bonfire,
      ...spawnKeepOut(two).filter((k) => !['the drag strip'].includes(k.what)), // (the drag strip is #616's, and goes)
      ...two.spawn.away.filter((a) => !['out in the barley field', 'out in the wheat field', 'by the field shed', 'along the road'].includes(a.where)),
    ];
    for (const k of clear) {
      for (const p of points) {
        const inside = p.x > k.minX && p.x < k.maxX && p.z > k.minZ && p.z < k.maxZ;
        expect(inside, `${p.what ?? p.id ?? p.where ?? 'a thing'} at ${p.x.toFixed(1)}, ${p.z.toFixed(1)} is in the ${k.name}`).toBe(false);
      }
    }
  });
});

describe('Home Ground\'s play things', () => {
  const home = fields.home;
  const edges = polygonEdges(home);
  const inHome = (p, margin = 0) => pointInPolygon(home, plan(p)[0], plan(p)[1], margin, edges);
  it('has the Home Loop, the cones and the jump inside it, with today\'s track in shape', () => {
    for (const p of two.trackPoints) expect(inHome({ x: p[0], z: p[1] }, 8), `${p}`).toBe(true);
    expect(inHome(two.jumpRamp, 8)).toBe(true);
    expect(inHome(two.coneCourse, 8)).toBe(true);
  });
  it('puts the bonfire in its south-east corner, plan (400, 424), the line-up by the south hedge and the brushwood along it', () => {
    expect(plan(two.bonfire).map((v) => +v.toFixed(3))).toEqual([400, 424]);
    expect(inHome(two.bonfire, 5)).toBe(true);
    expect(inHome(two.lineUp, 4)).toBe(true);
    expect(440 - plan(two.lineUp)[1]).toBeLessThan(12); // by the south hedge
    for (const [x, z] of two.brushwood) expect(inHome({ x, z }, 2)).toBe(true); // along the inside of the hedge, as today's are (2.5 m in)
  });
  it('rails its yard side where the paddock\'s fences were, and seats the girls on that rail facing out over the field', () => {
    expect(two.paddock).toBeUndefined();
    const runs = boundariesOf(clippedFields());
    expect(runs.find((r) => [r.a, r.b].sort().join('|') === 'farmstead|home').kind).toBe('rail');
    const fences = two.restSpots.filter((r) => r.kind === 'fence');
    expect(fences.length).toBe(4);
    for (const s of fences) {
      expect(plan(s)[0]).toBeCloseTo(412.45, 6);
      expect(s.yaw).toBeCloseTo(-Math.PI / 2, 6);
      expect(plan(s)[1]).toBeGreaterThan(P.frontage[0]);
      expect(plan(s)[1]).toBeLessThan(P.frontage[1]);
    }
  });
  it('has a gate for the tractor in the plan\'s gateway', () => {
    const g = two.gateways.find((w) => w.a === 'home' && w.b === 'farmstead');
    expect(g.half * 2).toBeGreaterThanOrEqual(5);
  });
});

describe('the rest of the layout', () => {
  it('still has every pieces a later move places, at today\'s numbers', () => {
    for (const k of ['fieldShed', 'trough']) expect(two[k]).toEqual(LAYOUT[k]);
  });
  it('moves nothing but the farmstead\'s own: the neighbour, the drive and the fields are as they were', () => {
    expect(two.road).toEqual(LAYOUT.road);
    expect(fromPlan([520, 365])).toEqual([0, 0]);
  });
});
