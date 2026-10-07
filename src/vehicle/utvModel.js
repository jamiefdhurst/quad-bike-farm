import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildDash } from './dash.js';
import { addHeadlightBeams } from './quadModel.js';
import { bentTube, loftGeometry, mergeStatic, rod, springGeometry } from './quadGeometry.js';

// The farm UTV: a Gator-style side-by-side, procedural like the quads and the tractor. A diesel, open-sided, with a bench seat for
// three under a roll cage and roof, a steering wheel on the right (it's British), a pedal pair on the floor, a forward and reverse
// lever on the dash, and a black tipping bed behind the seat with a drop-down tailgate. Same named parts as a quad's model so Quad
// drives it unchanged (see quadModel.js), plus the ones only it has:
//
//   quad
//   ├── body                       rocked by vibration
//   │   └── bodyRoot               ground-referenced: y = 0 is the ground at rest, so it sits at UTV_GROUND_OFFSET in the chassis
//   │       ├── bonnet, fenders, dash panel, floor, bench seat (seatLeft, seatMid anchors), roll cage, roof, exhaust
//   │       ├── dash                       on the dash panel in front of the driver, not turning with the wheel
//   │       ├── steeringColumn > handlebars    the wheel; turns about the column's axis (and holds riderHands, gripLeft, gripRight)
//   │       ├── bed                        hinged at the back: tips up (rotation.x negative). Holds bedSeat and the tailgate
//   │       │   └── tailgate               hinged at its bottom edge: 0 shut, -pi/2 lying flat
//   │       └── riderAnchor, cameraAnchor  the driver's hips and eyes
//   └── wheel_fl / wheel_fr / wheel_rl / wheel_rr   (each with a 'spin' child)
//
// +Z is forward and +X is the driver's left (the driver sits on the right, at -X).

export const UTV_GROUND_OFFSET = -0.6; // chassis origin to the ground at rest, metres
const R = 0.34; // 25 inch tyres
const REST = 0.2; // suspension rest length: matches the spec's suspensionRestLength
const TYRE_W = 0.25;
const RIM_R = 0.16; // a 12 inch rim

const wheelY = R + REST + UTV_GROUND_OFFSET; // where each wheel's suspension mount sits in the chassis frame

/** Where the wheels, their mounts and the bodywork box are, for QuadPhysics. */
export const UTV_LAYOUT = {
  wheels: [
    { name: 'wheel_fl', x: 0.66, z: 0.98, front: true, radius: R, y: wheelY },
    { name: 'wheel_fr', x: -0.66, z: 0.98, front: true, radius: R, y: wheelY },
    { name: 'wheel_rl', x: 0.66, z: -0.98, front: false, radius: R, y: wheelY },
    { name: 'wheel_rr', x: -0.66, z: -0.98, front: false, radius: R, y: wheelY },
  ],
  topY: wheelY,
  chassis: { hx: 0.62, hy: 0.28, hz: 1.45, y: 0.52 + UTV_GROUND_OFFSET },
};

/** The invisible box you look at to get on: ground to roof, wider than the body so it's easy to target. */
export const UTV_PROXY = { w: 1.9, h: 2.1, d: 3.6 };

/**
 * Where people sit and stand, in the model's frame at rest (metres, y up from the ground). The seats are on the bench (the driver, you,
 * at -X); the bed's seat is the open tailgate, facing backwards with her legs hanging. `stand` is where she stands on the ground to
 * climb up: beside her seat, or behind the tailgate.
 */
export const UTV_SEATS = {
  driver: { x: -0.34, y: 0.76, z: -0.2 },
  mid: { x: 0, y: 0.76, z: -0.2 },
  left: { x: 0.34, y: 0.76, z: -0.2 },
  bed: { x: 0, y: 0.8, z: -1.95 }, // on the open tailgate, hips over its middle
};
export const UTV_STAND = {
  left: { x: 1.35, z: -0.1 },
  mid: { x: 1.35, z: -0.1 }, // the middle seat is reached from the left, over the other girl's knees, or from the left when she's not there
  bed: { x: 0, z: -2.75 },
};

/** The most the bed tips, and the tailgate's open angle (radians). */
export const BED_MAX_TIP = 0.82;
export const TAILGATE_OPEN = -Math.PI / 2 - 0.04;

const HINGE = { y: 0.66, z: -1.78 }; // the bed's pivot, at the back of its floor

const MAT = {
  rubber: new THREE.MeshStandardMaterial({ color: 0x1a1917, roughness: 0.95 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.5, metalness: 0.6 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x1d1e20, roughness: 0.55, metalness: 0.3 }), // the black cage and chassis
  cast: new THREE.MeshStandardMaterial({ color: 0x55585b, roughness: 0.6, metalness: 0.4 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xd8dadc, roughness: 0.14, metalness: 1.0 }),
  plastic: new THREE.MeshStandardMaterial({ color: 0x232426, roughness: 0.7 }), // dash, bumper, bed: black moulded plastic
  bed: new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.85 }),
  floor: new THREE.MeshStandardMaterial({ color: 0x2c2d2f, roughness: 0.9 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.45 }), // the rims and a stripe
  tail: new THREE.MeshStandardMaterial({ color: 0xa3211a, roughness: 0.3 }),
  belt: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }),
  knob: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 }),
  glove: new THREE.MeshStandardMaterial({ color: 0x2d3a26, roughness: 0.8 }),
  rust: new THREE.MeshStandardMaterial({ color: 0x4b3a2e, roughness: 0.7, metalness: 0.5 }),
};

function add(geo, mat, parent, name) {
  const m = new THREE.Mesh(geo, mat);
  if (name) m.name = name;
  parent.add(m);
  return m;
}

function rbox(w, h, d, r, mat, x, y, z, parent, name) {
  const m = add(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.999), mat, parent, name);
  m.position.set(x, y, z);
  return m;
}

function tube(a, b, r, mat, parent, radial = 8) {
  return add(rod(a, b, r, radial), mat, parent);
}

/** A cylinder lying along X, at a position. */
function axleCyl(r, len, mat, x, y, z, parent, segments = 20) {
  const m = add(new THREE.CylinderGeometry(r, r, len, segments).rotateZ(Math.PI / 2), mat, parent);
  m.position.set(x, y, z);
  return m;
}

// Wheels ---------------------------------------------------------------------

const cache = new Map();
const cached = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

/** A chunky farm tyre: a drum with two staggered rows of angled lugs. */
function tyre() {
  const lug = 0.03;
  const parts = [new THREE.CylinderGeometry(R - lug, R - lug, TYRE_W, 32).rotateZ(Math.PI / 2)];
  const count = 22;
  for (let row = 0; row < 2; row++) {
    const side = row === 0 ? 1 : -1;
    for (let i = 0; i < count; i++) {
      const a = ((i + row * 0.5) / count) * Math.PI * 2;
      const g = new THREE.BoxGeometry(TYRE_W * 0.52, lug * 2, 0.05);
      const m = new THREE.Matrix4()
        .makeRotationX(a)
        .multiply(new THREE.Matrix4().makeTranslation(side * TYRE_W * 0.24, R - lug * 0.9, 0))
        .multiply(new THREE.Matrix4().makeRotationY(side * 0.5));
      g.applyMatrix4(m);
      parts.push(g);
    }
  }
  return mergeGeometries(parts);
}

function buildWheel(w) {
  const side = Math.sign(w.x);
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  spin.name = 'spin';
  spin.userData.keep = true;
  wheel.add(spin);
  add(cached('tyre', tyre), MAT.rubber, spin);
  // A steel rim in yellow, standing a little proud of the tyre, with a dished centre, four nuts and a cap.
  axleCyl(RIM_R, TYRE_W + 0.04, MAT.yellow, 0, 0, 0, spin);
  axleCyl(RIM_R * 0.92, 0.02, MAT.yellow, side * (TYRE_W / 2 + 0.03), 0, 0, spin);
  axleCyl(0.05, 0.05, MAT.cast, side * (TYRE_W / 2 + 0.05), 0, 0, spin);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const n = add(new THREE.CylinderGeometry(0.012, 0.012, 0.025, 6).rotateZ(Math.PI / 2), MAT.chrome, spin);
    n.position.set(side * (TYRE_W / 2 + 0.05), Math.sin(a) * 0.08, Math.cos(a) * 0.08);
  }
  mergeStatic(wheel);
  return wheel;
}

// The UTV ----------------------------------------------------------------------

export function buildUtvModel({ bodyColor = 0x367c2b, dashStyle = 'utv' } = {}) {
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.42, side: THREE.DoubleSide });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x2a2b2a, roughness: 0.85 });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x2c302c, roughness: 0.08, metalness: 0.2, emissive: 0x000000 });

  const quad = new THREE.Group();
  quad.name = 'quad';
  quad.userData.lensMaterial = lensMat;
  quad.userData.seatMaterial = seatMat;
  quad.userData.steerGain = 6; // the wheel turns about six times as far as the road wheels do, as a car's does
  const body = new THREE.Group();
  body.name = 'body';
  quad.add(body);
  const root = new THREE.Group();
  root.name = 'bodyRoot';
  body.add(root);

  // Chassis: two main rails, cross members and a skid plate; the engine and gearbox under the seat, the axles and arms.
  for (const s of [-1, 1]) tube([s * 0.42, 0.36, -1.6], [s * 0.42, 0.36, 1.3], 0.035, MAT.frame, root);
  for (const z of [1.18, 0.55, -0.3, -0.62, -1.45]) tube([-0.42, 0.36, z], [0.42, 0.36, z], 0.03, MAT.frame, root);
  rbox(0.84, 0.025, 1.5, 0.01, MAT.steel, 0, 0.29, 0.4, root);
  rbox(0.56, 0.28, 0.62, 0.04, MAT.cast, 0, 0.5, -0.25, root); // engine
  rbox(0.4, 0.22, 0.4, 0.04, MAT.steel, 0, 0.48, -0.78, root); // transaxle
  axleCyl(0.045, 1.3, MAT.steel, 0, 0.34, -0.98, root); // rear axle
  axleCyl(0.05, 1.2, MAT.steel, 0, 0.32, 0.98, root); // front axle
  rbox(0.22, 0.16, 0.2, 0.04, MAT.cast, 0, 0.34, 0.98, root); // front diff
  for (const s of [-1, 1]) {
    // Front wishbones and coil-overs, and the rear trailing arms with their dampers.
    tube([s * 0.4, 0.4, 0.8], [s * 0.6, 0.36, 0.98], 0.016, MAT.steel, root);
    tube([s * 0.4, 0.4, 1.16], [s * 0.6, 0.36, 0.98], 0.016, MAT.steel, root);
    tube([s * 0.56, 0.7, 0.98], [s * 0.6, 0.4, 0.98], 0.02, MAT.steel, root);
    add(springGeometry(0.22, 0.04, 0.007, 6), MAT.yellow, root).position.set(s * 0.57, 0.64, 0.98);
    tube([s * 0.42, 0.4, -0.5], [s * 0.6, 0.36, -0.98], 0.018, MAT.steel, root);
    tube([s * 0.55, 0.7, -0.98], [s * 0.6, 0.4, -0.98], 0.02, MAT.steel, root);
    add(springGeometry(0.22, 0.04, 0.007, 6), MAT.yellow, root).position.set(s * 0.57, 0.64, -0.98);
  }

  // The bonnet: a long low hood that swells at the cowl, with a yellow stripe along each flank; a front bumper and the grille.
  add(loftGeometry([
    { z: 0.5, w: 1.18, y0: 0.5, y1: 1.0 },
    { z: 0.95, w: 1.1, y0: 0.5, y1: 0.93 },
    { z: 1.36, w: 0.94, y0: 0.5, y1: 0.84 },
  ], { exponent: 3.2 }), paint, root, 'bonnet');
  for (const s of [-1, 1]) rbox(0.012, 0.03, 0.8, 0.005, MAT.yellow, s * 0.572, 0.62, 0.92, root);
  rbox(0.5, 0.2, 0.05, 0.02, MAT.plastic, 0, 0.7, 1.37, root); // grille
  for (let i = -3; i <= 3; i++) rbox(0.012, 0.17, 0.02, 0.004, MAT.steel, i * 0.065, 0.7, 1.4, root);
  bumper(root);
  // Headlamps in the front corners: a black housing and a lens that lights up.
  for (const s of [-1, 1]) {
    rbox(0.22, 0.13, 0.07, 0.03, MAT.plastic, s * 0.4, 0.78, 1.34, root);
    rbox(0.18, 0.09, 0.02, 0.02, lensMat, s * 0.4, 0.78, 1.375, root);
  }
  // The front fenders: wheel arches in the paint, with flat flanks joining them to the bonnet.
  for (const s of [-1, 1]) {
    const g = new THREE.CylinderGeometry(R + 0.08, R + 0.08, 0.3, 28, 1, true, -0.12, Math.PI + 0.24).rotateZ(Math.PI / 2);
    add(g, paint, root).position.set(s * 0.66, R + 0.04, 0.98);
    rbox(0.1, 0.1, 0.62, 0.03, paint, s * 0.6, 0.66, 0.88, root);
  }

  // The cab: floor with ribs, rocker panels, the dash panel across the front with its glovebox and grab handle.
  rbox(1.2, 0.03, 1.1, 0.01, MAT.floor, 0, 0.34, 0.0, root);
  for (let i = 0; i < 14; i++) rbox(1.1, 0.012, 0.02, 0.004, MAT.plastic, 0, 0.358, -0.5 + i * 0.075, root);
  for (const s of [-1, 1]) {
    rbox(0.1, 0.2, 1.15, 0.03, paint, s * 0.64, 0.42, 0.0, root);
    rbox(0.12, 0.03, 1.0, 0.01, MAT.steel, s * 0.72, 0.34, 0.0, root); // the step along the sill
  }
  add(loftGeometry([
    { z: 0.34, w: 1.3, y0: 0.62, y1: 1.02 },
    { z: 0.5, w: 1.26, y0: 0.6, y1: 1.06 },
    { z: 0.6, w: 1.2, y0: 0.6, y1: 1.0 },
  ], { exponent: 3 }), MAT.plastic, root);
  rbox(0.42, 0.2, 0.05, 0.02, MAT.floor, 0.3, 0.9, 0.33, root); // glovebox door
  rbox(0.1, 0.02, 0.02, 0.008, MAT.steel, 0.3, 0.98, 0.31, root);
  add(bentTube([[0.12, 1.06, 0.36], [0.12, 1.2, 0.34], [0.52, 1.2, 0.34], [0.52, 1.06, 0.36]], 0.014, { bend: 0.03, radial: 6 }), MAT.steel, root); // the passenger's grab handle
  for (const x of [-0.04, 0.1]) add(new THREE.CylinderGeometry(0.03, 0.026, 0.02, 14), MAT.floor, root).position.set(x, 1.065, 0.46); // cup holders
  for (const x of [-0.04, 0.1]) add(new THREE.CylinderGeometry(0.026, 0.026, 0.002, 14), MAT.plastic, root).position.set(x, 1.075, 0.46);

  // The bench: a base, a cushion and a split backrest, in grey cloth, with the three seat belts stowed down the back.
  rbox(1.38, 0.3, 0.46, 0.04, MAT.plastic, 0, 0.55, -0.2, root); // the base it sits on, with the engine under it
  rbox(1.4, 0.1, 0.5, 0.05, seatMat, 0, 0.71, -0.19, root, 'seatCushion');
  const back = rbox(1.4, 0.56, 0.1, 0.05, seatMat, 0, 1.06, -0.48, root, 'seatBack');
  back.rotation.x = -0.12; // leans back a touch
  for (const x of [-0.235, 0.235]) {
    rbox(0.012, 0.02, 0.5, 0.004, MAT.plastic, x, 0.762, -0.19, root); // the seams
    const seam = rbox(0.012, 0.56, 0.02, 0.004, MAT.plastic, x, 1.06, -0.43, root);
    seam.rotation.x = -0.12;
  }
  for (const x of [-0.46, 0, 0.46]) {
    const belt = rbox(0.045, 0.5, 0.012, 0.004, MAT.belt, x, 1.1, -0.425, root);
    belt.rotation.x = -0.12;
    rbox(0.05, 0.06, 0.02, 0.006, MAT.steel, x, 0.88, -0.42, root).rotation.x = -0.12; // the tongue
  }

  // The roll cage: two hoops joined by roof rails, a cab guard behind the seat, and a bar along each side. Black tube all through.
  const post = 0.03;
  const hoop = (z0, z1) => add(bentTube([[-0.62, 0.78, z0], [-0.58, 1.9, z1], [0.58, 1.9, z1], [0.62, 0.78, z0]], post, { bend: 0.1, radial: 8 }), MAT.frame, root);
  hoop(0.58, 0.2);
  hoop(-0.64, -0.64);
  for (const s of [-1, 1]) {
    tube([s * 0.58, 1.9, 0.2], [s * 0.58, 1.9, -0.64], post, MAT.frame, root);
    tube([s * 0.62, 1.02, 0.52], [s * 0.64, 1.02, -0.6], 0.02, MAT.frame, root); // the side bar
    tube([s * 0.64, 0.82, -0.6], [s * 0.64, 1.02, -0.6], 0.02, MAT.frame, root);
    tube([s * 0.6, 1.9, -0.2], [s * 0.6, 1.2, -0.62], 0.018, MAT.frame, root); // a brace down to the guard
  }
  tube([-0.6, 1.45, -0.64], [0.6, 1.45, -0.64], 0.02, MAT.frame, root);
  for (const x of [-0.4, -0.2, 0, 0.2, 0.4]) tube([x, 1.45, -0.64], [x, 1.12, -0.64], 0.012, MAT.frame, root); // the cab guard's bars
  // The roof: a moulded panel in the paint, with a slight dome and an overhang front and back.
  add(loftGeometry([
    { z: 0.34, w: 1.4, y0: 1.9, y1: 1.945 },
    { z: -0.14, w: 1.44, y0: 1.9, y1: 1.975 },
    { z: -0.72, w: 1.4, y0: 1.9, y1: 1.945 },
  ], { exponent: 3 }), paint, root, 'roof');

  // The steering wheel on its column, raked back to the driver (on the right). `handlebars` is the wheel itself, so it turns about the
  // column's axis; the dash sits on the column's shroud so it doesn't turn with it.
  const column = new THREE.Group();
  column.name = 'steeringColumn';
  column.userData.keep = true;
  column.position.set(-0.34, 0.84, 0.5);
  column.rotation.x = -0.95;
  tube([0, 0, 0], [0, 0.46, 0], 0.025, MAT.steel, column);
  root.add(column);
  const wheel = new THREE.Group();
  wheel.name = 'handlebars';
  wheel.userData.keep = true;
  wheel.position.set(0, 0.46, 0);
  column.add(wheel);
  add(new THREE.TorusGeometry(0.19, 0.017, 8, 32).rotateX(Math.PI / 2), MAT.plastic, wheel);
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 14), MAT.plastic, wheel); // the horn pad
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    tube([0, 0, 0], [Math.sin(a) * 0.19, 0, Math.cos(a) * 0.19], 0.013, MAT.plastic, wheel);
  }
  for (const side of [1, -1]) {
    const grip = new THREE.Object3D();
    grip.name = side > 0 ? 'gripLeft' : 'gripRight';
    grip.userData.keep = true;
    grip.position.set(side * 0.19, 0, 0);
    wheel.add(grip);
  }
  const hands = new THREE.Group(); // your own arms aren't drawn: Quad just expects the group
  hands.name = 'riderHands';
  hands.userData.keep = true;
  hands.visible = false;
  wheel.add(hands);
  // The column shroud and the key slot's bezel on the dash.
  rbox(0.16, 0.2, 0.2, 0.04, MAT.plastic, -0.34, 0.9, 0.52, root);

  // The dash, on top of the shroud and tilted up to the driver.
  const dash = buildDash(dashStyle);
  dash.group.position.set(-0.34, 1.06, 0.44);
  dash.group.rotation.x = 0.95;
  dash.group.scale.setScalar(1.2);
  dash.group.userData.keep = true;
  root.add(dash.group);
  quad.userData.dash = dash;
  quad.userData.podMount = null;

  // Controls: the forward and reverse lever on the dash, the brake and accelerator on the floor, the parking brake handle by the door.
  const fnr = new THREE.Group();
  fnr.name = 'driveLever';
  fnr.userData.keep = true;
  fnr.position.set(-0.08, 1.04, 0.5);
  tube([0, 0, 0], [0, 0.07, -0.06], 0.008, MAT.steel, fnr);
  add(new THREE.SphereGeometry(0.016, 10, 8), MAT.knob, fnr).position.set(0, 0.075, -0.065);
  root.add(fnr);
  rbox(0.1, 0.016, 0.08, 0.005, MAT.plastic, -0.42, 0.37, 0.3, root).rotation.x = -0.5; // the brake, wide
  rbox(0.05, 0.016, 0.12, 0.005, MAT.plastic, -0.27, 0.37, 0.3, root).rotation.x = -0.5; // the accelerator, narrow
  tube([-0.62, 0.68, 0.08], [-0.58, 0.88, -0.02], 0.01, MAT.steel, root); // the parking brake handle
  add(new THREE.SphereGeometry(0.02, 8, 6), MAT.knob, root).position.set(-0.58, 0.89, -0.02);
  // Quad still poses these two; neither belongs on a diesel with no tap and no choke.
  const tap = new THREE.Group();
  tap.name = 'fuelTap';
  tap.userData.keep = true;
  tap.visible = false;
  root.add(tap);
  const choke = new THREE.Group();
  choke.name = 'chokeLever';
  choke.userData.keep = true;
  choke.visible = false;
  root.add(choke);

  // The exhaust: a silencer under the bed on the right with a short tailpipe, and a heat shield.
  const exX = -0.4;
  add(new THREE.CylinderGeometry(0.075, 0.075, 0.55, 14).rotateX(Math.PI / 2), MAT.rust, root).position.set(exX, 0.4, -1.25);
  tube([exX, 0.4, -1.52], [exX, 0.36, -1.7], 0.025, MAT.steel, root);
  tube([exX, 0.42, -0.9], [exX, 0.4, -0.98], 0.025, MAT.steel, root);
  const tip = new THREE.Object3D();
  tip.name = 'exhaustTip';
  tip.position.set(exX, 0.36, -1.7); // smoke leaves along its -Z, which is straight back
  root.add(tip);
  // The rear: a hitch receiver tube and the tail lamps on the frame.
  rbox(0.07, 0.07, 0.3, 0.015, MAT.frame, 0, 0.42, -1.7, root);
  for (const s of [-1, 1]) rbox(0.12, 0.06, 0.03, 0.01, MAT.tail, s * 0.62, 0.52, -1.66, root);

  // The seats' anchors: hips on the cushion's top. The driver's is yours; the other two are where the girls sit.
  for (const [name, seat] of [['riderAnchor', UTV_SEATS.driver], ['seatMid', UTV_SEATS.mid], ['seatLeft', UTV_SEATS.left]]) {
    const a = new THREE.Object3D();
    a.name = name;
    a.position.set(seat.x, seat.y, seat.z);
    root.add(a);
  }
  const cameraAnchor = new THREE.Object3D();
  cameraAnchor.name = 'cameraAnchor';
  cameraAnchor.position.set(UTV_SEATS.driver.x, UTV_SEATS.driver.y + 0.7, UTV_SEATS.driver.z - 0.04); // eyes 0.7 m above the cushion
  root.add(cameraAnchor);

  // The bed: black plastic with ribs, a front wall, low sides with the wheel wells in them and tie-down hooks, on a hinge at the back.
  const bed = new THREE.Group();
  bed.name = 'bed';
  bed.position.set(0, HINGE.y, HINGE.z);
  root.add(bed);
  const zc = (z) => z - HINGE.z; // a world z, as the bed's own
  const yc = (y) => y - HINGE.y;
  rbox(1.52, 0.05, 1.2, 0.015, MAT.bed, 0, yc(0.72), zc(-1.2), bed); // floor
  for (let i = -4; i <= 4; i++) rbox(0.03, 0.012, 1.14, 0.004, MAT.floor, i * 0.15, yc(0.75), zc(-1.2), bed); // ribs
  rbox(1.52, 0.34, 0.05, 0.02, MAT.bed, 0, yc(0.92), zc(-0.66), bed); // front wall, a little higher than the sides
  for (const s of [-1, 1]) {
    rbox(0.05, 0.3, 1.2, 0.02, MAT.bed, s * 0.76, yc(0.89), zc(-1.2), bed); // side
    rbox(0.08, 0.04, 1.2, 0.02, MAT.bed, s * 0.76, yc(1.05), zc(-1.2), bed); // its rolled top edge
    rbox(0.3, 0.3, 0.92, 0.05, MAT.bed, s * 0.6, yc(0.9), zc(-0.98), bed); // the wheel well
    rbox(0.3, 0.02, 0.9, 0.01, MAT.floor, s * 0.6, yc(1.06), zc(-0.98), bed);
    for (const z of [-0.8, -1.6]) add(new THREE.TorusGeometry(0.025, 0.006, 6, 10), MAT.steel, bed).position.set(s * 0.8, yc(1.02), zc(z)); // tie-downs
  }
  // The tailgate, hinged along its bottom edge: shut, it stands up; open, it lies flat behind the bed (where a girl can sit).
  const gate = new THREE.Group();
  gate.name = 'tailgate';
  gate.userData.keep = true;
  gate.position.set(0, yc(0.75), zc(-1.8));
  rbox(1.5, 0.3, 0.04, 0.015, MAT.bed, 0, 0.15, 0, gate);
  rbox(1.44, 0.02, 0.05, 0.008, MAT.steel, 0, 0.295, 0, gate); // the top edge
  for (const s of [-1, 1]) {
    rbox(0.07, 0.07, 0.03, 0.01, MAT.steel, s * 0.55, 0.12, -0.03, gate); // latches
    tube([s * 0.72, 0.28, 0.0], [s * 0.74, 0.0, 0.1], 0.006, MAT.steel, gate, 4); // the check chains
  }
  rbox(1.5, 0.03, 0.04, 0.01, MAT.steel, 0, -0.0, 0.0, gate); // the hinge pin
  bed.add(gate);
  // The tailgate's seat: hips on its middle when it's down, facing backwards (a girl riding where she shouldn't).
  const bedSeat = new THREE.Object3D();
  bedSeat.name = 'bedSeat';
  bedSeat.position.set(UTV_SEATS.bed.x, yc(UTV_SEATS.bed.y), zc(UTV_SEATS.bed.z));
  bedSeat.rotation.y = Math.PI;
  bed.add(bedSeat);
  mergeStatic(gate);
  mergeStatic(bed);
  bed.userData.keep = true;

  // Wheels sit outside the body so they don't rock with it.
  for (const w of UTV_LAYOUT.wheels) {
    const wheelModel = buildWheel(w);
    wheelModel.name = w.name;
    quad.add(wheelModel);
  }

  addHeadlightBeams(quad);
  mergeStatic(root);
  quad.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return quad;
}

function bumper(root) {
  // A black moulded bumper with a bar across it and the two tow loops below.
  rbox(1.3, 0.14, 0.12, 0.05, MAT.plastic, 0, 0.5, 1.43, root);
  add(bentTube([[-0.55, 0.62, 1.43], [-0.6, 0.62, 1.46], [0.6, 0.62, 1.46], [0.55, 0.62, 1.43]], 0.016, { bend: 0.05, radial: 6 }), MAT.steel, root);
  for (const s of [-1, 1]) add(new THREE.TorusGeometry(0.035, 0.008, 6, 12), MAT.steel, root).position.set(s * 0.3, 0.4, 1.46);
}

/** Poses the bed and tailgate: `tip` is how far the bed has risen (0..1), `gate` how open the tailgate is (0 shut, 1 flat). */
export function poseUtvBed(model, { tip, gate }) {
  model.getObjectByName('bed').rotation.x = -BED_MAX_TIP * tip;
  model.getObjectByName('tailgate').rotation.x = TAILGATE_OPEN * gate;
}

/** Poses the dash lever: forward, or back for reverse. */
export function poseUtvControls(model, { reverse }) {
  model.getObjectByName('driveLever').rotation.x = reverse ? 0.5 : -0.2;
}
