// What the game asks of the fields, worked out from a plan (fieldPlan.js) alone: which field a point is in, how far the nearest hedge is, what
// is ahead, and the way round from one field to another through the gateways. Pure, and it knows nothing of the farm's own layout, so a field
// of any outline can be tried in a test.

import { clockwise, rectPolygon, polygonBounds, polygonEdges, pointInPolygon, outsidePolygon, nearestOnEdge, rayHitsEdge, clampIntoPolygon, notchCorners, segmentInside } from './polygons.js';

/** `farm` is the farm's outline inside the outer hedges: a rectangle, or a polygon (a list of [x, z] points). */
export function createFieldMap(plan, farm) {
  const { gateways } = plan;
  const hedges = plan.boundaries.filter((b) => b.kind === 'hedge');
  // What stops you and what you can't see through: a hedge, a wall, a fence or a rail (not a `none` line between two fields that run together).
  const solid = plan.boundaries.filter((b) => b.kind !== 'none');

  // The fields as polygons (`polygons`), and the rectangle that holds each (`areas`) for what wants a box: the stubble drawn over a field, the map's bounds.
  const polygons = {};
  const shapeEdges = {};
  const areas = {};
  for (const f of plan.fields) {
    polygons[f.name] = f.points;
    shapeEdges[f.name] = f.edges;
    areas[f.name] = polygonBounds(f.points);
  }
  const kinds = Object.fromEntries(plan.fields.map((f) => [f.name, f.kind]));
  const order = plan.fields.map((f) => f.name);
  const farmShape = Array.isArray(farm) ? clockwise(farm) : rectPolygon(farm);
  const farmEdges = polygonEdges(farmShape);

  /** Which field (x, z) is in: 'grass', 'road', 'end', 'north', 'south', 'lane', 'hill', 'meadow' (west of the lane), 'sheep' (east of it), 'riverside' (beyond the pasture's east hedge, where the river runs), 'woods' (through the north gate), 'quarry' (the gravel pit's field, through the barley field's north hedge), or 'out' beyond the hedges. */
  function areaOf(x, z) {
    for (const k of order) if (pointInPolygon(polygons[k], x, z, 0, shapeEdges[k])) return k;
    return 'out';
  }

  /** Whether the point `s` along a hedge (metres from its first end) is in one of its gaps. */
  const inGap = (h, s) => h.gaps.some((g) => Math.abs(s - g.at) < g.half);

  /** Metres to the nearest hedge line (gaps and all). */
  function hedgeDistance(x, z) {
    let best = Infinity;
    for (const h of solid) {
      const d = nearestOnEdge(h, x, z).d;
      if (d < best) best = d;
    }
    return best;
  }

  /** Whether a hedge is within `reach` metres of (x, z) there is no way through: not in a gap, unless its gate is shut. */
  function hedgedAt(x, z, reach) {
    for (const h of solid) {
      const { s, d } = nearestOnEdge(h, x, z);
      if (d < reach && !h.gaps.some((g) => !g.shut && Math.abs(s - g.at) < g.half)) return true;
    }
    return false;
  }

  /** Metres along `yaw` (0 is +z) from (x, z) to the first hedge or shut gate it would hit, not counting the open gaps; Infinity if none. */
  function hedgeAhead(x, z, yaw) {
    const dx = Math.sin(yaw);
    const dz = Math.cos(yaw);
    let best = Infinity;
    for (const h of solid) {
      const hit = rayHitsEdge(x, z, dx, dz, h);
      if (!hit || hit.t >= best || h.gaps.some((g) => !g.shut && Math.abs(hit.s - g.at) < g.half)) continue;
      best = hit.t;
    }
    return best;
  }


  // A field with a notch in it (a corner that points inwards) has straight lines through it that leave it, so a way across it goes round the
  // notch's corners: they are extra points on the way, in that field.
  const notches = {};
  for (const k of Object.keys(polygons)) {
    const corners = notchCorners(polygons[k], 0.6, shapeEdges[k]);
    if (corners.length) notches[k] = corners;
  }
  /** Whether a straight line from a to b stays in field `area` (always, unless it has a notch). */
  const clear = (area, a, b) => !notches[area] || segmentInside(polygons[area], a, b, shapeEdges[area]);

  /**
   * The way on foot or on a quad from `from` to `to` without going through a hedge: the gateway points to pass (and the corners of a notch to
   * go round), then `to`. Just [to] when they're in the same field and nothing is in the way. Shortest by straight lines between those points
   * (there are only a dozen gateways, so a plain Dijkstra).
   */
  function route(from, to) {
    const start = areaOf(from.x, from.z);
    const goal = areaOf(to.x, to.z);
    if (start === goal && clear(start, from, to)) return [to];
    // Nodes: 0 is `from`, 1 is `to`, then each gateway's two points, then each notch's corners.
    const nodes = [{ p: from, area: start }, { p: to, area: goal }];
    for (const g of gateways) if (!g.gap?.shut) nodes.push({ p: g.pa, area: g.a, twin: nodes.length + 1 }, { p: g.pb, area: g.b, twin: nodes.length });
    for (const k of Object.keys(notches)) for (const p of notches[k]) nodes.push({ p, area: k });
    const dist = nodes.map(() => Infinity);
    const prev = nodes.map(() => -1);
    const done = nodes.map(() => false);
    dist[0] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || u === 1) break;
      done[u] = true;
      const relax = (v) => {
        const d = dist[u] + Math.hypot(nodes[v].p.x - nodes[u].p.x, nodes[v].p.z - nodes[u].p.z);
        if (d < dist[v]) {
          dist[v] = d;
          prev[v] = u;
        }
      };
      if (nodes[u].twin !== undefined) relax(nodes[u].twin);
      for (let v = 1; v < nodes.length; v++) if (v !== u && !done[v] && nodes[v].area === nodes[u].area && clear(nodes[u].area, nodes[u].p, nodes[v].p)) relax(v);
    }
    if (dist[1] === Infinity) return [to];
    const path = [];
    for (let v = 1; v > 0; v = prev[v]) path.unshift(nodes[v].p);
    return path;
  }

  /**
   * The next point to head for on the way from `from` to `to`, skipping a point she's already within `reach` metres of, or has already passed:
   * on the far side of it along the way to the next point and (`lane` m) within a lane's width of that line. Without the second rule, a
   * gateway point 2.5 m short of a gap drew her back as she walked on through it, once she was more than `reach` past it, and she stood
   * dithering at the gap (the cattle grid's, mostly).
   */
  function nextWaypoint(from, to, reach = 1.5, lane = 1.5) {
    const path = route(from, to);
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      if (Math.hypot(p.x - from.x, p.z - from.z) <= reach) continue;
      const q = path[i + 1];
      if (q) {
        const dx = q.x - p.x;
        const dz = q.z - p.z;
        const len = Math.hypot(dx, dz) || 1;
        const along = ((from.x - p.x) * dx + (from.z - p.z) * dz) / len;
        const across = Math.abs(((from.x - p.x) * dz - (from.z - p.z) * dx) / len);
        if (along > 0 && across <= lane) continue;
      }
      return p;
    }
    return to;
  }

  /** Whether (x, z) is inside the farm's outer hedges, `margin` metres in. */
  function inFarm(x, z, margin = 0) {
    return pointInPolygon(farmShape, x, z, margin, farmEdges);
  }

  /** (x, z) pulled inside the field `area` (as areaOf names it), `margin` metres in from its edges; in the hill pasture, its bottom. */
  function clampToArea(area, x, z, margin = 0) {
    const shapeOf = plan.wander[area] ?? polygons[area];
    return shapeOf ? clampIntoPolygon(shapeOf, x, z, margin) : { x, z };
  }

  /** Metres (x, z) is outside the farm's outer hedges (0 inside). */
  const outsideFarm = (x, z) => outsidePolygon(farmShape, x, z, farmEdges);

  return { polygons, areas, kinds, hedges, areaOf, inGap, hedgeDistance, hedgedAt, hedgeAhead, route, nextWaypoint, inFarm, clampToArea, outsideFarm };
}
