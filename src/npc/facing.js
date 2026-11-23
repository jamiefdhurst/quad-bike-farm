// Which triangles on her chest face into her (#1143), for her body and for anything she wears over it. Earlier busts turned
// triangles over where they were reshaped (slashes across them in the shots), and a shirt cut from those was pushed into her.
// Positions are flat xyz arrays, three corners a triangle as drawn, all in the same space (figure.js's body frame in the tests). Pure.

/** Where on her a triangle counts: her front between under her bust and her collarbone, in the body frame. */
export const CHEST = { below: 0.38, above: 0.98, across: 0.4, front: 0.05 };

const EPS = 1e-6;

/** Distances along the ray from `o` in direction `d` at which it crosses each of `tris`' triangles (skipping triangle `skip`). */
function crossings(o, d, tris, skip = -1) {
  const out = [];
  for (let t = 0; t < tris.length / 9; t++) {
    if (t === skip) continue;
    const k = t * 9;
    const e1x = tris[k + 3] - tris[k], e1y = tris[k + 4] - tris[k + 1], e1z = tris[k + 5] - tris[k + 2];
    const e2x = tris[k + 6] - tris[k], e2y = tris[k + 7] - tris[k + 1], e2z = tris[k + 8] - tris[k + 2];
    const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-14) continue;
    const inv = 1 / det;
    const sx = o[0] - tris[k], sy = o[1] - tris[k + 1], sz = o[2] - tris[k + 2];
    const u = (sx * px + sy * py + sz * pz) * inv;
    if (u < 0 || u > 1) continue;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
    const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
    if (v < 0 || u + v > 1) continue;
    const dist = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (dist > EPS) out.push(dist);
  }
  return out;
}

/** A triangle's middle and unit normal (as wound), or null for a sliver with no facing to speak of. */
function face(tris, t) {
  const k = t * 9;
  const ax = tris[k + 3] - tris[k], ay = tris[k + 4] - tris[k + 1], az = tris[k + 5] - tris[k + 2];
  const bx = tris[k + 6] - tris[k], by = tris[k + 7] - tris[k + 1], bz = tris[k + 8] - tris[k + 2];
  const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-12) return null;
  const m = [0, 1, 2].map((j) => (tris[k + j] + tris[k + 3 + j] + tris[k + 6 + j]) / 3);
  // A little off the exact normal, so a ray doesn't run exactly along an edge of the body and count it twice or not at all.
  return { m, n: [nx / len + 1.3e-4, ny / len + 0.7e-4, nz / len - 0.9e-4] };
}

const onChest = ([x, y, z], c) => y > c.below && y < c.above && Math.abs(x) < c.across && z > c.front;

/**
 * Her body's triangles on her chest that face into her: a ray out along a triangle's normal crosses the rest of her body an odd
 * number of times only if it starts out going into her. Returns their indices.
 */
export function bodyFacingIn(body, chest = CHEST) {
  const bad = [];
  for (let t = 0; t < body.length / 9; t++) {
    const f = face(body, t);
    if (!f || !onChest(f.m, chest)) continue;
    const o = f.m.map((v, j) => v + f.n[j] * 1e-5);
    if (crossings(o, f.n, body, t).length % 2) bad.push(t);
  }
  return bad;
}

/**
 * A garment's triangles on her chest that face into her: her body is nearer in front of it, along its normal, than behind it.
 * `cloth` and `body` as for bodyFacingIn. Returns their indices.
 */
export function clothFacingIn(cloth, body, chest = CHEST) {
  const bad = [];
  for (let t = 0; t < cloth.length / 9; t++) {
    const f = face(cloth, t);
    if (!f || !onChest(f.m, chest)) continue;
    const ahead = Math.min(Infinity, ...crossings(f.m, f.n, body));
    if (ahead === Infinity) continue;
    const behind = Math.min(Infinity, ...crossings(f.m, f.n.map((v) => -v), body));
    if (ahead < behind) bad.push(t);
  }
  return bad;
}
