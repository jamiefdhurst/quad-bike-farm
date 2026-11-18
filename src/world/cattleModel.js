// A Holstein Friesian dairy cow, black and white (#569): the neighbour's herd, scenery in her fields now and walking her lane later (#714). Built from
// ellipsoids and tubes at a real cow's size (about 1.45 m at the shoulder and 2.4 m from chest to tail), her patches laid in vertex colours so one
// merged mesh carries every colour and many cows are one instanced draw. She faces +z and stands on y = 0.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { tiledInstances, MODEL_TILE } from './tiledInstances.js';

const BLACK = [0.07, 0.07, 0.075];
const WHITE = [0.86, 0.85, 0.8];
const PINK = [0.78, 0.55, 0.52];
const DARK = [0.1, 0.09, 0.08];
const HOOF = [0.12, 0.1, 0.09];

/** How many patterns of patches a herd has (cow `variant` 0 to 2): no two neighbours alike is enough for scenery. */
export const COW_VARIANTS = 3;

const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 0..1 patchiness at a point of the body: a few big blotches (sums of waves at odd angles), per variant. */
function patches(x, y, z, variant) {
  const p = variant * 1.7;
  const n = Math.sin(x * 5.3 + z * 2.1 + p) * Math.sin(y * 4.1 - z * 3.7 + p * 2) + Math.sin(z * 4.3 + x * 1.9 - p) * 0.8 + Math.sin(y * 6.1 + x * 2.9 + z * 1.3 + p) * 0.45;
  return smooth(-0.15, 0.15, n);
}

/** Paints a geometry's vertex colours: `fn(x, y, z)` gives [r, g, b] for each vertex in the geometry's own space after `matrix`. */
function paint(geo, matrix, fn) {
  geo.applyMatrix4(matrix);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) col.set(fn(pos.getX(i), pos.getY(i), pos.getZ(i)), i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

const at = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(
  new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz),
);

const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * The parts of a cow as geometries with vertex colours (all the same attributes, so they merge): the barrel, hips and shoulders in her patches, the
 * neck and head, ears, legs with hocks and hooves, the udder with its teats, the tail. `variant` picks her patches.
 */
export function cowParts(variant = 0) {
  const sphere = () => new THREE.SphereGeometry(1, 14, 10);
  const coat = (x, y, z) => lerp3(BLACK, WHITE, patches(x, y, z, variant));
  const geos = [];
  // The barrel, the hips (high, with pin bones) and the shoulders, as overlapping ellipsoids.
  geos.push(paint(sphere(), at(0, 1.0, 0, 0, 0, 0, 0.44, 0.5, 1.0), coat));
  geos.push(paint(sphere(), at(0, 1.1, -0.72, 0, 0, 0, 0.4, 0.44, 0.44), coat));
  geos.push(paint(sphere(), at(0, 1.08, 0.55, 0, 0, 0, 0.36, 0.44, 0.42), coat));
  // The neck, rising from the shoulders and out to the head, and the head with its muzzle, a white blaze and a dark nose.
  geos.push(paint(new THREE.CylinderGeometry(0.15, 0.22, 0.62, 10), at(0, 1.12, 1.05, 1.1), (x, y, z) => lerp3(BLACK, WHITE, patches(x * 1.3, y, z, variant + 1))));
  geos.push(paint(new THREE.BoxGeometry(0.26, 0.3, 0.42, 2, 2, 2), at(0, 0.95, 1.42, 0.5), (x, y, z) => (Math.abs(x) < 0.04 && z > 1.25 ? WHITE : BLACK)));
  geos.push(paint(new THREE.BoxGeometry(0.2, 0.18, 0.2, 2, 2, 2), at(0, 0.78, 1.62, 0.5), () => PINK));
  for (const s of [-1, 1]) {
    geos.push(paint(new THREE.BoxGeometry(0.2, 0.03, 0.1), at(s * 0.2, 1.11, 1.35, 0, 0, s * -0.35), () => BLACK)); // the ears, out and down
    geos.push(paint(new THREE.SphereGeometry(0.025, 6, 4), at(s * 0.1, 1.06, 1.46), () => DARK)); // the eyes
  }
  // Four legs, the front ones straight and the back ones with a hock, each ending in a dark hoof.
  const leg = (x, z, hind) => {
    const colour = (px, py, pz) => (py > 0.35 ? lerp3(BLACK, WHITE, patches(px, py, pz, variant + 2)) : WHITE);
    if (hind) {
      geos.push(paint(new THREE.CylinderGeometry(0.115, 0.075, 0.52, 8), at(x, 0.78, z + 0.02, -0.25), colour));
      geos.push(paint(new THREE.CylinderGeometry(0.07, 0.055, 0.5, 8), at(x, 0.27, z - 0.05, 0.15), colour));
    } else {
      geos.push(paint(new THREE.CylinderGeometry(0.105, 0.06, 0.9, 8), at(x, 0.5, z), colour));
    }
    geos.push(paint(new THREE.BoxGeometry(0.13, 0.08, 0.17), at(x, 0.04, z + (hind ? -0.1 : 0.01)), () => HOOF));
  };
  for (const s of [-1, 1]) {
    leg(s * 0.24, 0.62, false);
    leg(s * 0.24, -0.78, true);
  }
  // The udder, hung between the back legs with four teats, and the tail with its switch.
  geos.push(paint(sphere(), at(0, 0.66, -0.7, 0, 0, 0, 0.2, 0.18, 0.24), () => PINK));
  for (const [tx, tz] of [[-0.08, -0.62], [0.08, -0.62], [-0.08, -0.8], [0.08, -0.8]]) geos.push(paint(new THREE.CylinderGeometry(0.014, 0.018, 0.08, 5), at(tx, 0.54, tz), () => PINK));
  geos.push(paint(new THREE.CylinderGeometry(0.02, 0.015, 0.95, 5), at(0, 0.86, -1.16, -0.12), () => BLACK));
  geos.push(paint(new THREE.SphereGeometry(0.06, 6, 5), at(0, 0.36, -1.26, 0, 0, 0, 1, 2, 1), () => WHITE));
  // Normals and UVs agree across every part so they merge.
  return geos.map((g) => (g.index ? g.toNonIndexed() : g));
}

const cowMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });

/** One merged geometry of a cow with her colours. */
export function cowGeometry(variant = 0) {
  const parts = cowParts(variant);
  for (const g of parts) for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
  return mergeGeometries(parts);
}

/** A cow as a group of her body parts (the model the tests look at; the herd shares `cowGeometry` through `buildHerd`). */
export function buildCow(variant = 0) {
  const group = new THREE.Group();
  group.name = 'cow';
  const parts = cowParts(variant);
  for (const g of parts) {
    const m = new THREE.Mesh(g, cowMaterial);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  return group;
}

/**
 * A herd as instanced meshes: `cows` is [{ x, z, yaw }], each standing on `groundAt(x, z)`. One instanced mesh a tile of ground for each of
 * the `COW_VARIANTS` patterns, so a tile out of view is not drawn (tiledInstances.js). The cows differ a little in size (up to 6%).
 */
export function buildHerd(cows, groundAt, name = 'herd') {
  const group = new THREE.Group();
  group.name = name;
  const euler = new THREE.Euler();
  for (let v = 0; v < COW_VARIANTS; v++) {
    const mine = cows.filter((_, i) => i % COW_VARIANTS === v);
    if (!mine.length) continue;
    const matrices = mine.map((c, i) => {
      const s = 0.97 + ((i * 0.6180339887) % 1) * 0.09;
      return new THREE.Matrix4().compose(
        new THREE.Vector3(c.x, groundAt(c.x, c.z), c.z), new THREE.Quaternion().setFromEuler(euler.set(0, c.yaw, 0)), new THREE.Vector3(s, s, s),
      );
    });
    group.add(...tiledInstances(cowGeometry(v), cowMaterial, matrices, { tileSize: MODEL_TILE, castShadow: true, receiveShadow: true }).children);
  }
  return group;
}
