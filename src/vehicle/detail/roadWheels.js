import * as THREE from 'three';
import { cabMats, merge, mesh } from './parts.js';
import { boltCircle } from './fixings.js';
import { lathe } from '../quadGeometry.js';

// Road wheels (TODO 340): a pressed steel wheel (plain, or with slots or round holes round its face), a domed hubcap, a full plastic
// trim, and alloys in a few patterns. Axle along X, centred on the hub; `side` +1 is outboard to +X. They go in the wheel's `spin`
// group under the kit's tyre (tread.js). The spoke pattern of an alloy and the holes of a steel wheel are pure (tested).

export const ROAD_WHEEL_KINDS = ['steel', 'slots', 'holes', 'hubcap', 'trim', 'alloy'];

/** Where the holes or slots in a steel wheel's face go: `n` centres round a circle of radius `r` (in the YZ plane), offset half a pitch from the nuts. */
export function faceOpenings(n, r) {
  return boltCircle(n, r, Math.PI / n).map(([a, b]) => [0, a, b]);
}

/** An alloy's spokes: `n` of them, each { angle, width (radians at the rim), split (a twin spoke) } for `style` 'star', 'twin' or 'turbine'. */
export function alloySpokes(style, n = 5) {
  const angles = Array.from({ length: n }, (_, i) => (i / n) * Math.PI * 2);
  if (style === 'star') return angles.map((angle) => ({ angle, width: 0.32, split: false }));
  if (style === 'twin') return angles.map((angle) => ({ angle, width: 0.4, split: true }));
  if (style === 'turbine') return Array.from({ length: n * 3 }, (_, i) => ({ angle: (i / (n * 3)) * Math.PI * 2, width: 0.12, split: false, twist: 0.4 }));
  throw new Error(`Unknown alloy style: ${style}`);
}

/**
 * A road wheel of `kind` with a rim of radius `rimR` (the tyre's bead) and `width`. Options: `side`, `nuts` (4 or 5), `style` for an
 * alloy ('star', 'twin', 'turbine'), `spokes`. Returns a group; mats: `rim` (the steel or alloy), `cap`, `trim`.
 */
export function buildRoadWheel(kind = 'steel', { rimR = 0.165, width = 0.14, side = 1, nuts = 4, style = 'star', spokes = 5, mats = {} } = {}) {
  if (!ROAD_WHEEL_KINDS.includes(kind)) throw new Error(`Unknown road wheel: ${kind}`);
  const m = { ...cabMats(), ...mats };
  const g = new THREE.Group();
  g.name = `roadWheel_${kind}`;
  const rimMat = mats.rim ?? (kind === 'alloy' ? m.alloy : m.paintedSteel);
  const face = side * (width / 2 - 0.02); // the face sits in a little from the outer flange
  // The barrel and its two flanges.
  const barrel = [new THREE.CylinderGeometry(rimR - 0.005, rimR - 0.005, width, 32, 1, true).rotateZ(Math.PI / 2)];
  for (const s of [-1, 1]) barrel.push(new THREE.TorusGeometry(rimR, 0.007, 6, 32).rotateY(Math.PI / 2).translate((s * width) / 2, 0, 0));
  mesh(merge(barrel), rimMat, g, 'wheelBarrel');
  const dark = [];
  if (kind === 'alloy') {
    const ring = lathe([[rimR * 0.98, 0], [rimR * 0.85, side * 0.01], [rimR * 0.3, side * 0.03], [rimR * 0.18, side * 0.035]], 32).rotateZ(-Math.PI / 2).translate(face, 0, 0);
    const parts = [ring, new THREE.CylinderGeometry(rimR * 0.22, rimR * 0.22, 0.04, 20).rotateZ(Math.PI / 2).translate(face + side * 0.015, 0, 0)];
    for (const sp of alloySpokes(style, spokes)) {
      for (const k of sp.split ? [-0.09, 0.09] : [0]) {
        const a = sp.angle + k;
        const len = rimR * 0.78;
        const geo = new THREE.BoxGeometry(0.018, len, sp.split ? 0.016 : rimR * sp.width * 0.5);
        geo.deleteAttribute('uv');
        geo.translate(0, rimR * 0.2 + len / 2, 0);
        if (sp.twist) geo.rotateY(sp.twist);
        geo.rotateX(a);
        geo.translate(face + side * 0.012, 0, 0);
        parts.push(geo);
      }
    }
    mesh(merge(parts), rimMat, g, 'wheelFace');
    dark.push(new THREE.CylinderGeometry(rimR * 0.97, rimR * 0.97, 0.004, 32).rotateZ(Math.PI / 2).translate(face - side * 0.01, 0, 0));
  } else {
    // A pressed steel disc, dished out to the hub, with its openings dark behind.
    mesh(lathe([[rimR * 0.98, 0], [rimR * 0.7, side * 0.006], [rimR * 0.5, side * 0.022], [rimR * 0.32, side * 0.024], [rimR * 0.3, side * 0.03], [0.001, side * 0.03]], 32).rotateZ(-Math.PI / 2).translate(face, 0, 0), rimMat, g, 'wheelFace');
    if (kind === 'slots' || kind === 'holes') {
      for (const p of faceOpenings(kind === 'slots' ? 8 : 6, rimR * 0.62)) {
        const hole = kind === 'slots' ? new THREE.BoxGeometry(0.004, 0.018, 0.04) : new THREE.CylinderGeometry(rimR * 0.1, rimR * 0.1, 0.004, 14).rotateZ(Math.PI / 2);
        hole.deleteAttribute('uv');
        if (kind === 'slots') hole.rotateX(Math.atan2(p[2], p[1]));
        hole.translate(face + side * 0.008, p[1], p[2]);
        dark.push(hole);
      }
    }
  }
  if (dark.length) mesh(merge(dark), m.dark, g, 'wheelDark');
  // The nuts, then whatever covers the middle.
  const nutGeo = boltCircle(nuts, rimR * 0.28).map(([y, z]) => new THREE.CylinderGeometry(0.009, 0.009, 0.014, 6).rotateZ(Math.PI / 2).translate(face + side * 0.035, y, z));
  if (kind !== 'trim' && kind !== 'hubcap') mesh(merge(nutGeo), m.steel, g, 'wheelNuts');
  if (kind === 'hubcap' || kind === 'trim') {
    const capR = kind === 'trim' ? rimR * 1.02 : rimR * 0.45;
    const prof = kind === 'trim' ? [[capR, 0], [capR * 0.92, side * 0.012], [capR * 0.55, side * 0.022], [capR * 0.3, side * 0.03], [0.001, side * 0.034]] : [[capR, 0], [capR * 0.85, side * 0.02], [capR * 0.4, side * 0.035], [0.001, side * 0.038]];
    mesh(lathe(prof, 28).rotateZ(-Math.PI / 2).translate(face + side * 0.03, 0, 0), mats.cap ?? (kind === 'trim' ? m.greyPlastic : m.chrome), g, 'wheelCap');
    if (kind === 'trim') {
      const vents = faceOpenings(10, capR * 0.75).map((p) => {
        const v = new THREE.BoxGeometry(0.003, 0.012, 0.035);
        v.deleteAttribute('uv');
        v.rotateX(Math.atan2(p[2], p[1]));
        return v.translate(face + side * 0.042, p[1], p[2]);
      });
      mesh(merge(vents), m.dark, g, 'trimVents');
    }
  }
  return g;
}
