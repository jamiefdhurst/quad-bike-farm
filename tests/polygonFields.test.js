import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createFields } from '../src/world/fields.js';
import { createFieldMap } from '../src/world/fieldMap.js';
import { boundary, gap, field, gatewayAcross, FIELD_KINDS, BOUNDARY_KINDS } from '../src/world/fieldPlan.js';
import { polygonArea, polygonBounds, pointInPolygon, outsidePolygon, clampIntoPolygon, rayHitsEdge, polygonEdges, segmentInside, notchCorners, nearestOnEdge } from '../src/world/polygons.js';

// An L-shaped field, 40 m square with its south-east quarter missing (the notch), and the field that fills the notch.
const L = [[0, 0], [40, 0], [40, 20], [20, 20], [20, 40], [0, 40]];
const NOTCH = [[20, 20], [40, 20], [40, 40], [20, 40]];

describe('a field with a notch in it', () => {
  const a = field('a', 'grass', L);
  const plan = { fields: [a, field('c', 'pasture', NOTCH)], boundaries: [], gateways: [] };
  const map = createFieldMap(plan, polygonBounds(L));

  it('says what is inside and outside it', () => {
    expect(pointInPolygon(a.points, 10, 10)).toBe(true);
    expect(pointInPolygon(a.points, 30, 10)).toBe(true); // the east arm
    expect(pointInPolygon(a.points, 10, 30)).toBe(true); // the south arm
    expect(pointInPolygon(a.points, 30, 30)).toBe(false); // in the box round it, but in the notch
    expect(pointInPolygon(a.points, -1, 10)).toBe(false);
    expect(pointInPolygon(a.points, 20, 30)).toBe(true); // on a side counts as in
    expect(pointInPolygon(a.points, 10, 10, 11)).toBe(false); // not 11 m in
    expect(outsidePolygon(a.points, 30, 30)).toBeCloseTo(10);
    expect(polygonArea(a.points)).toBe(40 * 40 - 20 * 20);
    expect(map.areaOf(30, 10)).toBe('a');
    expect(map.areaOf(30, 30)).toBe('c');
  });

  it('is turned clockwise if it was written the other way, and only has the kinds there are', () => {
    const f = field('x', 'rough', [...L].reverse());
    expect(polygonArea(f.points)).toBeGreaterThan(0);
    expect(() => field('x', 'orchard', L)).toThrow();
    for (const k of ['grass', 'arable', 'hay', 'ley', 'wood', 'pasture', 'rough', 'yard', 'lane']) expect(FIELD_KINDS).toContain(k);
    for (const k of ['hedge', 'wall', 'fence', 'rail', 'none']) expect(BOUNDARY_KINDS).toContain(k);
  });

  it('pulls a point back in, round the notch', () => {
    expect(clampIntoPolygon(a.points, 5, 5, 2)).toEqual({ x: 5, z: 5 });
    const p = clampIntoPolygon(a.points, 30, 30, 0);
    expect(pointInPolygon(a.points, p.x, p.z)).toBe(true);
    expect(Math.hypot(p.x - 30, p.z - 30)).toBeCloseTo(10); // the nearest side, not the middle
    const q = clampIntoPolygon(a.points, 100, 10, 3);
    expect(q.x).toBeCloseTo(37);
    expect(q.z).toBeCloseTo(10);
    const r = clampIntoPolygon(a.points, 30, 30, 3); // 3 m in from the notch's two sides
    expect(pointInPolygon(a.points, r.x, r.z, 2.99)).toBe(true);
  });

  it('shoots a ray at its sides', () => {
    const hits = polygonEdges(a.points).map((e) => rayHitsEdge(10, 10, 1, 0, e)).filter(Boolean);
    expect(hits).toHaveLength(1);
    expect(hits[0].t).toBeCloseTo(30);
    expect(hits[0].s).toBeCloseTo(10);
    expect(polygonEdges(a.points).map((e) => rayHitsEdge(10, 10, -1, 0, e)).filter(Boolean)[0].t).toBeCloseTo(10); // the west side, behind
  });

  it('finds the notch\'s corner and which straight lines cut across it', () => {
    const corners = notchCorners(a.points);
    expect(corners).toHaveLength(1);
    expect(corners[0].x).toBeCloseTo(20 - 0.6);
    expect(corners[0].z).toBeCloseTo(20 - 0.6);
    expect(segmentInside(a.points, { x: 30, z: 10 }, { x: 10, z: 30 })).toBe(true); // clear of the corner
    expect(segmentInside(a.points, { x: 35, z: 10 }, { x: 10, z: 35 })).toBe(false); // clips it
    expect(segmentInside(a.points, { x: 5, z: 5 }, { x: 15, z: 35 })).toBe(true);
  });

  it('walks round the notch rather than across it', () => {
    const way = map.route({ x: 38, z: 10 }, { x: 10, z: 38 });
    expect(way).toHaveLength(2);
    expect(Math.hypot(way[0].x - 20, way[0].z - 20)).toBeLessThan(1); // by the notch's corner
    expect(way[1]).toEqual({ x: 10, z: 38 });
    expect(map.route({ x: 5, z: 5 }, { x: 15, z: 35 })).toEqual([{ x: 15, z: 35 }]); // a line that stays in is still just that
  });
});

describe('a gateway on a slanted side', () => {
  // The line x = 0.75 z, 50 m long (3, 4, 5), with a gateway 25 m along it: at (15, 20).
  const west = field('west', 'grass', [[-30, 0], [0, 0], [30, 40], [-30, 40]]);
  const east = field('east', 'arable', [[0, 0], [60, 0], [60, 40], [30, 40]]);
  const slant = boundary(0, 0, 30, 40, [gap(25, 3, { gate: true, shut: false })]);
  const { pa, pb } = gatewayAcross(slant, 25, west.points, east.points, 2.5, 3);
  const map = createFieldMap({ fields: [west, east], boundaries: [slant], gateways: [{ a: 'west', pa, b: 'east', pb, gap: slant.gaps[0] }] }, { minX: -30, maxX: 60, minZ: 0, maxZ: 40 });

  it('is a line that is neither along x nor along z', () => {
    expect(slant.alongX).toBeNull();
    expect(slant.length).toBeCloseTo(50);
    expect(nearestOnEdge(slant, 15, 20)).toEqual({ s: 25, d: 0 });
  });

  it('puts a point either side of it square to the line, in each field', () => {
    expect(pointInPolygon(west.points, pa.x, pa.z)).toBe(true);
    expect(pointInPolygon(east.points, pb.x, pb.z)).toBe(true);
    expect(Math.hypot(pa.x - 15, pa.z - 20)).toBeCloseTo(2.5);
    expect(Math.hypot(pb.x - 15, pb.z - 20)).toBeCloseTo(3);
    expect((pa.x - 15) * slant.dx + (pa.z - 20) * slant.dz).toBeCloseTo(0);
    const swapped = gatewayAcross(slant, 25, east.points, west.points, 3, 2.5); // the same, whichever field is named first
    expect(swapped.pa.x).toBeCloseTo(pb.x);
    expect(swapped.pb.z).toBeCloseTo(pa.z);
  });

  it('is the way from one field to the other, until its gate is shut', () => {
    expect(map.areaOf(10, 20)).toBe('west');
    expect(map.areaOf(40, 20)).toBe('east');
    expect(map.route({ x: -10, z: 20 }, { x: 50, z: 20 })).toEqual([pa, pb, { x: 50, z: 20 }]);
    slant.gaps[0].shut = true;
    expect(map.route({ x: -10, z: 20 }, { x: 50, z: 20 })).toEqual([{ x: 50, z: 20 }]);
    slant.gaps[0].shut = false;
  });

  it('stops what looks across it, except through the gap', () => {
    expect(map.hedgeAhead(-10, 20, Math.PI / 2)).toBe(Infinity); // straight through the gap
    expect(map.hedgeAhead(-10, 5, Math.PI / 2)).toBeCloseTo(13.75); // hits the line at x = 3.75
    slant.gaps[0].shut = true;
    expect(map.hedgeAhead(-10, 20, Math.PI / 2)).toBeCloseTo(25);
    slant.gaps[0].shut = false;
    expect(map.hedgeDistance(15, 20)).toBe(0);
    expect(map.hedgeDistance(-15, 20)).toBeCloseTo(24); // square to the line
    expect(map.hedgedAt(3.75, 5, 0.45)).toBe(true);
    expect(map.hedgedAt(15, 20, 0.45)).toBe(false); // in the gap
  });
});

describe("today's farm as a plan", () => {
  const f = createFields(LAYOUT);
  const sides = Object.values(f.polygons).flatMap((pts) => polygonEdges(pts));
  // Every metre of a hedge is on a side of some field (the farm's east hedge is the sides of three: the two stubble fields and the end of the road).
  const lies = (h) => {
    for (let s = 0; s <= h.length; s += 0.5) {
      const p = { x: h.x1 + h.dx * s, z: h.z1 + h.dz * s };
      if (!sides.some((e) => nearestOnEdge(e, p.x, p.z).d < 1e-6)) return false;
    }
    return true;
  };

  it('is made of fields that all have a kind there is and are clockwise', () => {
    for (const [name, pts] of Object.entries(f.polygons)) {
      expect(FIELD_KINDS, name).toContain(f.kinds[name]);
      expect(polygonArea(pts), name).toBeGreaterThan(0);
    }
    expect(f.kinds).toMatchObject({ grass: 'grass', north: 'arable', south: 'arable', road: 'lane', hill: 'rough', meadow: 'pasture', woods: 'wood' });
  });

  it('has every hedge along a side of a field, and each line once', () => {
    for (const h of f.hedges) {
      expect(BOUNDARY_KINDS).toContain(h.kind);
      expect(lies(h), `${h.x1},${h.z1} to ${h.x2},${h.z2}`).toBe(true);
    }
    const seen = new Set(f.hedges.map((h) => [h.x1, h.z1, h.x2, h.z2].join()));
    expect(seen.size).toBe(f.hedges.length);
  });

  it('puts each gap on its hedge, as metres along it', () => {
    for (const h of f.hedges) for (const g of h.gaps) expect(g.at >= 0 && g.at <= h.length, `${h.x1},${h.z1}`).toBe(true);
  });

  it('has gateway points in the fields they join', () => {
    for (const g of f.gateways) {
      if (g.a !== 'out') expect(f.areaOf(g.pa.x, g.pa.z), `${g.a} to ${g.b}`).toBe(g.a);
      if (g.b !== 'out') expect(f.areaOf(g.pb.x, g.pb.z), `${g.a} to ${g.b}`).toBe(g.b);
    }
  });
});
