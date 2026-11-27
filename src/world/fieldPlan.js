// The farm's fields as shapes (#662): each field a polygon with a kind, the lines round and between them (a hedge, a wall, a fence, a rail or
// nothing) with their gateways, and the points a girl walks through to get from one field to the next, from the layout's data (`fields`,
// `boundaries`, `gateways`, layoutNew.js). Pure: fields.js turns this into the questions the game asks (where am I, how far is the hedge, the way round).

import { polygonEdges, edgeBetween, pointInPolygon, pointAlong, clockwise } from './polygons.js';

/** What a field is. `kind` on each field in the plan is one of these. */
export const FIELD_KINDS = ['grass', 'arable', 'hay', 'ley', 'wood', 'pasture', 'rough', 'yard', 'lane'];
/** What stands along a boundary. A `none` one is a line you can cross anywhere (two fields that run into each other). */
export const BOUNDARY_KINDS = ['hedge', 'wall', 'fence', 'rail', 'none'];

/**
 * A boundary between points: its two ends, its kind, and gaps `{ at, half }` (`at` metres along from the first end), which a gateway
 * is. `extra` is anything the boundary carries (a taller `height`, a `coarse` hedge, a gap's gate).
 */
export function boundary(x1, z1, x2, z2, gaps = [], kind = 'hedge', extra = {}) {
  const e = edgeBetween(x1, z1, x2, z2);
  return { ...e, alongX: e.dz === 0 ? true : e.dx === 0 ? false : null, kind, gaps, ...extra };
}

/** A field: its name, its kind (FIELD_KINDS) and its outline, turned clockwise if it was written the other way, with its sides worked out. */
export function field(name, kind, points) {
  if (!FIELD_KINDS.includes(kind)) throw new Error(`field ${name}: unknown kind ${kind}`);
  const pts = clockwise(points);
  return { name, kind, points: pts, edges: polygonEdges(pts) };
}

/** A gap `half` m either side of the point `at` metres along the boundary, with whatever else says what's in it (`gate`, `shut`, `id`). */
export const gap = (at, half, extra = {}) => ({ at, half, ...extra });

/**
 * The two points a girl passes either side of a gateway: `at` metres along the edge from its first end, `outA` m out into field `a` and `outB`
 * into field `b`. Each field is its polygon (null for the country outside, which is whichever side the other is not on).
 */
export function gatewayAcross(edge, at, a, b, outA = 2.5, outB = 2.5) {
  const mid = pointAlong(edge, at);
  const nx = -edge.dz;
  const nz = edge.dx;
  let side = 1;
  if (a) side = pointInPolygon(a, mid.x + nx * 0.5, mid.z + nz * 0.5) ? 1 : -1;
  else if (b) side = pointInPolygon(b, mid.x + nx * 0.5, mid.z + nz * 0.5) ? -1 : 1;
  return { pa: { x: mid.x + nx * side * outA, z: mid.z + nz * side * outA }, pb: { x: mid.x - nx * side * outB, z: mid.z - nz * side * outB } };
}

/**
 * A boundary written as a list of points (`layout.boundaries`): one straight `boundary()` per stretch, each with the gaps whose centre falls on it.
 * A gap's `at` is metres along the whole line from its first point, as a gateway's is.
 */
function bentBoundary(def, i) {
  const pts = def.points;
  if (!Array.isArray(pts) || pts.length < 2) throw new Error(`boundary ${i}: needs two points or more`);
  const { points, kind = 'hedge', gaps = [], ...extra } = def;
  if (!BOUNDARY_KINDS.includes(kind)) throw new Error(`boundary ${i}: unknown kind ${kind}`);
  const stretches = [];
  let from = 0;
  for (let k = 0; k + 1 < pts.length; k++) {
    const e = edgeBetween(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]);
    stretches.push({ from, to: from + e.length, pts: [pts[k], pts[k + 1]], gaps: [] });
    from += e.length;
  }
  const place = (g) => {
    const s = stretches.find((st, k) => g.at < st.to || k === stretches.length - 1);
    s.gaps.push({ ...g, at: g.at - s.from });
    return s.gaps[s.gaps.length - 1];
  };
  return { stretches, place, kind, gaps, extra };
}

/**
 * The plan for the layout, from its data (`layout.fields`, `layout.boundaries`, `layout.gateways`). Plain data, no functions: `fields` are `{ name, kind, points }`; `boundaries` are
 * `{ points, kind, gaps: [{ at, half, ...extra }], ...extra }` (`at` metres along from the first point); `gateways` are
 * `{ a, b, boundary, at, half, gate, id, shut, outA, outB }`: the way from field `a` to field `b` through the `boundary`-th boundary, `at` metres
 * along it. With a `half` it is a gap in that boundary (the one already there at `at`, if the boundary has it); without, only the way across.
 */
export function fieldPlan(layout) {
  const fields = layout.fields.map((f) => field(f.name, f.kind, f.points));
  const polygons = Object.fromEntries(fields.map((f) => [f.name, f.points]));
  const defs = (layout.boundaries ?? []).map(bentBoundary);
  (layout.boundaries ?? []).forEach((b, i) => {
    for (const g of b.gaps ?? []) defs[i].place({ ...g });
  });
  const gateways = [];
  for (const [i, w] of (layout.gateways ?? []).entries()) {
    const def = defs[w.boundary];
    if (!def) throw new Error(`gateway ${i}: no boundary ${w.boundary}`);
    for (const n of [w.a, w.b]) if (n !== 'out' && !polygons[n]) throw new Error(`gateway ${i}: no field ${n}`);
    let gapOf = null;
    if (w.half) {
      const { a, b, boundary: _b, at, half, outA, outB, ...rest } = w;
      const was = def.stretches.flatMap((st) => st.gaps.map((x) => ({ x, st }))).find(({ x, st }) => Math.abs(st.from + x.at - at) < 1e-6);
      gapOf = was ? was.x : def.place({ at, half, ...rest });
      Object.assign(gapOf, { half, ...rest });
    }
    const st = def.stretches.find((s, k) => w.at < s.to || k === def.stretches.length - 1);
    const edge = edgeBetween(st.pts[0][0], st.pts[0][1], st.pts[1][0], st.pts[1][1]);
    const { pa, pb } = gatewayAcross(edge, w.at - st.from, polygons[w.a], polygons[w.b], w.outA, w.outB);
    gateways.push({ a: w.a, pa, b: w.b, pb, gap: gapOf, via: { edge, at: w.at - st.from, outA: w.outA, outB: w.outB } });
  }
  const boundaries = defs.flatMap((d) => d.stretches.map((st) => boundary(st.pts[0][0], st.pts[0][1], st.pts[1][0], st.pts[1][1], st.gaps, d.kind, d.extra)));
  const gates = {};
  for (const b of boundaries) for (const g of b.gaps) if (g.id) gates[g.id] = g;
  const wander = Object.fromEntries(Object.entries(layout.wander ?? {}).map(([k, pts]) => [k, clockwise(pts)]));
  return { fields, boundaries, gateways, gates, wander };
}
