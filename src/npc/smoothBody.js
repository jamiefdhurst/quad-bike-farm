// A smoother body under everything (#176). Her model is coarse (about 1,900 triangles, one running from her shoulder nearly to her
// jaw), and every garment is cut from her triangles, so their shapes stop where hers do. Once at load, before her figure is shaped
// and her clothes are fitted, each triangle is split into four, and the new points on each edge are pushed out towards a curved
// surface through the corners' smooth normals (Phong tessellation, as garmentMesh.js's `subdivide` does for the clothes).
//
// The model is flat shaded, each triangle with its own three corners, so the corners are welded by position to find the edges:
// both triangles on an edge get the same new point and the same skin weights, so nothing cracks when she moves. An edge is only
// pushed out when every triangle beside it is rounded, so her hair (split, not rounded) keeps its shapes and a crisp hairline, and
// each end's normal is taken only from the faces on the edge's side of any crease, so a sharp edge stays sharp. The
// new corners' UVs are taken inside their own triangle, so the paint stays exactly where it was. Pure.

/** The smoother body unless `?body=flat` asks for the model as shipped. */
export function smoothBodyWanted(search) {
  return new URLSearchParams(search ?? '').get('body') !== 'flat';
}

export const SMOOTH_BODY = {
  round: 0.4, // how far the new points go towards the curved surface (0 flat, 1 full): about half the garments' 0.75, so she's
  // smoother without looking a different style from the low-poly world
  crease: 60, // degrees: faces meeting more sharply than this are a crease, kept sharp rather than rounded over
};

const key = (p, i) => `${Math.round(p[i * 3] * 1e5)},${Math.round(p[i * 3 + 1] * 1e5)},${Math.round(p[i * 3 + 2] * 1e5)}`;

/** Skin weights between two corners: blended half and half, the strongest four kept, summing to 1. As [[bone, weight]]. */
function blend(a, b) {
  const sum = new Map();
  for (const [bone, w] of [...a, ...b]) sum.set(bone, (sum.get(bone) ?? 0) + w / 2);
  const top = [...sum].filter(([, w]) => w > 0).sort((x, y) => y[1] - x[1]).slice(0, 4);
  const total = top.reduce((s, [, w]) => s + w, 0) || 1;
  return top.map(([bone, w]) => [bone, w / total]);
}

/**
 * Splits a skinned mesh's triangles into four. `positions` (xyz), `uvs` (uv), `skinIndex` and `skinWeight` (4 each) are per corner,
 * `index` the triangles (every corner listed). `rounded(t)` says whether triangle t is rounded (default all). Returns new arrays of
 * the same kinds, every triangle with its own three corners as before, and `index` listing them in order.
 */
export function splitBody({ positions, uvs, skinIndex, skinWeight, index }, { round = SMOOTH_BODY.round, crease = SMOOTH_BODY.crease, rounded = () => true } = {}) {
  const tris = index.length / 3;
  // Points: the corners welded by position, each with the faces round it and the weights of the first corner found there.
  const pointOf = new Map();
  const point = [];
  const points = [];
  for (let c = 0; c < positions.length / 3; c++) {
    const k = key(positions, c);
    if (!pointOf.has(k)) {
      pointOf.set(k, points.length);
      const weights = [];
      for (let j = 0; j < 4; j++) if (skinWeight[c * 4 + j] > 0) weights.push([skinIndex[c * 4 + j], skinWeight[c * 4 + j]]);
      points.push({ p: [positions[c * 3], positions[c * 3 + 1], positions[c * 3 + 2]], faces: [], weights });
    }
    point.push(pointOf.get(k));
  }
  const corner = (t, j) => index[t * 3 + j];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const unit = (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  // Each face's normal, as long as twice its area (so bigger faces count for more) and as a unit.
  const faces = [];
  for (let t = 0; t < tris; t++) {
    const [a, b, c] = [0, 1, 2].map((j) => points[point[corner(t, j)]].p);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    faces.push({ n, u: unit(n) });
    for (let j = 0; j < 3; j++) points[point[corner(t, j)]].faces.push(t);
  }
  // Edges: the faces on each, and whether every one of them is rounded.
  const edgeKey = (i, j) => (i < j ? `${i},${j}` : `${j},${i}`);
  const edges = new Map();
  for (let t = 0; t < tris; t++) {
    const r = rounded(t);
    for (let j = 0; j < 3; j++) {
      const k = edgeKey(point[corner(t, j)], point[corner(t, (j + 1) % 3)]);
      const e = edges.get(k) ?? { faces: [], round: true };
      e.faces.push(t);
      e.round &&= r;
      edges.set(k, e);
    }
  }
  const sharp = Math.cos((crease * Math.PI) / 180);
  // An end's normal for an edge: the faces round that end on the edge's side of any crease (within `crease` of the edge's own).
  const normalAt = (q, side) => {
    const sum = [0, 0, 0];
    for (const f of q.faces) if (dot(faces[f].u, side) > sharp) for (let m = 0; m < 3; m++) sum[m] += faces[f].n[m];
    return unit(sum);
  };
  // Each edge's new point, shared by the triangles on it.
  const mids = new Map();
  const mid = (i, j) => {
    const k = edgeKey(i, j);
    if (!mids.has(k)) {
      const A = points[i];
      const B = points[j];
      const p = A.p.map((x, m) => (x + B.p[m]) / 2);
      const e = edges.get(k);
      // Not across a crease (the old shirt's hem over her thighs, the soles of her feet), which rounding would only push further out.
      const fold = e.faces.length === 2 && dot(faces[e.faces[0]].u, faces[e.faces[1]].u) <= sharp;
      if (e.round && !fold && round) {
        const side = unit(e.faces.reduce((s, f) => s.map((x, m) => x + faces[f].u[m]), [0, 0, 0]));
        const nA = normalAt(A, side);
        const nB = normalAt(B, side);
        // On each end's tangent plane, then part way to the average of the two.
        const dA = dot([p[0] - A.p[0], p[1] - A.p[1], p[2] - A.p[2]], nA);
        const dB = dot([p[0] - B.p[0], p[1] - B.p[1], p[2] - B.p[2]], nB);
        for (let m = 0; m < 3; m++) p[m] += ((-(dA * nA[m]) - dB * nB[m]) / 2) * round;
      }
      mids.set(k, { p, weights: blend(A.weights, B.weights) });
    }
    return mids.get(k);
  };
  const out = { positions: new Float32Array(tris * 36), uvs: new Float32Array(tris * 24), skinIndex: new Uint16Array(tris * 48), skinWeight: new Float32Array(tris * 48) };
  let n = 0;
  const emit = (q, uv) => {
    out.positions.set(q.p, n * 3);
    out.uvs.set(uv, n * 2);
    q.weights.forEach(([bone, w], j) => {
      out.skinIndex[n * 4 + j] = bone;
      out.skinWeight[n * 4 + j] = w;
    });
    n++;
  };
  for (let t = 0; t < tris; t++) {
    const c = [0, 1, 2].map((j) => corner(t, j));
    const P = c.map((i) => points[point[i]]);
    const UV = c.map((i) => [uvs[i * 2], uvs[i * 2 + 1]]);
    const M = [0, 1, 2].map((j) => mid(point[c[j]], point[c[(j + 1) % 3]]));
    const MUV = [0, 1, 2].map((j) => [(UV[j][0] + UV[(j + 1) % 3][0]) / 2, (UV[j][1] + UV[(j + 1) % 3][1]) / 2]);
    // a, ab, ca / ab, b, bc / ca, bc, c / ab, bc, ca: the same winding as the triangle.
    const quads = [[[P[0], UV[0]], [M[0], MUV[0]], [M[2], MUV[2]]], [[M[0], MUV[0]], [P[1], UV[1]], [M[1], MUV[1]]], [[M[2], MUV[2]], [M[1], MUV[1]], [P[2], UV[2]]], [[M[0], MUV[0]], [M[1], MUV[1]], [M[2], MUV[2]]]];
    for (const tri of quads) for (const [q, uv] of tri) emit(q, uv);
  }
  out.index = Array.from({ length: n }, (_, i) => i);
  return out;
}
