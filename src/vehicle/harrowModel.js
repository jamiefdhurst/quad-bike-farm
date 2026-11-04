import { part } from './part.js';
import * as THREE from 'three';
import { PART_MAT, box, buildWheel, addJockeyWheel, addChain, addLeafSpring, addUBolts, beam, addGusset, addEye } from './trailerParts.js';
import { rod } from './quadGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// The chain harrows: a set of harrow mats, a lattice of steel links with a pointed tine at every joint, about 3.4 m across, hung on chains from a
// spreader bar behind a small two-wheeled carrier. The carrier lets the mat be lifted clear to travel (T lowers or raises the tines); lowered, the
// mat lies flat on the ground and is dragged. Procedural like the other trailers. Pose it with `poseHarrow`.
//
//   harrow (origin on the ground, under the axle; +Z toward the puller, +X left)
//   ├── body       rides on the springs and tilts with the ground
//   │   └── the frame, A-frame tongue and ring, the spreader bar and its chains to the tongue
//   ├── mat        hangs from the spreader bar (userData.keep so it poses): the lattice, its chains up to the bar and the grass caught in it
//   └── wheelLeft, wheelRight     spin as it rolls

export const HARROW_SPEC = {
  floorY: 0.5, // top of the frame
  halfWidth: 0.55,
  rearZ: -0.7, // the back of the frame
  frontZ: 0.7, // the front of the frame
  wheelRadius: 0.3,
  ringHeight: 0.48, // the hitch ring, above the ground
  drawLength: 1.7, // axle to ring
  barY: 0.62, // the spreader bar's height
  barZ: -1.15, // the spreader bar's line behind the axle
  barHalf: 1.45, // half the spreader bar
  matWidth: 3.4, // the mat across
  matLength: 2.2, // the mat from front to back (its middle is DEFAULT_HARROW_PARAMS.matBehind behind the axle)
  pitch: 0.2, // metres between one joint of the lattice and the next
  tine: 0.075, // a tine's length
  lift: 0.55, // radians the mat tips up at its back when the tines are raised
  raise: 0.3, // and metres it is lifted as a whole on the bar's chains
};

/** The footprint a girl's probes hit: the carrier only (the mat lies flat and does not block). */
export const HARROW_FOOTPRINT = { halfWidth: 0.6, rearZ: -1.2, frontZ: 0.7 };

const MAT = {
  steel: new THREE.MeshStandardMaterial({ color: 0x4a4c4e, roughness: 0.55, metalness: 0.5 }),
  link: new THREE.MeshStandardMaterial({ color: 0x555a5c, roughness: 0.5, metalness: 0.7 }),
  rusty: new THREE.MeshStandardMaterial({ color: 0x7a4a2e, roughness: 0.9, metalness: 0.25 }),
  tine: new THREE.MeshStandardMaterial({ color: 0x6a6258, roughness: 0.8, metalness: 0.4 }),
  grass: new THREE.MeshStandardMaterial({ color: 0x5f7a30, roughness: 1 }),
  straw: new THREE.MeshStandardMaterial({ color: 0xb7a05a, roughness: 1 }),
};

/**
 * A taut chain between two points: a thin rod for its length and a ring every few centimetres turned a quarter each time, so it reads as links
 * from close to without a mesh per link (a hanging chain of 25 links is 25 meshes; this is a rod and a few rings, merged).
 */
function chainRun(parent, a, b, mat) {
  parent.add(new THREE.Mesh(rod(a, b, 0.0045, 4), mat));
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const along = B.clone().sub(A);
  const n = Math.max(2, Math.round(along.length() / 0.05));
  const link = new THREE.TorusGeometry(0.013, 0.003, 3, 6);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), along.clone().normalize());
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(link, mat);
    m.position.copy(A).addScaledVector(along, (i + 0.5) / n);
    m.quaternion.copy(q);
    m.rotateZ(i % 2 ? Math.PI / 2 : 0);
    parent.add(m);
  }
}

/**
 * Folds every mesh under `container` (except the subtrees in `leave`) into one, whatever their materials: each mesh's colour is baked into its
 * vertices and they share one lit material. A draw call is paid for every mesh and again for its shadow, and a trailer standing out in a field
 * is seen from a long way off, so the carrier is a handful of meshes (the sprayer's is over a hundred). Textures and shine are given up for it.
 */
function mergeColoured(container, name, leave = [], castShadow = true) {
  container.updateMatrixWorld(true);
  const inv = container.matrixWorld.clone().invert();
  const geos = [];
  const victims = [];
  const inside = (o) => leave.some((l) => {
    for (let p = o; p; p = p.parent) if (p === l) return true;
    return false;
  });
  container.traverse((o) => {
    if (!o.isMesh || inside(o) || Array.isArray(o.material)) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
    if (!g.attributes.color) {
      const colours = new Float32Array(g.attributes.position.count * 3);
      const c = o.material.map ? TEXTURED : (o.material.color ?? TEXTURED); // a textured part (a tyre's tread) goes in a flat dark grey
      for (let i = 0; i < colours.length; i += 3) c.toArray(colours, i);
      g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    }
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    geos.push(g);
    victims.push(o);
  });
  if (!geos.length) return null;
  for (const v of victims) v.removeFromParent();
  const mesh = new THREE.Mesh(mergeGeometries(geos), LATTICE_MATERIAL);
  mesh.name = name;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  container.add(mesh);
  return mesh;
}

const TEXTURED = new THREE.Color(0x24231f);
const LATTICE_MATERIAL = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.45 });

/** A tiny seeded 0..1 source, so every set of harrows is rusted and caught with grass in the same places. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * The lattice: rows across the mat a `pitch` apart, every other row shifted half a pitch so the links make diamonds, a short rod from each
 * joint to its two neighbours in the next row, and a pointed tine hanging from each. Built as three merged geometries (steel links, rusty links
 * and tines) plus a few tufts of grass and straw caught in the tines, so the whole mat is a handful of draw calls. Local origin: the middle of the
 * mat's front edge, links in the plane y 0.05 and tine points at y -0.025, so lowered with its group at ground level the points are just in the turf.
 */
function buildMat() {
  const S = HARROW_SPEC;
  const rand = seeded(11);
  const cols = Math.round(S.matWidth / S.pitch);
  const rows = Math.round(S.matLength / S.pitch);
  const joint = (r, c) => [(c - (cols - 1) / 2) * S.pitch + (r % 2 ? S.pitch / 2 : 0), 0.05, -r * S.pitch];
  const inRow = (r) => (r % 2 ? cols - 1 : cols); // the shifted rows are one joint short
  const steel = [];
  const rusty = [];
  const tines = [];
  const tufts = { grass: [], straw: [] };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < inRow(r); c++) {
      const a = joint(r, c);
      const tine = new THREE.ConeGeometry(0.016, S.tine, 5, 1);
      tine.rotateX(Math.PI); // point down
      tine.translate(a[0], a[1] - S.tine / 2 + 0.025, a[2]); // the point just touches the ground
      tines.push(tine);
      // Links to the two joints below it in the next row: a diamond between each four.
      for (const cc of r % 2 ? [c, c + 1] : [c - 1, c]) {
        if (r + 1 >= rows || cc < 0 || cc >= inRow(r + 1)) continue;
        (rand() < 0.35 ? rusty : steel).push(rod(a, joint(r + 1, cc), 0.0085, 4));
      }
      if (rand() < 0.05) {
        const g = new THREE.ConeGeometry(0.012, 0.11 + rand() * 0.06, 4);
        g.rotateZ((rand() - 0.5) * 1.2);
        g.rotateY(rand() * 6);
        g.translate(a[0], a[1] + 0.04, a[2]);
        (rand() < 0.6 ? tufts.grass : tufts.straw).push(g);
      }
    }
  }
  // One mesh for the lot, coloured by vertex (a mesh a material would be five draws): steel, rusty steel, tines, grass and straw.
  const parts = [[steel, MAT.link], [rusty, MAT.rusty], [tines, MAT.tine], [tufts.grass, MAT.grass], [tufts.straw, MAT.straw]];
  const geos = [];
  for (const [list, material] of parts) {
    for (const g of list) {
      const geo = g.index ? g.toNonIndexed() : g;
      for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
      const colours = new Float32Array(geo.attributes.position.count * 3);
      for (let i = 0; i < colours.length; i += 3) material.color.toArray(colours, i);
      geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
      geos.push(geo);
    }
  }
  const mat = new THREE.Group();
  mat.name = 'mat';
  const mesh = new THREE.Mesh(mergeGeometries(geos), LATTICE_MATERIAL);
  mesh.name = 'links';
  mesh.castShadow = false; // a flat mat of thin links throws no shadow worth a second draw of 5,000 triangles
  mesh.receiveShadow = true;
  mat.add(mesh);
  return mat;
}

export function buildHarrowModel() {
  const S = HARROW_SPEC;
  const root = new THREE.Group();
  root.name = 'harrows';
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  const len = S.frontZ - S.rearZ;
  const midZ = (S.frontZ + S.rearZ) / 2;
  const gal = PART_MAT.galv; // the plain grey metal merges into one mesh; the textured galvanised() would be a draw a part
  // Frame: two rails with cross members, and the A-frame tongue to a ball coupling, as the sprayer's.
  for (const s of [-0.38, 0.38]) box(0.06, 0.08, len, MAT.steel, s, S.floorY - 0.1, midZ, body);
  box(S.halfWidth * 2, 0.06, 0.08, MAT.steel, 0, S.floorY - 0.1, S.frontZ - 0.1, body);
  box(S.halfWidth * 2, 0.06, 0.08, MAT.steel, 0, S.floorY - 0.1, S.rearZ + 0.12, body);
  for (const s of [-1, 1]) {
    beam(body, [s * 0.38, S.floorY - 0.1, S.frontZ - 0.05], [s * 0.05, S.ringHeight + 0.02, S.drawLength - 0.4], 0.055, 0.055, gal);
    box(0.1, 0.1, 0.16, gal, s * 0.38, S.floorY - 0.1, S.frontZ - 0.02, body);
  }
  beam(body, [-0.27, S.floorY - 0.08, S.frontZ + 0.3], [0.27, S.floorY - 0.08, S.frontZ + 0.3], 0.04, 0.05, gal);
  addGusset(body, -0.05, S.ringHeight + 0.06, S.drawLength - 0.48, 0.16, -1, 1, gal);
  addGusset(body, 0.05, S.ringHeight + 0.06, S.drawLength - 0.48, 0.16, 1, 1, gal);
  box(0.12, 0.08, 0.3, gal, 0, S.ringHeight + 0.02, S.drawLength - 0.3, body);
  box(0.1, 0.09, 0.16, gal, 0, S.ringHeight + 0.02, S.drawLength - 0.1, body);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 12), MAT.steel);
  cup.position.set(0, S.ringHeight - 0.03, S.drawLength);
  body.add(cup);
  addEye(body, -0.06, S.ringHeight + 0.02, S.drawLength - 0.3, -1);
  addEye(body, 0.06, S.ringHeight + 0.02, S.drawLength - 0.3, 1);
  addChain(body, [-0.08, S.ringHeight + 0.008, S.drawLength - 0.3], [0.08, S.ringHeight + 0.008, S.drawLength - 0.3], 7, 0.04);
  addJockeyWheel(body, 0, S.ringHeight + 0.05, S.frontZ + 0.75);

  // Axle on leaf springs.
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, (S.halfWidth + 0.11) * 2, 8), MAT.steel);
  axle.rotation.z = Math.PI / 2;
  axle.position.set(0, S.wheelRadius, 0);
  axle.castShadow = true;
  body.add(axle);
  for (const s of [-0.38, 0.38]) {
    addLeafSpring(body, s, S.wheelRadius + 0.07, 0.7, 2, MAT.steel);
    addUBolts(body, s, S.wheelRadius + 0.035, 0, 0.1, 0.012);
    box(0.07, 0.12, 0.1, MAT.steel, s, S.wheelRadius + 0.12, 0, body);
  }

  // The spreader bar: a galvanised tube across the back on two stout struts from the frame rails, with an eye at each end and at the middle, and
  // a chain from each end forward to the tongue (the pull goes up to the hitch through these).
  for (const s of [-1, 1]) {
    beam(body, [s * 0.38, S.floorY - 0.1, S.rearZ + 0.08], [s * 0.38, S.barY, S.barZ + 0.06], 0.055, 0.055, MAT.steel);
    chainRun(body, [s * S.barHalf, S.barY - 0.02, S.barZ + 0.04], [s * 0.06, S.ringHeight + 0.04, S.drawLength - 0.55], PART_MAT.chain);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, S.barHalf * 2, 10), gal);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, S.barY, S.barZ);
  bar.castShadow = true;
  body.add(bar);
  for (const x of [-S.barHalf, 0, S.barHalf]) addEye(body, x, S.barY - 0.04, S.barZ, 1);
  for (const s of [-1, 1]) box(0.07, 0.07, 0.07, MAT.steel, s * (S.barHalf + 0.02), S.barY, S.barZ, body); // the caps on the ends

  // The mat, hung from the bar by chains. The group's origin is the bar, so tipping it about X lifts the back of the mat and keeps the chains on the bar.
  const hang = new THREE.Group();
  hang.name = 'mat';
  hang.userData.keep = true;
  hang.position.set(0, S.barY, S.barZ);
  body.add(hang);
  const lattice = buildMat();
  lattice.name = 'lattice';
  lattice.position.set(0, -S.barY, -0.12);
  hang.add(lattice);
  // Four chains from the bar down to the front corners and middle of the mat, short and slack enough to hang straight.
  for (const x of [-1.5, -0.75, 0.75, 1.5]) {
    chainRun(hang, [x, -0.02, 0], [x * 0.98, -(S.barY - 0.1), -0.12], PART_MAT.chain);
  }
  // A drag-bar along the front of the mat that the chains shackle to, so the lattice is pulled evenly across.
  const dragBar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, S.matWidth, 8), gal);
  dragBar.rotation.z = Math.PI / 2;
  dragBar.position.set(0, -(S.barY - 0.07), -0.12);
  hang.add(dragBar);
  mergeColoured(hang, 'hangings', [lattice], false); // the chains and the drag bar in one mesh; the lattice is its own

  // Wheels, with no mudguards or lamps: a harrow carrier is a field implement, and each of those is a draw call.
  for (const [name, side] of [['wheelLeft', 1], ['wheelRight', -1]]) {
    const wheel = buildWheel(name, side * (S.halfWidth + 0.11), S.wheelRadius, 0.16, 'atv');
    root.add(wheel);
    root.updateMatrixWorld(true);
    mergeColoured(wheel.getObjectByName('spin'), 'wheelParts'); // the parts of a wheel turn together, so one mesh
  }
  mergeColoured(body, 'carrier', [hang]); // the frame, tongue, bar and the chains forward in one mesh
  return root;
}

/** Lowers or raises the tines: `down` 1 has the mat lying on the ground, 0 has it tipped up behind the carrier clear of it. */
export function poseHarrow(model, { down }) {
  const hang = part(model, 'mat');
  hang.rotation.x = HARROW_SPEC.lift * (1 - down);
  hang.position.y = HARROW_SPEC.barY + HARROW_SPEC.raise * (1 - down);
}
