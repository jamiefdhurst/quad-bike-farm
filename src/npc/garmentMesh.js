// Garments cut from her body mesh, as plain data (no Three.js), so the cutting can be tested.
//
// Her body is coarse (a single triangle runs from her shoulder nearly to her jaw), so a garment made of whole body triangles
// can only stop where those triangles do. Here the triangles are split along a smooth line instead, adding vertices of the
// garment's own, so an edge goes exactly where it should whatever the body's triangles are like.
//
// A vertex carries two positions: `bind`, where the body mesh stores it (the model's bind pose, a T-pose turned a quarter
// round from the way she stands), and `rest`, where it is in the pose she stands in, front +z and her left +x, which is the
// frame her bones are measured in. Decisions (where an edge goes, how far out) are made on `rest`; the garment is built on
// `bind`, because that is what gets skinned. `skin` is the affine map from one to the other (12 numbers, a 3x4 matrix by
// rows), so a shape worked out in the rest frame can be carried back. `weights` are [bone index, weight] pairs, at most 4.

const lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const vec = { lerp, sub, add, scale, dot, cross, norm };

/** Applies a 3x4 affine (by rows) to a point. */
export function applySkin(m, p) {
  return [
    m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3],
    m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7],
    m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11],
  ];
}

/** Applies only the 3x3 part of a 3x4 affine to a direction. */
export function applySkinDir(m, d) {
  return [m[0] * d[0] + m[1] * d[1] + m[2] * d[2], m[4] * d[0] + m[5] * d[1] + m[6] * d[2], m[8] * d[0] + m[9] * d[1] + m[10] * d[2]];
}

/** Carries a rest-frame direction back to the bind frame: the inverse of the 3x3 part. */
export function unskinDir(m, d) {
  const [a, b, c, , e, f, g, , h, i, j] = m;
  const det = a * (f * j - g * i) - b * (e * j - g * h) + c * (e * i - f * h);
  const inv = [f * j - g * i, c * i - b * j, b * g - c * f, g * h - e * j, a * j - c * h, c * e - a * g, e * i - f * h, b * h - a * i, a * f - b * e];
  return [
    (inv[0] * d[0] + inv[1] * d[1] + inv[2] * d[2]) / det,
    (inv[3] * d[0] + inv[4] * d[1] + inv[5] * d[2]) / det,
    (inv[6] * d[0] + inv[7] * d[1] + inv[8] * d[2]) / det,
  ];
}

/** Carries a rest-frame point back to the bind frame. */
export function unskin(m, p) {
  return unskinDir(m, [p[0] - m[3], p[1] - m[7], p[2] - m[11]]);
}

/** Skin weights between two vertices' weights: blended, the strongest four kept and summing to 1. */
export function blendWeights(a, b, t) {
  const sum = new Map();
  for (const [bone, w] of a) sum.set(bone, (sum.get(bone) ?? 0) + w * (1 - t));
  for (const [bone, w] of b) sum.set(bone, (sum.get(bone) ?? 0) + w * t);
  const top = [...sum].filter(([, w]) => w > 0).sort((x, y) => y[1] - x[1]).slice(0, 4);
  const total = top.reduce((s, [, w]) => s + w, 0) || 1;
  return top.map(([bone, w]) => [bone, w / total]);
}

/** A vertex part way from a to b: everything interpolated, `rest` kept consistent with `bind` through the blended skin. */
export function between(a, b, t, bind = null) {
  const skin = lerp(a.skin, b.skin, t);
  const p = bind ?? lerp(a.bind, b.bind, t);
  return { bind: p, rest: applySkin(skin, p), normal: norm(lerp(a.normal, b.normal, t)), weights: blendWeights(a.weights, b.weights, t), skin };
}

/**
 * The garment's piece of the body: the triangles `keepTri(a, b, c)` picks from the body's (flat shaded, so its corners are
 * separate vertices), with the corners at one spot welded into one vertex whose normal is the average of the faces there.
 * `verts[i]` is the body's vertex i ({ bind, rest, normal, weights, skin }).
 */
export function weld(verts, index, keepTri) {
  const key = (p) => `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)},${Math.round(p[2] * 1e5)}`;
  const normals = new Map();
  for (const v of verts) normals.set(key(v.bind), add(normals.get(key(v.bind)) ?? [0, 0, 0], v.normal));
  const ids = new Map();
  const out = { verts: [], tris: [] };
  const id = (i) => {
    const k = key(verts[i].bind);
    if (!ids.has(k)) {
      ids.set(k, out.verts.length);
      out.verts.push({ ...verts[i], normal: norm(normals.get(k)) });
    }
    return ids.get(k);
  };
  for (let t = 0; t < index.length; t += 3) {
    const [a, b, c] = [index[t], index[t + 1], index[t + 2]];
    if (keepTri(a, b, c)) out.tris.push([id(a), id(b), id(c)]);
  }
  return out;
}

/**
 * Each triangle into four, the new points on each edge pushed out on to a curved surface through the corners' normals
 * (Phong tessellation), so the garment comes out rounder than the low-poly body under it. `round` is how far (0 flat, 1 full),
 * or a function of the edge's two vertices giving it.
 */
export function subdivide(mesh, round = 0.75) {
  const verts = mesh.verts.slice();
  const mids = new Map();
  const mid = (a, b) => {
    const k = a < b ? `${a},${b}` : `${b},${a}`;
    if (!mids.has(k)) {
      const A = verts[a];
      const B = verts[b];
      const p = lerp(A.bind, B.bind, 0.5);
      const onA = sub(p, scale(A.normal, dot(sub(p, A.bind), A.normal)));
      const onB = sub(p, scale(B.normal, dot(sub(p, B.bind), B.normal)));
      mids.set(k, verts.length);
      const r = typeof round === 'function' ? round(A, B) : round;
      verts.push(between(A, B, 0.5, lerp(p, lerp(onA, onB, 0.5), r)));
    }
    return mids.get(k);
  };
  const tris = [];
  for (const [a, b, c] of mesh.tris) {
    const ab = mid(a, b);
    const bc = mid(b, c);
    const ca = mid(c, a);
    tris.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
  }
  return { verts, tris };
}

/**
 * Cuts the mesh along where `field(vertex)` is 0, keeping the side where it's below 0. Triangles across the line are split
 * on it, the new points shared between neighbours (so no cracks) and tagged `edge: tag`. With `keep: 'both'` nothing is
 * thrown away: the line is only drawn into the mesh, and the far side gets its own copies of the points on it, marked
 * `outside` (so a colour can change sharply there); `sides` then says which side each triangle is on ('in' or 'out'). With
 * `keep: 'split'` both sides are kept sharing the points on the line: the line is only drawn in, so a later cut whose field
 * bends there (a V's point) can follow it exactly.
 */
export function cut(mesh, field, tag, { keep = 'in' } = {}) {
  const verts = mesh.verts.slice();
  const f = verts.map((v) => field(v));
  const both = keep === 'both';
  const split = keep === 'split'; // both sides kept and the points on the line shared: the line only drawn in
  const onLine = new Map();
  const copies = new Map();
  const point = (a, b) => {
    const k = a < b ? `${a},${b}` : `${b},${a}`;
    if (!onLine.has(k)) {
      const t = f[a] / (f[a] - f[b]);
      onLine.set(k, verts.length);
      verts.push({ ...between(verts[a], verts[b], t), edge: tag });
      f.push(0);
    }
    return onLine.get(k);
  };
  const outCopy = (i) => {
    if (!both || f[i] !== 0 || verts[i].edge !== tag) return i;
    if (!copies.has(i)) {
      copies.set(i, verts.length);
      verts.push({ ...verts[i], outside: true });
      f.push(0);
    }
    return copies.get(i);
  };
  const tris = [];
  const sides = [];
  const emit = (tri, side) => {
    if (split) {
      tris.push(tri);
      return;
    }
    if (side === 'out' && !both) return;
    tris.push(side === 'out' ? tri.map(outCopy) : tri);
    sides.push(side);
  };
  mesh.tris.forEach((tri) => {
    const inside = tri.map((i) => f[i] <= 0);
    const count = inside.filter(Boolean).length;
    if (count === 3 || count === 0) {
      emit(tri, count === 3 ? 'in' : 'out');
      return;
    }
    // Rotate so the odd one out is first, keeping the winding.
    const odd = count === 1 ? inside.indexOf(true) : inside.indexOf(false);
    const [a, b, c] = [tri[odd], tri[(odd + 1) % 3], tri[(odd + 2) % 3]];
    const ab = point(a, b);
    const ca = point(c, a);
    const lone = [a, ab, ca];
    const pair = [[ab, b, c], [ab, c, ca]];
    const loneSide = count === 1 ? 'in' : 'out';
    const pairSide = count === 1 ? 'out' : 'in';
    emit(lone, loneSide);
    for (const p of pair) emit(p, pairSide);
  });
  // A triangle's side is about this cut only; earlier cuts' sides are dropped.
  return both ? { verts, tris, sides } : { verts, tris };
}

/** Edges used by only one triangle (the garment's open edges), each as [a, b] in its triangle's winding. */
export function openEdges(mesh) {
  const count = new Map();
  for (const [a, b, c] of mesh.tris) {
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      const k = p < q ? `${p},${q}` : `${q},${p}`;
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  }
  const out = [];
  for (const [a, b, c] of mesh.tris) {
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      const k = p < q ? `${p},${q}` : `${q},${p}`;
      if (count.get(k) === 1) out.push([p, q]);
    }
  }
  return out;
}

/** The open edges joined into loops (each a list of vertex ids, in order). */
export function edgeLoops(mesh) {
  const next = new Map();
  for (const [a, b] of openEdges(mesh)) next.set(a, b);
  const loops = [];
  const seen = new Set();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop = [];
    let v = start;
    while (v !== undefined && !seen.has(v)) {
      seen.add(v);
      loop.push(v);
      v = next.get(v);
    }
    loops.push(loop);
  }
  return loops;
}

/**
 * Where a ray first meets the mesh, using each vertex's `pos(vertex)` (by default its rest position): the triangle, the
 * distance, and the weights of its three corners. Null if it misses.
 */
export function rayHit(mesh, origin, dir, pos = (v) => v.rest) {
  // The same arithmetic as the vector helpers, written out on numbers: this runs for every triangle of a garment for every ray of its fitting.
  const [ox, oy, oz] = origin;
  const [dx, dy, dz] = dir;
  const verts = mesh.verts;
  let best = null;
  for (const tri of mesh.tris) {
    const p0 = pos(verts[tri[0]]);
    const p1 = pos(verts[tri[1]]);
    const p2 = pos(verts[tri[2]]);
    const e1x = p1[0] - p0[0];
    const e1y = p1[1] - p0[1];
    const e1z = p1[2] - p0[2];
    const e2x = p2[0] - p0[0];
    const e2y = p2[1] - p0[1];
    const e2z = p2[2] - p0[2];
    const hx = dy * e2z - dz * e2y;
    const hy = dz * e2x - dx * e2z;
    const hz = dx * e2y - dy * e2x;
    const det = e1x * hx + e1y * hy + e1z * hz;
    if (Math.abs(det) < 1e-12) continue;
    const sx = ox - p0[0];
    const sy = oy - p0[1];
    const sz = oz - p0[2];
    const u = (sx * hx + sy * hy + sz * hz) / det;
    if (u < 0 || u > 1) continue;
    const qx = sy * e1z - sz * e1y;
    const qy = sz * e1x - sx * e1z;
    const qz = sx * e1y - sy * e1x;
    const v = (dx * qx + dy * qy + dz * qz) / det;
    if (v < 0 || u + v > 1) continue;
    const t = (e2x * qx + e2y * qy + e2z * qz) / det;
    if (t > 0 && (!best || t < best.t)) best = { tri, t, bary: [1 - u - v, u, v] };
  }
  return best;
}

/** A vertex at a point inside a triangle, from its barycentric weights. */
export function inTriangle(mesh, tri, [w0, w1, w2]) {
  const [A, B, C] = tri.map((i) => mesh.verts[i]);
  const ab = between(A, B, w1 / Math.max(1e-9, w0 + w1));
  return between(ab, C, w2);
}

/**
 * Smooth normals for `pos(vertex)`: every vertex at one spot gets the average of the faces round that spot, so copies made
 * for a sharp change of colour shade as one surface. Vertices marked `apart` (a turned-in edge) only average their own faces.
 */
export function smoothNormals(mesh, pos = (v) => v.bind) {
  const key = (v, i) => (v.apart ? `#${i}` : pos(v).map((c) => Math.round(c * 1e5)).join(','));
  const sums = new Map();
  for (const tri of mesh.tris) {
    const [a, b, c] = tri.map((i) => pos(mesh.verts[i]));
    const n = cross(sub(b, a), sub(c, a));
    const apart = tri.some((i) => mesh.verts[i].apart);
    for (const i of tri) {
      const v = mesh.verts[i];
      if (!!v.apart !== apart) continue;
      const k = key(v, i);
      sums.set(k, add(sums.get(k) ?? [0, 0, 0], n));
    }
  }
  return mesh.verts.map((v, i) => norm(sums.get(key(v, i)) ?? v.normal));
}

/**
 * Evens out how the mesh is skinned: each point's bone weights (and the skin map that goes with them, which is linear in them)
 * move part way towards the average of its neighbours', `passes` times. The body's weights change abruptly in places (over her
 * shoulder blade, between her back, shoulder and upper arm); a garment standing off the body there carries its offset in quite
 * different directions at neighbouring points once a joint bends, and creases. Points at one spot (copies made for a colour
 * change) are kept together. `where(v)` limits it, `amount` is how far each pass goes.
 */
export function smoothSkinning(mesh, passes = 3, amount = 0.5, where = () => true) {
  const key = (v) => v.bind.map((c) => Math.round(c * 1e5)).join(',');
  const groups = new Map();
  mesh.verts.forEach((v, i) => {
    const k = key(v);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(i);
  });
  const keys = [...groups.keys()];
  const gid = new Map();
  keys.forEach((k, g) => groups.get(k).forEach((i) => gid.set(i, g)));
  const near = keys.map(() => new Set());
  for (const tri of mesh.tris) {
    for (const i of tri) for (const j of tri) if (gid.get(i) !== gid.get(j)) near[gid.get(i)].add(gid.get(j));
  }
  const first = keys.map((k) => mesh.verts[groups.get(k)[0]]);
  let weights = first.map((v) => v.weights);
  let skins = first.map((v) => v.skin);
  for (let pass = 0; pass < passes; pass++) {
    const nextW = [];
    const nextS = [];
    weights.forEach((w, g) => {
      const ns = [...near[g]];
      if (!ns.length || !where(first[g])) {
        nextW.push(w);
        nextS.push(skins[g]);
        return;
      }
      const sum = new Map();
      for (const [b, x] of w) sum.set(b, (sum.get(b) ?? 0) + x * (1 - amount));
      const skin = skins[g].map((x) => x * (1 - amount));
      for (const n of ns) {
        for (const [b, x] of weights[n]) sum.set(b, (sum.get(b) ?? 0) + (x * amount) / ns.length);
        skins[n].forEach((x, k) => (skin[k] += (x * amount) / ns.length));
      }
      const top = [...sum].filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const total = top.reduce((t, [, x]) => t + x, 0) || 1;
      nextW.push(top.map(([b, x]) => [b, x / total]));
      nextS.push(skin);
    });
    weights = nextW;
    skins = nextS;
  }
  keys.forEach((k, g) => {
    for (const i of groups.get(k)) {
      const v = mesh.verts[i];
      v.weights = weights[g];
      v.skin = skins[g];
      v.rest = applySkin(v.skin, v.bind);
    }
  });
  return mesh;
}

/**
 * Cloth bridges a hollow in her rather than following her into it. Each pass moves every point outwards along its normal, never in,
 * half way to where its neighbours' average would put it, so a hollow fills and nothing goes into her. Points on a line the garment
 * was cut along stay put, as do any `where(v)` leaves out. A body split at load (smoothBody.js) has twice the points along any line,
 * so it needs four times the passes for the same reach (evening out spreads with their root).
 */
export function drape(mesh, passes, where = () => true) {
  const near = mesh.verts.map(() => new Set());
  for (const t of mesh.tris) for (const a of t) for (const b of t) if (a !== b) near[a].add(b);
  const free = mesh.verts.map((v) => !v.edge && where(v));
  const out = mesh.verts.map((v) => norm(applySkinDir(v.skin, v.normal)));
  const rest = mesh.verts.map((v) => v.rest);
  for (let pass = 0; pass < passes; pass++) {
    const next = rest.map((r, i) => {
      if (!free[i] || !near[i].size) return r;
      const avg = [0, 0, 0];
      for (const j of near[i]) for (let k = 0; k < 3; k++) avg[k] += rest[j][k] / near[i].size;
      const d = dot(sub(avg, r), out[i]);
      return d > 0 ? add(r, scale(out[i], d * 0.5)) : r;
    });
    next.forEach((r, i) => (rest[i] = r));
  }
  mesh.verts.forEach((v, i) => {
    if (rest[i] === v.rest) return;
    v.bind = unskin(v.skin, rest[i]);
    v.rest = rest[i];
  });
}
