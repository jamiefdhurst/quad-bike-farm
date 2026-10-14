import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { sweepGeometry } from '../quadGeometry.js';

// Cables and hoses for the vehicle models (TODO 87): throttle and brake cables from the bars, wiring looms, fuel and coolant hoses,
// hydraulic pipes. A cable runs through the points it's clipped to and sags a little between them under its own weight (`cablePath`,
// pure, tested); it is swept into a tube along that. Points are [x, y, z] in the frame of the part it's fixed to.

/**
 * The centre line through `anchors`, smooth (a centripetal Catmull-Rom curve, so it doesn't overshoot at tight clips) with each span
 * sagging by `sag` of its length at its middle. `steps` points per span. Returns [[x, y, z], ...] starting and ending on the anchors.
 */
export function cablePath(anchors, { sag = 0.04, steps = 8 } = {}) {
  if (anchors.length < 2) throw new Error('A cable needs two ends');
  const pts = anchors.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const spans = pts.length - 1;
  // Where along the curve each anchor falls, by the curve's own parameter (it is spaced by chord length to the power 0.5).
  const out = [];
  const lengths = [];
  for (let i = 0; i < spans; i++) lengths.push(pts[i].distanceTo(pts[i + 1]));
  for (let i = 0; i < spans; i++) {
    for (let k = i === 0 ? 0 : 1; k <= steps; k++) {
      const u = (i + k / steps) / spans;
      const p = curve.getPoint(u);
      const s = k / steps;
      p.y -= 4 * s * (1 - s) * sag * lengths[i];
      out.push([p.x, p.y, p.z]);
    }
  }
  return out;
}

/** A cable or thin pipe of radius `r` through `anchors`. Options as `cablePath`, plus `radial` sides. */
export function cableGeometry(anchors, r, { sag = 0.04, steps = 8, radial = 6 } = {}) {
  return sweepGeometry(cablePath(anchors, { sag, steps }), r, { radial });
}

/**
 * A hose of radius `r` through `anchors`: rubber that sags less than a cable, optionally `ribbed` (a corrugated coolant or air hose),
 * with a worm-drive clamp at each end. Returns { hose, clamps } to take a rubber and a steel material.
 */
export function hoseGeometry(anchors, r, { sag = 0.015, steps = 10, radial = 10, ribbed = false, clamps = true } = {}) {
  const path = cablePath(anchors, { sag, steps });
  const radius = ribbed ? (t, i) => r * (i % 2 ? 0.88 : 1) : r;
  const hose = sweepGeometry(ribbed ? densify(path, 3) : path, radius, { radial });
  if (!clamps) return { hose, clamps: null };
  const bands = [];
  for (const [at, next] of [[path[0], path[1]], [path[path.length - 1], path[path.length - 2]]]) {
    const a = new THREE.Vector3(...at);
    const dir = new THREE.Vector3(...next).sub(a).normalize();
    const c = a.clone().addScaledVector(dir, r * 1.2);
    const band = new THREE.CylinderGeometry(r * 1.18, r * 1.18, r * 0.7, radial).translate(0, 0, 0);
    band.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    band.translate(c.x, c.y, c.z);
    band.deleteAttribute('uv');
    bands.push(band);
  }
  return { hose, clamps: mergeGeometries(bands) };
}

/** Each span cut into `n`, so a ribbed hose has ribs closer than its path's points. */
function densify(path, n) {
  const out = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, a[2] + ((b[2] - a[2]) * k) / n]);
  }
  return out;
}

/** How long a path is: for checking a cable reaches without stretching. */
export function pathLength(path) {
  let len = 0;
  for (let i = 1; i < path.length; i++) len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]);
  return len;
}
