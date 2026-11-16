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

/** Whether every corner of the polygon turns the same way as the polygon (no notch), a straight run counting as either. */
export function isConvex(pts) {
  const sign = Math.sign(polygonArea(pts));
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[(i + 1) % pts.length];
    const [cx, cz] = pts[(i + 2) % pts.length];
    if (((bx - ax) * (cz - bz) - (bz - az) * (cx - bx)) * sign < -EPS) return false;
  }
  return true;
}

/** The polygon cut into triangles by its corners (ear clipping), each clockwise. A simple polygon of n corners gives n - 2. */
export function triangulate(pts) {
  const p = clockwise(pts);
  const idx = p.map((_, i) => i);
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
  const inTri = (q, a, b, c) => cross(a, b, q) >= -EPS && cross(b, c, q) >= -EPS && cross(c, a, q) >= -EPS;
  const out = [];
  let guard = idx.length * idx.length;
  while (idx.length > 3 && guard-- > 0) {
    for (let k = 0; k < idx.length; k++) {
      const [ia, ib, ic] = [idx[(k + idx.length - 1) % idx.length], idx[k], idx[(k + 1) % idx.length]];
      const [a, b, c] = [p[ia], p[ib], p[ic]];
      if (cross(a, b, c) <= EPS) continue; // a notch's corner, or a straight run: not an ear
      if (idx.some((j) => j !== ia && j !== ib && j !== ic && inTri(p[j], a, b, c))) continue;
      out.push([a, b, c]);
      idx.splice(k, 1);
      break;
    }
  }
  if (idx.length !== 3) throw new Error('triangulate: not a simple polygon');
  out.push(idx.map((i) => p[i]));
  return out;
}

/** The part of `subject` (any simple polygon) inside `convex` (a convex one): Sutherland-Hodgman, its sides counting as inside. */
function clipToConvex(subject, convex) {
  const c = clockwise(convex);
  let out = subject;
  for (let i = 0; i < c.length && out.length; i++) {
    const [ax, az] = c[i];
    const [bx, bz] = c[(i + 1) % c.length];
    const side = ([x, z]) => (bx - ax) * (z - az) - (bz - az) * (x - ax);
    const input = out;
    out = [];
    for (let k = 0; k < input.length; k++) {
      const p = input[k];
      const q = input[(k + 1) % input.length];
      const sp = side(p);
      const sq = side(q);
      if (sp >= -EPS) out.push(p);
      if ((sp > EPS && sq < -EPS) || (sp < -EPS && sq > EPS)) {
        const t = sp / (sp - sq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return out;
}

const near = (a, b, tol) => Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol;

/** The points, without a repeat of the one before or a corner on a straight run. */
function tidyPolygon(pts, tol) {
  let p = pts.filter((q, i) => !near(q, pts[(i + 1) % pts.length], tol));
  for (let changed = true; changed && p.length > 2; ) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length];
      const b = p[i];
      const c = p[(i + 1) % p.length];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
      if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / len <= tol) {
        p = p.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return p;
}

/**
 * Pieces of polygons that together make one shape, joined back into polygons: every side two pieces share (one each way) is taken out, and
 * the sides left are followed round. A side that another piece's corner lies along is split there first, so a shared side cut differently on
 * each piece still cancels out. `tol` metres counts as the same point.
 */
export function joinPieces(pieces, tol = 1e-6) {
  const corners = pieces.flat();
  let sides = [];
  for (const piece of pieces) {
    for (let i = 0; i < piece.length; i++) {
      const a = piece[i];
      const b = piece[(i + 1) % piece.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len <= tol) continue;
      const cuts = [];
      for (const q of corners) {
        const s = ((q[0] - a[0]) * (b[0] - a[0]) + (q[1] - a[1]) * (b[1] - a[1])) / len;
        if (s <= tol || s >= len - tol) continue;
        const off = Math.abs((q[0] - a[0]) * (b[1] - a[1]) - (q[1] - a[1]) * (b[0] - a[0])) / len;
        if (off <= tol) cuts.push([s, q]);
      }
      cuts.sort((u, v) => u[0] - v[0]);
      let from = a;
      for (const [, q] of cuts) {
        if (!near(from, q, tol)) sides.push([from, q]);
        from = q;
      }
      if (!near(from, b, tol)) sides.push([from, b]);
    }
  }
  const gone = new Set();
  for (let i = 0; i < sides.length; i++) {
    if (gone.has(i)) continue;
    const j = sides.findIndex(([a, b], k) => k !== i && !gone.has(k) && near(a, sides[i][1], tol) && near(b, sides[i][0], tol));
    if (j >= 0) gone.add(i).add(j);
  }
  sides = sides.filter((_, i) => !gone.has(i));
  const loops = [];
  const used = new Set();
  for (let i = 0; i < sides.length; i++) {
    if (used.has(i)) continue;
    const loop = [];
    for (let k = i; k >= 0 && !used.has(k); k = sides.findIndex(([a], m) => !used.has(m) && near(a, sides[k][1], tol))) {
      used.add(k);
      loop.push(sides[k][0]);
    }
    const tidy = tidyPolygon(loop, tol);
    if (tidy.length >= 3 && Math.abs(polygonArea(tidy)) > tol) loops.push(clockwise(tidy));
  }
  return loops;
}

/**
 * Where two simple polygons overlap, as a list of polygons (clockwise; empty if they don't). Either may have notches: `clip` is cut into
 * triangles unless it is convex, `subject` is clipped by each, and the pieces are joined again. Sides lying along each other and corners on
 * the other's sides are fine (the farm's fields share the outline's east side and meet it at its corners).
 */
export function intersectPolygons(subject, clip, tol = 1e-6) {
  const s = clockwise(subject);
  const parts = isConvex(clip) ? [clockwise(clip)] : triangulate(clip);
  return joinPieces(parts.map((part) => clipToConvex(s, part)).filter((p) => p.length >= 3), tol);
}
