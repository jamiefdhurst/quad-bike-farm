import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Procedural geometry for the quads: bent tubes, lofted plastics, fender
// shells, tyres and rims. Everything here is built once when a quad is made.

const v3 = (p) => (p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2]));

/**
 * Points along a polyline with every interior corner replaced by a bend of
 * the given radius, like bent steel tube. Closed paths round every corner.
 */
export function roundPath(corners, bend, steps = 4, closed = false) {
  const P = corners.map(v3);
  const n = P.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = P[i];
    if (!closed && (i === 0 || i === n - 1)) {
      out.push(p);
      continue;
    }
    const a = P[(i - 1 + n) % n].clone().sub(p);
    const b = P[(i + 1) % n].clone().sub(p);
    const r = Math.min(bend, a.length() * 0.48, b.length() * 0.48);
    const s = p.clone().addScaledVector(a.normalize(), r);
    const e = p.clone().addScaledVector(b.normalize(), r);
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const u = 1 - t;
      out.push(new THREE.Vector3().addScaledVector(s, u * u).addScaledVector(p, 2 * u * t).addScaledVector(e, t * t));
    }
  }
  return out;
}

/**
 * A round tube swept along points, with parallel-transported frames so it
 * doesn't twist. `radius` can be a number or a function of (t 0..1, index).
 */
export function sweepGeometry(points, radius, { radial = 8, closed = false, caps = true } = {}) {
  const pts = points.map(v3);
  const n = pts.length;
  const rad = typeof radius === 'function' ? radius : () => radius;
  const T = pts.map((p, i) => {
    const prev = closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)];
    const next = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
    return next.clone().sub(prev).normalize();
  });
  const ref = Math.abs(T[0].y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const N = new THREE.Vector3().crossVectors(T[0], ref).normalize();
  const B = new THREE.Vector3();
  const pos = [];
  const idx = [];
  for (let i = 0; i < n; i++) {
    if (i > 0) N.addScaledVector(T[i], -N.dot(T[i])).normalize();
    B.crossVectors(T[i], N);
    const r = rad(n > 1 ? i / (n - 1) : 0, i);
    for (let k = 0; k < radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      const c = Math.cos(a) * r;
      const s = Math.sin(a) * r;
      pos.push(pts[i].x + c * N.x + s * B.x, pts[i].y + c * N.y + s * B.y, pts[i].z + c * N.z + s * B.z);
    }
  }
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const i2 = (i + 1) % n;
    for (let k = 0; k < radial; k++) {
      const k2 = (k + 1) % radial;
      const a = i * radial + k;
      const b = i2 * radial + k;
      const c = i2 * radial + k2;
      const d = i * radial + k2;
      idx.push(a, d, b, b, d, c);
    }
  }
  if (!closed && caps) {
    // Flat end caps on their own vertices so they shade flat.
    for (const [ring, flip] of [[0, true], [n - 1, false]]) {
      const base = pos.length / 3;
      const p = pts[ring];
      pos.push(p.x, p.y, p.z);
      for (let k = 0; k < radial; k++) pos.push(pos[(ring * radial + k) * 3], pos[(ring * radial + k) * 3 + 1], pos[(ring * radial + k) * 3 + 2]);
      for (let k = 0; k < radial; k++) {
        const a = base + 1 + k;
        const b = base + 1 + ((k + 1) % radial);
        if (flip) idx.push(base, b, a);
        else idx.push(base, a, b);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** A bent tube through the corner points, with rounded bends. */
export function bentTube(corners, r, { bend = 0.05, steps = 4, closed = false, radial = 8 } = {}) {
  return sweepGeometry(roundPath(corners, bend, steps, closed), r, { radial, closed });
}

/** A straight tube between two points. */
export function rod(a, b, r, radial = 8) {
  return sweepGeometry([a, b], r, { radial });
}

/**
 * Lofts rounded-rectangle sections along Z. Each station is
 * { z, w, y0, y1, x = 0, e = exponent, eb = bottom exponent }; a higher
 * exponent is squarer. `bottom` sets the lower half's exponent for every
 * station. The ends are capped.
 */
export function loftGeometry(stations, { segments = 24, exponent = 4, bottom } = {}) {
  const pos = [];
  const idx = [];
  const n = stations.length;
  const ring = (st) => {
    const out = [];
    const cx = st.x ?? 0;
    const cy = (st.y0 + st.y1) / 2;
    const hw = st.w / 2;
    const hh = (st.y1 - st.y0) / 2;
    for (let k = 0; k < segments; k++) {
      const a = (k / segments) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const e = s >= 0 ? st.e ?? exponent : st.eb ?? bottom ?? st.e ?? exponent;
      const px = cx + hw * Math.sign(c) * Math.abs(c) ** (2 / e);
      const py = cy + hh * Math.sign(s) * Math.abs(s) ** (2 / e);
      out.push(px, py, st.z);
    }
    return out;
  };
  for (const st of stations) pos.push(...ring(st));
  const forward = stations[n - 1].z > stations[0].z;
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < segments; k++) {
      const k2 = (k + 1) % segments;
      const a = i * segments + k;
      const b = (i + 1) * segments + k;
      const c = (i + 1) * segments + k2;
      const d = i * segments + k2;
      if (forward) idx.push(a, d, b, b, d, c);
      else idx.push(a, b, d, b, c, d);
    }
  }
  for (const [si, start] of [[0, true], [n - 1, false]]) {
    const st = stations[si];
    const base = pos.length / 3;
    pos.push(st.x ?? 0, (st.y0 + st.y1) / 2, st.z);
    pos.push(...ring(st));
    for (let k = 0; k < segments; k++) {
      const a = base + 1 + k;
      const b = base + 1 + ((k + 1) % segments);
      if (start === forward) idx.push(base, b, a);
      else idx.push(base, a, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/**
 * A moulded fender: a cross-section swept along a side profile around a
 * wheel. `profile` is [[z, y], ...] relative to the wheel centre, front to
 * back. `section` is [[t, drop], ...] across the width, t from 0 (inner edge
 * at xIn) to 1 (outer edge at xOut), drop measured towards the wheel. Over
 * the first and last `taper` of its length the shell narrows to `taperTo`
 * of its width, so the ends come out rounded. Use a double-sided material.
 */
export function shellGeometry(profile, section, xIn, xOut, { samples = 32, taper = 0.2, taperTo = 0.7 } = {}) {
  const curve = new THREE.CatmullRomCurve3(profile.map(([z, y]) => new THREE.Vector3(0, y, z)), false, 'centripetal');
  const P = curve.getSpacedPoints(samples);
  const pos = [];
  const idx = [];
  const m = section.length;
  const n = new THREE.Vector3();
  const mid = (xIn + xOut) / 2;
  const ease = (k) => k * k * (3 - 2 * k);
  for (let i = 0; i < P.length; i++) {
    const u = i / (P.length - 1);
    const end = Math.min(u, 1 - u);
    const f = end >= taper ? 1 : taperTo + (1 - taperTo) * Math.sqrt(ease(end / taper));
    const a = P[Math.max(0, i - 1)];
    const b = P[Math.min(P.length - 1, i + 1)];
    n.set(0, b.z - a.z, -(b.y - a.y)).normalize();
    if (n.dot(P[i]) < 0) n.negate();
    for (const [t, drop] of section) {
      const x = mid + (xIn + (xOut - xIn) * t - mid) * f;
      const d = drop * f;
      pos.push(x, P[i].y - n.y * d, P[i].z - n.z * d);
    }
  }
  for (let i = 0; i < P.length - 1; i++) {
    for (let j = 0; j < m - 1; j++) {
      const a = i * m + j;
      const b = (i + 1) * m + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Lathe around +Y from [[radius, y], ...]. */
export function lathe(points, segments = 24) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);
}

/** Box with its top face shrunk, for tread blocks and ribs. */
export function taperedBox(w, h, d, taper) {
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0) {
      p.setX(i, p.getX(i) * taper);
      p.setZ(i, p.getZ(i) * taper);
    }
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Wheel rim, axle along X, dished towards `side` (+1 = +X). Returns
 * { rim, dark } where dark holds the vent holes and the centre recess.
 */
export function rimGeometry(rimR, width, side, { holes = 5, spokes = false } = {}) {
  const h = width / 2;
  const face = h - 0.035;
  const g = lathe(
    [
      [rimR + 0.014, -h * 0.84],
      [rimR + 0.002, -h * 0.8],
      [rimR - 0.006, -h * 0.66],
      [rimR - 0.02, -h * 0.5],
      [rimR - 0.02, h * 0.4],
      [rimR - 0.006, h * 0.62],
      [rimR + 0.002, h * 0.8],
      [rimR + 0.014, h * 0.84],
      [rimR + 0.006, h * 0.87],
      [rimR - 0.014, h * 0.8],
      [rimR - 0.035, face],
      [0.075, face - 0.004],
      [0.06, face + 0.012],
      [0.045, face + 0.016],
      [0.03, face + 0.022],
      [0.0, face + 0.026],
    ],
    28,
  );
  const dark = [];
  const nuts = [];
  if (spokes) {
    // Cast wheel: dark pockets between six spokes.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const pocket = new THREE.CircleGeometry(0.026, 10);
      pocket.scale(1, 1.5, 1);
      pocket.applyMatrix4(new THREE.Matrix4().makeRotationZ(a));
      pocket.rotateX(-Math.PI / 2);
      pocket.translate(Math.sin(a) * 0.1, face - 0.002 + 0.0035, Math.cos(a) * 0.1);
      dark.push(pocket);
    }
  } else {
    for (let i = 0; i < holes; i++) {
      const a = (i / holes) * Math.PI * 2;
      const hole = new THREE.CircleGeometry(0.019, 10);
      hole.rotateX(-Math.PI / 2);
      hole.translate(Math.sin(a) * 0.1, face - 0.002 + 0.0035, Math.cos(a) * 0.1);
      dark.push(hole);
    }
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const nut = new THREE.CylinderGeometry(0.009, 0.009, 0.014, 6);
    nut.translate(Math.sin(a) * 0.052, face + 0.02, Math.cos(a) * 0.052);
    nuts.push(nut);
  }
  const cap = new THREE.CylinderGeometry(0.022, 0.026, 0.02, 12);
  cap.translate(0, face + 0.03, 0);
  nuts.push(cap);
  const out = {
    rim: stripUv(g),
    dark: mergeGeometries(dark.map(stripUv)),
    nuts: mergeGeometries(nuts.map(stripUv)),
  };
  for (const k in out) out[k].rotateZ(side > 0 ? -Math.PI / 2 : Math.PI / 2);
  return out;
}

/** Concertina rubber boot along +Y from 0 to len. */
export function bootGeometry(len, r0, r1, ribs = 5) {
  const pts = [];
  const n = ribs * 2;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const r = r0 + (r1 - r0) * t;
    pts.push([i % 2 ? r * 1.25 : r, t * len]);
  }
  return lathe(pts, 12);
}

/** Coil spring along -Y from 0 to -len. */
export function springGeometry(len, coilR, wireR, turns = 6) {
  const pts = [];
  const steps = turns * 10;
  for (let i = 0; i <= steps; i++) {
    const a = (i / 10) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * coilR, -(i / steps) * len, Math.sin(a) * coilR));
  }
  return sweepGeometry(pts, wireR, { radial: 6, caps: false });
}

/** Ribbed handlebar grip along +Y from 0 to len, with a flange at the inner end. */
export function gripGeometry(len, r) {
  const pts = [[0.001, 0], [r * 1.5, 0], [r * 1.5, 0.008], [r * 1.05, 0.012]];
  const ribs = 9;
  for (let i = 0; i <= ribs; i++) {
    const y = 0.016 + ((len - 0.03) * i) / ribs;
    pts.push([i % 2 ? r : r * 1.1, y]);
  }
  pts.push([r * 1.1, len - 0.006], [r * 0.8, len], [0.001, len]);
  return lathe(pts, 12);
}

function stripUv(g) {
  g.deleteAttribute('uv');
  if (!g.index) {
    const n = g.attributes.position.count;
    g.setIndex(Array.from({ length: n }, (_, i) => i));
  }
  return g;
}

/**
 * Merges the unnamed, untextured meshes under `container` into one mesh per
 * material, to save draw calls. Subtrees flagged userData.keep (moving
 * parts) and named meshes are left alone.
 */
export function mergeStatic(container) {
  container.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(container.matrixWorld).invert();
  const byMat = new Map();
  const victims = [];
  const visit = (o) => {
    for (const c of o.children) {
      if (c.userData.keep) continue;
      if (c.isMesh && !c.name && !Array.isArray(c.material) && !c.material.map) {
        const g = c.geometry.clone();
        stripUv(g);
        for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld));
        if (!byMat.has(c.material)) byMat.set(c.material, []);
        byMat.get(c.material).push(g);
        victims.push(c);
      }
      visit(c);
    }
  };
  visit(container);
  for (const c of victims) c.removeFromParent();
  for (const [mat, geos] of byMat) container.add(new THREE.Mesh(mergeGeometries(geos), mat));
}
