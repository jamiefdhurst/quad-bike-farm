import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew, fromPlan, clippedFields, boundariesOf, FIELDS_PLAN, GATEWAYS_PLAN, OUTLINE_PLAN } from '../src/world/layoutNew.js';
import { createFields } from '../src/world/fields.js';
import { roadNetwork } from '../src/world/roads.js';
import { STONE_TRACKS_PLAN, BOUNDARY_TRACK_PLAN, HEADLAND_WIDTH, boundaryTrackPoints, trackGateways, runLength } from '../src/world/farmTracks.js';
import { planTrack, drawTrack, paintContext, paintStubble } from '../src/world/groundTexture.js';
import { trackPlaces } from '../src/console/gameHost.js';
import { createRandom } from '../src/core/random.js';
import { createFieldMap } from '../src/world/fieldMap.js';
import { boundary, gap, field, gatewayAcross } from '../src/world/fieldPlan.js';
import { surfaceFeel, DEFAULT_SURFACE_PARAMS } from '../src/world/surfaces.js';
import { polygonArea, pointInPolygon, distanceToEdges, polygonEdges } from '../src/world/polygons.js';

// The stone tracks, the grass boundary track and the headlands (#689), on the new farm behind ?layout=2.
const two = LAYOUT;
const fields = createFields(two);
const net = roadNetwork(two);
const north = net.road('stoneNorth');
const south = net.road('stoneSouth');
const loop = net.road('boundaryTrack');
const at = (p) => fromPlan(p);
const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const step = (road, every) => {
  const out = [];
  for (let s = 0; s <= road.length; s += every) out.push(net.pointAt(road.id, s));
  return out;
};
/** Whether a quad can ride in a straight line from p to q: no hedge, wall or fence, no shut gate between them. */
const clear = (p, q) => {
  const d = Math.hypot(q.x - p.x, q.z - p.z);
  return d < 1e-6 || fields.hedgeAhead(p.x, p.z, Math.atan2(q.x - p.x, q.z - p.z)) > d;
};

describe('the stone track north', () => {
  it('is a stone road about 3.5 m wide that starts in the yard and ends at the pit\'s farm gate', () => {
    expect(north.surface).toBe('stone');
    expect(north.halfWidth * 2).toBeCloseTo(3.5, 5);
    const first = north.samples[0];
    expect(fields.areaOf(first.x, first.z)).toBe('farmstead');
    const gate = two.quarry.gates.find((g) => g.id === 'quarry');
    const last = north.samples[north.samples.length - 1];
    expect(Math.hypot(last.x - gate.x, last.z - gate.z)).toBeLessThan(5); // just inside it
  });
  it('can be ridden end to end: no hedge, wall or fence in the way, through the gateways the plan has', () => {
    const pts = step(north, 1);
    for (let i = 1; i < pts.length; i++) expect(clear(pts[i - 1], pts[i]), `at ${north.samples.length ? pts[i].x.toFixed(0) + ',' + pts[i].z.toFixed(0) : ''}`).toBe(true);
  });
  it('runs on past the yard\'s gateway to Top Field and then the Old Pit', () => {
    const seen = new Set(step(north, 2).map((p) => fields.areaOf(p.x, p.z)));
    expect([...seen].sort()).toEqual(['farmstead', 'pit', 'top']);
  });
});

describe('the stone track south', () => {
  it('is a stone road that starts in the yard and ends in Brook Meadow, about 630 m of stone with the north one', () => {
    expect(south.surface).toBe('stone');
    expect(fields.areaOf(south.samples[0].x, south.samples[0].z)).toBe('farmstead');
    const last = south.samples[south.samples.length - 1];
    expect(fields.areaOf(last.x, last.z)).toBe('brook');
    expect(Math.abs(last.z - at([424, 720])[1])).toBeLessThan(1);
    expect(north.length + south.length).toBeGreaterThan(500);
    expect(north.length + south.length).toBeLessThan(700);
  });
  it('can be ridden end to end, down the sheep field\'s edge and over the river\'s head', () => {
    const pts = step(south, 1);
    for (let i = 1; i < pts.length; i++) expect(clear(pts[i - 1], pts[i])).toBe(true);
    expect(new Set(pts.map((p) => fields.areaOf(p.x, p.z)))).toEqual(new Set(['farmstead', 'hay', 'brook']));
  });
  it('crosses the river at the farm bridge, the place the river plan keeps for it', () => {
    const b = two.farmBridge;
    expect(near([b.x, b.z], at([424, 572]))).toBeLessThan(0.5);
    const hit = south.samples.reduce((best, p) => (Math.hypot(p.x - b.x, p.z - b.z) < best ? Math.hypot(p.x - b.x, p.z - b.z) : best), Infinity);
    expect(hit).toBeLessThan(1);
    // The stream under it is the shallow one: no deep water, which only the river's own wide reach has.
    expect(fields.brook.deepAt(b.x, b.z)).toBe(0);
  });
});

describe('the grass boundary track', () => {
  const pts = step(loop, 2);
  it('is a grass road round the farm, 14 m in from the outline but round the pit and on Hill Pasture, about 3 km', () => {
    expect(loop.surface).toBe('grass');
    expect(loop.length).toBeGreaterThan(3000);
    expect(loop.length).toBeLessThan(4200);
    const out = polygonEdges(two.outline);
    // 14 m from the outline all the way, except the two detours (round the pit; down Hill Pasture's east end to the ford, #1061), which are inside.
    for (const p of pts) {
      expect(pointInPolygon(two.outline, p.x, p.z)).toBe(true);
      expect(distanceToEdges(out, p.x, p.z)).toBeGreaterThan(8);
    }
  });
  it('goes round the Old Pit outside its fence and gives the pit no new way in', () => {
    const pit = fields.polygons.pit;
    expect(pts.some((p) => fields.areaOf(p.x, p.z) === 'pit')).toBe(false);
    expect(GATEWAYS_PLAN.filter((g) => (g.a === 'pit' || g.b === 'pit') && /grass track round the boundary/.test(g.why))).toEqual([]);
    expect(pit.length).toBeGreaterThan(2);
  });
  it('closes: its end meets its start', () => {
    const a = loop.samples[0];
    const b = loop.samples[loop.samples.length - 1];
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(0.01);
  });
  it('can be ridden all the way round without a closed gate or a hedge in the way', () => {
    const blocked = [];
    for (let i = 1; i < pts.length; i++) if (!clear(pts[i - 1], pts[i])) blocked.push(`${pts[i].x.toFixed(0)},${pts[i].z.toFixed(0)}`);
    expect(blocked).toEqual([]);
  });
  it('gets a gateway where it crosses each line between fields, none of them shut', () => {
    const added = GATEWAYS_PLAN.filter((g) => /grass track round the boundary/.test(g.why));
    expect(added.length).toBeGreaterThanOrEqual(9);
    expect(added.every((g) => !g.shut)).toBe(true);
    // Every crossing has one: asking again for what is missing gives nothing.
    expect(trackGateways(boundaryTrackPoints(OUTLINE_PLAN), boundariesOf(clippedFields()), GATEWAYS_PLAN)).toEqual([]);
  });
  it('crosses the stream at the green lane\'s ford, not by wading the hill pasture\'s own channel', () => {
    const ford = at([199.6, 565]);
    const near = pts.filter((p) => Math.abs(p.x - ford[0]) < 4 && Math.abs(p.z - ford[1]) < 10);
    expect(near.length).toBeGreaterThan(2);
    // The stream's z at the loop's other points is never between the loop's points: it only meets it at the ford.
    const hill = two.hill;
    const wades = pts.filter((p) => Math.abs(p.z - (hill.stream.z + hill.stream.wander * Math.sin(p.x * 0.05 + 1.1))) < hill.stream.halfWidth + 0.5 && p.x < hill.pasture.maxX && p.x > -480);
    expect(wades.every((p) => Math.abs(p.x - ford[0]) < hill.stream.ford.halfWidth + hill.stream.ford.reach)).toBe(true);
  });
  it('goes through Hill Pasture\'s electric fence once, by its gap at the foot of the hill (#1061)', () => {
    const f = two.hill.fence;
    const crossings = [];
    for (let i = 1; i < pts.length; i++) {
      const [p, q] = [pts[i - 1], pts[i]];
      if ((p.x - f.from[0]) * (q.x - f.from[0]) > 0 || Math.abs(q.x - p.x) > 5) continue; // not across the fence's line (or the loop's join)
      const z = (p.z + q.z) / 2;
      if (z > f.from[1] && z < f.to[1]) crossings.push(z);
    }
    expect(crossings.length).toBe(1);
    // Its whole width and a metre each side are inside the gap.
    expect(Math.abs(crossings[0] - (f.from[1] + f.gap.at))).toBeLessThan(f.gap.half - loop.halfWidth - 1);
  });
  it('reaches every field from the yard by a track, but Home Ground (open to the yard) and the sheep field (its gate is on the south track)', () => {
    const reached = new Set();
    for (const r of [north, south, loop]) for (const p of step(r, 3)) reached.add(fields.areaOf(p.x, p.z));
    expect(FIELDS_PLAN.map((f) => f.name).filter((k) => !reached.has(k))).toEqual(['home', 'sheep']);
    const gate = GATEWAYS_PLAN.find((g) => g.a === 'hay' && g.b === 'sheep');
    const [gx, gz] = at(gate.at);
    expect(step(south, 1).some((p) => Math.hypot(p.x - gx, p.z - gz) < 8)).toBe(true);
  });
});

describe('the headlands', () => {
  const arable = FIELDS_PLAN.filter((f) => f.kind === 'arable').map((f) => f.name);
  it('are a 6 m strip inside each of the six arable fields', () => {
    expect(arable.length).toBe(6);
    expect(two.headlands.width).toBe(HEADLAND_WIDTH);
    expect(HEADLAND_WIDTH).toBe(6);
    expect(two.headlands.fields.map((h) => h.field).sort()).toEqual([...arable].sort());
    for (const h of two.headlands.fields) {
      const edges = polygonEdges(fields.polygons[h.field]);
      for (const [x, z] of h.ring) {
        expect(pointInPolygon(fields.polygons[h.field], x, z)).toBe(true);
        expect(distanceToEdges(edges, x, z)).toBeGreaterThan(4); // 6 m, a little less where a corner points inwards
      }
      expect(polygonArea(h.ring)).toBeLessThan(polygonArea(fields.polygons[h.field]));
    }
  });
});

describe('the plan', () => {
  it('has the numbers the issue gives', () => {
    expect(STONE_TRACKS_PLAN.halfWidth * 2).toBe(3.5);
    expect(BOUNDARY_TRACK_PLAN.inset).toBe(14);
    expect(runLength(boundaryTrackPoints(OUTLINE_PLAN), true)).toBeGreaterThan(3000);
  });
});

describe('how the tracks ride and wear', () => {
  const mid = (road, s) => net.pointAt(road.id, s);
  it('makes the stone tracks gravel: loose, but less than the pit, and never worn into mud', () => {
    const p = mid(north, 100);
    expect(fields.stoneAt(p.x, p.z)).toBeCloseTo(1, 1);
    expect(fields.stoneAt(p.x - p.tz * 6, p.z + p.tx * 6)).toBe(0);
    const p1 = DEFAULT_SURFACE_PARAMS;
    const stone = surfaceFeel(p1, 0, 0, 0, 0, 0, fields.stoneAt(p.x, p.z) * p1.stoneLoose);
    const pit = surfaceFeel(p1, 0, 0, 0, 0, 0, 1);
    const grass = surfaceFeel(p1, 0, 0);
    expect(stone.grip).toBeLessThan(grass.grip);
    expect(stone.grip).toBeGreaterThan(pit.grip);
  });
  it('ruts the grass track like the green lane, and the girls\' routes prefer a track', () => {
    const p = mid(loop, 500);
    expect(fields.laneAt(p.x, p.z)).toBeGreaterThan(0.9);
    expect(fields.laneAt(p.x + 10, p.z + 10)).toBeLessThan(0.1);
    // Three fields in a row with two gateways in each line, 20 m apart: the track along the south ones takes the route, and the north ones when the track is there.
    const f = [field('a', 'grass', [[0, 0], [20, 0], [20, 40], [0, 40]]), field('b', 'grass', [[20, 0], [40, 0], [40, 40], [20, 40]]), field('c', 'grass', [[40, 0], [60, 0], [60, 40], [40, 40]])];
    const lines = [20, 40].map((x) => boundary(x, 0, x, 40, [gap(10, 2.5), gap(30, 2.5)]));
    const e = (x) => ({ x1: x, z1: 0, x2: x, z2: 40 });
    const gateways = [[20, 'a', 'b'], [40, 'b', 'c']].flatMap(([x, a, b]) => [10, 30].map((at) => {
      const edge = lines[x === 20 ? 0 : 1];
      return { a, b, gap: edge.gaps[at === 10 ? 0 : 1], ...gatewayAcross(edge, at, f[a === 'a' ? 0 : 1].points, f[a === 'a' ? 1 : 2].points) };
    }));
    const way = (trackAt) => createFieldMap({ fields: f, boundaries: lines, gateways }, [[0, 0], [60, 0], [60, 40], [0, 40]], { trackAt }).route({ x: 10, z: 20 }, { x: 50, z: 20 });
    expect(e(20).x1).toBe(20);
    expect(way((x, z) => (z > 20 ? 1 : 0)).some((q) => q.z > 25)).toBe(true);
    expect(way((x, z) => (z < 20 ? 1 : 0)).some((q) => q.z < 15)).toBe(true);
  });
  it('keeps the headland and the tracks free of stubble, and stubble in the rest of the field', () => {
    const north = fields.polygons.north;
    const edges = polygonEdges(north);
    // A point 3 m in from the field's edge is headland, one 30 m in is stubble (the middle of the field is clear of the tracks).
    const inner = two.headlands.fields.find((h) => h.field === 'north').ring;
    const [rx, rz] = inner[0];
    const mid2 = fields.polygons.north.reduce((a, q) => [a[0] + q[0] / north.length, a[1] + q[1] / north.length], [0, 0]);
    expect(fields.stubbleAt(mid2[0], mid2[1])).toBe(1);
    const out = (() => {
      for (let t = 0; t < 40; t += 0.5) {
        const x = rx + (mid2[0] - rx) * (t / 40) * -1;
        if (!pointInPolygon(north, x, rz)) return [x, rz];
      }
      return null;
    })();
    expect(out === null || distanceToEdges(edges, out[0], out[1]) < 6).toBe(true);
    expect(fields.headlandAt('north', rx, rz)).toBeLessThan(0.6);
    const edgeSide = [(inner[0][0] + (north[0][0] - inner[0][0]) * 0.5), (inner[0][1] + (north[0][1] - inner[0][1]) * 0.5)];
    expect(fields.headlandAt('north', edgeSide[0], edgeSide[1])).toBeGreaterThan(0.9);
    expect(fields.stubbleAt(edgeSide[0], edgeSide[1])).toBe(0);
    // And never on a track.
    const p = net.pointAt('boundaryTrack', 0);
    expect(fields.stubbleAt(p.x, p.z)).toBe(0);
  });
});

describe('how the tracks are painted into the ground', () => {
  const recorder = () => {
    const calls = [];
    const ctx = new Proxy({}, {
      get: (_, name) => (name === 'calls' ? calls : (...args) => (calls.push([name, ...args]), { addColorStop() {} })),
      set: (_, name, v) => (calls.push(['set', name, v]), true),
    });
    return { ctx, calls };
  };
  const whole = { minX: -1e5, maxX: 1e5, minZ: -1e5, maxZ: 1e5 };
  const context = (ctx) => paintContext(ctx, whole, 8, { fine: true, toPx: (x, z) => [x, z] });

  it('gives the stone track potholes with water, drainage grips, loose stones, verge tufts and a broken crown', () => {
    const plan = planTrack(north, fields, createRandom(5));
    expect(plan.puddles.length).toBeGreaterThanOrEqual(2);
    expect(plan.grips.length).toBeGreaterThanOrEqual(1);
    expect(plan.stones.length / 4).toBeGreaterThan(north.length);
    expect(plan.tufts.length).toBeGreaterThan(20);
    expect(plan.crown.length).toBeGreaterThan(10);
    const { ctx, calls } = recorder();
    drawTrack(context(ctx), north, plan);
    const styles = calls.filter((c) => c[0] === 'set' && c[1] === 'strokeStyle').map((c) => c[2]);
    expect(styles).toContain('#8b867a'); // the chippings
    expect(calls.filter((c) => c[0] === 'ellipse').length).toBeGreaterThan(plan.puddles.length * 3); // each puddle in three, then the tufts
  });
  it('gives the grass track two bare wheel lines, flattened grass between and mud at every gateway it goes through', () => {
    const plan = planTrack(loop, fields, createRandom(6));
    expect(plan.gates.length).toBeGreaterThanOrEqual(9);
    expect(plan.puddles.length).toBeGreaterThan(20);
    const { ctx, calls } = recorder();
    drawTrack(context(ctx), loop, plan);
    const styles = calls.filter((c) => c[0] === 'set' && c[1] === 'strokeStyle').map((c) => c[2]);
    expect(styles).toContain('rgba(92,72,48,0.8)'); // the ruts
    expect(styles).toContain('rgba(138,142,76,0.5)'); // the grass laid over
  });
  it('paints a grass headland inside the edge of each arable field, over the stubble', () => {
    const { ctx, calls } = recorder();
    paintStubble(context(ctx), fields);
    const widths = calls.filter((c) => c[0] === 'set' && c[1] === 'lineWidth').map((c) => c[2]);
    expect(widths.filter((w) => w === 2 * HEADLAND_WIDTH * 8).length).toBeGreaterThanOrEqual(6);
    expect(calls.filter((c) => c[0] === 'set' && c[1] === 'strokeStyle' && c[2] === 'rgba(92,124,58,0.95)').length).toBeGreaterThanOrEqual(6);
  });
});

describe('the places to go to', () => {
  const p = trackPlaces(two, net);
  it('puts you on each track, at the bridge and on the headland on the new farm', () => {
    expect(fields.stoneAt(p.stonetrack.x, p.stonetrack.z)).toBeGreaterThan(0.9);
    expect(fields.grassTrackAt(p.boundarytrack.x, p.boundarytrack.z)).toBeGreaterThan(0.9);
    expect(Math.hypot(p.farmbridge.x - two.farmBridge.x, p.farmbridge.z - two.farmBridge.z)).toBeCloseTo(9, 5);
    expect(fields.areaOf(p.headland.x, p.headland.z)).toBe('lanefield');
    expect(fields.headlandAt('lanefield', p.headland.x, p.headland.z)).toBeGreaterThan(0.3);
  });
});

describe('the wood the boundary track goes through', () => {
  it('has no trunk or bush within a verge of the track, which runs along its edge', async () => {
    const { woodsPlants } = await import('../src/world/woods.js');
    let seed = 11;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const { trees, bushes } = woodsPlants(fields.woods, two, random);
    expect(trees.length).toBeGreaterThan(20);
    const inWood = step(loop, 2).filter((p) => fields.areaOf(p.x, p.z) === 'wood');
    expect(inWood.length).toBeGreaterThan(40); // along its north and west edges
    for (const [x, z] of [...trees, ...bushes]) {
      for (const p of inWood) expect(Math.hypot(x - p.x, z - p.z), `a trunk at ${x.toFixed(0)}, ${z.toFixed(0)}`).toBeGreaterThan(loop.halfWidth + 1.5);
    }
  });
});

describe('what the girls\' route discount does when a gate shuts', () => {
  it('gives the same routes as a fresh map with that gate shut, however many it has worked out before', () => {
    const a = createFields(two);
    const b = createFields(two);
    const spots = step(loop, 110).map((p) => ({ x: p.x, z: p.z }));
    const pairs = spots.flatMap((p, i) => spots.slice(i + 1).map((q) => [p, q]));
    for (const [p, q] of pairs) a.route(p, q); // the discount is worked out and kept for every pair of gateway points on the way
    const open = a.gateways.findIndex((g) => g.gap && !g.gap.shut && g.a === 'wood' && g.b === 'wet');
    expect(open).toBeGreaterThanOrEqual(0);
    a.gateways[open].gap.shut = true;
    b.gateways[open].gap.shut = true;
    const differ = pairs.filter(([p, q]) => JSON.stringify(a.route(p, q)) !== JSON.stringify(b.route(p, q)));
    expect(differ.length).toBe(0);
  });
});

describe('the tracks meet', () => {
  it('has the stone track north join the boundary track, so every track is reached from the yard', () => {
    const loopPts = step(loop, 1);
    const closest = Math.min(...step(north, 1).map((p) => Math.min(...loopPts.map((q) => Math.hypot(p.x - q.x, p.z - q.z)))));
    expect(closest).toBeLessThan(loop.halfWidth);
  });
});
