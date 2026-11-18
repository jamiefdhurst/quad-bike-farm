// The orchard's two houses (#682): the hens' house and the pig's ark, each standing in its fenced run (farmAnimalsView.js places them). Both are built
// facing +x (the pop-hole and the ark's doorway), standing on the ground at the group's origin, from a handful of timber and tin parts with trim: not boxes.
// All ordinary lit materials, so the day's light and the night dim them.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { woodTexture } from './neighbourTextures.js';
import { corrugatedTexture } from './outbuildingProps.js';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
/** A material from a texture of the kits, tiled `repeat` times. */
const textured = (map, repeat = [1, 1], extra = {}) => {
  map.repeat.set(...repeat);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.9, ...extra });
};
const shadowed = (o) => {
  o.traverse((m) => {
    if (m.isMesh) m.castShadow = m.receiveShadow = true;
  });
  return o;
};
const box = (sx, sy, sz, material, x, y, z, parent, rot = [0, 0, 0]) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  m.position.set(x, y, z);
  m.rotation.set(...rot);
  parent.add(m);
  return m;
};

/**
 * The house's meshes merged into one a material, so it is a handful of draw calls and not eighty (#978). Every part is a lit mesh with position, normal and uv,
 * built once and never moved. The unmerged group is what the coplanar test looks at (`buildHenHouse(random, false)`).
 */
function mergedByMaterial(group) {
  group.updateMatrixWorld(true);
  const byMat = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
  });
  const out = new THREE.Group();
  out.name = group.name;
  for (const [material, geos] of byMat) {
    const mesh = new THREE.Mesh(mergeGeometries(geos), material);
    mesh.castShadow = mesh.receiveShadow = true;
    out.add(mesh);
  }
  return out;
}

/**
 * The hens' house: a raised timber house on four legs with a pitched tin roof, a pop-hole with a ramp and cleats, a nest box on the back with a hinged
 * lid, a hatch for you, a wire-covered vent, corner trims and fascia, and a perch and a hanging feeder in the run. About 1.6 by 1.1 m on the ground, 1.7 m high.
 */
export function buildHenHouse(random = Math.random, merge = true) {
  const g = new THREE.Group();
  g.name = 'henHouse';
  const paint = textured(woodTexture(random, [185, 87, 58]), [1, 1]); // red-oxide boards
  const trim = textured(woodTexture(random, [228, 223, 210]), [1, 1]); // white corner trims and door frames
  const timber = textured(woodTexture(random, [79, 58, 36]), [1, 1]);
  const tin = textured(corrugatedTexture(random, '#6c747c', 0.5), [1, 0.3], { metalness: 0.4, roughness: 0.6 });
  const dark = mat(0x1a1410);
  const W = 1.4; // along z (the front is +x)
  const D = 1.0; // depth along x
  const H = 0.85; // wall height
  const lift = 0.45; // the floor's height off the ground
  // The floor and the four walls (boards in strips, so the walls have a grain), on four legs with a rail between each pair.
  box(D + 0.08, 0.05, W + 0.08, timber, 0, lift, 0, g);
  for (const [dx, dz] of [[-0.42, -0.6], [0.42, -0.6], [-0.42, 0.6], [0.42, 0.6]]) box(0.08, lift, 0.08, timber, dx, lift / 2, dz, g);
  for (const dz of [-0.6, 0.6]) box(0.84, 0.05, 0.05, timber, 0, 0.18, dz, g);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      box(0.02, H, W / 5 - 0.006, paint, side * (D / 2 - 0.01), lift + 0.03 + H / 2, (i - 2) * (W / 5), g); // the front and back
    }
    for (let i = 0; i < 4; i++) box(D / 4 - 0.006, H, 0.02, paint, (i - 1.5) * (D / 4), lift + 0.03 + H / 2, side * (W / 2 - 0.01), g); // the two ends
  }
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.06, H + 0.02, 0.06, trim, dx * (D / 2 - 0.02), lift + 0.03 + H / 2, dz * (W / 2 - 0.02), g);
  // The roof: two tin slopes with a ridge cap and a fascia board each side, overhanging the front.
  const roofRise = 0.34;
  const slope = Math.atan2(roofRise, W / 2);
  const slopeLen = Math.hypot(W / 2 + 0.12, roofRise);
  for (const s of [-1, 1]) {
    box(D + 0.3, 0.03, slopeLen, tin, 0.08, lift + 0.03 + H + roofRise / 2 + 0.012, s * (W / 4 + 0.06), g, [s * slope, 0, 0]);
    box(D + 0.32, 0.07, 0.025, trim, 0.08, lift + 0.03 + H - 0.012, s * (W / 2 + 0.108), g);
  }
  box(D + 0.38, 0.05, 0.1, tin, 0.08, lift + 0.03 + H + roofRise + 0.033, 0, g);
  // The front: the pop-hole (a dark opening in a white frame) with its ramp and cleats, and a perch on two stands.
  box(0.025, 0.34, 0.3, trim, D / 2 + 0.005, lift + 0.5, 0.35, g);
  box(0.03, 0.3, 0.26, dark, D / 2 + 0.0185, lift + 0.5, 0.35, g);
  box(0.7, 0.025, 0.24, timber, D / 2 + 0.3, lift + 0.2, 0.35, g, [0, 0, -0.5]);
  for (let i = 0; i < 4; i++) box(0.02, 0.03, 0.22, trim, D / 2 + 0.12 + i * 0.12, lift + 0.33 - i * 0.07, 0.35, g, [0, 0, -0.5]);
  const perch = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 8), timber);
  perch.rotation.x = Math.PI / 2;
  perch.position.set(D / 2 + 0.5, 0.42, -0.1);
  g.add(perch);
  for (const dz of [-0.5, 0.3]) box(0.05, 0.42, 0.05, timber, D / 2 + 0.5, 0.21, dz, g);
  // The hatch you clean it out by, hinged and latched, and a vent covered in wire.
  box(0.025, 0.5, 0.42, trim, D / 2 + 0.005, lift + 0.4, -0.36, g);
  box(0.02, 0.44, 0.36, paint, D / 2 + 0.0215, lift + 0.4, -0.36, g);
  for (const dy of [-0.18, 0.18]) box(0.03, 0.03, 0.08, tin, D / 2 + 0.05, lift + 0.4 + dy, -0.53, g);
  box(0.035, 0.1, 0.03, tin, D / 2 + 0.055, lift + 0.4, -0.2, g);
  box(0.025, 0.14, 0.3, trim, -D / 2 - 0.005, lift + 0.62, 0.15, g);
  box(0.03, 0.1, 0.26, mat(0x9a9ea3, { transparent: true, opacity: 0.5 }), -D / 2 - 0.0185, lift + 0.62, 0.15, g);
  // The nest box on one end, a lean-to with a hinged lid lifted a little, and a step.
  box(0.5, 0.34, 0.4, paint, 0, lift + 0.2, W / 2 + 0.22, g);
  box(0.56, 0.03, 0.46, tin, 0, lift + 0.4, W / 2 + 0.22, g, [0.18, 0, 0]);
  box(0.4, 0.03, 0.04, timber, 0, lift + 0.03, W / 2 + 0.5, g);
  // A hanging feeder in the run.
  const feeder = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.28, 12), tin);
  feeder.position.set(D / 2 + 0.9, 0.46, 0.55);
  g.add(feeder);
  box(0.01, 0.4, 0.01, timber, D / 2 + 0.9, 0.78, 0.55, g);
  shadowed(g);
  return merge ? mergedByMaterial(g) : g;
}

/**
 * The pig's ark: a timber-skidded shelter with a curved corrugated tin roof, a boarded back, a door frame with a lintel at the front and a drop-down board
 * across the foot of the doorway, a bed of straw inside and a hook for the chain it is towed by. 2.4 m long, 1.5 m wide, 1.35 m high.
 */
export function buildPigArk(random = Math.random, merge = true) {
  const g = new THREE.Group();
  g.name = 'pigArk';
  const wood = textured(woodTexture(random, [122, 90, 58]), [1, 1]);
  const timber = textured(woodTexture(random, [79, 58, 36]), [1, 1]);
  const tin = textured(corrugatedTexture(random, '#7c858c', 0.4), [3, 1], { metalness: 0.4, roughness: 0.55, side: THREE.DoubleSide });
  const rib = mat(0x5d656b, { metalness: 0.5, roughness: 0.55 });
  const L = 2.4;
  const R = 0.75;
  // Two skids, upturned at the front, with cross-bearers between them.
  for (const s of [-1, 1]) {
    box(L + 0.3, 0.1, 0.12, timber, 0, 0.05, s * (R - 0.04), g);
    box(0.3, 0.1, 0.1, timber, L / 2 + 0.2, 0.1, s * (R - 0.04), g, [0, 0, 0.5]);
  }
  for (const x of [-0.9, 0, 0.9]) box(0.1, 0.08, 2 * R, timber, x, 0.14, 0, g);
  // The arch: a half-cylinder of tin along x, with a rib every 0.4 m across it (the corrugations) and a boarded back with a tin skirt.
  const archGeo = new THREE.CylinderGeometry(R, R, L, 24, 1, true, 0, Math.PI); // its axis is y: turned along x, the half that is above the ground
  archGeo.rotateZ(Math.PI / 2);
  const arch = new THREE.Mesh(archGeo, tin);
  arch.position.set(0, 0.18, 0);
  g.add(arch);
  for (let i = 0; i <= 6; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.01, 0.016, 6, 24, Math.PI), rib);
    ring.position.set(-L / 2 + (i * L) / 6, 0.18, 0);
    ring.rotation.y = Math.PI / 2;
    g.add(ring);
  }
  const back = new THREE.Mesh(new THREE.CircleGeometry(R, 24, 0, Math.PI), wood);
  back.position.set(-L / 2 + 0.01, 0.18, 0);
  back.rotation.y = Math.PI / 2;
  g.add(back);
  // The doorway at the front: two jambs, a lintel, and a board across the foot to keep the straw in.
  for (const s of [-1, 1]) box(0.08, 0.95, 0.09, timber, L / 2 - 0.02, 0.18 + 0.475, s * 0.5, g);
  box(0.1, 0.1, 1.1, timber, L / 2 - 0.02, 0.18 + 0.97, 0, g);
  for (const s of [-1, 1]) box(0.06, 0.32, 0.2, wood, L / 2 - 0.045, 0.18 + 1.12 - Math.abs(s) * 0.08, s * 0.42, g); // the gable fill each side, down to the arch
  box(0.04, 0.18, 0.94, wood, L / 2 - 0.02, 0.18 + 0.1, 0, g);
  // The chain hook, and straw on the floor.
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 6, 12), rib);
  hook.position.set(L / 2 + 0.4, 0.13, 0.55);
  hook.rotation.y = Math.PI / 2;
  g.add(hook);
  box(L - 0.4, 0.07, 2 * R - 0.35, mat(0xcdb26a), -0.05, 0.225, 0, g);
  shadowed(g);
  return merge ? mergedByMaterial(g) : g;
}
