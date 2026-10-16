import * as THREE from 'three';

// Z-fighting finder: two surfaces on the same plane that overlap fight for the same depth and flicker (and show the mud shader's pattern fighting),
// so no two faces of a model that face the same way should lie within `gap` of one plane and overlap. Only axis-aligned faces are looked at (the
// panels, posts and boxes of a body are all square to it). Glass, labels and lamp lenses are left out: they sit on purpose a millimetre off a face
// with a polygon offset, and the wheels and beams are not body.

const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/** Clips polygon `poly` (array of [u, v], counter-clockwise) against the convex counter-clockwise polygon `clip`; returns the clipped polygon. */
function clipPolygon(poly, clip) {
  let out = poly;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j];
      const q = input[(j + 1) % input.length];
      const sp = side(p);
      const sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) {
        const t = sp / (sp - sq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return out;
}

const area = (poly) => {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    s += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(s) / 2;
};

/**
 * Pairs of overlapping coplanar same-facing triangles in a model: [{ a, b, area, at: [x, y, z], axis, dir }], biggest first. `gap` is how close
 * two planes must be to count (metres), `minArea` how much overlap (square metres).
 */
export function coplanarOverlaps(model, { gap = 0.002, minArea = 2e-5, skip = (o) => false, visibleOnly = true } = {}) {
  model.updateMatrixWorld(true);
  const tris = [];
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const n = new THREE.Vector3();
  model.traverse((o) => {
    if (!o.isMesh || !o.visible || o.isSprite) return;
    const m = o.material;
    if (m.transparent || m.map || /^headlight/.test(o.name) || skip(o)) return;
    let p = o;
    while (p) {
      if (/^wheel_/.test(p.name)) return;
      p = p.parent;
    }
    const pos = o.geometry.attributes.position;
    const idx = o.geometry.index;
    const count = idx ? idx.count / 3 : pos.count / 3;
    for (let t = 0; t < count; t++) {
      va.fromBufferAttribute(pos, idx ? idx.getX(t * 3) : t * 3).applyMatrix4(o.matrixWorld);
      vb.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + 1) : t * 3 + 1).applyMatrix4(o.matrixWorld);
      vc.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + 2) : t * 3 + 2).applyMatrix4(o.matrixWorld);
      n.subVectors(vb, va).cross(vc.clone().sub(va));
      const len = n.length();
      if (len < 1e-7) continue;
      n.divideScalar(len);
      const axis = AXES.findIndex((a, i) => Math.abs(n.getComponent(i)) > 0.999);
      if (axis < 0) continue;
      const dir = Math.sign(n.getComponent(axis));
      const [u, v] = [0, 1, 2].filter((i) => i !== axis);
      let pts = [[va.getComponent(u), va.getComponent(v)], [vb.getComponent(u), vb.getComponent(v)], [vc.getComponent(u), vc.getComponent(v)]];
      if (area(pts) < 1e-8) continue;
      // counter-clockwise in (u, v)
      const cross = (pts[1][0] - pts[0][0]) * (pts[2][1] - pts[0][1]) - (pts[1][1] - pts[0][1]) * (pts[2][0] - pts[0][0]);
      if (cross < 0) pts = [pts[0], pts[2], pts[1]];
      tris.push({ axis, dir, d: va.getComponent(axis), pts, name: o.name || o.parent?.name || '-', mesh: o.uuid });
    }
  });
  const buckets = new Map();
  tris.forEach((t, i) => {
    const key = `${t.axis}|${t.dir}|${Math.round(t.d / gap)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(i);
  });
  const found = [];
  for (const [key, list] of buckets) {
    const [axis, dir, k] = key.split('|').map(Number);
    const other = buckets.get(`${axis}|${dir}|${k + 1}`) ?? [];
    const pairs = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) pairs.push([list[i], list[j]]);
      for (const j of other) pairs.push([list[i], j]);
    }
    for (const [i, j] of pairs) {
      const A = tris[i];
      const B = tris[j];
      if (Math.abs(A.d - B.d) > gap) continue;
      const minU = (t) => Math.min(...t.pts.map((p) => p[0]));
      const maxU = (t) => Math.max(...t.pts.map((p) => p[0]));
      const minV = (t) => Math.min(...t.pts.map((p) => p[1]));
      const maxV = (t) => Math.max(...t.pts.map((p) => p[1]));
      if (maxU(A) < minU(B) || maxU(B) < minU(A) || maxV(A) < minV(B) || maxV(B) < minV(A)) continue;
      const clipped = clipPolygon(A.pts, B.pts);
      const a = clipped.length >= 3 ? area(clipped) : 0;
      if (a < minArea) continue;
      const cu = clipped.reduce((s, p) => s + p[0], 0) / clipped.length;
      const cv = clipped.reduce((s, p) => s + p[1], 0) / clipped.length;
      const at = [0, 0, 0];
      const [u, v] = [0, 1, 2].filter((x) => x !== A.axis);
      at[u] = cu;
      at[v] = cv;
      at[A.axis] = A.d;
      found.push({ a: A.name, b: B.name, sameMesh: A.mesh === B.mesh, area: a, at, axis: A.axis, dir: A.dir });
    }
  }
  found.sort((x, y) => y.area - x.area);
  if (!visibleOnly) return found;
  // Only the ones you could see: a ray from 0.6 m out along the face's normal, down onto the overlap's middle, must reach the plane before anything
  // else opaque (a pair of faces inside a joint, behind a panel or inside a box fight in the dark and nobody sees it).
  const meshes = [];
  model.traverse((o) => { if (o.isMesh && o.visible && !o.isSprite && !o.material.transparent && !/^headlight/.test(o.name)) meshes.push(o); });
  const rc = new THREE.Raycaster();
  return found.filter((f) => {
    const dirv = new THREE.Vector3();
    dirv.setComponent(f.axis, -f.dir);
    const origin = new THREE.Vector3(...f.at).addScaledVector(dirv, -0.6);
    rc.set(origin, dirv);
    rc.far = 2;
    const hit = rc.intersectObjects(meshes, false)[0];
    return hit && Math.abs(hit.distance - 0.6) < 0.004;
  });
}
