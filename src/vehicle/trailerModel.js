import * as THREE from 'three';
import { squareBaleGeometry, squareBaleMaterials } from '../world/squareBale.js';
import { createRandom } from '../core/random.js';
import { PART_MAT, box, buildWheel, addMudguard, addRearLights, addJockeyWheel } from './trailerParts.js';

// The bale trailer, procedural like the tractor: a flat bed on one axle with two wheels, a tongue to the tractor's drawbar, and
// bales stacked on it, two high at the back (to lean on) and at the front, with a well between where legs hang down.
//
//   trailer (origin on the ground, under the axle; +Z toward the tractor, +X left)
//   ├── body          the bed and bales, which ride on the springs and tilt
//   │   ├── seatLeft, seatRight   where a girl's hips go (on the top of the lower layer, at the edge of the well)
//   └── wheelLeft, wheelRight     spin as it rolls

export const TRAILER_SPEC = {
  bedY: 0.78, // top of the bed
  bedHalfWidth: 1.0,
  rearZ: -1.7, // the back end of the bed
  frontZ: 1.5, // the front end of the bed
  baleHeight: 0.38,
  wheelRadius: 0.42,
  seatX: 0.5, // her hips' distance from the middle, either side
  seatZ: -0.12,
  ringHeight: 0.5, // the hitch ring, above the ground
};

/** Where she stands to climb on or off, beside the wheel on her side, as trailer-local metres. */
export function trailerStandLocal(side) {
  return { x: side * 1.7, z: -0.4 };
}

const MAT = {
  steel: new THREE.MeshStandardMaterial({ color: 0x4a4c4e, roughness: 0.55, metalness: 0.5 }),
  deck: new THREE.MeshStandardMaterial({ color: 0x6b5a45, roughness: 0.85 }),
  deckWorn: new THREE.MeshStandardMaterial({ color: 0x5f503d, roughness: 0.9 }),
  deckDark: new THREE.MeshStandardMaterial({ color: 0x2a231b, roughness: 0.95 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x1a1917, roughness: 0.95 }),
  rim: new THREE.MeshStandardMaterial({ color: 0x8a2f24, roughness: 0.6 }),
  hay: new THREE.MeshStandardMaterial({ color: 0xc9a74c, roughness: 0.95 }),
  hayDark: new THREE.MeshStandardMaterial({ color: 0xb8933f, roughness: 0.95 }),
  twine: new THREE.MeshStandardMaterial({ color: 0x3b6e8f, roughness: 0.8 }),
};

// A bale is 1 m across the trailer, 0.45 along it: two across fill the bed. They share one geometry and one set of textures (twine and all).
let baleGeo;
let baleMats;

function bale(x, y, z, parent, shade) {
  if (!baleGeo) {
    baleGeo = squareBaleGeometry(0.98, 0.38, 0.44);
    const light = squareBaleMaterials(createRandom(77));
    // The darker bales share the textures but are tinted, so there are two sets of materials rather than one per bale.
    const tinted = new Map([...new Set(light)].map((mat) => [mat, Object.assign(mat.clone(), { color: new THREE.Color(0xe3d3ac) })]));
    baleMats = { light, dark: light.map((mat) => tinted.get(mat)) };
  }
  const m = new THREE.Mesh(baleGeo, shade ? baleMats.dark : baleMats.light);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
}

export function buildTrailerModel() {
  const S = TRAILER_SPEC;
  const root = new THREE.Group();
  root.name = 'trailer';
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  // Bed: planks with dark gaps between them, a pair of main rails and cross members under it, a low board along each side, and a headboard.
  const len = S.frontZ - S.rearZ;
  const midZ = (S.frontZ + S.rearZ) / 2;
  box(S.bedHalfWidth * 2, 0.05, len, MAT.deckDark, 0, S.bedY - 0.06, midZ, body); // the dark under the gaps
  const planks = 8;
  const plankW = (S.bedHalfWidth * 2) / planks;
  for (let i = 0; i < planks; i++) {
    box(plankW - 0.012, 0.04, len, i % 3 === 1 ? MAT.deckWorn : MAT.deck, -S.bedHalfWidth + plankW * (i + 0.5), S.bedY - 0.02, midZ, body);
  }
  for (const s of [-0.6, 0.6]) box(0.09, 0.14, len, PART_MAT.paint, s, S.bedY - 0.16, midZ, body); // main rails
  for (let i = 0; i < 5; i++) box(S.bedHalfWidth * 2, 0.06, 0.07, PART_MAT.paint, 0, S.bedY - 0.1, S.rearZ + 0.2 + (i * (len - 0.4)) / 4, body);
  for (const s of [-1, 1]) {
    box(0.04, 0.16, len, MAT.deck, s * S.bedHalfWidth, S.bedY + 0.08, midZ, body); // side board
    box(0.05, 0.04, len + 0.04, PART_MAT.steel, s * S.bedHalfWidth, S.bedY + 0.17, midZ, body); // its capping
    for (const z of [S.rearZ + 0.1, midZ, S.frontZ - 0.1]) box(0.05, 0.22, 0.06, PART_MAT.steel, s * S.bedHalfWidth, S.bedY + 0.1, z, body); // stakes
  }
  box(S.bedHalfWidth * 2, 0.12, 0.05, MAT.deck, 0, S.bedY + 0.06, S.rearZ - 0.025, body); // the back board, low, so the bales load over it
  box(S.bedHalfWidth * 2, 0.55, 0.05, MAT.deck, 0, S.bedY + 0.275, S.frontZ + 0.025, body); // headboard
  box(S.bedHalfWidth * 2 + 0.04, 0.05, 0.07, PART_MAT.steel, 0, S.bedY + 0.57, S.frontZ + 0.025, body);
  for (const s of [-0.7, 0, 0.7]) box(0.05, 0.5, 0.06, PART_MAT.steel, s, S.bedY + 0.3, S.frontZ + 0.07, body); // headboard uprights

  // The axle with a leaf spring each side, and a pair of axle stands.
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, (S.bedHalfWidth + 0.14) * 2, 8), PART_MAT.steel);
  axle.rotation.z = Math.PI / 2;
  axle.position.set(0, S.wheelRadius, 0);
  axle.castShadow = true;
  body.add(axle);
  for (const s of [-0.6, 0.6]) {
    box(0.07, 0.025, 0.9, PART_MAT.steel, s, S.wheelRadius + 0.07, 0, body);
    box(0.07, 0.02, 0.7, PART_MAT.steel, s, S.wheelRadius + 0.095, 0, body);
    box(0.08, 0.2, 0.12, PART_MAT.steel, s, S.wheelRadius + 0.15, 0, body);
  }

  // The drawbar: an A-frame of two flat bars meeting at a coupling, a jockey wheel wound up, a chain and a ring.
  for (const s of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 1.35), PART_MAT.paint);
    bar.position.set(s * 0.22, S.ringHeight + 0.1, 1.95);
    bar.rotation.y = s * 0.17;
    bar.castShadow = true;
    body.add(bar);
  }
  box(0.14, 0.1, 0.5, PART_MAT.paint, 0, S.ringHeight + 0.1, 2.45, body);
  box(0.1, 0.1, 0.1, PART_MAT.steel, 0, S.ringHeight, 2.52, body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 6, 12), PART_MAT.steel);
  ring.position.set(0, S.ringHeight, 2.6);
  ring.rotation.y = Math.PI / 2;
  body.add(ring);
  addJockeyWheel(body, 0.1, S.ringHeight + 0.05, 2.25);
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 4, 10), PART_MAT.steel);
  chain.position.set(-0.18, S.ringHeight - 0.05, 2.25);
  chain.rotation.x = Math.PI / 2;
  body.add(chain);
  addRearLights(body, S.bedHalfWidth - 0.12, S.bedY - 0.12, S.rearZ - 0.03);

  // Bales: a layer across the back four rows, a second layer on the back two, and a stack at the front.
  const top = S.bedY + S.baleHeight / 2;
  let n = 0;
  for (let row = 0; row < 4; row++) {
    for (const x of [-0.5, 0.5]) bale(x, top, S.rearZ + 0.22 + row * 0.45, body, n++ % 3 === 0);
  }
  for (let row = 0; row < 2; row++) {
    for (const x of [-0.5, 0.5]) bale(x, top + S.baleHeight, S.rearZ + 0.22 + row * 0.45, body, n++ % 3 === 1);
  }
  for (const x of [-0.5, 0.5]) {
    bale(x, top, S.frontZ - 0.22, body, n++ % 3 === 2);
    bale(x, top + S.baleHeight, S.frontZ - 0.22, body, n++ % 3 === 0);
  }

  // Where the girls sit: hips on the top of the lower layer at the edge of the well, facing forward.
  const seatY = S.bedY + S.baleHeight;
  for (const [name, side] of [['seatLeft', 1], ['seatRight', -1]]) {
    const a = new THREE.Object3D();
    a.name = name;
    a.position.set(side * S.seatX, seatY, S.seatZ);
    body.add(a);
  }

  // Wheels, with a curved mudguard over each.
  for (const [name, side] of [['wheelLeft', 1], ['wheelRight', -1]]) {
    root.add(buildWheel(name, side * (S.bedHalfWidth + 0.14), S.wheelRadius, 0.2));
    addMudguard(root, side * (S.bedHalfWidth + 0.14), S.wheelRadius, 0.26, PART_MAT.paint, S.bedHalfWidth);
  }
  return root;
}
