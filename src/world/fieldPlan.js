// The farm's fields as shapes (#662): each field a polygon with a kind, the lines round and between them (a hedge, a wall, a fence, a rail or
// nothing) with their gateways, and the points a girl walks through to get from one field to the next. Today's farm is built here from the
// layout's numbers (every field a rectangle for now); a field with a natural outline is more points in `fields`, and nothing that reads
// the plan needs to know. Pure: fields.js turns this into the questions the game asks (where am I, how far is the hedge, the way round).

import { rectPolygon, polygonEdges, edgeBetween, pointInPolygon, pointAlong, clockwise } from './polygons.js';

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
 * The plan from data alone (`layout.fields`, `layout.boundaries`, `layout.gateways`), for a layout that says what its fields are rather than
 * leaving today's farm to be built from its numbers. Plain data, no functions: `fields` are `{ name, kind, points }`; `boundaries` are
 * `{ points, kind, gaps: [{ at, half, ...extra }], ...extra }` (`at` metres along from the first point); `gateways` are
 * `{ a, b, boundary, at, half, gate, id, shut, outA, outB }`: the way from field `a` to field `b` through the `boundary`-th boundary, `at` metres
 * along it. With a `half` it is a gap in that boundary (the one already there at `at`, if the boundary has it); without, only the way across.
 */
function planFromData(layout) {
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

/** The plan for the layout; `hill`, `woods`, `quarry` and `brook` are the places through the gates, each null if the layout has none. */
export function fieldPlan(layout, { hill, woods, quarry, brook }) {
  if (layout.fields) return planFromData(layout);
  const F = layout.fieldHalf;
  const farm = layout.farm ?? { minX: -F, maxX: F, minZ: -F, maxZ: F };
  const road = layout.road;
  const gate = layout.gate;
  const corridor = road ? { lo: road.z - road.halfWidth - road.verge, hi: road.z + road.halfWidth + road.verge } : null;

  // The fields, in the order a point is looked for in them (the first that holds it names it).
  const fields = [{ name: 'grass', kind: 'grass', points: rectPolygon({ minX: -F, maxX: F, minZ: -F, maxZ: F }) }];
  const add = (name, kind, rect) => fields.push({ name, kind, points: rectPolygon(rect) });
  if (road) {
    // The road's corridor between its hedges, the two stubble fields either side of it, and the hardstanding's end, open to both fields.
    add('road', 'lane', { minX: F, maxX: road.hedgeTo, minZ: corridor.lo, maxZ: corridor.hi });
    add('end', 'lane', { minX: road.hedgeTo, maxX: farm.maxX, minZ: corridor.lo, maxZ: corridor.hi });
    add('north', 'arable', { minX: F, maxX: farm.maxX, minZ: farm.minZ, maxZ: corridor.lo });
    add('south', 'arable', { minX: F, maxX: farm.maxX, minZ: corridor.hi, maxZ: farm.maxZ });
  }
  if (hill) {
    add('lane', 'lane', { ...hill.laneRect, minZ: F });
    add('hill', 'rough', hill.pasture);
    if (hill.west) add('meadow', 'pasture', hill.west);
    if (hill.east) add('sheep', 'pasture', hill.east);
    if (hill.riverside) add('riverside', 'pasture', hill.riverside);
  }
  if (woods) add('woods', 'wood', woods.rect);
  if (quarry) add('quarry', 'rough', quarry.rect);
  const polygons = Object.fromEntries(fields.map((f) => [f.name, f.points]));

  // Boundaries. A gap with a gate in it is `gate`, and `shut` if the gate is (the south gate is tied open; the big gate at the end of the road
  // is shut). `height` is a taller hedge's own. Gaps are written as the x or z they are at, and made `along` the line.
  const lines = [];
  const line = (x1, z1, x2, z2, gaps = [], extra = {}) => {
    const alongX = z1 === z2;
    const h = boundary(x1, z1, x2, z2, gaps.map((x) => ({ ...x, at: x.at - (alongX ? x1 : z1) })), 'hedge', extra);
    lines.push(h);
    return h;
  };
  const g = (at, half, extra = {}) => ({ at, half, ...extra });
  const gateGap = g(gate.x, gate.width / 2 + 0.35, { id: 'south', gate: true, shut: !gate.open });
  const northGap = woods ? g(woods.gate.x, woods.gate.width / 2 + 0.35, { id: 'north', gate: true, shut: !woods.gate.open }) : null;
  const quarryGap = quarry ? g(quarry.gate.x, quarry.gate.width / 2 + 0.35, { id: 'quarry', gate: true, shut: !quarry.gate.open }) : null;
  const roadGap = road?.gate ? g(road.z, road.gate.width / 2 + 0.35, { id: 'road', gate: true, shut: true }) : null; // the game opens and shuts both (world/gates.js)
  const riverGap = hill?.riverside && brook ? g(brook.zAt(hill.riverside.maxX), brook.halfAt(hill.riverside.maxX) + 1.6, { shut: true }) : null;
  const some = (x) => (x ? [x] : []);

  const northHedge = line(-F, -F, F, -F, some(northGap));
  const southHedge = line(-F, F, F, F, [gateGap]);
  line(-F, -F, -F, F);
  const eastHedge = line(F, -F, F, F, road ? [g(road.z, (corridor.hi - corridor.lo) / 2)] : []);
  let farmNorth = null;
  let farmEast = null;
  let roadNorth = null;
  let roadSouth = null;
  let roadEnd = null;
  if (road) {
    const gaps = (xs) => xs.map((at) => g(at, road.gapWidth / 2));
    farmNorth = line(F, farm.minZ, farm.maxX, farm.minZ, some(quarryGap));
    line(F, farm.maxZ, farm.maxX, farm.maxZ);
    farmEast = line(farm.maxX, farm.minZ, farm.maxX, farm.maxZ, some(roadGap));
    roadNorth = line(F, corridor.lo, road.hedgeTo, corridor.lo, gaps(road.gaps.north));
    roadSouth = line(F, corridor.hi, road.hedgeTo, corridor.hi, gaps(road.gaps.south));
    // Not a hedge: the line the hardstanding's end shares with the road, and with each field beside it.
    roadEnd = edgeBetween(road.hedgeTo, corridor.lo, road.hedgeTo, corridor.hi);
  }
  if (woods) {
    // The wood's hedges on its other three sides; the fourth is the grass field's north hedge, with the gate in it.
    const r = woods.rect;
    line(r.minX, r.minZ, r.maxX, r.minZ);
    line(r.minX, r.minZ, r.minX, r.maxZ);
    line(r.maxX, r.minZ, r.maxX, r.maxZ);
  }
  if (quarry) {
    // The gravel pit's field: its south side is the barley field's north hedge (above, with the gate in it) and its west side the wood's east one.
    // Far from everywhere you ride, so a coarser hedge (props.js: fewer, fatter blocks) keeps the triangles down.
    const r = quarry.rect;
    line(r.minX, r.minZ, r.maxX, r.minZ, [], { coarse: true });
    line(r.maxX, r.minZ, r.maxX, r.maxZ, [], { coarse: true });
  }
  let pastureNorth = null;
  let pastureEast = null;
  let laneSouth = null;
  const laneSides = [];
  if (hill) {
    // The lane's tall hedges on top of its banks, from the gate to the pasture, and the pasture's own all round, open where the lane comes in.
    const { lane, pasture: p } = hill;
    if (hill.west) {
      // The lane runs between the two fields beside it with nothing in between (the banks are still there, with a ramp at each gateway);
      // they are hedged round their outer sides: a short piece of the grass field's south hedge west of its corner, and a hedge down each side.
      line(hill.west.minX, F, -F, F);
      line(hill.west.minX, F, hill.west.minX, lane.toZ);
      line(hill.east.maxX, F, hill.east.maxX, lane.toZ);
    } else {
      for (const x of [lane.x - lane.hedgeOff, lane.x + lane.hedgeOff]) line(x, F, x, lane.toZ, [], { height: lane.hedgeHeight });
    }
    // The pasture's north hedge is open along its whole width where the two fields beside the lane meet it (they are hedged on their
    // outer sides only).
    pastureNorth = line(p.minX, p.minZ, p.maxX, p.minZ, [hill.west ? g((p.minX + p.maxX) / 2, (p.maxX - p.minX) / 2 + 1) : g(lane.x, lane.hedgeOff)]);
    line(p.minX, p.maxZ, p.maxX, p.maxZ);
    line(p.minX, p.minZ, p.minX, p.maxZ);
    pastureEast = line(p.maxX, p.minZ, p.maxX, p.maxZ, hill.riverside ? [g(hill.riverside.gate.z, hill.riverside.gate.width / 2)] : []);
    if (hill.riverside) {
      // The riverside meadow's other three sides; its west side is the pasture's east hedge (above) and the sheep field's, which meet at the corner.
      // The river runs out under its east hedge (the water is at the hedge's foot, as at the pasture's), open where it does, which a hurdle
      // across the water shuts (world/riverProps.js).
      const r = hill.riverside;
      line(r.minX, r.minZ, r.maxX, r.minZ);
      line(r.minX, r.maxZ, r.maxX, r.maxZ);
      line(r.maxX, r.minZ, r.maxX, r.maxZ, some(riverGap));
    }
    // The lane's own sides, where the gateways to the fields beside it are (no hedge of their own to hold a gap).
    const lr = hill.laneRect;
    laneSouth = edgeBetween(lr.minX, lane.toZ, lr.maxX, lane.toZ);
    laneSides.push(edgeBetween(lr.minX, F, lr.minX, lane.toZ), edgeBetween(lr.maxX, F, lr.maxX, lane.toZ));
  }

  // Gateways: a point either side of each, 2 m or so out, joining the two fields it's between. A shut gap is no way through.
  const gateways = [];
  const link = (a, b, edge, at, outA, outB, gapOf = null) => {
    const { pa, pb } = gatewayAcross(edge, at, polygons[a], polygons[b], outA, outB);
    gateways.push({ a, pa, b, pb, gap: gapOf ? gapOf : null, via: { edge, at, outA, outB } });
  };
  const gapOn = (h, extra) => h.gaps.find((x) => x.id === extra);
  link('grass', hill ? 'lane' : 'out', southHedge, gate.x - southHedge.x1, 2.5, 2.5, gapOn(southHedge, 'south'));
  if (woods) link('grass', 'woods', northHedge, woods.gate.x - northHedge.x1, 2.5, 2.5, gapOn(northHedge, 'north'));
  if (quarry) link('north', 'quarry', farmNorth, quarry.gate.x - farmNorth.x1, 2.5, 2.5, gapOn(farmNorth, 'quarry'));
  if (hill) link('lane', 'hill', laneSouth, hill.lane.x - laneSouth.x1, 2, 2);
  if (hill?.riverside) link('hill', 'riverside', pastureEast, hill.riverside.gate.z - pastureEast.z1, 2.5, 2.5);
  if (hill) for (const gt of hill.gates) link('lane', gt.side < 0 ? 'meadow' : 'sheep', laneSides[gt.side < 0 ? 0 : 1], gt.z - F, 2, 2.5);
  if (road) {
    link('grass', 'road', eastHedge, road.z - eastHedge.z1, 2.5, 2.5);
    for (const x of road.gaps.north) link('road', 'north', roadNorth, x - roadNorth.x1, 1.5, 2.5);
    for (const x of road.gaps.south) link('road', 'south', roadSouth, x - roadSouth.x1, 1.5, 2.5);
    link('road', 'end', roadEnd, road.z - roadEnd.z1, 2, 2);
    const endX = (road.hedgeTo + farm.maxX) / 2;
    const endNorth = edgeBetween(road.hedgeTo, corridor.lo, farm.maxX, corridor.lo);
    const endSouth = edgeBetween(road.hedgeTo, corridor.hi, farm.maxX, corridor.hi);
    link('end', 'north', endNorth, endX - road.hedgeTo, 1, 2.5);
    link('end', 'south', endSouth, endX - road.hedgeTo, 1, 2.5);
  }

  // On foot, a girl wandering about the hill pasture keeps to the bottom of it, over the stream from the lane: this field, less the 6 m margin
  // clampToArea is given, is the strip just past the water and short of the foot, 8 m either side of the lane.
  const wander = {};
  if (hill) {
    let lo = -Infinity;
    let hi = Infinity;
    for (let x = hill.lane.x - 8; x <= hill.lane.x + 8; x += 0.5) {
      lo = Math.max(lo, hill.farEdge(x) + 1);
      hi = Math.min(hi, hill.farEdge(x) + layout.hill.foot - 0.5);
    }
    wander.hill = rectPolygon({ minX: hill.lane.x - 14, maxX: hill.lane.x + 14, minZ: lo - 6, maxZ: Math.max(lo, hi) + 6 });
  }

  const gates = { south: gapOn(southHedge, 'south'), north: woods ? gapOn(northHedge, 'north') : null, road: roadGap ? farmEast.gaps[0] : null, quarry: quarry ? gapOn(farmNorth, 'quarry') : null };
  return { fields: fields.map((f) => field(f.name, f.kind, f.points)), boundaries: lines, gateways, gates, wander };
}
