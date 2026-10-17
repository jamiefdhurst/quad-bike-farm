import * as THREE from 'three';
import { PART_MAT, box, buildWheel, addMudguard, addJockeyWheel, addRearLights, addChain, addCable, addLeafSpring, addUBolts } from './trailerParts.js';
import { boltsMesh } from './detail/fixings.js';
import { decalMesh } from './detail/decals.js';
import { mergeStatic, rod } from './quadGeometry.js';

// The small tipping trailer, procedural like the others: a galvanised steel tub on one axle with two wheels, a tongue to a quad's hitch,
// and a tailgate that drops. The tub tips up on a pivot at the back.
//
//   trailer (origin on the ground, under the axle; +Z toward the puller, +X left)
//   ├── body          rides on the springs and tilts with the ground
//   │   ├── frame, tongue and ring
//   │   └── tub       pivots at its back edge: rotation.x negative tips the front up
//   │       ├── seat      where a girl's hips go, on the floor
//   │       ├── cargo0..2 where a jerry can or the toolbox stands
//   │       └── tailgate  hinged at its bottom edge: 0 shut, -pi/2 lying flat
//   └── wheelLeft, wheelRight     spin as it rolls

export const TIP_TRAILER_SPEC = {
  floorY: 0.58, // top of the tub's floor above the ground
  halfWidth: 0.56,
  rearZ: -0.95, // the back end of the tub
  frontZ: 0.65, // the front end
  sideHeight: 0.4,
  wheelRadius: 0.3,
  ringHeight: 0.48, // the hitch ring, above the ground
  drawLength: 1.7, // axle to ring
  maxTip: 0.85, // radians
  gateOpen: -Math.PI / 2 - 0.04,
};

// Where things go inside the tub, in tub-local metres (z is from the axle; the tub pivots at the rear edge).
export const SEAT_AT = { x: 0, y: 0.1, z: -0.3 };
// Things stand in a row across the front, the long ones (cans, the toolbox) turned a quarter turn so their long side is along the tub:
// nothing is then wider than the gap between the sides (halfWidth 0.56, less the 0.04 of wall), and the front wall is 0.61 from the axle.
export const CARGO_SPOTS = [
  { x: -0.32, z: 0.3 },
  { x: 0, z: 0.3 },
  { x: 0.32, z: 0.3 },
];
export const CARGO_YAWS = { jumpLeads: 0 }; // by the item's model name; the leads are roundish
export const CARGO_YAW = Math.PI / 2; // and everything else (the cans have names of their own)
// The footprints (across, along) of what goes in, as the models are built, before the quarter turn: a jerry can with its ribs, the
// toolbox, and the jump leads' coil with the clamps out front.
export const CARGO_FOOTPRINTS = {
  jerryCan: { w: 0.36, d: 0.165 },
  toolbox: { w: 0.508, d: 0.228 },
  jumpLeads: { w: 0.36, d: 0.5 },
  oilBottle: { w: 0.16, d: 0.16 },
};

/** Where she stands to climb in or out, beside the wheel on the left, as trailer-local metres. */
export const TIP_STAND = { x: 1.15, z: -0.3 };

const MAT = {
  steel: new THREE.MeshStandardMaterial({ color: 0x4a4c4e, roughness: 0.55, metalness: 0.5 }),
  tub: new THREE.MeshStandardMaterial({ color: 0x9aa3a6, roughness: 0.5, metalness: 0.55 }),
  tubInner: new THREE.MeshStandardMaterial({ color: 0x7d8588, roughness: 0.7, metalness: 0.4 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x1a1917, roughness: 0.95 }),
  rim: new THREE.MeshStandardMaterial({ color: 0x8a2f24, roughness: 0.6 }),
  lamp: new THREE.MeshStandardMaterial({ color: 0xaa1111, roughness: 0.4, emissive: 0x330000 }),
};

export function buildTipTrailerModel() {
  const S = TIP_TRAILER_SPEC;
  const root = new THREE.Group();
  root.name = 'tipTrailer';
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  // Chassis: two rails under the tub with a cross member at each end, and the A-frame tongue up to a ball coupling (a cast head with its cup, the
  // locking handle, a safety chain and the lights' lead), a chassis plate and a jockey wheel wound up.
  const len = S.frontZ - S.rearZ;
  const midZ = (S.frontZ + S.rearZ) / 2;
  for (const s of [-0.38, 0.38]) box(0.06, 0.08, len, MAT.steel, s, S.floorY - 0.1, midZ, body);
  box(S.halfWidth * 2, 0.06, 0.08, MAT.steel, 0, S.floorY - 0.1, S.frontZ - 0.1, body);
  box(S.halfWidth * 2, 0.06, 0.08, MAT.steel, 0, S.floorY - 0.1, S.rearZ + 0.12, body);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.95), MAT.steel);
    leg.position.set(s * 0.2, S.ringHeight + 0.02, S.frontZ + 0.425); // ends on the coupling body
    leg.rotation.y = -s * 0.32;
    leg.castShadow = true;
    body.add(leg);
  }
  box(0.12, 0.08, 0.3, MAT.steel, 0, S.ringHeight + 0.02, S.drawLength - 0.3, body); // the coupling body
  // The ball coupling at the pin: a cast head with a round cup on its underside, and the handle that locks it, rising and folding back.
  box(0.1, 0.09, 0.16, MAT.steel, 0, S.ringHeight + 0.02, S.drawLength - 0.1, body);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 12), MAT.steel);
  cup.position.set(0, S.ringHeight - 0.03, S.drawLength);
  body.add(cup);
  const latch = new THREE.Group();
  latch.position.set(0, S.ringHeight + 0.06, S.drawLength - 0.04);
  latch.rotation.x = -0.5;
  latch.add(new THREE.Mesh(rod([0, 0, 0], [0, 0.11, 0], 0.01, 6), PART_MAT.galv));
  const handleGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.06, 8), PART_MAT.rubber);
  handleGrip.rotation.z = Math.PI / 2;
  handleGrip.position.y = 0.12;
  latch.add(handleGrip);
  body.add(latch);
  addChain(body, [-0.06, S.ringHeight - 0.02, S.drawLength - 0.3], [0.05, S.ringHeight - 0.03, S.drawLength + 0.02], 6, 0.08); // the safety chain
  addCable(body, [[-0.3, S.floorY - 0.05, S.rearZ + 0.1], [-0.3, S.floorY - 0.1, 0.2], [-0.12, S.ringHeight + 0.04, S.frontZ + 0.5], [-0.07, S.ringHeight - 0.06, S.drawLength - 0.4]], 0.007, 0.05); // the lights' lead
  const plate = decalMesh('chassis', { maker: 'fenwick', seed: 11 }, { width: 0.1, name: 'chassisPlate' });
  plate.position.set(-0.061, S.ringHeight + 0.03, S.drawLength - 0.3);
  plate.rotation.y = -Math.PI / 2;
  body.add(plate);
  addJockeyWheel(body, 0, S.ringHeight + 0.05, S.frontZ + 0.75);
  // Axle on a leaf spring each side, with U-bolts, and the spring's seat on the rail.
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
  addRearLights(body, S.halfWidth - 0.12, S.floorY - 0.15, S.rearZ - 0.08, true); // the lights board, on the chassis behind the tub (it does not tip)

  // The tub: floor, two sides, a front wall and the tailgate. Pivots about the back bottom edge.
  const tub = new THREE.Group();
  tub.name = 'tub';
  tub.userData.keep = true;
  tub.position.set(0, S.floorY, S.rearZ);
  body.add(tub);
  const hz = (z) => z - S.rearZ; // tub-local z from trailer-local z
  box(S.halfWidth * 2, 0.04, len, MAT.tubInner, 0, -0.02, hz(midZ), tub);
  for (const s of [-1, 1]) {
    box(0.04, S.sideHeight, len, MAT.tub, s * (S.halfWidth - 0.02), S.sideHeight / 2, hz(midZ), tub);
    box(0.07, 0.04, len + 0.0, MAT.steel, s * (S.halfWidth - 0.02), S.sideHeight, hz(midZ) + 0.02, tub); // rolled top edge (wider than the posts under it, so no face is shared)
  }
  box(S.halfWidth * 2 - 0.02, S.sideHeight + 0.1, 0.04, MAT.tub, 0, (S.sideHeight + 0.1) / 2, hz(S.frontZ) - 0.02, tub); // (a centimetre inside the sides' outer faces, so they share none)
  // Pressed ribs along the sides and across the front, corner posts, and the tipping pivot's hinge lugs at the back.
  for (const s of [-1, 1]) {
    for (const y of [0.12, 0.26]) box(0.012, 0.03, len - 0.1, MAT.tubInner, s * (S.halfWidth + 0.002), y, hz(midZ), tub);
    box(0.06, S.sideHeight + 0.04, 0.07, MAT.steel, s * (S.halfWidth - 0.02), (S.sideHeight + 0.04) / 2, hz(S.frontZ) - 0.025, tub); // proud of the wall, so no shared face
    box(0.06, S.sideHeight + 0.04, 0.05, MAT.steel, s * (S.halfWidth - 0.02), (S.sideHeight + 0.04) / 2, 0.03, tub);
    box(0.07, 0.07, 0.1, MAT.steel, s * 0.3, -0.02, -0.04, tub);
  }
  for (const y of [0.12, 0.26]) box(S.halfWidth * 2 - 0.1, 0.03, 0.008, MAT.tubInner, 0, y, hz(S.frontZ) + 0.003, tub);
  // The tipping pivot: a pin through the two hinge lugs at the back (a rod through them, a washer and split pin each end), and the catch at the front: a
  // spring latch on the chassis's cross member that hooks a bar under the tub's front edge, with its release lever.
  tub.add(new THREE.Mesh(rod([-0.36, -0.02, -0.04], [0.36, -0.02, -0.04], 0.013, 8), MAT.steel));
  for (const s of [-1, 1]) box(0.03, 0.03, 0.03, MAT.steel, s * 0.38, -0.02, -0.04, tub);
  tub.add(new THREE.Mesh(rod([-0.2, -0.045, hz(S.frontZ) - 0.1], [0.2, -0.045, hz(S.frontZ) - 0.1], 0.012, 6), MAT.steel)); // the bar the catch hooks over
  box(0.06, 0.1, 0.05, MAT.steel, 0, -0.1, hz(S.frontZ) - 0.1, tub); // the catch's body, on the tub's underside
  const lever = new THREE.Mesh(rod([0, -0.12, hz(S.frontZ) - 0.1], [0.16, -0.13, hz(S.frontZ) - 0.02], 0.008, 6), PART_MAT.galv); // the release lever, out to the side
  tub.add(lever);
  for (const sd of [-1, 1]) tub.add(boltsMesh([0.08, 0.2, 0.32].map((y) => [sd * (S.halfWidth - 0.02 + 0.031), y, hz(S.frontZ) - 0.025]), [sd, 0, 0], MAT.steel, { size: 0.01, kind: 'hex', name: 'postBolts' })); // bolts through the front posts
  const gate = new THREE.Group();
  gate.name = 'tailgate';
  gate.userData.keep = true;
  gate.position.set(0, 0, 0.0);
  box(S.halfWidth * 2 - 0.08, S.sideHeight, 0.03, MAT.tub, 0, S.sideHeight / 2, -0.015, gate);
  box(S.halfWidth * 2 - 0.04, 0.04, 0.05, MAT.steel, 0, S.sideHeight, -0.02, gate);
  tub.add(new THREE.Mesh(rod([-0.4, 0.0, -0.01], [0.4, 0.0, -0.01], 0.012, 6), MAT.steel)); // the gate's hinge pin along its bottom edge, through the tub's rear
  for (const s of [-1, 1]) {
    box(0.03, 0.06, 0.03, MAT.steel, s * (S.halfWidth - 0.05), S.sideHeight - 0.08, -0.03, gate); // the latch
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 4, 8), MAT.steel);
    chain.position.set(s * (S.halfWidth - 0.02), S.sideHeight - 0.04, -0.015);
    gate.add(chain);
  }
  box(S.halfWidth * 2 - 0.1, 0.03, 0.012, MAT.tubInner, 0, 0.14, -0.034, gate); // a pressed rib
  tub.add(gate);

  // Where a girl sits, and where things stand. These ride the tub as it tips.
  const seat = new THREE.Object3D();
  seat.name = 'seat';
  seat.position.set(SEAT_AT.x, SEAT_AT.y, hz(SEAT_AT.z));
  tub.add(seat);
  CARGO_SPOTS.forEach((c, i) => {
    const a = new THREE.Object3D();
    a.name = `cargo${i}`;
    a.position.set(c.x, 0.02, hz(c.z));
    tub.add(a);
  });

  // Wheels, with a curved mudguard over each.
  for (const [name, side] of [['wheelLeft', 1], ['wheelRight', -1]]) {
    root.add(buildWheel(name, side * (S.halfWidth + 0.11), S.wheelRadius, 0.16, 'atv'));
    addMudguard(root, side * (S.halfWidth + 0.11), S.wheelRadius, 0.22, MAT.tub, S.halfWidth);
  }
  for (const o of tub.children) if (o.name === 'seat' || /^cargo/.test(o.name)) o.userData.keep = true;
  mergeStatic(root);
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return root;
}

/** Tips the tub (0 down to 1 up) and drops the tailgate (0 shut to 1 flat). */
export function poseTipTrailer(model, { tip, gate }) {
  model.getObjectByName('tub').rotation.x = -TIP_TRAILER_SPEC.maxTip * tip;
  model.getObjectByName('tailgate').rotation.x = TIP_TRAILER_SPEC.gateOpen * gate;
}
