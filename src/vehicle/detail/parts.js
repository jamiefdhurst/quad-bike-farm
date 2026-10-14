import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Small helpers and a default palette shared by the cab and interior kit (TODO 340). Every builder takes `mats` to override any of
// these, so a vehicle can give its seats its own vinyl or its switches its own plastic; the mud coat copies them per vehicle.

let palette = null;

/** The kit's default materials, made once. */
export function cabMats() {
  if (palette) return palette;
  const std = (color, roughness, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  palette = {
    plastic: std(0x1c1d1f, 0.7), // black moulded plastic
    greyPlastic: std(0x55585c, 0.65),
    bakelite: std(0x161210, 0.35), // an old hard steering wheel rim or knob
    vinyl: std(0x232323, 0.55), // seat vinyl
    leather: std(0x1a1a1a, 0.6),
    rubber: std(0x151515, 0.9),
    webbing: std(0x34373b, 0.9), // seat belt
    chrome: std(0xd8dadc, 0.14, 1),
    steel: std(0x6c7074, 0.45, 0.7),
    paintedSteel: std(0x2a2b2d, 0.5, 0.35),
    alloy: std(0xb9bcbf, 0.32, 0.85),
    red: std(0xc01818, 0.45),
    glass: std(0x9fb4bd, 0.05, 0.1, { transparent: true, opacity: 0.35 }),
    mirror: std(0xc8d2d8, 0.04, 1),
    reflector: std(0xe6e6e6, 0.1, 1),
    lensClear: std(0xf2f4f5, 0.08, 0, { transparent: true, opacity: 0.55 }),
    lensAmber: std(0xff8a1a, 0.15, 0, { transparent: true, opacity: 0.8 }),
    lensRed: std(0xb3120c, 0.15, 0, { transparent: true, opacity: 0.85 }),
    dark: std(0x0b0b0b, 0.9), // the dark behind slots and holes
  };
  return palette;
}

/** A rounded box geometry, the corner radius kept inside the box. */
export function rounded(w, h, d, r, segments = 2) {
  const g = new RoundedBoxGeometry(w, h, d, segments, Math.max(1e-4, Math.min(r, Math.min(w, h, d) / 2 - 1e-4)));
  g.deleteAttribute('uv');
  return g;
}

/** Merges geometries whatever their attributes and indexing (keeps position and normal only). */
export function merge(geos) {
  const list = geos.filter(Boolean).map((g) => {
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    return g;
  });
  const mixed = list.some((g) => g.index) && list.some((g) => !g.index);
  return mergeGeometries(mixed ? list.map((g) => (g.index ? g.toNonIndexed() : g)) : list);
}

/** A mesh of `geo` in `mat`, added to `parent`, named if given (a named mesh isn't merged away by mergeStatic). */
export function mesh(geo, mat, parent, name) {
  const m = new THREE.Mesh(geo, mat);
  if (name) m.name = name;
  if (parent) parent.add(m);
  return m;
}

/** A group that mergeStatic leaves alone (a moving part). */
export function keepGroup(name) {
  const g = new THREE.Group();
  if (name) g.name = name;
  g.userData.keep = true;
  return g;
}
