import * as THREE from 'three';
import { MAT, STYLE, add, rbox, tube, pipe, buildHandlebars } from './quadModel.js';
import { mergeStatic } from './quadGeometry.js';

// The mini moto: a 50cc pit bike, procedural like the quads. Same named parts as a quad's model so Quad drives it unchanged (see
// quadModel.js). It has two wheels in a line plus two hidden outrigger wheels either side, which only exist to keep the physics upright;
// the body leans into corners for show (`userData.leans`, see quad.js update).
//
// +Z is forward and +X is the rider's left.

export const MOTO_GROUND_OFFSET = -0.35; // chassis origin to the ground at rest, metres
const R = 0.22; // wheel radius
const REST = 0.12; // suspension rest length: matches the spec's suspensionRestLength
const wheelY = R + REST + MOTO_GROUND_OFFSET; // where each suspension mount sits in the chassis frame
const FRONT_Z = 0.5;
const REAR_Z = -0.45;
const OUT_X = 0.38; // the outriggers' half track

/** Where the wheels, their mounts and the bodywork box are, for QuadPhysics. The outriggers don't drive and grip lightly. */
export const MOTO_LAYOUT = {
  wheels: [
    { name: 'wheel_fl', x: 0, z: FRONT_Z, front: true },
    { name: 'wheel_fr', x: -OUT_X, z: 0.05, front: false, driven: false, outrigger: true, gripScale: 0.35 },
    { name: 'wheel_rl', x: OUT_X, z: 0.05, front: false, driven: false, outrigger: true, gripScale: 0.35 },
    { name: 'wheel_rr', x: 0, z: REAR_Z, front: false },
  ],
  topY: wheelY,
  chassis: { hx: 0.17, hy: 0.22, hz: 0.7, y: 0.2 },
};

/** The invisible box you look at to get on. */
export const MOTO_PROXY = { w: 0.9, h: 1.2, d: 1.6 };

function tyreAndRim(wheel, spin, mat) {
  // A knobbly tyre: a torus with a ring of blocks on it, and an alloy rim with a hub inside.
  add(new THREE.TorusGeometry(R - 0.045, 0.045, 10, 26).rotateY(Math.PI / 2), MAT.rubber, spin);
  const lugs = 22;
  for (let i = 0; i < lugs; i++) {
    const a = (i / lugs) * Math.PI * 2;
    const lug = add(new THREE.BoxGeometry(0.075, 0.03, 0.026), MAT.rubber, spin);
    lug.position.set(0, Math.sin(a) * (R - 0.012), Math.cos(a) * (R - 0.012));
    lug.rotation.x = -a + Math.PI / 2;
  }
  add(new THREE.CylinderGeometry(R - 0.09, R - 0.09, 0.07, 18).rotateZ(Math.PI / 2), mat, spin);
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 10).rotateZ(Math.PI / 2), MAT.engineDark, spin);
  mergeStatic(wheel);
}

function buildWheel(w, paint) {
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  spin.name = 'spin';
  spin.userData.keep = true;
  wheel.add(spin);
  if (w.outrigger) return wheel; // nothing to see
  tyreAndRim(wheel, spin, MAT.alloy);
  if (w.front) {
    // The fork legs and a mudguard turn with the wheel; the legs reach up to the bars.
    for (const s of [-1, 1]) {
      tube([s * 0.06, 0, 0], [s * 0.06, 0.6, -0.14], 0.02, MAT.chrome, wheel);
      tube([s * 0.06, 0.28, -0.035], [s * 0.06, 0.42, -0.07], 0.027, MAT.engineDark, wheel);
    }
    rbox(0.13, 0.02, 0.38, 0.008, paint, 0, 0.27, 0.02, wheel).rotation.x = -0.05;
    mergeStatic(wheel);
  }
  return wheel;
}

export function buildMiniMotoModel({ bodyColor = 0xd0d4d8, dashStyle = 'kidsKey' } = {}) {
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.35, side: THREE.DoubleSide });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0xe8e8dc, roughness: 0.05, emissive: 0x000000 });
  const seatMat = MAT.seat.clone(); // its own, so frost on one seat is not on them all
  const quad = new THREE.Group();
  quad.name = 'quad';
  quad.userData.lensMaterial = lensMat;
  quad.userData.seatMaterial = seatMat;
  quad.userData.leans = true;
  const body = new THREE.Group();
  body.name = 'body';
  quad.add(body);
  const root = new THREE.Group();
  root.name = 'bodyRoot';
  body.add(root);

  // Frame: the steering head, a spine over the engine to the seat rails, a down tube and cradle.
  tube([0, 0.72, 0.36], [0, 0.66, -0.1], 0.02, MAT.frame, root);
  tube([0, 0.72, 0.36], [0, 0.3, 0.14], 0.02, MAT.frame, root);
  tube([0, 0.3, 0.14], [0, 0.3, -0.18], 0.02, MAT.frame, root);
  tube([0, 0.66, -0.1], [0, 0.34, -0.2], 0.02, MAT.frame, root);
  tube([0, 0.62, -0.12], [0, 0.6, -0.5], 0.018, MAT.frame, root);
  // Swingarm and the rear shock.
  for (const s of [-1, 1]) tube([s * 0.07, 0.32, -0.2], [s * 0.07, 0.22, REAR_Z], 0.017, MAT.frame, root);
  tube([0, 0.6, -0.16], [0, 0.32, -0.3], 0.018, MAT.chrome, root);
  tube([0, 0.5, -0.19], [0, 0.4, -0.23], 0.028, STYLE.sport.spring, root);

  // The engine: crankcase, barrel and head, with a pull-start housing on the left.
  rbox(0.15, 0.2, 0.25, 0.03, MAT.engine, 0, 0.3, -0.02, root);
  rbox(0.11, 0.17, 0.12, 0.02, MAT.engineDark, 0, 0.45, 0.04, root);
  rbox(0.13, 0.04, 0.13, 0.01, MAT.alloy, 0, 0.55, 0.04, root);
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 14).rotateZ(Math.PI / 2), MAT.engineDark, root).position.set(0.1, 0.3, -0.05);
  rbox(0.05, 0.1, 0.12, 0.012, MAT.plastic, -0.1, 0.4, 0.04, root); // the carb, with the air filter behind
  rbox(0.07, 0.09, 0.1, 0.02, MAT.plastic, -0.1, 0.4, -0.08, root);

  // The tank over the spine, the seat behind it and a short tail with the plate.
  rbox(0.2, 0.14, 0.32, 0.05, paint, 0, 0.72, 0.18, root);
  rbox(0.19, 0.075, 0.5, 0.03, seatMat, 0, 0.7, -0.2, root);
  rbox(0.14, 0.02, 0.2, 0.01, paint, 0, 0.66, -0.55, root).rotation.x = 0.25;
  rbox(0.07, 0.03, 0.01, 0.004, MAT.tail, 0, 0.67, -0.65, root);
  // Side panels.
  for (const s of [-1, 1]) rbox(0.015, 0.12, 0.26, 0.01, paint, s * 0.1, 0.55, -0.15, root);

  // Foot pegs and the brake pedal.
  for (const s of [-1, 1]) {
    tube([s * 0.07, 0.26, -0.05], [s * 0.16, 0.26, -0.05], 0.01, MAT.steel, root);
    rbox(0.07, 0.015, 0.025, 0.005, MAT.steel, s * 0.19, 0.26, -0.05, root);
  }

  // The exhaust: out of the front of the barrel, round the right and back to a small silencer.
  pipe([[-0.0, 0.5, 0.1], [-0.08, 0.38, 0.12], [-0.13, 0.36, -0.1], [-0.14, 0.4, -0.35]], 0.018, MAT.exhaust, root, { bend: 0.06 });
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.26, 12).rotateX(Math.PI / 2), MAT.exhaust, root).position.set(-0.14, 0.4, -0.43);
  const tip = new THREE.Object3D();
  tip.name = 'exhaustTip';
  tip.position.set(-0.14, 0.4, -0.57);
  root.add(tip);

  // Fuel tap on the left of the tank, turning about X like the quads' (the handle points forward for ON).
  const tap = new THREE.Group();
  tap.name = 'fuelTap';
  tap.userData.keep = true;
  tap.position.set(0.115, 0.67, 0.16);
  rbox(0.04, 0.03, 0.035, 0.008, MAT.plastic, 0.11, 0.67, 0.16, root);
  rbox(0.008, 0.012, 0.045, 0.003, MAT.chrome, 0, 0, 0.02, tap, undefined, 1);
  root.add(tap);

  // The bars, the same as the quads' with the key switch dash, a bit narrower; a round headlight on them turns with the steering.
  const bars = buildHandlebars(dashStyle, STYLE.sport, 'thumb');
  bars.scale.setScalar(0.85);
  bars.position.set(0, 0.84, 0.34);
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 18).rotateX(Math.PI / 2), MAT.chrome, bars).position.set(0, -0.02, 0.15);
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 18).rotateX(Math.PI / 2), lensMat, bars).position.set(0, -0.02, 0.18);
  root.add(bars);
  quad.userData.dash = bars.userData.dash;
  quad.userData.podMount = bars.userData.podMount;
  // The choke is on the bars' thumb lever; the quads' other chokeLever is the same named part, so Quad finds it there.

  // Anchors for people and the camera. One seat: nobody rides on the back.
  const riderAnchor = new THREE.Object3D();
  riderAnchor.name = 'riderAnchor';
  riderAnchor.position.set(0, 0.78, -0.2);
  root.add(riderAnchor);
  const pillionCameraAnchor = new THREE.Object3D();
  pillionCameraAnchor.name = 'pillionCameraAnchor';
  pillionCameraAnchor.position.set(0, 1.57, -0.22);
  root.add(pillionCameraAnchor);
  const cameraAnchor = new THREE.Object3D();
  cameraAnchor.name = 'cameraAnchor';
  cameraAnchor.position.set(0, 1.57, -0.22); // eyes 0.79 m above the seat
  root.add(cameraAnchor);

  // Wheels sit outside the body so they don't rock with it.
  for (const w of MOTO_LAYOUT.wheels) {
    const wheel = buildWheel(w, paint);
    wheel.name = w.name;
    quad.add(wheel);
  }

  mergeStatic(root);
  mergeStatic(bars);
  quad.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return quad;
}
