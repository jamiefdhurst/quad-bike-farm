import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildDash } from './dash.js';
import { addHeadlightBeams } from './quadModel.js';
import { bentTube, mergeStatic, rod } from './quadGeometry.js';

// The old Land Rover: a Series III 88-inch pick-up, procedural like the UTV. Ladder chassis on leaf springs and live axles, flat-topped
// front wings with the headlamps in them, a black grille, the spare wheel on the bonnet, a bumper with the hole for the starting
// handle, an upright windscreen frame, a truck cab with a white roof and a three-seat bench, and an open tub behind with a drop
// tailgate and a towing jaw. Right-hand drive. Same named parts as the UTV's model so Quad drives it unchanged, plus its own:
//
//   quad
//   ├── body                         rocked by vibration
//   │   └── bodyRoot                 ground-referenced: y = 0 is the ground at rest, so it sits at LANDY_GROUND_OFFSET in the chassis
//   │       ├── steeringColumn > handlebars    the wheel (holds riderHands, gripLeft, gripRight)
//   │       ├── dash                 the Series binnacle in front of the driver
//   │       ├── gearLever, transferKnob (4WD), diffLockKnob, handThrottleKnob, chokeKnob   posed by poseLandyControls
//   │       ├── riderAnchor, seatMid, seatLeft, cameraAnchor
//   │       └── crankHole, towHitch, exhaustTip
//   └── wheel_fl / wheel_fr / wheel_rl / wheel_rr   (each with a 'spin' child)
//
// +Z is forward and +X is the driver's left (the driver sits on the right, at -X).

export const LANDY_GROUND_OFFSET = -0.62; // chassis origin to the ground at rest, metres
const R = 0.38; // 7.50 x 16 tyres
const REST = 0.2; // suspension rest length: matches the spec's suspensionRestLength
const TYRE_W = 0.21;
const RIM_R = 0.21; // a 16 inch rim
const WHEELBASE = 2.23; // 88 inches
const TRACK = 1.31;

const wheelY = R + REST + LANDY_GROUND_OFFSET;

/** Where the wheels, their mounts and the bodywork box are, for QuadPhysics. */
export const LANDY_LAYOUT = {
  wheels: [
    { name: 'wheel_fl', x: TRACK / 2, z: WHEELBASE / 2, front: true, radius: R, y: wheelY },
    { name: 'wheel_fr', x: -TRACK / 2, z: WHEELBASE / 2, front: true, radius: R, y: wheelY },
    { name: 'wheel_rl', x: TRACK / 2, z: -WHEELBASE / 2, front: false, radius: R, y: wheelY },
    { name: 'wheel_rr', x: -TRACK / 2, z: -WHEELBASE / 2, front: false, radius: R, y: wheelY },
  ],
  topY: wheelY,
  chassis: { hx: 0.8, hy: 0.36, hz: 1.8, y: 0.85 + LANDY_GROUND_OFFSET },
};

/** The invisible box you look at to get in: ground to roof, a little wider than the body. */
export const LANDY_PROXY = { w: 1.95, h: 2.1, d: 3.9 };

/** Where people sit on the bench (the driver, you, at -X) and where a girl stands to climb in, by the passenger's door. */
export const LANDY_SEATS = {
  driver: { x: -0.42, y: 0.94, z: -0.22 },
  mid: { x: 0, y: 0.94, z: -0.22 },
  left: { x: 0.42, y: 0.94, z: -0.22 },
};
export const LANDY_STAND = {
  left: { x: 1.45, z: 0 },
  mid: { x: 1.45, z: 0 }, // the middle seat is reached through the passenger's door, as in the real thing
};

/** The starting handle's hole in the front bumper, in the model's frame: where you stand to swing it, and the towing jaw behind. */
export const CRANK_HOLE = { x: 0, y: 0.56, z: 1.84 };
export const TOW_HITCH = { x: 0, y: 0.56, z: -2.02 };

const MAT = {
  rubber: new THREE.MeshStandardMaterial({ color: 0x1b1a18, roughness: 0.95 }),
  chassis: new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.6, metalness: 0.3 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.5, metalness: 0.6 }),
  galv: new THREE.MeshStandardMaterial({ color: 0x8e9396, roughness: 0.45, metalness: 0.7 }), // galvanised: the windscreen frame, hinges
  black: new THREE.MeshStandardMaterial({ color: 0x1c1d1e, roughness: 0.7 }), // the grille, bumper, dash
  roof: new THREE.MeshStandardMaterial({ color: 0xe8e4d6, roughness: 0.5, side: THREE.DoubleSide }), // Limestone
  rim: new THREE.MeshStandardMaterial({ color: 0xc9c7bc, roughness: 0.45, metalness: 0.4 }), // the steel wheels in Limestone
  glass: new THREE.MeshStandardMaterial({ color: 0x9fb3b8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
  seat: new THREE.MeshStandardMaterial({ color: 0x2b2a28, roughness: 0.85 }), // black vinyl
  knob: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.35 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xe0b020, roughness: 0.35 }), // the 4WD knob
  red: new THREE.MeshStandardMaterial({ color: 0xb02018, roughness: 0.35 }), // the diff lock's
  rust: new THREE.MeshStandardMaterial({ color: 0x4b3a2e, roughness: 0.7, metalness: 0.5 }),
  amber: new THREE.MeshStandardMaterial({ color: 0xd88a18, roughness: 0.3 }),
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

/** A narrow all-terrain tyre on a drum: blocky tread in two staggered rows. */
function tyre() {
  const lug = 0.022;
  const parts = [new THREE.CylinderGeometry(R - lug, R - lug, TYRE_W, 36).rotateZ(Math.PI / 2)];
  const count = 26;
  for (let row = 0; row < 2; row++) {
    const side = row === 0 ? 1 : -1;
    for (let i = 0; i < count; i++) {
      const a = ((i + row * 0.5) / count) * Math.PI * 2;
      const g = new THREE.BoxGeometry(TYRE_W * 0.44, lug * 2, 0.06);
      g.applyMatrix4(new THREE.Matrix4().makeRotationX(a).multiply(new THREE.Matrix4().makeTranslation(side * TYRE_W * 0.24, R - lug * 0.9, 0)));
      parts.push(g);
    }
  }
  return mergeGeometries(parts);
}

/** A steel wheel: the dished disc with its ring of holes suggested by bolts, in Limestone, and a hub cap. */
function addWheelFace(spin, side) {
  axleCyl(RIM_R, TYRE_W + 0.02, MAT.rim, 0, 0, 0, spin);
  axleCyl(RIM_R * 0.8, 0.03, MAT.rim, side * (TYRE_W / 2 + 0.005), 0, 0, spin);
  axleCyl(0.06, 0.05, MAT.galv, side * (TYRE_W / 2 + 0.03), 0, 0, spin);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const n = add(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 6).rotateZ(Math.PI / 2), MAT.galv, spin);
    n.position.set(side * (TYRE_W / 2 + 0.03), Math.sin(a) * 0.1, Math.cos(a) * 0.1);
  }
}

function buildWheel(w) {
  const side = Math.sign(w.x);
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  spin.name = 'spin';
  spin.userData.keep = true;
  wheel.add(spin);
  add(cached('tyre', tyre), MAT.rubber, spin);
  addWheelFace(spin, side);
  mergeStatic(wheel);
  return wheel;
}

// The Land Rover ----------------------------------------------------------------

export function buildLandRoverModel({ bodyColor = 0x3b4a36, dashStyle = 'series' } = {}) {
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.55, side: THREE.DoubleSide });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x2c302c, roughness: 0.08, metalness: 0.2, emissive: 0x000000 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x3c0b08, roughness: 0.25, emissive: 0x000000 });

  const quad = new THREE.Group();
  quad.name = 'quad';
  quad.userData.lensMaterial = lensMat;
  quad.userData.seatMaterial = MAT.seat;
  quad.userData.steerGain = 7; // a big wheel, a lot of turns lock to lock
  const body = new THREE.Group();
  body.name = 'body';
  quad.add(body);
  const root = new THREE.Group();
  root.name = 'bodyRoot';
  body.add(root);
  const zF = WHEELBASE / 2;
  const zR = -WHEELBASE / 2;

  // Chassis: two box-section rails and cross members, the engine and gearbox, live axles with their diffs, and the leaf springs.
  for (const s of [-1, 1]) rbox(0.08, 0.15, 3.55, 0.01, MAT.chassis, s * 0.43, 0.5, -0.1, root);
  for (const z of [1.62, 0.6, -0.5, -1.55, -1.92]) rbox(0.86, 0.1, 0.08, 0.01, MAT.chassis, 0, 0.5, z, root);
  rbox(0.5, 0.42, 0.75, 0.05, MAT.steel, 0, 0.75, 1.05, root); // the engine under the bonnet
  rbox(0.3, 0.3, 0.6, 0.04, MAT.steel, 0, 0.6, 0.3, root); // gearbox and transfer box under the seat
  tube([0, 0.48, 0.05], [0, 0.4, zR + 0.25], 0.03, MAT.steel, root); // the propshafts
  tube([0, 0.48, 0.55], [0, 0.4, zF - 0.25], 0.03, MAT.steel, root);
  for (const [z, off] of [[zF, 0.18], [zR, -0.12]]) {
    axleCyl(0.05, TRACK, MAT.chassis, 0, R, z, root);
    add(new THREE.SphereGeometry(0.15, 16, 12), MAT.chassis, root).position.set(off, R, z); // the diff casing, offset as on a Series
    for (const s of [-1, 1]) {
      // A leaf spring along the rail, with its shackle, and a damper.
      add(bentTube([[s * 0.43, 0.56, z + 0.48], [s * 0.43, 0.46, z], [s * 0.43, 0.56, z - 0.48]], 0.028, { bend: 0.2, radial: 6 }), MAT.chassis, root);
      tube([s * 0.5, 0.42, z + 0.08], [s * 0.5, 0.7, z + 0.2], 0.022, MAT.steel, root);
    }
  }

  // The front: bumper with the starting-handle hole, the black grille panel between the wings, the flat-topped wings with the headlamps
  // in their faces, the bonnet with the spare wheel on it.
  rbox(1.62, 0.16, 0.12, 0.02, MAT.black, 0, 0.56, 1.78, root); // bumper
  add(new THREE.TorusGeometry(0.035, 0.012, 8, 16), MAT.steel, root).position.set(CRANK_HOLE.x, CRANK_HOLE.y, CRANK_HOLE.z - 0.02); // the hole's ring
  add(new THREE.CircleGeometry(0.03, 14), MAT.knob, root).position.set(CRANK_HOLE.x, CRANK_HOLE.y, CRANK_HOLE.z - 0.025);
  for (const s of [-1, 1]) rbox(0.06, 0.12, 0.2, 0.01, MAT.chassis, s * 0.43, 0.56, 1.68, root); // its mounts to the rails
  rbox(0.68, 0.5, 0.06, 0.02, MAT.black, 0, 0.83, 1.6, root); // the grille panel
  for (let i = 0; i < 9; i++) rbox(0.6, 0.012, 0.02, 0.004, MAT.chassis, 0, 0.64 + i * 0.048, 1.635, root); // its slats
  for (const s of [-1, 1]) {
    const x = s * 0.6;
    rbox(0.48, 0.03, 0.85, 0.01, paint, x, 1.06, 1.18, root, 'wingTop'); // the flat top, which you can stand a mug on
    rbox(0.03, 0.34, 0.85, 0.01, paint, s * 0.84, 0.9, 1.18, root); // the outer side, above the wheel
    rbox(0.48, 0.36, 0.03, 0.01, paint, x, 0.88, 1.6, root); // the front face, with the lamp
    rbox(0.03, 0.34, 0.85, 0.01, paint, s * 0.36, 0.9, 1.18, root); // the inner side, against the engine bay
    const bezel = add(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 22).rotateX(Math.PI / 2), MAT.galv, root);
    bezel.position.set(x, 0.9, 1.62);
    const lamp = add(new THREE.CylinderGeometry(0.085, 0.085, 0.02, 22).rotateX(Math.PI / 2), lensMat, root);
    lamp.position.set(x, 0.9, 1.64);
    rbox(0.07, 0.05, 0.03, 0.01, MAT.amber, s * 0.75, 0.73, 1.625, root); // the sidelamp and indicator below
    // A wing mirror on a stalk from the wing top.
    tube([s * 0.8, 1.07, 0.92], [s * 0.92, 1.3, 0.92], 0.008, MAT.galv, root, 6);
    rbox(0.13, 0.09, 0.02, 0.01, MAT.black, s * 0.94, 1.33, 0.92, root);
  }
  rbox(0.7, 0.04, 0.95, 0.02, paint, 0, 1.06, 1.12, root, 'bonnet');
  rbox(0.66, 0.02, 0.9, 0.01, paint, 0, 1.085, 1.12, root); // its pressed panel
  // The spare wheel on the bonnet, lying flat and strapped down.
  const spare = new THREE.Group();
  spare.position.set(0, 1.21, 1.1);
  spare.rotation.z = Math.PI / 2;
  add(cached('tyre', tyre), MAT.rubber, spare);
  addWheelFace(spare, 1);
  root.add(spare);
  rbox(0.05, 0.02, 0.8, 0.005, MAT.chassis, 0, 1.33, 1.1, root); // the strap

  // The bulkhead with its vent flaps, the dash rail, and the windscreen: an upright galvanised frame with two panes and a centre post.
  rbox(1.62, 0.55, 0.05, 0.02, paint, 0, 0.88, 0.6, root);
  for (const s of [-1, 1]) rbox(0.5, 0.06, 0.03, 0.01, paint, s * 0.4, 1.12, 0.63, root); // the vent flaps under the screen
  rbox(1.6, 0.05, 0.05, 0.01, MAT.galv, 0, 1.17, 0.58, root);
  rbox(1.6, 0.05, 0.05, 0.01, MAT.galv, 0, 1.68, 0.55, root);
  for (const x of [-0.78, 0, 0.78]) rbox(0.05, 0.52, 0.05, 0.01, MAT.galv, x, 1.425, 0.565, root);
  for (const s of [-1, 1]) {
    const pane = add(new THREE.PlaneGeometry(0.72, 0.46), MAT.glass, root);
    pane.position.set(s * 0.39, 1.425, 0.565);
    pane.rotation.x = 0.06;
  }
  tube([-0.3, 1.66, 0.6], [-0.05, 1.35, 0.63], 0.006, MAT.chassis, root, 4); // a wiper

  // The cab: doors with the window frames, the sides back to the cab's rear panel, its rear window, and the white roof.
  for (const s of [-1, 1]) {
    rbox(0.04, 0.6, 0.95, 0.01, paint, s * 0.82, 0.86, 0.05, root, s > 0 ? 'doorLeft' : 'doorRight'); // the door's lower half
    rbox(0.03, 0.04, 0.95, 0.008, MAT.galv, s * 0.82, 1.17, 0.05, root); // the top of the lower half
    rbox(0.03, 0.5, 0.03, 0.008, paint, s * 0.82, 1.43, 0.5, root); // the window frame
    rbox(0.03, 0.5, 0.03, 0.008, paint, s * 0.82, 1.43, -0.4, root);
    rbox(0.03, 0.03, 0.92, 0.008, paint, s * 0.82, 1.66, 0.05, root);
    const glass = add(new THREE.PlaneGeometry(0.88, 0.46), MAT.glass, root);
    glass.position.set(s * 0.82, 1.42, 0.05);
    glass.rotation.y = Math.PI / 2;
    rbox(0.03, 0.03, 0.1, 0.008, MAT.galv, s * 0.845, 1.07, -0.3, root); // the handle
    for (const z of [0.42, 0.18]) rbox(0.02, 0.06, 0.06, 0.005, MAT.galv, s * 0.84, 1.0, z, root); // the hinges, on the outside
    rbox(0.04, 1.2, 0.12, 0.01, paint, s * 0.82, 1.22, -0.5, root); // the B pillar
    rbox(0.04, 0.42, 0.2, 0.01, paint, s * 0.82, 0.75, -0.62, root); // the cab side behind the door
  }
  // The cab's rear panel in four pieces round a real opening, with the glass set in the middle of it: glass laid on a whole
  // panel's face fights it for the same depth and flickers.
  rbox(1.62, 0.73, 0.04, 0.01, paint, 0, 0.985, -0.62, root, 'cabBack'); // below the window
  rbox(1.62, 0.07, 0.04, 0.01, paint, 0, 1.685, -0.62, root); // above it
  for (const s of [-1, 1]) rbox(0.36, 0.3, 0.04, 0.01, paint, s * 0.63, 1.5, -0.62, root); // either side
  const rear = add(new THREE.PlaneGeometry(0.9, 0.3), MAT.glass, root);
  rear.position.set(0, 1.5, -0.62);
  // The roof: Limestone, with a gentle rise to its middle and a lip all round.
  rbox(1.7, 0.06, 1.3, 0.03, MAT.roof, 0, 1.75, -0.02, root, 'roof');
  rbox(1.6, 0.03, 1.2, 0.015, MAT.roof, 0, 1.79, -0.02, root);
  for (let i = -3; i <= 3; i++) rbox(1.62, 0.012, 0.02, 0.004, MAT.roof, 0, 1.805, -0.02 + i * 0.16, root); // its ribs

  // Inside: the floor, the seat box with the bench on it (three in a row, black vinyl), the gearbox tunnel.
  rbox(1.56, 0.03, 1.1, 0.01, MAT.chassis, 0, 0.62, 0.05, root);
  rbox(1.56, 0.26, 0.5, 0.02, paint, 0, 0.76, -0.3, root, 'seatBox');
  rbox(0.36, 0.22, 0.6, 0.04, MAT.black, 0, 0.73, 0.25, root); // the tunnel
  for (const seat of [LANDY_SEATS.driver, LANDY_SEATS.mid, LANDY_SEATS.left]) {
    rbox(0.42, 0.1, 0.46, 0.04, MAT.seat, seat.x, 0.9, seat.z, root);
    const back = rbox(0.42, 0.48, 0.08, 0.04, MAT.seat, seat.x, 1.18, -0.5, root); // clear of the cab's rear panel, even leant back
    back.rotation.x = -0.08;
  }

  // The steering wheel: big and thin-rimmed, four spokes, on a long raked column. `handlebars` is the wheel itself.
  const column = new THREE.Group();
  column.name = 'steeringColumn';
  column.userData.keep = true;
  column.position.set(-0.42, 0.9, 0.5);
  column.rotation.x = -1.05;
  tube([0, 0, 0], [0, 0.5, 0], 0.024, MAT.black, column);
  root.add(column);
  const wheel = new THREE.Group();
  wheel.name = 'handlebars';
  wheel.userData.keep = true;
  wheel.position.set(0, 0.5, 0);
  column.add(wheel);
  add(new THREE.TorusGeometry(0.21, 0.012, 8, 36).rotateX(Math.PI / 2), MAT.black, wheel);
  add(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 14), MAT.black, wheel); // the boss
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    tube([0, 0, 0], [Math.sin(a) * 0.21, 0, Math.cos(a) * 0.21], 0.007, MAT.galv, wheel, 5);
  }
  for (const side of [1, -1]) {
    const grip = new THREE.Object3D();
    grip.name = side > 0 ? 'gripLeft' : 'gripRight';
    grip.userData.keep = true;
    grip.position.set(side * 0.21, 0, 0);
    wheel.add(grip);
  }
  const hands = new THREE.Group(); // your own arms aren't drawn: Quad just expects the group
  hands.name = 'riderHands';
  hands.userData.keep = true;
  hands.visible = false;
  wheel.add(hands);

  // The dash: a flat painted panel across the cab under the screen, with the binnacle in front of the driver.
  rbox(1.56, 0.12, 0.2, 0.02, MAT.black, 0, 1.08, 0.5, root); // the parcel shelf
  const dash = buildDash(dashStyle);
  dash.group.position.set(-0.42, 1.19, 0.48);
  dash.group.rotation.x = 0.55;
  dash.group.scale.setScalar(1.15);
  dash.group.userData.keep = true;
  root.add(dash.group);
  quad.userData.dash = dash;
  quad.userData.podMount = null;

  // Knobs on the dash under the binnacle: the choke and the hand throttle, each pulled out towards the driver.
  for (const [name, x] of [['chokeKnob', -0.2], ['handThrottleKnob', -0.62]]) {
    const knob = new THREE.Group();
    knob.name = name;
    knob.userData.keep = true;
    knob.position.set(x, 1.04, 0.4);
    tube([0, 0, 0], [0, 0, -0.03], 0.004, MAT.galv, knob, 5);
    add(new THREE.CylinderGeometry(0.014, 0.014, 0.018, 12).rotateX(Math.PI / 2), MAT.knob, knob).position.set(0, 0, -0.035);
    root.add(knob);
  }
  // The levers on the tunnel: the gear lever, the transfer lever with its yellow knob (4WD, pushed down) and a red knob for the diff lock.
  const lever = (name, x, mat, len, r) => {
    const g = new THREE.Group();
    g.name = name;
    g.userData.keep = true;
    g.position.set(x, 0.84, 0.32);
    tube([0, 0, 0], [0, len, 0], 0.008, MAT.galv, g, 5);
    add(new THREE.SphereGeometry(r, 12, 10), mat, g).position.set(0, len, 0);
    root.add(g);
  };
  lever('gearLever', -0.1, MAT.knob, 0.38, 0.026);
  lever('transferKnob', 0.04, MAT.yellow, 0.22, 0.018);
  lever('diffLockKnob', 0.12, MAT.red, 0.16, 0.016);
  rbox(0.07, 0.02, 0.16, 0.005, MAT.black, -0.55, 0.66, 0.32, root).rotation.x = -0.6; // the pedals: clutch, brake, accelerator
  rbox(0.07, 0.02, 0.16, 0.005, MAT.black, -0.4, 0.66, 0.32, root).rotation.x = -0.6;
  rbox(0.04, 0.02, 0.14, 0.005, MAT.black, -0.25, 0.66, 0.32, root).rotation.x = -0.6;
  tube([-0.2, 0.7, 0.1], [-0.24, 0.98, 0.0], 0.009, MAT.galv, root, 5); // the handbrake, beside the driver's knee
  // Quad poses these two on a quad; the Land Rover's choke is the dash knob and it has no fuel tap.
  for (const name of ['fuelTap', 'chokeLever']) {
    const g = new THREE.Group();
    g.name = name;
    g.userData.keep = true;
    g.visible = false;
    root.add(g);
  }

  // The tub: floor, sides with the wheel boxes inside, the drop tailgate with its chains, the rear lamps on the corners.
  rbox(1.6, 0.04, 1.3, 0.01, paint, 0, 0.78, -1.3, root);
  for (const s of [-1, 1]) {
    rbox(0.04, 0.5, 1.3, 0.01, paint, s * 0.82, 1.03, -1.3, root); // side
    rbox(0.08, 0.03, 1.3, 0.01, MAT.galv, s * 0.82, 1.29, -1.3, root); // its capping
    rbox(0.32, 0.32, 0.82, 0.04, paint, s * 0.6, 0.94, zR, root); // the wheel box
    for (const z of [-0.8, -1.8]) add(new THREE.TorusGeometry(0.02, 0.005, 6, 10), MAT.galv, root).position.set(s * 0.8, 1.22, z); // rope hooks
    rbox(0.08, 0.1, 0.03, 0.01, tailMat, s * 0.74, 0.92, -1.97, root); // the tail lamp
    rbox(0.08, 0.05, 0.03, 0.01, MAT.amber, s * 0.74, 0.84, -1.97, root); // and the indicator under it
    tube([s * 0.78, 1.24, -1.94], [s * 0.8, 1.04, -1.95], 0.004, MAT.galv, root, 4); // the tailgate's chains
  }
  rbox(1.6, 0.5, 0.04, 0.01, paint, 0, 1.03, -1.95, root, 'tailgate');
  for (const y of [0.92, 1.12]) rbox(1.5, 0.02, 0.01, 0.004, paint, 0, y, -1.975, root); // its pressings
  // The rear crossmember with the towing jaw: a pin through a jaw, where the trailer's ring goes.
  rbox(1.0, 0.12, 0.1, 0.01, MAT.chassis, 0, 0.56, -1.95, root);
  rbox(0.08, 0.08, 0.1, 0.01, MAT.steel, TOW_HITCH.x, TOW_HITCH.y, TOW_HITCH.z + 0.02, root);
  tube([TOW_HITCH.x, TOW_HITCH.y + 0.06, TOW_HITCH.z - 0.01], [TOW_HITCH.x, TOW_HITCH.y - 0.06, TOW_HITCH.z - 0.01], 0.01, MAT.galv, root, 6);
  for (const [name, at] of [['towHitch', TOW_HITCH], ['crankHole', CRANK_HOLE]]) {
    const o = new THREE.Object3D();
    o.name = name;
    o.position.set(at.x, at.y, at.z);
    root.add(o);
  }

  // The exhaust: a silencer under the right side and a tailpipe out behind the rear wheel.
  add(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 14).rotateX(Math.PI / 2), MAT.rust, root).position.set(-0.6, 0.38, -0.5);
  tube([-0.6, 0.38, -0.8], [-0.65, 0.34, -1.6], 0.022, MAT.rust, root, 6);
  const tip = new THREE.Object3D();
  tip.name = 'exhaustTip';
  tip.position.set(-0.65, 0.34, -1.6);
  root.add(tip);

  // The seats' anchors: hips on the cushions. The driver's is yours; the other two are where the girls sit.
  for (const [name, seat] of [['riderAnchor', LANDY_SEATS.driver], ['seatMid', LANDY_SEATS.mid], ['seatLeft', LANDY_SEATS.left]]) {
    const a = new THREE.Object3D();
    a.name = name;
    a.position.set(seat.x, seat.y, seat.z);
    root.add(a);
  }
  const cameraAnchor = new THREE.Object3D();
  cameraAnchor.name = 'cameraAnchor';
  cameraAnchor.position.set(LANDY_SEATS.driver.x, LANDY_SEATS.driver.y + 0.72, LANDY_SEATS.driver.z + 0.02);
  root.add(cameraAnchor);

  for (const w of LANDY_LAYOUT.wheels) {
    const wheelModel = buildWheel(w);
    wheelModel.name = w.name;
    quad.add(wheelModel);
  }

  addHeadlightBeams(quad);
  // Its own tail lamp material, which setTaillights lights (no halos).
  quad.userData.tailMaterial = tailMat;
  quad.userData.tailHaloMaterial = new THREE.SpriteMaterial({ transparent: true, opacity: 0 });
  quad.userData.tailHalos = [];
  mergeStatic(root);
  quad.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return quad;
}

/**
 * Poses the levers and knobs: the gear lever leans with the gear (-1 reverse to 4), the yellow 4WD knob and the red diff lock knob go
 * down when engaged, and the choke and hand throttle knobs pull out towards the driver.
 */
export function poseLandyControls(model, { gear = 0, fourWd = false, locked = false, choke = 0, hand = 0 }) {
  const g = model.getObjectByName('gearLever');
  if (!g) return;
  // An H: first and second to the left, third and fourth to the right, reverse further left; odd gears forward.
  const across = { '-1': 0.25, 0: 0, 1: 0.14, 2: 0.14, 3: -0.14, 4: -0.14 }[gear] ?? 0;
  const along = gear === 0 ? 0 : gear % 2 !== 0 ? -0.25 : 0.25;
  g.rotation.set(along, 0, across);
  model.getObjectByName('transferKnob').position.y = 0.84 - (fourWd ? 0.05 : 0);
  model.getObjectByName('diffLockKnob').position.y = 0.84 - (locked ? 0.05 : 0);
  model.getObjectByName('chokeKnob').position.z = 0.4 - 0.05 * choke;
  model.getObjectByName('handThrottleKnob').position.z = 0.4 - 0.05 * hand;
}
