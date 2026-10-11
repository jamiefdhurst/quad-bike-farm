import * as THREE from 'three';
import { MAT, STYLE, add, rbox, buildSedimentBowl, tube, pipe, buildHandlebars, addHeadlightBeams, addTailLights } from './quadModel.js';
import { mergeStatic, loftGeometry, shellGeometry } from './quadGeometry.js';

// The neighbour's old three-wheeler: a sun-bleached ATC with one front wheel, two fat balloon tyres at the back, a flat seat and a tall,
// narrow stance, so it tips if you throw it round. Same named parts as a quad's model so Quad drives it unchanged (see quadModel.js).
// Beaten up: rust, a taped seat, a bent mudguard.
//
// +Z is forward and +X is the rider's left.

export const ATC_GROUND_OFFSET = -0.4; // chassis origin to the ground at rest, metres
const R = 0.3; // wheel radius
const REST = 0.2; // suspension rest length: matches the spec's suspensionRestLength
const wheelY = R + REST + ATC_GROUND_OFFSET; // where each suspension mount sits in the chassis frame
const FRONT_Z = 0.62;
const REAR_Z = -0.55;
const HALF_TRACK = 0.45;

/** Where the wheels, their mounts and the bodywork box are, for QuadPhysics: one wheel at the front, two at the back. */
export const ATC_LAYOUT = {
  wheels: [
    { name: 'wheel_fl', x: 0, z: FRONT_Z, front: true, stiffness: 2 }, // the lone front wheel carries about twice what a rear one does
    { name: 'wheel_rl', x: HALF_TRACK, z: REAR_Z, front: false },
    { name: 'wheel_rr', x: -HALF_TRACK, z: REAR_Z, front: false },
  ],
  topY: wheelY,
  chassis: { hx: 0.3, hy: 0.2, hz: 0.9, y: 0.2 },
};

/** The invisible box you look at to get on. */
export const ATC_PROXY = { w: 1.3, h: 1.2, d: 2.0 };

// Moulded fender profiles, [z, y] from the wheel centre, front to back, and a rounded crown to match (see PROFILE and SECTION in quadModel.js).
const FRONT_FENDER = [[0.36, 0.1], [0.33, 0.25], [0.25, 0.37], [0.1, 0.43], [-0.05, 0.44], [-0.2, 0.41], [-0.3, 0.31], [-0.34, 0.18]];
const REAR_FENDER = [[0.4, 0.14], [0.38, 0.27], [0.3, 0.38], [0.14, 0.44], [-0.04, 0.46], [-0.2, 0.44], [-0.33, 0.37], [-0.4, 0.25], [-0.42, 0.14]];
const FENDER_SECTION = [[0, 0.07], [0.02, 0.022], [0.07, 0.004], [0.3, -0.01], [0.6, -0.012], [0.82, -0.004], [0.92, 0.01], [0.97, 0.032], [1.0, 0.06], [0.985, 0.088]];

const RUST = new THREE.MeshStandardMaterial({ color: 0x6b3f26, roughness: 0.85, metalness: 0.3 });
const TAPE = new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.5 });

function buildWheel(w, paint) {
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  spin.name = 'spin';
  spin.userData.keep = true;
  wheel.add(spin);
  const side = Math.sign(w.x) || 1;
  // A fat, soft balloon tyre (0.3 m wide) with a ring of lugs, on a small steel rim.
  add(new THREE.TorusGeometry(R - 0.15, 0.15, 14, 32).rotateY(Math.PI / 2), MAT.rubber, spin);
  const lugs = 26;
  for (let i = 0; i < lugs; i++) {
    const a = (i / lugs) * Math.PI * 2;
    const lug = add(new THREE.BoxGeometry(0.26, 0.032, 0.034), MAT.rubber, spin);
    lug.position.set(0, Math.sin(a) * (R - 0.004), Math.cos(a) * (R - 0.004));
    lug.rotation.x = -a + Math.PI / 2;
  }
  add(new THREE.CylinderGeometry(0.11, 0.11, 0.26, 16).rotateZ(Math.PI / 2), MAT.engineDark, spin);
  add(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 16).rotateZ(Math.PI / 2), RUST, spin).position.x = side * 0.13;
  add(new THREE.CylinderGeometry(0.04, 0.04, 0.34, 10).rotateZ(Math.PI / 2), MAT.steel, spin);
  mergeStatic(wheel);
  if (w.front) {
    // Fork legs outside the tyre, an axle between them, and a moulded fender over the wheel that turns with it.
    for (const s of [-1, 1]) {
      tube([s * 0.19, 0, 0], [s * 0.19, 0.62, -0.14], 0.024, MAT.chrome, wheel);
      tube([s * 0.19, 0.22, -0.045], [s * 0.19, 0.4, -0.09], 0.032, MAT.engineDark, wheel);
    }
    add(shellGeometry(FRONT_FENDER, FENDER_SECTION, -0.2, 0.2, { samples: 28 }), paint, wheel);
    mergeStatic(wheel);
  }
  return wheel;
}

export function buildAtcModel({ bodyColor = 0xb4553f, dashStyle = 'kidsKey', chokeStyle = 'knob' } = {}) {
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.6, side: THREE.DoubleSide }); // chalky from years in the sun
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x2c302c, roughness: 0.08, metalness: 0.2, emissive: 0x000000 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x1c1b1a, roughness: 0.7 }); // its own, so frost on one seat is not on them all
  const quad = new THREE.Group();
  quad.name = 'quad';
  quad.userData.lensMaterial = lensMat;
  quad.userData.seatMaterial = seatMat;
  const body = new THREE.Group();
  body.name = 'body';
  quad.add(body);
  const root = new THREE.Group();
  root.name = 'bodyRoot';
  body.add(root);

  // The frame: tubes round the engine from the steering head, with a rail back under the seat and an axle housing across the rear.
  tube([0, 0.74, 0.4], [0, 0.4, 0.14], 0.026, MAT.frame, root);
  tube([0, 0.4, 0.14], [0, 0.4, -0.5], 0.026, MAT.frame, root);
  tube([0, 0.74, 0.4], [0, 0.68, -0.2], 0.026, MAT.frame, root);
  tube([0, 0.68, -0.2], [0, 0.4, -0.5], 0.024, MAT.frame, root);
  for (const s of [-1, 1]) {
    tube([s * 0.13, 0.4, 0.1], [s * 0.13, 0.4, -0.5], 0.02, MAT.frame, root);
    tube([s * 0.13, 0.4, -0.5], [s * 0.13, 0.3, REAR_Z], 0.02, MAT.frame, root);
  }
  tube([-HALF_TRACK, 0.3, REAR_Z], [HALF_TRACK, 0.3, REAR_Z], 0.04, MAT.steel, root);

  // The engine: a finned barrel and head standing up, the crankcase and gearbox under it, a pull-start housing on the left.
  rbox(0.2, 0.22, 0.32, 0.05, MAT.engine, 0, 0.34, -0.02, root);
  rbox(0.22, 0.2, 0.22, 0.05, MAT.engineDark, 0, 0.33, -0.28, root);
  add(new THREE.CylinderGeometry(0.075, 0.075, 0.3, 16), MAT.engineDark, root).position.set(0, 0.55, 0.1);
  for (let i = 0; i < 6; i++) add(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 18), MAT.engine, root).position.set(0, 0.45 + i * 0.045, 0.1);
  add(new THREE.CylinderGeometry(0.085, 0.085, 0.07, 16), MAT.alloy, root).position.set(0, 0.72, 0.1);
  add(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 16).rotateZ(Math.PI / 2), MAT.engineDark, root).position.set(0.14, 0.34, -0.05);
  rbox(0.05, 0.1, 0.1, 0.012, MAT.plastic, -0.13, 0.55, 0.2, root); // the carb
  add(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 12).rotateZ(Math.PI / 2), MAT.plastic, root).position.set(-0.17, 0.55, 0.28);

  // Rounded bodywork: the tank lofted from the steering head back, a long flat seat behind it, and a moulded fender over each rear tyre.
  add(loftGeometry([
    { z: 0.46, w: 0.16, y0: 0.7, y1: 0.86 },
    { z: 0.32, w: 0.3, y0: 0.66, y1: 0.95 },
    { z: 0.1, w: 0.34, y0: 0.64, y1: 0.96 },
    { z: -0.08, w: 0.3, y0: 0.66, y1: 0.88 },
    { z: -0.14, w: 0.22, y0: 0.7, y1: 0.84 },
  ], { exponent: 3 }), paint, root);
  add(loftGeometry([
    { z: -0.1, w: 0.22, y0: 0.72, y1: 0.84 },
    { z: -0.25, w: 0.3, y0: 0.72, y1: 0.87 },
    { z: -0.6, w: 0.3, y0: 0.72, y1: 0.87 },
    { z: -0.85, w: 0.22, y0: 0.72, y1: 0.84 },
  ], { exponent: 3 }), seatMat, root);
  rbox(0.05, 0.02, 0.28, 0.008, TAPE, 0.07, 0.875, -0.3, root); // tape over a split in the seat
  for (const s of [-1, 1]) {
    const fender = add(shellGeometry(REAR_FENDER, FENDER_SECTION, s * 0.26, s * 0.64, { samples: 32 }), paint, root);
    fender.position.set(0, 0.3, REAR_Z);
    for (const z of [-0.25, 0.25]) tube([s * 0.14, 0.64, REAR_Z + z * 0.8], [s * 0.34, 0.7, REAR_Z + z], 0.014, MAT.steel, root); // stays
  }
  // A short grab rail and the tail light.
  pipe([[-0.12, 0.84, -0.78], [-0.12, 0.9, -1.0], [0.12, 0.9, -1.0], [0.12, 0.84, -0.78]], 0.013, MAT.steel, root, { bend: 0.05 });
  rbox(0.07, 0.035, 0.015, 0.005, MAT.tail, 0, 0.8, -0.98, root);
  // Rust along the fender edges and the tank, and a ding in the tank.
  for (const s of [-1, 1]) rbox(0.05, 0.012, 0.28, 0.004, RUST, s * 0.62, 0.45, REAR_Z, root).rotation.z = s * 0.4;
  rbox(0.1, 0.012, 0.12, 0.004, RUST, -0.06, 0.97, 0.15, root);

  // Foot rests: ribbed steel plates either side of the engine, ahead of the rear tyres.
  for (const s of [-1, 1]) {
    rbox(0.2, 0.025, 0.5, 0.008, RUST, s * 0.28, 0.25, 0.0, root);
    tube([s * 0.14, 0.38, 0.0], [s * 0.22, 0.26, 0.0], 0.014, MAT.steel, root);
  }

  // The exhaust: out of the front of the barrel, round the right and back to a fat silencer that has gone brown with rust.
  pipe([[0, 0.7, 0.2], [-0.12, 0.52, 0.22], [-0.2, 0.46, -0.1], [-0.2, 0.46, -0.4]], 0.022, MAT.exhaust, root, { bend: 0.06 });
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 14).rotateX(Math.PI / 2), RUST, root).position.set(-0.2, 0.46, -0.55);
  const tip = new THREE.Object3D();
  tip.name = 'exhaustTip';
  tip.position.set(-0.2, 0.46, -0.71);
  root.add(tip);

  // Fuel tap on the left of the tank, turning about X like the quads' (the handle points forward for ON).
  const tap = new THREE.Group();
  tap.name = 'fuelTap';
  tap.userData.keep = true;
  tap.position.set(0.2, 0.74, 0.2);
  rbox(0.04, 0.03, 0.035, 0.008, MAT.plastic, 0.18, 0.74, 0.2, root);
  buildSedimentBowl(root, 0.18, 0.74, 0.2);
  rbox(0.008, 0.012, 0.045, 0.003, MAT.chrome, 0, 0, 0.02, tap, undefined, 1);
  root.add(tap);

  // The bars, the quads' own with the key switch, up on the steering head. A lamp on brackets, a bit crooked.
  const bars = buildHandlebars(dashStyle, STYLE.utility3, chokeStyle);
  bars.position.set(0, 1.0, 0.36);
  add(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 18).rotateX(Math.PI / 2), MAT.plastic, bars).position.set(0, -0.03, 0.14);
  add(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 18).rotateX(Math.PI / 2), RUST, bars).position.set(0, -0.03, 0.2);
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 18).rotateX(Math.PI / 2), lensMat, bars).position.set(0, -0.03, 0.21);
  for (const x of [-0.07, 0.07]) tube([x, -0.06, -0.02], [x * 0.9, -0.03, 0.1], 0.013, MAT.steel, bars);
  const mount = new THREE.Object3D();
  mount.name = 'podMount';
  mount.position.set(0, 0.095, 0.0);
  mount.rotation.x = 0.35;
  bars.add(mount);
  bars.userData.podMount = mount;
  root.add(bars);
  quad.userData.dash = bars.userData.dash;
  quad.userData.podMount = bars.userData.podMount;
  // The choke is on the bars (chokeStyle), the steering column ties the bars to the fork.
  tube([0, 1.0, 0.36], [0, 0.78, 0.4], 0.03, MAT.steel, root);

  // Anchors for people and the camera. One seat: nobody rides on the back.
  const riderAnchor = new THREE.Object3D();
  riderAnchor.name = 'riderAnchor';
  riderAnchor.position.set(0, 0.92, -0.3);
  root.add(riderAnchor);
  const pillionCameraAnchor = new THREE.Object3D();
  pillionCameraAnchor.name = 'pillionCameraAnchor';
  pillionCameraAnchor.position.set(0, 1.71, -0.32);
  root.add(pillionCameraAnchor);
  const cameraAnchor = new THREE.Object3D();
  cameraAnchor.name = 'cameraAnchor';
  cameraAnchor.position.set(0, 1.71, -0.32); // eyes 0.79 m above the seat
  root.add(cameraAnchor);

  // Wheels sit outside the body so they don't rock with it.
  for (const w of ATC_LAYOUT.wheels) {
    const wheel = buildWheel(w, paint);
    wheel.name = w.name;
    quad.add(wheel);
  }

  addHeadlightBeams(quad);
  addTailLights(quad);
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
