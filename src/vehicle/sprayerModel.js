import { part } from './part.js';
import * as THREE from 'three';
import { PART_MAT, box, buildWheel, addMudguard, addJockeyWheel, addRearLights, addChain, addCable, addLeafSpring, addUBolts, beam, galvanised, addGusset, addEye } from './trailerParts.js';
import { decalMesh } from './detail/decals.js';
import { mergeStatic, rod } from './quadGeometry.js';

// The field sprayer: a single-axle trailer for the green quad, a poly tank on a steel frame, a pump and a folding boom across the back. Procedural
// like the other trailers. The boom has a centre section on the frame and an arm each side that folds up beside the tank (pose it with
// `poseSprayer`).
//
//   sprayer (origin on the ground, under the axle; +Z toward the puller, +X left)
//   ├── body          rides on the springs and tilts with the ground
//   │   ├── frame, tongue and ring, the tank, the pump
//   │   ├── boomMid   the centre section across the back
//   │   │   ├── boomLeft, boomRight   the arms, hinged at the ends of it (userData.keep so they pose)
//   │   │   └── nozzles along each, named nozzle<i> (for the spray)
//   └── wheelLeft, wheelRight     spin as it rolls

export const SPRAYER_SPEC = {
  floorY: 0.58, // top of the frame
  halfWidth: 0.55,
  rearZ: -1.0, // the back of the frame
  frontZ: 0.7, // the front of the frame
  wheelRadius: 0.3,
  ringHeight: 0.48, // the hitch ring, above the ground
  drawLength: 1.7, // axle to ring
  boomY: 0.62, // the boom's height above the ground when it is out
  boomZ: -1.3, // the boom's line behind the axle (matches DEFAULT_SPRAY_PARAMS.boomBehind)
  midHalf: 0.55, // half the centre section
  armLength: 2.45, // each arm: with the centre it makes the 6 m boom
  nozzles: 6, // a side
};

/** The footprint a girl's probes hit, as the other trailers have. */
export const SPRAYER_FOOTPRINT = { halfWidth: 0.6, rearZ: -1.0, frontZ: 0.7 };

const MAT = {
  steel: new THREE.MeshStandardMaterial({ color: 0x4a4c4e, roughness: 0.55, metalness: 0.5 }),
  tank: new THREE.MeshStandardMaterial({ color: 0xd8d6c4, roughness: 0.55, metalness: 0.05 }), // a translucent-looking cream poly tank
  tankDark: new THREE.MeshStandardMaterial({ color: 0x3a6a3c, roughness: 0.6 }), // the green lid
  boom: new THREE.MeshStandardMaterial({ color: 0x2f6a35, roughness: 0.5, metalness: 0.3 }),
  pipe: new THREE.MeshStandardMaterial({ color: 0xc9c9c2, roughness: 0.5 }),
  nozzle: new THREE.MeshStandardMaterial({ color: 0xd8b020, roughness: 0.4 }),
  hose: new THREE.MeshStandardMaterial({ color: 0x1f1f1f, roughness: 0.8 }),
};

export function buildSprayerModel() {
  const S = SPRAYER_SPEC;
  const root = new THREE.Group();
  root.name = 'sprayer';
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  const len = S.frontZ - S.rearZ;
  const midZ = (S.frontZ + S.rearZ) / 2;
  const gal = galvanised();
  // Frame: two rails with cross members, and the A-frame tongue to a ball coupling.
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
  addCable(body, [[-0.3, S.floorY - 0.05, S.rearZ + 0.1], [-0.3, S.floorY - 0.1, 0.2], [-0.12, S.ringHeight + 0.04, S.frontZ + 0.5], [-0.07, S.ringHeight - 0.06, S.drawLength - 0.4]], 0.007, 0.05);
  addJockeyWheel(body, 0, S.ringHeight + 0.05, S.frontZ + 0.75);
  const plate = decalMesh('chassis', { maker: 'fenwick', seed: 17 }, { width: 0.1, name: 'chassisPlate' });
  plate.position.set(-0.061, S.ringHeight + 0.03, S.drawLength - 0.3);
  plate.rotation.y = -Math.PI / 2;
  body.add(plate);

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
  addRearLights(body, S.halfWidth - 0.12, S.floorY - 0.15, S.rearZ - 0.08, true);

  // The tank: a horizontal poly drum on two steel cradles, with a filler neck and lid on top, a sight tube and a drain tap at the back.
  const tankR = 0.36;
  const tankLen = 1.15;
  const tankY = S.floorY + tankR + 0.03;
  const tankZ = 0.05;
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(tankR, tankR, tankLen, 24), MAT.tank);
  drum.rotation.x = Math.PI / 2;
  drum.position.set(0, tankY, tankZ);
  drum.castShadow = true;
  drum.receiveShadow = true;
  body.add(drum);
  for (const e of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(tankR, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), MAT.tank);
    cap.scale.set(1, 0.3, 1); // a shallow dome on each end
    cap.rotation.x = e * (Math.PI / 2);
    cap.position.set(0, tankY, tankZ + e * (tankLen / 2));
    cap.castShadow = true;
    body.add(cap);
  }
  for (const z of [-0.3, 0.4]) {
    box(S.halfWidth * 2 - 0.1, 0.05, 0.08, MAT.steel, 0, S.floorY + 0.01, tankZ + z - 0.05, body);
    for (const s of [-1, 1]) beam(body, [s * 0.4, S.floorY + 0.03, tankZ + z - 0.05], [s * 0.3, tankY + 0.05, tankZ + z - 0.05], 0.03, 0.05, MAT.steel);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(tankR + 0.01, 0.012, 6, 24, Math.PI), MAT.steel); // a strap over the top
    strap.position.set(0, tankY, tankZ + z - 0.05);
    body.add(strap);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.06, 14), MAT.tankDark);
  neck.position.set(0, tankY + tankR - 0.005, tankZ + 0.1);
  body.add(neck);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.03, 14), MAT.tankDark);
  lid.position.set(0, tankY + tankR + 0.04, tankZ + 0.1);
  body.add(lid);
  box(0.025, 0.2, 0.025, MAT.pipe, tankR - 0.01, tankY - 0.05, tankZ - tankLen / 2 - 0.02, body); // the sight tube, on the back end
  const drain = new THREE.Mesh(rod([0, tankY - tankR + 0.04, tankZ - tankLen / 2 - 0.1], [0, tankY - tankR - 0.03, tankZ - tankLen / 2 - 0.1], 0.015, 6), MAT.steel);
  body.add(drain);

  // The pump and its hose: a small engine-black pump on the frame at the front, with a hose up to the tank and one back to the boom.
  box(0.2, 0.16, 0.22, MAT.steel, 0.28, S.floorY + 0.1, S.frontZ - 0.18, body);
  const pumpHead = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 12), PART_MAT.paint);
  pumpHead.rotation.z = Math.PI / 2;
  pumpHead.position.set(0.43, S.floorY + 0.12, S.frontZ - 0.18);
  body.add(pumpHead);
  addCable(body, [[0.28, S.floorY + 0.18, S.frontZ - 0.2], [0.34, tankY - 0.1, tankZ + 0.5], [0.25, tankY + 0.05, tankZ + 0.55]], 0.012, 0.05, MAT.hose);
  addCable(body, [[0.28, S.floorY + 0.04, S.frontZ - 0.28], [0.4, S.floorY - 0.02, 0.1], [0.4, S.floorY - 0.02, S.rearZ + 0.1], [0.3, S.boomY + 0.03, S.boomZ + 0.1]], 0.012, 0.04, MAT.hose);

  // The boom. A centre section across the back, bolted to the frame by two stub arms, with an arm each side hinged at its end.
  const mid = new THREE.Group();
  mid.name = 'boomMid';
  mid.position.set(0, S.boomY, S.boomZ);
  body.add(mid);
  for (const s of [-1, 1]) beam(body, [s * 0.38, S.floorY - 0.1, S.rearZ + 0.08], [s * 0.38, S.boomY, S.boomZ + 0.06], 0.05, 0.05, MAT.steel); // the stubs from the rails
  box(S.midHalf * 2, 0.06, 0.06, MAT.boom, 0, 0, 0, mid);
  box(S.midHalf * 2, 0.04, 0.04, MAT.pipe, 0, -0.07, -0.02, mid); // the spray line under it
  const nozzleAt = (group, x, i) => {
    const n = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 8), MAT.nozzle);
    n.name = `nozzle${i}`;
    n.position.set(x, -0.12, -0.02);
    n.rotation.x = Math.PI; // pointing down
    n.userData.keep = true;
    group.add(n);
  };
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.name = side > 0 ? 'boomLeft' : 'boomRight';
    arm.userData.keep = true;
    arm.userData.side = side;
    arm.position.set(side * S.midHalf, 0, 0);
    mid.add(arm);
    const L = S.armLength;
    // Two tubes, top and bottom, braced with a zig-zag between them: a light lattice arm.
    const top = new THREE.Mesh(rod([0, 0.05, 0], [side * L, 0.03, 0], 0.014, 6), MAT.boom);
    const bot = new THREE.Mesh(rod([0, -0.04, 0], [side * L, -0.03, 0], 0.014, 6), MAT.boom);
    const line = new THREE.Mesh(rod([0, -0.07, -0.02], [side * L, -0.07, -0.02], 0.012, 6), MAT.pipe);
    for (const m of [top, bot, line]) {
      m.castShadow = true;
      arm.add(m);
    }
    for (let k = 0; k < 6; k++) {
      const x0 = (k / 6) * L * side;
      const x1 = ((k + 0.5) / 6) * L * side;
      const x2 = ((k + 1) / 6) * L * side;
      const up = new THREE.Mesh(rod([x0, -0.04, 0], [x1, 0.05, 0], 0.007, 4), MAT.boom);
      const down = new THREE.Mesh(rod([x1, 0.05, 0], [x2, -0.04, 0], 0.007, 4), MAT.boom);
      arm.add(up, down);
    }
    for (let i = 0; i < S.nozzles; i++) nozzleAt(arm, side * (0.3 + (i * (L - 0.35)) / (S.nozzles - 1)), (side > 0 ? 0 : S.nozzles) + i);
    box(0.05, 0.07, 0.06, MAT.steel, 0, 0, 0, arm); // the hinge block
  }
  box(0.05, 0.07, 0.06, MAT.steel, -S.midHalf, 0, 0, mid);
  box(0.05, 0.07, 0.06, MAT.steel, S.midHalf, 0, 0, mid);

  // Wheels with a mudguard over each.
  for (const [name, side] of [['wheelLeft', 1], ['wheelRight', -1]]) {
    root.add(buildWheel(name, side * (S.halfWidth + 0.11), S.wheelRadius, 0.16, 'atv'));
    addMudguard(root, side * (S.halfWidth + 0.11), S.wheelRadius, 0.22, MAT.tank, S.halfWidth);
  }
  // The tank is a see-level mark: the sight tube shows how much is left (scaled in `poseSprayer`).
  const level = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.18, 0.016), new THREE.MeshStandardMaterial({ color: 0x4aa0d8, roughness: 0.3 }));
  level.name = 'level';
  level.position.set(tankR - 0.01, tankY - 0.14, tankZ - tankLen / 2 - 0.036);
  level.userData.keep = true;
  level.userData.baseY = tankY - 0.14;
  body.add(level);
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  mergeStatic(root);
  return root;
}

/**
 * Folds the boom (0 in, 1 out) and sets the sight tube to the tank's level (0..1). In, each arm swings forward to lie along the tank's side (the
 * way a real boom travels), lifted a little so it clears the mudguard.
 */
export function poseSprayer(model, { boom, tank }) {
  const fold = 1 - boom;
  for (const [name, side] of [['boomLeft', 1], ['boomRight', -1]]) {
    const arm = part(model, name);
    arm.rotation.order = 'YZX';
    arm.rotation.set(0, -side * (Math.PI / 2) * fold, side * 0.3 * fold);
  }
  const lv = part(model, 'level');
  lv.scale.y = Math.max(0.02, tank);
  lv.position.y = lv.userData.baseY - 0.09 * (1 - tank);
}

/** The world position of each nozzle (for the spray), appended to `out`. */
export function nozzlePositions(model, out = []) {
  out.length = 0;
  model.traverse((o) => {
    if (/^nozzle\d+$/.test(o.name)) out.push(o.getWorldPosition(new THREE.Vector3()));
  });
  return out;
}
