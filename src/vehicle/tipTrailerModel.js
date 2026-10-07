import * as THREE from 'three';

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

function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function buildTipTrailerModel() {
  const S = TIP_TRAILER_SPEC;
  const root = new THREE.Group();
  root.name = 'tipTrailer';
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  // Chassis: two rails under the tub, a cross member and the A-frame tongue up to the ring.
  const len = S.frontZ - S.rearZ;
  const midZ = (S.frontZ + S.rearZ) / 2;
  for (const s of [-0.38, 0.38]) box(0.06, 0.08, len, MAT.steel, s, S.floorY - 0.1, midZ, body);
  box(S.halfWidth * 2, 0.06, 0.08, MAT.steel, 0, S.floorY - 0.1, S.frontZ - 0.1, body);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.25), MAT.steel);
    leg.position.set(s * 0.2, S.ringHeight + 0.05, S.frontZ + 0.5);
    leg.rotation.y = -s * 0.16;
    leg.castShadow = true;
    body.add(leg);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 6, 12), MAT.steel);
  ring.position.set(0, S.ringHeight, S.drawLength);
  ring.rotation.y = Math.PI / 2;
  body.add(ring);
  box(0.08, 0.1, 0.16, MAT.steel, 0, S.ringHeight, S.drawLength - 0.1, body);

  // The tub: floor, two sides, a front wall and the tailgate. Pivots about the back bottom edge.
  const tub = new THREE.Group();
  tub.name = 'tub';
  tub.position.set(0, S.floorY, S.rearZ);
  body.add(tub);
  const hz = (z) => z - S.rearZ; // tub-local z from trailer-local z
  box(S.halfWidth * 2, 0.04, len, MAT.tubInner, 0, -0.02, hz(midZ), tub);
  for (const s of [-1, 1]) {
    box(0.04, S.sideHeight, len, MAT.tub, s * (S.halfWidth - 0.02), S.sideHeight / 2, hz(midZ), tub);
    box(0.06, 0.04, len + 0.02, MAT.steel, s * (S.halfWidth - 0.02), S.sideHeight, hz(midZ), tub); // rolled top edge
  }
  box(S.halfWidth * 2, S.sideHeight + 0.1, 0.04, MAT.tub, 0, (S.sideHeight + 0.1) / 2, hz(S.frontZ) - 0.02, tub);
  const gate = new THREE.Group();
  gate.name = 'tailgate';
  gate.position.set(0, 0, 0.0);
  box(S.halfWidth * 2 - 0.08, S.sideHeight, 0.03, MAT.tub, 0, S.sideHeight / 2, -0.015, gate);
  box(S.halfWidth * 2 - 0.04, 0.04, 0.05, MAT.steel, 0, S.sideHeight, -0.02, gate);
  for (const s of [-1, 1]) box(0.08, 0.05, 0.03, MAT.lamp, s * (S.halfWidth - 0.1), 0.12, -0.04, gate);
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

  // Wheels, with a mudguard over each.
  for (const [name, side] of [['wheelLeft', 1], ['wheelRight', -1]]) {
    const w = new THREE.Group();
    w.name = name;
    w.position.set(side * (S.halfWidth + 0.11), S.wheelRadius, 0);
    const spin = new THREE.Group();
    spin.name = 'spin';
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(S.wheelRadius, S.wheelRadius, 0.16, 16), MAT.rubber);
    tyre.rotation.z = Math.PI / 2;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.18, 10), MAT.rim);
    hub.rotation.z = Math.PI / 2;
    const lug = box(0.18, 0.05, 0.08, MAT.steel, 0, S.wheelRadius - 0.04, 0, spin); // so the spin shows
    spin.add(tyre, hub);
    w.add(spin);
    for (const m of [tyre, hub, lug]) m.castShadow = true;
    root.add(w);
    box(0.2, 0.03, 0.7, MAT.steel, side * (S.halfWidth + 0.11), S.wheelRadius * 2 + 0.05, 0, root);
  }
  return root;
}

/** Tips the tub (0 down to 1 up) and drops the tailgate (0 shut to 1 flat). */
export function poseTipTrailer(model, { tip, gate }) {
  model.getObjectByName('tub').rotation.x = -TIP_TRAILER_SPEC.maxTip * tip;
  model.getObjectByName('tailgate').rotation.x = TIP_TRAILER_SPEC.gateOpen * gate;
}
