// Which triangles on her chest face into her (#1143), for her body and for anything she wears over it. Earlier busts turned
// triangles over where they were reshaped (slashes across them in the shots), and a shirt cut from those was pushed into her.
// Positions are flat xyz arrays, three corners a triangle as drawn, all in the same space (figure.js's body frame in the tests). Pure.

/** Where on her a triangle counts: her front between under her bust and her collarbone, in the body frame. */
export const CHEST = { below: 0.38, above: 0.98, across: 0.4, front: 0.05 };

const EPS = 1e-6;

/**
 * Where the ray from `o` in direction `d` crosses each of `tris`' triangles (skipping triangle `skip`): its distance, and `inside`, true
 * when it meets the triangle's back (it was inside the surface).
 */
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
    if (dist > EPS) out.push({ dist, inside: det < 0 });
  }
  return out;
}

/** A triangle's middle and unit normal (as wound), or null for a sliver. */
function face(tris, t) {
  const k = t * 9;
  const ax = tris[k + 3] - tris[k], ay = tris[k + 4] - tris[k + 1], az = tris[k + 5] - tris[k + 2];
  const bx = tris[k + 6] - tris[k], by = tris[k + 7] - tris[k + 1], bz = tris[k + 8] - tris[k + 2];
  const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
  const len = Math.hypot(nx, ny, nz);
  // A sliver (its area under a hundredth of its longest edge squared) has no facing to speak of, and can't be seen either way.
  const longest = Math.max(ax * ax + ay * ay + az * az, bx * bx + by * by + bz * bz, (bx - ax) ** 2 + (by - ay) ** 2 + (bz - az) ** 2);
  if (len < 1e-12 || len / 2 < 0.01 * longest) return null;
  const m = [0, 1, 2].map((j) => (tris[k + j] + tris[k + 3 + j] + tris[k + 6 + j]) / 3);
  // A little off the exact normal, so a ray doesn't run exactly along an edge of the body and count it twice or not at all.
  return { m, n: [nx / len + 1.3e-4, ny / len + 0.7e-4, nz / len - 0.9e-4] };
}

const onChest = ([x, y, z], c) => y > c.below && y < c.above && Math.abs(x) < c.across && z > c.front;

/** Each triangle's area-weighted normal (the cross product of two edges, as wound) and middle. */
function normals(tris) {
  const out = [];
  for (let t = 0; t < tris.length / 9; t++) {
    const k = t * 9;
    const ax = tris[k + 3] - tris[k], ay = tris[k + 4] - tris[k + 1], az = tris[k + 5] - tris[k + 2];
    const bx = tris[k + 6] - tris[k], by = tris[k + 7] - tris[k + 1], bz = tris[k + 8] - tris[k + 2];
    out.push({
      n: [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx],
      m: [0, 1, 2].map((j) => (tris[k + j] + tris[k + 3 + j] + tris[k + 6 + j]) / 3),
    });
  }
  return out;
}

/** The triangles of `tris` on her chest folded over: each points against the triangles on two or three of its edges. */
export function foldedOver(tris, chest) {
  const all = normals(tris);
  const key = (k) => `${Math.round(tris[k] * 1e5)},${Math.round(tris[k + 1] * 1e5)},${Math.round(tris[k + 2] * 1e5)}`;
  const edges = new Map();
  const edgeKeys = (t) => [0, 1, 2].map((e) => [key(t * 9 + e * 3), key(t * 9 + ((e + 1) % 3) * 3)].sort().join('|'));
  for (let t = 0; t < all.length; t++) {
    for (const e of edgeKeys(t)) {
      if (!edges.has(e)) edges.set(e, []);
      edges.get(e).push(t);
    }
  }
  const unit = (n) => {
    const l = Math.hypot(...n) || 1;
    return n.map((v) => v / l);
  };
  const folded = new Set();
  for (let t = 0; t < all.length; t++) {
    const f = face(tris, t);
    if (!f || !onChest(f.m, chest)) continue;
    const n = unit(all[t].n);
    let against = 0;
    for (const e of edgeKeys(t)) {
      for (const u of edges.get(e)) {
        if (u === t || !face(tris, u)) continue;
        const q = unit(all[u].n);
        if (n[0] * q[0] + n[1] * q[1] + n[2] * q[2] < 0) against++;
      }
    }
    if (against >= 2) folded.add(t);
  }
  return folded;
}

/**
 * Whether a ray from `o` along `d` first meets `body` from inside, within `reach` (about 12 cm): `o` is inside her. Further, a ray
 * from cloth under her bust reaches the flap of the model's old shirt hem round her hips and meets it from behind.
 */
export function insideOf(o, d, body, skip = -1, reach = 0.3) {
  const hits = crossings(o, d, body, skip).filter((h) => h.dist < reach);
  if (!hits.length) return false;
  return hits.reduce((a, b) => (b.dist < a.dist ? b : a)).inside;
}

/**
 * Her body's triangles on her chest that face into her, found two ways. A fold: it points against the triangles on two or three of
 * its edges, as the middle sheet of a Z does (one in a crease, like the fold under a breast, points against at most one). Or it is
 * inside her: a ray out along its normal first meets the rest of her from inside. (Counting crossings, odd or even, went wrong where
 * the model is open, as under her old shirt's hem.) Returns their indices.
 */
export function bodyFacingIn(body, chest = CHEST) {
  const folded = foldedOver(body, chest);
  const bad = [];
  for (let t = 0; t < body.length / 9; t++) {
    const f = face(body, t);
    if (!f || !onChest(f.m, chest)) continue;
    if (folded.has(t) || insideOf(f.m.map((v, j) => v + f.n[j] * 1e-5), f.n, body, t)) bad.push(t);
  }
  return bad;
}

/**
 * Whether a set of triangles is a closed solid (every edge shared by two of them), as a button is: its back faces her by design.
 */
export function isClosed(tris) {
  const key = (k) => `${Math.round(tris[k] * 1e5)},${Math.round(tris[k + 1] * 1e5)},${Math.round(tris[k + 2] * 1e5)}`;
  const count = new Map();
  for (let t = 0; t < tris.length / 9; t++) {
    for (let e = 0; e < 3; e++) {
      const edge = [key(t * 9 + e * 3), key(t * 9 + ((e + 1) % 3) * 3)].sort().join('|');
      count.set(edge, (count.get(edge) ?? 0) + 1);
    }
  }
  return count.size > 0 && [...count.values()].every((n) => n >= 2);
}

/**
 * A garment's triangles on her chest that face into her: folded over (as for her body), or inside her (a ray along its normal first
 * meets her body from inside). Cloth bridging a hollow (her cleavage, the fold under a breast) can have her nearer in front of it
 * than behind, and is right. Trim laid on the cloth (buttons, a placket) has a back facing her by design and isn't checked: a
 * closed solid (`isClosed`) is left out here, and the callers leave out the rest by name. Returns their indices.
 */
export function clothFacingIn(cloth, body, chest = CHEST) {
  if (isClosed(cloth)) return [];
  const folded = foldedOver(cloth, chest);
  const bad = [];
  for (let t = 0; t < cloth.length / 9; t++) {
    const f = face(cloth, t);
    if (!f || !onChest(f.m, chest)) continue;
    if (folded.has(t) || insideOf(f.m, f.n, body)) bad.push(t);
  }
  return bad;
}
