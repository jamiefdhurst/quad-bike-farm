// Flat shapes on the farm's ground, in x and z: a polygon is a list of [x, z] points, clockwise on the map (+x east, +z south), so its inside is
// to the right of the way each edge runs. Pure: the fields (fields.js), their hedges and the map are built on these.

const EPS = 1e-9;

/** A rectangle { minX, maxX, minZ, maxZ } as four points, clockwise from its north-west corner. */
export const rectPolygon = (r) => [[r.minX, r.minZ], [r.maxX, r.minZ], [r.maxX, r.maxZ], [r.minX, r.maxZ]];

/** The rectangle that just holds the polygon. */
export function polygonBounds(pts) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minX, maxX, minZ, maxZ };
}

/** Square metres inside; positive for a clockwise polygon (as the map shows it), negative for an anticlockwise one. */
export function polygonArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % pts.length];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

/** The polygon clockwise: the same points, turned round if they were written the other way. */
export const clockwise = (pts) => (polygonArea(pts) < 0 ? [...pts].reverse() : pts);

/** Whether the points are a rectangle with its sides along x and z. */
export function isAxisRect(pts) {
  if (pts.length !== 4) return false;
  const b = polygonBounds(pts);
  return Math.abs(polygonArea(pts) - (b.maxX - b.minX) * (b.maxZ - b.minZ)) < EPS;
}

/** Each side as { x1, z1, x2, z2, length, dx, dz } (`d` the unit direction it runs). The last runs back to the first point. */
export function polygonEdges(pts) {
  return pts.map(([x1, z1], i) => {
    const [x2, z2] = pts[(i + 1) % pts.length];
    return edgeBetween(x1, z1, x2, z2);
  });
}

/** The line from (x1, z1) to (x2, z2) as an edge. */
export function edgeBetween(x1, z1, x2, z2) {
  const length = Math.hypot(x2 - x1, z2 - z1);
  return { x1, z1, x2, z2, length, dx: length ? (x2 - x1) / length : 0, dz: length ? (z2 - z1) / length : 0 };
}

/** The point `s` metres along an edge from its first end (past either end if `s` is). */
export const pointAlong = (e, s) => ({ x: e.x1 + e.dx * s, z: e.z1 + e.dz * s });

/** Metres from (x, z) to the edge's line, and how far along it the nearest point is (clamped to the edge). */
export function nearestOnEdge(e, x, z) {
  const s = Math.max(0, Math.min(e.length, (x - e.x1) * e.dx + (z - e.z1) * e.dz));
  return { s, d: Math.hypot(x - (e.x1 + e.dx * s), z - (e.z1 + e.dz * s)) };
}

/** Metres from (x, z) to the nearest edge. */
export function distanceToEdges(edges, x, z) {
  let best = Infinity;
  for (const e of edges) {
    const d = nearestOnEdge(e, x, z).d;
    if (d < best) best = d;
  }
  return best;
}

/**
 * Whether (x, z) is in the polygon, its edges counting as in. `margin` m in: at least that far from every edge; a negative one
 * takes in the strip that far outside.
 */
export function pointInPolygon(pts, x, z, margin = 0, edges = polygonEdges(pts)) {
  const near = distanceToEdges(edges, x, z);
  if (near <= EPS) return margin <= 0;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i];
    const [xj, zj] = pts[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside ? near >= margin : near <= -margin;
}

/** Metres (x, z) is outside the polygon (0 inside). */
export function outsidePolygon(pts, x, z, edges = polygonEdges(pts)) {
  return pointInPolygon(pts, x, z, 0, edges) ? 0 : distanceToEdges(edges, x, z);
}

/**
 * Where the ray from (x, z) towards (dx, dz) (a unit direction) meets the edge: `t` metres along the ray and `s` metres along the edge,
 * or null if it runs parallel, points away or misses.
 */
export function rayHitsEdge(x, z, dx, dz, e) {
  const denom = dx * e.dz - dz * e.dx;
  if (Math.abs(denom) < 1e-6) return null;
  const px = e.x1 - x;
  const pz = e.z1 - z;
  const t = (px * e.dz - pz * e.dx) / denom;
  const s = (px * dz - pz * dx) / denom;
  if (t < 0 || s < 0 || s > e.length) return null;
  return { t, s };
}

/** The polygon drawn in `m` metres from every side (square corners kept sharp, so a rectangle stays one). */
export function insetPolygon(pts, m) {
  const edges = polygonEdges(pts);
  return pts.map(([x, z], i) => {
    const a = edges[(i + edges.length - 1) % edges.length];
    const b = edges[i];
    const ax = -a.dz;
    const az = a.dx;
    const bx = -b.dz;
    const bz = b.dx;
    const k = m / Math.max(0.2, 1 + ax * bx + az * bz);
    return [x + (ax + bx) * k, z + (az + bz) * k];
  });
}

/** (x, z) pulled into the polygon, `margin` metres in from its sides (less if it is narrower than that); a point already there stays. */
export function clampIntoPolygon(pts, x, z, margin = 0) {
  const b = polygonBounds(pts);
  const m = Math.min(margin, (b.maxX - b.minX) / 2, (b.maxZ - b.minZ) / 2);
  if (isAxisRect(pts)) return { x: Math.min(Math.max(x, b.minX + m), b.maxX - m), z: Math.min(Math.max(z, b.minZ + m), b.maxZ - m) };
  const inner = m > 0 ? insetPolygon(pts, m) : pts;
  const edges = polygonEdges(inner);
  if (pointInPolygon(inner, x, z, 0, edges)) return { x, z };
  let best = null;
  let bestD = Infinity;
  for (const e of edges) {
    const { s, d } = nearestOnEdge(e, x, z);
    if (d < bestD) {
      bestD = d;
      best = pointAlong(e, s);
    }
  }
  return best ?? { x, z };
}

/** The corners that point into the polygon (a notch's), drawn in `m` metres so they can be walked past without touching the side. */
export function notchCorners(pts, m = 0.6, edges = polygonEdges(pts)) {
  const inner = insetPolygon(pts, m);
  const out = [];
  pts.forEach((p, i) => {
    const a = edges[(i + edges.length - 1) % edges.length];
    const b = edges[i];
    if (a.dx * b.dz - a.dz * b.dx < -EPS) out.push({ x: inner[i][0], z: inner[i][1] }); // turns the other way from the polygon's own
  });
  return out;
}

/** Whether the straight line from a to b stays inside the polygon (touching its sides is fine). */
export function segmentInside(pts, a, b, edges = polygonEdges(pts)) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  if (len < EPS) return pointInPolygon(pts, a.x, a.z, 0, edges);
  const ray = { x1: a.x, z1: a.z, x2: b.x, z2: b.z, length: len, dx: dx / len, dz: dz / len };
  for (const e of edges) {
    const hit = rayHitsEdge(a.x, a.z, ray.dx, ray.dz, e);
    // Crossing a side, short of the far end and not just touching a corner of it.
    if (hit && hit.t > 1e-6 && hit.t < len - 1e-6 && hit.s > 1e-6 && hit.s < e.length - 1e-6) return false;
  }
  return pointInPolygon(pts, a.x + dx / 2, a.z + dz / 2, 0, edges);
}
