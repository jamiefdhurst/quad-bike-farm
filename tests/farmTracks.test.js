import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew, fromPlan, clippedFields, boundariesOf, FIELDS_PLAN, GATEWAYS_PLAN, OUTLINE_PLAN } from '../src/world/layoutNew.js';
import { createFields } from '../src/world/fields.js';
import { roadNetwork } from '../src/world/roads.js';
import { STONE_TRACKS_PLAN, BOUNDARY_TRACK_PLAN, HEADLAND_WIDTH, boundaryTrackPoints, trackGateways, runLength } from '../src/world/farmTracks.js';
import { polygonArea, pointInPolygon, distanceToEdges, polygonEdges } from '../src/world/polygons.js';

// The stone tracks, the grass boundary track and the headlands (#689), on the new farm behind ?layout=2.
const two = layoutNew(LAYOUT, RAW_LAYOUT);
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
  it('is a grass road round the whole farm, 14 m in from the outline but round the pit and the stream ford, about 3 km', () => {
    expect(loop.surface).toBe('grass');
    expect(loop.length).toBeGreaterThan(3000);
    expect(loop.length).toBeLessThan(4200);
    const out = polygonEdges(two.outline);
    // 14 m from the outline all the way, except the detour to the ford, which is inside.
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
