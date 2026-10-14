import * as THREE from 'three';
import { cabMats, merge, mesh, rounded } from './parts.js';
import { lathe } from '../quadGeometry.js';

// Lamps for the vehicles (TODO 340): round and rectangular headlamps with a reflector behind a fluted lens, indicators, tail
// clusters and a work lamp. Each faces +Z with its lens's front at about z = 0 and the body behind. The lens is a mesh named
// 'lens' (or 'lens_<part>' on a tail cluster), so the vehicle's light code can light it. The reflector's shape and the lens's
// fluting pattern are pure (tested).

export const LAMP_KINDS = ['round', 'rect', 'indicator', 'tail', 'work'];

/** A parabolic reflector's profile: [[r, z], ...] from the bulb hole out to the rim, `depth` deep, for a lathe. */
export function reflectorProfile(r, depth, n = 8) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = 0.12 + (0.88 * i) / n;
    return [r * t, -depth * (1 - t * t)];
  });
}

/** The lens's fluting: `rows` by `cols` cells, each a little prism, as a list of [x, y] centres in -0.5..0.5. */
export function lensFlutes(rows, cols) {
  const out = [];
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) out.push([(j + 0.5) / cols - 0.5, (i + 0.5) / rows - 0.5]);
  return out;
}

const lensTextures = new Map();
/** A lens's fluted face drawn on a canvas, shared by kind: vertical prisms on a headlamp, a grid on a tail lamp. */
function lensTexture(kind) {
  if (lensTextures.has(kind)) return lensTextures.get(kind);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 128);
  const [rows, cols] = kind === 'tail' || kind === 'indicator' ? [8, 8] : [3, 12];
  for (const [x, y] of lensFlutes(rows, cols)) {
    const cx = (x + 0.5) * 128;
    const cy = (y + 0.5) * 128;
    const w = 128 / cols;
    const h = 128 / rows;
    const grad = g.createLinearGradient(cx - w / 2, cy, cx + w / 2, cy);
    grad.addColorStop(0, '#d8d8d8');
    grad.addColorStop(0.5, '#ffffff');
    grad.addColorStop(1, '#bcbcbc');
    g.fillStyle = grad;
    g.fillRect(cx - w / 2 + 1, cy - h / 2 + 1, w - 2, h - 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  lensTextures.set(kind, tex);
  return tex;
}

/** A lens material of `base` with the fluting of `kind`: kept apart from the palette's so the light code can set its emissive. */
function lensMaterial(base, kind) {
  const mat = base.clone();
  mat.map = lensTexture(kind);
  return mat;
}

/**
 * A lamp of `kind`: 'round' (a 7-inch headlamp in a chrome ring: `r`), 'rect' (a rectangular headlamp: `w`, `h`), 'indicator' (a
 * small amber lamp), 'tail' (a cluster of red, amber and clear: `w`, `h`), 'work' (a square work lamp on a bracket). Returns a group.
 */
export function buildLamp(kind = 'round', { r = 0.09, w = 0.18, h = 0.11, mats = {} } = {}) {
  const m = { ...cabMats(), ...mats };
  const g = new THREE.Group();
  g.name = `lamp_${kind}`;
  if (kind === 'round' || kind === 'work') {
    const rr = kind === 'work' ? 0.06 : r;
    const depth = rr * 0.7;
    mesh(lathe(reflectorProfile(rr * 0.96, depth), 24).rotateX(Math.PI / 2).translate(0, 0, -0.004), m.reflector, g, 'reflector');
    mesh(new THREE.CylinderGeometry(rr * 1.02, rr * 0.85, depth + 0.02, 24, 1, true).rotateX(Math.PI / 2).translate(0, 0, -depth / 2 - 0.01), mats.body ?? m.paintedSteel, g, 'lampBody');
    mesh(new THREE.TorusGeometry(rr * 1.0, rr * 0.06, 6, 28), mats.rim ?? m.chrome, g, 'lampRim');
    const lens = new THREE.SphereGeometry(rr * 2.2, 24, 4, 0, Math.PI * 2, 0, 0.47).rotateX(Math.PI / 2).translate(0, 0, -rr * 2.2 * Math.cos(0.47) + 0.002);
    mesh(lens, lensMaterial(mats.lens ?? m.lensClear, 'round'), g, 'lens');
    if (kind === 'work') mesh(merge([rounded(0.03, 0.08, 0.02, 0.004).translate(0, -0.08, -0.04), new THREE.CylinderGeometry(0.008, 0.008, 0.05, 8).rotateZ(Math.PI / 2).translate(0, -0.05, -0.04)]), m.steel, g, 'lampBracket');
  } else if (kind === 'rect') {
    mesh(rounded(w, h, 0.06, 0.012).translate(0, 0, -0.035), mats.body ?? m.plastic, g, 'lampBody');
    mesh(rounded(w * 0.92, h * 0.86, 0.02, 0.01).translate(0, 0, -0.02), m.reflector, g, 'reflector');
    mesh(rounded(w * 0.94, h * 0.88, 0.006, 0.008), lensMaterial(mats.lens ?? m.lensClear, 'rect'), g, 'lens');
  } else if (kind === 'indicator') {
    mesh(rounded(0.06, 0.035, 0.03, 0.01).translate(0, 0, -0.015), mats.body ?? m.plastic, g, 'lampBody');
    mesh(rounded(0.056, 0.031, 0.008, 0.009).translate(0, 0, 0.001), lensMaterial(mats.lens ?? m.lensAmber, 'indicator'), g, 'lens');
  } else if (kind === 'tail') {
    mesh(rounded(w, h, 0.05, 0.01).translate(0, 0, -0.026), mats.body ?? m.plastic, g, 'lampBody');
    // Red down the outer half, amber over clear down the inner half.
    for (const [name, mat, x, y, ph] of [['red', m.lensRed, -0.25, 0, h], ['amber', m.lensAmber, 0.25, h / 4, h / 2], ['clear', m.lensClear, 0.25, -h / 4, h / 2]]) {
      mesh(rounded(w * 0.47, ph - 0.006, 0.008, 0.005).translate(x * w, y, 0.001), lensMaterial(mats[`lens_${name}`] ?? mat, 'tail'), g, `lens_${name}`);
    }
  } else {
    throw new Error(`Unknown lamp: ${kind}`);
  }
  return g;
}
