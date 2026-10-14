import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Bolt heads, nuts and washers for the vehicle models (TODO 87). Small, so a vehicle's bolts on one material are merged into one
// mesh (`boltsMesh`). The placing is pure (`boltCircle`, `boltRow`, tested). Every bolt stands on y = 0 with its head up (+Y) in its
// own frame, and is turned to face the surface's normal when placed.

export const BOLT_KINDS = ['hex', 'flange', 'dome', 'nut', 'allen'];

/**
 * One bolt head: `size` across the flats in metres; `kind` 'hex' (a plain hex head), 'flange' (hex on a wide collar, as on frames),
 * 'dome' (a round coach bolt or rivet head), 'nut' (a hex nut with the bolt's end through it) or 'allen' (a round cap with a hex
 * socket, as on engine cases); `washer` puts a flat washer under it.
 */
export function boltGeometry({ size = 0.012, kind = 'hex', washer = true } = {}) {
  const parts = [];
  let y = 0;
  const add = (g) => {
    g.deleteAttribute('uv');
    parts.push(g);
  };
  if (washer) {
    add(new THREE.CylinderGeometry(size * 0.95, size * 0.95, size * 0.12, 12).translate(0, size * 0.06, 0));
    y = size * 0.12;
  }
  const hexR = size / Math.sqrt(3); // across the corners from across the flats
  if (kind === 'flange') {
    add(new THREE.CylinderGeometry(size * 0.78, size * 0.78, size * 0.12, 12).translate(0, y + size * 0.06, 0));
    y += size * 0.12;
  }
  if (kind === 'dome') {
    add(new THREE.SphereGeometry(size * 0.6, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1).translate(0, y, 0));
  } else if (kind === 'allen') {
    add(new THREE.CylinderGeometry(size * 0.5, size * 0.52, size * 0.55, 12).translate(0, y + size * 0.275, 0));
    add(new THREE.CylinderGeometry(size * 0.25, size * 0.25, size * 0.04, 6).translate(0, y + size * 0.55, 0)); // the socket, a dark-ish hex
  } else {
    const h = kind === 'nut' ? size * 0.8 : size * 0.65;
    add(new THREE.CylinderGeometry(hexR, hexR, h, 6).translate(0, y + h / 2, 0));
    if (kind === 'nut') add(new THREE.CylinderGeometry(size * 0.3, size * 0.3, size * 0.4, 8).translate(0, y + h + size * 0.2, 0)); // the thread's end
  }
  return mergeGeometries(parts);
}

/** `n` points evenly round a circle of radius `r` in the XY plane (a wheel's nuts, a flange's bolts), starting at `start` radians. */
export function boltCircle(n, r, start = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = start + (i / n) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r, 0];
  });
}

/** `n` points evenly along from `a` to `b` ([x, y, z]), `inset` metres in from each end (a row of rivets or bolts along a seam). */
export function boltRow(a, b, n, inset = 0) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const t0 = len > 0 ? inset / len : 0;
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : t0 + ((1 - 2 * t0) * i) / (n - 1);
    return [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t];
  });
}

const _up = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _spin = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _n = new THREE.Vector3();

/**
 * One mesh of bolts at `points` (in the parent's frame), each head facing `normal` ([x, y, z], or one per point), each hex turned
 * its own way so a row doesn't look stamped. Add it to the part they hold on.
 */
export function boltsMesh(points, normal, material, opts = {}) {
  const one = boltGeometry(opts);
  const geos = points.map((p, i) => {
    const nm = Array.isArray(normal[0]) ? normal[i] : normal;
    _n.set(nm[0], nm[1], nm[2]).normalize();
    _q.setFromUnitVectors(_up, _n);
    _spin.setFromAxisAngle(_up, (i * 2.399) % (Math.PI / 3)); // the golden angle, folded into a hex's sixth
    _q.multiply(_spin);
    return one.clone().applyMatrix4(_m.compose(new THREE.Vector3(p[0], p[1], p[2]), _q, new THREE.Vector3(1, 1, 1)));
  });
  const mesh = new THREE.Mesh(mergeGeometries(geos), material);
  mesh.name = opts.name ?? 'bolts';
  return mesh;
}
