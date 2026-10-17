import * as THREE from 'three';
import { squareBaleGeometry, squareBaleMaterials } from '../world/squareBale.js';
import { createRandom } from '../core/random.js';
import { PART_MAT, box, buildWheel, addMudguard, addRearLights, addJockeyWheel, addChain, addCable, addLeafSpring, addUBolts, beam, galvanised, addGusset, addEye } from './trailerParts.js';
import { boltsMesh, boltRow } from './detail/fixings.js';
import { decalMesh } from './detail/decals.js';
import { mergeStatic, rod } from './quadGeometry.js';

// The bale trailer, procedural like the tractor: a flat bed on one axle with two wheels, a tongue to the tractor's drawbar, and
// bales stacked at the front only, so there is a clear bed behind them for a quad. Two ramps fold down from under the back end.
//
//   trailer (origin on the ground, under the axle; +Z toward the tractor, +X left)
//   ├── body          the bed and bales, which ride on the springs and tilt
//   │   ├── seatLeft, seatRight   where a girl's hips go (on the top of the low bales, at the edge of the clear bed, facing back)
//   │   ├── rampLeft, rampRight   pivots at the back edge; rotation.x runs from 0 (stowed under the bed) to the open angle (poseRamps)
//   │   ├── winch                  the drum against the bales, its cable end point is `winchEye`
//   │   └── straps                 two ratchet straps over a loaded quad, shown while it is strapped (placed by the game)
//   └── wheelLeft, wheelRight     spin as it rolls

export const TRAILER_SPEC = {
  bedY: 0.78, // top of the bed
  bedHalfWidth: 1.0,
  rearZ: -1.7, // the back end of the bed
  frontZ: 1.5, // the front end of the bed
  baleHeight: 0.38,
  wheelRadius: 0.42,
  seatX: 0.5, // her hips' distance from the middle, either side
  seatZ: 0.72, // on the back edge of the low bales at the front
  rampLength: 2.4,
  rampX: 0.45, // each ramp's distance from the middle
  rampWidth: 0.52,
  winchZ: 0.5, // the drum, against the back of the bale stack
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

/** The angle the ramps open to (radians of rotation.x): they end pointing back and down from the bed's rear edge, the walking face up. */
export function rampOpenAngle(rise) {
  const rampLen = TRAILER_SPEC.rampLength;
  return Math.PI - Math.asin(Math.min(0.95, rise / rampLen));
}

/**
 * Works the ramps: t from 0 (stowed) to 1 (down on the ground). They lie on the bed behind the bales, walking face up, their lower ends hanging a
 * hand over the back; opening, they slide back along the bed until the upper end reaches the back edge (t up to 0.6), then drop at the free end to
 * the ground, turning about that edge (0.6 to 1). Never through the floor, and closing is the same in reverse.
 */
export function poseRamps(body, t, openAngle) {
  const S = TRAILER_SPEC;
  const slide = Math.min(1, t / 0.6);
  const k = Math.max(0, (t - 0.6) / 0.4);
  const tilt = k * k * (3 - 2 * k);
  for (const n of ['rampLeft', 'rampRight']) {
    const ramp = body.getObjectByName(n);
    const len = S.rampLength * ramp.scale.z;
    const stowedZ = S.rearZ - 0.1 + len; // its upper end, with the lower end 10 cm past the back edge
    ramp.position.z = stowedZ + (S.rearZ - stowedZ) * slide;
    ramp.position.y = S.bedY + 0.03 * (1 - tilt); // lying on the deck, then its surface at the deck's height as it hinges
    ramp.rotation.x = Math.PI + (openAngle - Math.PI) * tilt;
  }
}

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

  // Bed: planks with dark gaps between them on a ladder of steel: two main rails (box section) with a ring of angle round the edge, cross members
  // under the planks, a low board along each side in its stake pockets, and a tube-frame headboard.
  const len = S.frontZ - S.rearZ;
  const midZ = (S.frontZ + S.rearZ) / 2;
  box(S.bedHalfWidth * 2 - 0.02, 0.05, len - 0.04, MAT.deckDark, 0, S.bedY - 0.06, midZ, body); // the dark under the gaps (inside the planks' ends and sides, sharing no face)
  const planks = 8;
  const plankW = (S.bedHalfWidth * 2) / planks;
  for (let i = 0; i < planks; i++) {
    box(plankW - 0.012, 0.04, len, i % 3 === 1 ? MAT.deckWorn : MAT.deck, -S.bedHalfWidth + plankW * (i + 0.5), S.bedY - 0.02, midZ, body);
  }
  for (const s of [-0.6, 0.6]) {
    box(0.09, 0.14, len, PART_MAT.paint, s, S.bedY - 0.16, midZ, body); // main rails
    box(0.05, 0.1, len - 0.1, PART_MAT.steel, s, S.bedY - 0.16, midZ, body); // the box section's flange showing under them, proud of the sides
  }
  const crossZ = Array.from({ length: 5 }, (_, i) => S.rearZ + 0.2 + (i * (len - 0.4)) / 4);
  for (const z of crossZ) box(S.bedHalfWidth * 2, 0.06, 0.07, PART_MAT.paint, 0, S.bedY - 0.1, z, body);
  // The angle round the bed's edge: a steel angle along each side and across the back, its upstanding leg holding the planks in.
  for (const s of [-1, 1]) {
    box(0.05, 0.06, len + 0.06, PART_MAT.steel, s * (S.bedHalfWidth + 0.02), S.bedY - 0.045, midZ, body);
    box(0.02, 0.07, len + 0.06, PART_MAT.steel, s * (S.bedHalfWidth + 0.04), S.bedY - 0.035, midZ, body);
  }
  box(S.bedHalfWidth * 2 + 0.12, 0.066, 0.05, PART_MAT.steel, 0, S.bedY - 0.045, S.rearZ - 0.02, body);
  // Coach bolts through the planks into the cross members: a row at each, a head on each plank.
  const boltPts = [];
  crossZ.forEach((z, k) => { if (k % 2 === 0) for (let i = k % 4 === 0 ? 0 : 1; i < planks; i += 2) boltPts.push([-S.bedHalfWidth + plankW * (i + 0.5), S.bedY, z]); }); // at three of the cross members, every other plank
  body.add(boltsMesh(boltPts, [0, 1, 0], PART_MAT.nut, { size: 0.012, kind: 'dome', name: 'plankBolts' }));
  for (const s of [-1, 1]) {
    box(0.036, 0.16, len, MAT.deck, s * S.bedHalfWidth, S.bedY + 0.08, midZ, body); // side board
    box(0.05, 0.04, len + 0.04, PART_MAT.steel, s * S.bedHalfWidth, S.bedY + 0.17, midZ, body); // its capping
    const stakes = [S.rearZ + 0.1, midZ, S.frontZ - 0.1];
    for (const z of stakes) {
      box(0.056, 0.22, 0.06, PART_MAT.steel, s * S.bedHalfWidth, S.bedY + 0.1, z, body); // stakes (a little wider than the capping over them, so no face is shared)
      box(0.07, 0.05, 0.1, PART_MAT.steel, s * S.bedHalfWidth, S.bedY - 0.02, z, body); // and their pockets on the bed's edge
    }
    body.add(boltsMesh(stakes.map((z) => [s * (S.bedHalfWidth + 0.027), S.bedY + 0.1, z]), [s, 0, 0], PART_MAT.nut, { size: 0.012, kind: 'hex', name: 'stakeBolts' }));
  }
  // The headboard: a tube frame (two corner posts, a centre post, four rails and a diagonal brace), welded, with a flat top plate; it stops the bales.
  const hz = S.frontZ + 0.04;
  const tubeAt = (a, b, r = 0.022) => body.add(new THREE.Mesh(rod(a, b, r, 6), PART_MAT.paint));
  for (const x of [-S.bedHalfWidth + 0.02, 0, S.bedHalfWidth - 0.02]) tubeAt([x, S.bedY, hz], [x, S.bedY + 0.58, hz]);
  for (const y of [0.1, 0.25, 0.4, 0.56]) tubeAt([-S.bedHalfWidth + 0.02, S.bedY + y, hz], [S.bedHalfWidth - 0.02, S.bedY + y, hz]);
  tubeAt([-S.bedHalfWidth + 0.02, S.bedY + 0.1, hz + 0.001], [0, S.bedY + 0.56, hz + 0.001], 0.015);
  tubeAt([S.bedHalfWidth - 0.02, S.bedY + 0.1, hz + 0.001], [0, S.bedY + 0.56, hz + 0.001], 0.015);
  box(S.bedHalfWidth * 2 + 0.04, 0.03, 0.08, PART_MAT.steel, 0, S.bedY + 0.59, hz, body); // top plate
  for (const s of [-1, 1]) box(0.08, 0.1, 0.1, PART_MAT.steel, s * (S.bedHalfWidth - 0.02), S.bedY + 0.02, hz, body); // each post's foot on the bed's angle
  box(S.bedHalfWidth * 2 - 0.1, 0.5, 0.012, MAT.deckDark, 0, S.bedY + 0.3, hz - 0.03, body); // a dark board behind the rails, so you do not see through to the bales

  // The axle on two leaf springs, held by U-bolts, with a shackle at each end of each spring on a hanger bracket from the rail, and a grease nipple.
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, (S.bedHalfWidth + 0.14) * 2, 8), PART_MAT.steel);
  axle.rotation.z = Math.PI / 2;
  axle.position.set(0, S.wheelRadius, 0);
  axle.castShadow = true;
  body.add(axle);
  for (const s of [-0.6, 0.6]) {
    addLeafSpring(body, s, S.wheelRadius + 0.09, 1.0, 3, PART_MAT.steel);
    addUBolts(body, s, S.wheelRadius + 0.045, 0, 0.14);
    box(0.08, 0.2, 0.12, PART_MAT.steel, s, S.wheelRadius + 0.2, 0, body); // the spring's seat on the rail
    for (const e of [-1, 1]) box(0.1, 0.14, 0.04, PART_MAT.paint, s, S.wheelRadius + 0.22, e * 0.53, body); // the hanger and the shackle's bracket
  }

  // The drawbar: an A-frame of two flat bars meeting at an over-run coupling (a damper tube along the drawbar, the lunette ring at the end), a handbrake
  // lever, a breakaway cable and a chain, the lights' lead with its socket, a chassis plate, and a jockey wheel wound up.
  // The A-frame: a bar from the front of each main rail running in to the coupling (so it narrows towards the front: the bars lead from the rails
  // at x +-0.6 to the coupling at x +-0.07), joined to the rails by a plate each, braced across by a bar and a gusset at the coupling. Galvanised.
  const gal = galvanised();
  const railY = S.bedY - 0.16;
  for (const s of [-1, 1]) {
    beam(body, [s * 0.6, railY, S.frontZ - 0.25], [s * 0.07, S.ringHeight + 0.1, 2.25], 0.07, 0.08, gal);
    box(0.12, 0.1, 0.16, gal, s * 0.6, railY, S.frontZ - 0.12, body); // the plate joining it to the rail's end
  }
  beam(body, [-0.42, railY - 0.005, 1.78], [0.42, railY - 0.005, 1.78], 0.05, 0.06, gal); // the cross brace
  addGusset(body, -0.07, S.ringHeight + 0.145, 2.18, 0.22, -1, 1, gal);
  addGusset(body, 0.07, S.ringHeight + 0.145, 2.18, 0.22, 1, 1, gal);
  box(0.14, 0.1, 0.5, PART_MAT.paint, 0, S.ringHeight + 0.1, 2.45, body);
  box(0.16, 0.12, 0.3, PART_MAT.steel, 0, S.ringHeight + 0.1, 2.2, body); // the over-run housing, where the two bars meet
  body.add(new THREE.Mesh(rod([0, S.ringHeight + 0.1, 2.2], [0, S.ringHeight + 0.1, 2.5], 0.035, 10), PART_MAT.galv)); // the damper's tube
  box(0.1, 0.1, 0.1, PART_MAT.steel, 0, S.ringHeight, 2.52, body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 6, 12), PART_MAT.steel);
  ring.position.set(0, S.ringHeight, 2.6);
  ring.rotation.y = Math.PI / 2;
  body.add(ring);
  addJockeyWheel(body, 0.1, S.ringHeight + 0.05, 2.25);
  // The handbrake: a lever off the left of the housing, up and back, with a grip and a ratchet, and the cable down the bar to the axle's brakes.
  const hb = new THREE.Group();
  hb.position.set(-0.12, S.ringHeight + 0.17, 2.12);
  hb.rotation.x = -0.9;
  hb.add(new THREE.Mesh(rod([0, 0, 0], [0, 0.32, 0], 0.01, 6), PART_MAT.steel));
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 8), PART_MAT.rubber);
  grip.position.y = 0.34;
  hb.add(grip);
  body.add(hb);
  box(0.02, 0.1, 0.1, PART_MAT.steel, -0.12, S.ringHeight + 0.2, 2.1, body); // the ratchet quadrant
  addCable(body, [[-0.12, S.ringHeight + 0.19, 2.1], [-0.13, S.ringHeight + 0.1, 1.7], [-0.2, S.ringHeight + 0.1, 0.8], [-0.4, S.wheelRadius + 0.1, 0.12]], 0.007, 0.03); // the brake cable
  addCable(body, [[0.08, S.ringHeight + 0.12, 2.3], [0.2, S.ringHeight + 0.0, 2.0], [0.2, S.ringHeight + 0.1, 1.6]], 0.005, 0.2); // the breakaway cable, looped
  addEye(body, -0.07, S.ringHeight + 0.1, 2.4, -1); // the chain's two eyes, welded one on each side of the coupling plate...
  addEye(body, 0.07, S.ringHeight + 0.1, 2.4, 1);
  addChain(body, [-0.09, S.ringHeight + 0.088, 2.4], [0.09, S.ringHeight + 0.088, 2.4], 8, 0.05); // ...and the safety chain between them (a loop, to hook on the towing vehicle)
  // The lights' lead: from the board at the back along the left rail and the drawbar to a socket on a little bracket at the front, which hangs.
  addCable(body, [[-S.bedHalfWidth + 0.2, S.bedY - 0.12, S.rearZ], [-0.62, S.bedY - 0.28, -0.5], [-0.62, S.bedY - 0.28, S.frontZ - 0.1], [-0.3, S.ringHeight + 0.2, 1.9], [-0.26, S.ringHeight + 0.06, 2.25]], 0.009, 0.05);
  box(0.05, 0.06, 0.04, PART_MAT.cableSpiral, -0.26, S.ringHeight + 0.02, 2.27, body); // the socket
  const plate = decalMesh('chassis', { maker: 'fenwick', seed: 7 }, { width: 0.12, name: 'chassisPlate' });
  plate.position.set(-0.081, S.ringHeight + 0.1, 2.2); // on the over-run housing's left face (its face is at x -0.08)
  plate.rotation.y = -Math.PI / 2;
  body.add(plate);
  addRearLights(body, S.bedHalfWidth - 0.15, S.bedY - 0.14, S.rearZ - 0.05);

  // Bales: a stack two high across the front, and a single layer in front of that on its back side for the girls to sit on.
  const top = S.bedY + S.baleHeight / 2;
  let n = 0;
  for (const x of [-0.5, 0.5]) {
    bale(x, top, S.frontZ - 0.22, body, n++ % 3 === 2);
    bale(x, top + S.baleHeight, S.frontZ - 0.22, body, n++ % 3 === 0);
    bale(x, top, S.frontZ - 0.67, body, n++ % 3 === 1);
  }

  buildRamps(body);
  buildWinch(body);
  for (const o of body.children) if (/^(ramp|seat)/.test(o.name) || o.name === 'straps' || o.name === 'winchEye') o.userData.keep = true; // the posed and the placed parts are left out of the merge

  // Where the girls sit: hips on the top of the lower layer at the edge of the well, facing forward.
  const seatY = S.bedY + S.baleHeight;
  for (const [name, side] of [['seatLeft', 1], ['seatRight', -1]]) {
    const a = new THREE.Object3D();
    a.name = name;
    a.position.set(side * S.seatX, seatY, S.seatZ);
    a.rotation.y = Math.PI; // facing back over the clear bed, leaning on the high bales
    body.add(a);
  }

  // Wheels, with a curved mudguard over each.
  for (const [name, side] of [['wheelLeft', 1], ['wheelRight', -1]]) {
    root.add(buildWheel(name, side * (S.bedHalfWidth + 0.14), S.wheelRadius, 0.2, 'farm'));
    addMudguard(root, side * (S.bedHalfWidth + 0.14), S.wheelRadius, 0.26, PART_MAT.paint, S.bedHalfWidth);
  }
  mergeStatic(root);
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return root;
}

const ALU = new THREE.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.45, metalness: 0.7 });
const STRAP = new THREE.MeshStandardMaterial({ color: 0xe0780f, roughness: 0.7 });

// Two loading ramps, each a plank of aluminium with cleats and side lips on its walking face. Built about their upper end (the pivot) running along +Z with
// the walking face on the -Y side, so that turned upside down (poseRamps: rotation.x from pi) the face is up and the lips and cleats stand proud of it.
function buildRamps(body) {
  const S = TRAILER_SPEC;
  for (const [name, side] of [['rampLeft', 1], ['rampRight', -1]]) {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.set(side * S.rampX, S.bedY + 0.03, S.rearZ + S.rampLength - 0.1);
    pivot.rotation.x = Math.PI;
    box(S.rampWidth, 0.03, S.rampLength, ALU, 0, 0.015, S.rampLength / 2, pivot);
    for (const e of [-1, 1]) box(0.04, 0.045, S.rampLength - 0.04, ALU, e * (S.rampWidth / 2 - 0.015), -0.0075, S.rampLength / 2, pivot); // side lips on the walking face
    for (let i = 1; i < 9; i++) box(S.rampWidth - 0.09, 0.012, 0.03, PART_MAT.steel, 0, -0.006, (i * S.rampLength) / 9, pivot); // cleats across it
    box(S.rampWidth - 0.1, 0.03, 0.06, PART_MAT.steel, 0, 0.0, 0.03, pivot); // the hook plate at the upper end, that sits over the bed's edge
    body.add(pivot);
  }
}

// The winch: a drum in a frame against the back of the bales, cable out of the bottom, and the two ratchet straps for the load.
function buildWinch(body) {
  const S = TRAILER_SPEC;
  box(0.36, 0.2, 0.22, PART_MAT.paint, 0, S.bedY + 0.12, S.winchZ + 0.1, body).name = 'winch';
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.26, 10), PART_MAT.steel);
  drum.rotation.z = Math.PI / 2;
  drum.position.set(0, S.bedY + 0.12, S.winchZ - 0.02);
  body.add(drum);
  const eye = new THREE.Object3D();
  eye.name = 'winchEye';
  eye.position.set(0, S.bedY + 0.12, S.winchZ - 0.1);
  body.add(eye);

  const straps = new THREE.Group();
  straps.name = 'straps';
  straps.visible = false;
  for (const i of [0, 1]) {
    const s = new THREE.Group();
    s.name = `strap${i}`;
    box(1.14, 0.025, 0.05, STRAP, 0, 0.6, 0, s); // over the top
    for (const side of [-1, 1]) box(0.025, 0.6, 0.05, STRAP, side * 0.57, 0.3, 0, s); // down each side to the deck
    straps.add(s);
  }
  body.add(straps);
}
