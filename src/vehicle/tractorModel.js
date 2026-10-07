import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildDash } from './dash.js';
import { addHeadlightBeams } from './quadModel.js';
import { loftGeometry, mergeStatic, rod } from './quadGeometry.js';

// The old farm tractor, procedural like the quads: a Fergie-sized diesel with a bonnet, a pan seat between two big rear wheels, a
// steering wheel on a raked column, an upright exhaust with a flap on top, and a drawbar. Same named parts as a quad's model so
// Quad drives it unchanged (see quadModel.js), plus the controls only it has:
//
//   quad
//   ├── body                       rocked by vibration
//   │   └── bodyRoot               ground-referenced: y = 0 is the ground at rest, so it sits at TRACTOR_GROUND_OFFSET in the chassis
//   │       ├── bonnet, engine, scuttle, gearbox, fenders, seat, exhaust (exhaustFlap, exhaustTip), lamps, drawbar
//   │       ├── dash                       on the scuttle, not turning with the wheel
//   │       ├── steeringColumn > handlebars    the wheel; turns about the column's axis (and holds riderHands)
//   │       ├── gearLever, handThrottle, clutchPedal, stopKnob   posed from the controls (quad.js poseControls)
//   │       └── riderAnchor, cameraAnchor
//   └── wheel_fl / wheel_fr / wheel_rl / wheel_rr   (each with a 'spin' child)
//
// +Z is forward and +X is the rider's left.

export const TRACTOR_GROUND_OFFSET = -0.8; // chassis origin to the ground at rest, metres
const REAR_R = 0.72; // big rear wheels
const FRONT_R = 0.42; // small front ones
const REST = 0.12; // suspension rest length: matches the spec's suspensionRestLength

const wheelY = (r) => r + REST + TRACTOR_GROUND_OFFSET; // where each wheel's suspension mount sits in the chassis frame

/** Where the wheels, their mounts and the bodywork box are, for QuadPhysics. */
export const TRACTOR_LAYOUT = {
  wheels: [
    { name: 'wheel_fl', x: 0.66, z: 0.95, front: true, radius: FRONT_R, y: wheelY(FRONT_R) },
    { name: 'wheel_fr', x: -0.66, z: 0.95, front: true, radius: FRONT_R, y: wheelY(FRONT_R) },
    { name: 'wheel_rl', x: 0.88, z: -0.95, front: false, radius: REAR_R, y: wheelY(REAR_R) },
    { name: 'wheel_rr', x: -0.88, z: -0.95, front: false, radius: REAR_R, y: wheelY(REAR_R) },
  ],
  topY: wheelY(REAR_R),
  chassis: { hx: 0.55, hy: 0.5, hz: 1.5, y: 0.95 + TRACTOR_GROUND_OFFSET },
};

/** The tops of the rear wheel arches, where a girl sits (chassis frame, metres), and where she stands on the ground to climb up. */
export const MUDGUARD = { x: 0.88, top: REAR_R + REAR_R + 0.17, z: -0.95, standX: 1.5, standZ: -0.35 };

/** The invisible box you look at to get on: ground to roof, wider than the body so it's easy to target. */
export const TRACTOR_PROXY = { w: 2.0, h: 2.0, d: 3.2 };

// Which way each gear's lever leans, as a gate: [forward/back, left/right] in radians (reverse back-right, 1 and 2 left, 3 right).
const GATE = { '-1': [0.3, -0.22], 0: [0, 0], 1: [-0.3, 0.22], 2: [0.3, 0.22], 3: [-0.3, -0.22] };

const MAT = {
  rubber: new THREE.MeshStandardMaterial({ color: 0x1a1917, roughness: 0.95 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.5, metalness: 0.6 }),
  rust: new THREE.MeshStandardMaterial({ color: 0x4b3a2e, roughness: 0.7, metalness: 0.5 }),
  cast: new THREE.MeshStandardMaterial({ color: 0x55585b, roughness: 0.6, metalness: 0.4 }),
  castDark: new THREE.MeshStandardMaterial({ color: 0x2f3133, roughness: 0.65, metalness: 0.4 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xd8dadc, roughness: 0.14, metalness: 1.0 }),
  black: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.7 }),
  seat: new THREE.MeshStandardMaterial({ color: 0x1b1b1a, roughness: 0.6 }),
  glove: new THREE.MeshStandardMaterial({ color: 0x2d3a26, roughness: 0.8 }),
  sleeve: new THREE.MeshStandardMaterial({ color: 0x3f4d34, roughness: 0.9 }),
  knob: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 }),
  red: new THREE.MeshStandardMaterial({ color: 0xb02a20, roughness: 0.45 }),
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

/** A big lugged rear tyre: a drum with two staggered rows of angled lugs, like the herringbone on an old Fergie. */
function rearTyre() {
  const width = 0.38;
  const lug = 0.07;
  const parts = [new THREE.CylinderGeometry(REAR_R - lug, REAR_R - lug, width, 36).rotateZ(Math.PI / 2)];
  const count = 22;
  for (let row = 0; row < 2; row++) {
    const side = row === 0 ? 1 : -1;
    for (let i = 0; i < count; i++) {
      const a = ((i + row * 0.5) / count) * Math.PI * 2;
      const g = new THREE.BoxGeometry(width * 0.54, lug * 2.2, 0.06);
      const m = new THREE.Matrix4()
        .makeRotationX(a)
        .multiply(new THREE.Matrix4().makeTranslation(side * width * 0.24, REAR_R - lug * 0.9, 0))
        .multiply(new THREE.Matrix4().makeRotationY(side * 0.5));
      g.applyMatrix4(m);
      parts.push(g);
    }
  }
  return mergeGeometries(parts);
}

/** A narrow ribbed front tyre. */
function frontTyre() {
  const width = 0.15;
  const parts = [new THREE.CylinderGeometry(FRONT_R - 0.03, FRONT_R - 0.03, width, 28).rotateZ(Math.PI / 2)];
  for (const x of [-0.045, 0, 0.045]) parts.push(new THREE.CylinderGeometry(FRONT_R, FRONT_R, 0.036, 28).rotateZ(Math.PI / 2).translate(x, 0, 0));
  return mergeGeometries(parts);
}

function buildWheel(w, rimMat) {
  const side = Math.sign(w.x);
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  spin.name = 'spin';
  spin.userData.keep = true;
  wheel.add(spin);
  const rear = !w.front;
  add(cached(rear ? 'rearTyre' : 'frontTyre', rear ? rearTyre : frontTyre), MAT.rubber, spin);
  // The rim stands proud of the tyre's sides, and a dished plate and hub close the outside, so it reads as a wheel rather than a drum.
  const rimR = rear ? 0.42 : 0.24;
  const tyreW = rear ? 0.38 : 0.15;
  axleCyl(rimR, tyreW + 0.1, rimMat, 0, 0, 0, spin);
  axleCyl(rimR * 1.04, 0.025, rimMat, side * (tyreW / 2 + 0.03), 0, 0, spin);
  axleCyl(rear ? 0.1 : 0.06, 0.1, MAT.cast, side * (tyreW / 2 + 0.07), 0, 0, spin);
  const nuts = rear ? 8 : 5;
  const nutR = rear ? 0.2 : 0.12;
  for (let i = 0; i < nuts; i++) {
    const a = (i / nuts) * Math.PI * 2;
    const n = add(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 6).rotateZ(Math.PI / 2), MAT.chrome, spin);
    n.position.set(side * (tyreW / 2 + 0.05), Math.sin(a) * nutR, Math.cos(a) * nutR);
  }
  mergeStatic(wheel);
  return wheel;
}

// The tractor ------------------------------------------------------------------

export function buildTractorModel({ bodyColor = 0xb02a20, dashStyle = 'tractor' } = {}) {
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5, side: THREE.DoubleSide });
  const grey = new THREE.MeshStandardMaterial({ color: 0xa9aaa4, roughness: 0.55, side: THREE.DoubleSide }); // the faded grey of the wheels and the body
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x2c302c, roughness: 0.08, metalness: 0.2, emissive: 0x000000 });

  const quad = new THREE.Group();
  quad.name = 'quad';
  quad.userData.lensMaterial = lensMat;
  const body = new THREE.Group();
  body.name = 'body';
  quad.add(body);
  const root = new THREE.Group();
  root.name = 'bodyRoot';
  body.add(root);

  // Engine and bonnet. The block shows under the bonnet's edge, as on the real thing.
  rbox(0.5, 0.5, 1.1, 0.04, MAT.cast, 0, 0.69, 0.7, root);
  rbox(0.42, 0.14, 0.9, 0.03, MAT.castDark, 0, 0.46, 0.75, root); // sump
  add(loftGeometry([
    { z: 0.38, w: 0.5, y0: 0.93, y1: 1.3 },
    { z: 0.9, w: 0.5, y0: 0.93, y1: 1.34 },
    { z: 1.36, w: 0.44, y0: 0.93, y1: 1.28 },
  ], { exponent: 4 }), paint, root, 'bonnet');
  // The front bolster and the grille: a dark panel with slats, and a badge.
  rbox(0.46, 0.62, 0.1, 0.03, MAT.castDark, 0, 0.98, 1.4, root);
  for (let i = 0; i < 6; i++) rbox(0.4, 0.018, 0.02, 0.006, MAT.chrome, 0, 0.78 + i * 0.1, 1.455, root);
  rbox(0.12, 0.05, 0.02, 0.01, MAT.chrome, 0, 1.3, 1.4, root);
  // Headlamps in the bolster's corners.
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 20).rotateX(Math.PI / 2), MAT.chrome, root).position.set(s * 0.26, 1.14, 1.43);
    const lens = add(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 20).rotateX(Math.PI / 2), lensMat, root);
    lens.position.set(s * 0.26, 1.14, 1.465);
  }

  // Scuttle and the fuel tank behind the bonnet, with the dash on top.
  rbox(0.52, 0.42, 0.36, 0.05, paint, 0, 1.18, 0.22, root);
  rbox(0.5, 0.04, 0.34, 0.015, grey, 0, 1.4, 0.22, root);

  // Gearbox and clutch housing, rear axle and final drives.
  rbox(0.58, 0.5, 0.82, 0.05, MAT.cast, 0, 0.7, -0.32, root);
  rbox(0.44, 0.1, 0.5, 0.03, grey, 0, 0.98, -0.4, root); // the cover the seat bracket and lever stand on
  axleCyl(0.09, 1.5, MAT.castDark, 0, 0.72, -0.95, root);
  for (const s of [-1, 1]) axleCyl(0.17, 0.3, MAT.cast, s * 0.46, 0.72, -0.95, root);
  // Front axle beam and the kingpin housings.
  rbox(1.0, 0.1, 0.12, 0.03, MAT.castDark, 0, 0.5, 0.95, root);
  for (const s of [-1, 1]) rbox(0.09, 0.2, 0.09, 0.03, MAT.cast, s * 0.58, 0.46, 0.95, root);

  // Rear mudguards, wide curved shells over the big wheels, with a stay each.
  for (const s of [-1, 1]) {
    const g = new THREE.CylinderGeometry(REAR_R + 0.17, REAR_R + 0.17, 0.58, 28, 1, true, -0.12, Math.PI + 0.24).rotateZ(Math.PI / 2);
    add(g, paint, root).position.set(s * 0.88, REAR_R, -0.95);
    tube([s * 0.62, 1.0, -0.95], [s * 0.64, 1.45, -0.95], 0.016, MAT.steel, root);
  }
  // Steps and the footplate.
  for (const s of [-1, 1]) rbox(0.22, 0.03, 0.55, 0.01, MAT.steel, s * 0.46, 0.7, -0.35, root);

  // The pan seat on its spring bracket, between the mudguards.
  tube([0, 1.0, -0.55], [0, 1.1, -0.78], 0.02, MAT.steel, root);
  rbox(0.36, 0.04, 0.34, 0.02, MAT.steel, 0, 1.1, -0.8, root);
  rbox(0.34, 0.06, 0.32, 0.03, MAT.seat, 0, 1.15, -0.8, root);
  rbox(0.3, 0.2, 0.05, 0.02, MAT.seat, 0, 1.3, -0.97, root);
  tube([0, 1.1, -0.95], [0, 1.22, -0.97], 0.015, MAT.steel, root);

  // The upright exhaust on the left of the bonnet, a silencer box part-way up and a hinged flap on top.
  const exX = 0.17;
  const exZ = 1.02;
  tube([exX, 1.3, exZ], [exX, 2.0, exZ], 0.035, MAT.rust, root, 10);
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.32, 14), MAT.rust, root).position.set(exX, 1.58, exZ);
  const flap = new THREE.Group();
  flap.name = 'exhaustFlap';
  flap.userData.keep = true;
  flap.position.set(exX, 2.01, exZ - 0.04); // hinged at the back
  add(new THREE.CylinderGeometry(0.052, 0.052, 0.012, 14), MAT.steel, flap).position.set(0, 0, 0.04);
  root.add(flap);
  const tip = new THREE.Object3D();
  tip.name = 'exhaustTip';
  tip.position.set(exX, 2.06, exZ);
  tip.rotation.x = Math.PI / 2; // smoke leaves along its -Z, which now points up
  root.add(tip);

  // The steering wheel on its column, raked back towards the rider. `handlebars` is the wheel itself, so it turns about the column.
  const column = new THREE.Group();
  column.name = 'steeringColumn';
  column.userData.keep = true;
  column.position.set(0, 1.24, 0.12);
  column.rotation.x = -0.7;
  tube([0, 0, 0], [0, 0.42, 0], 0.025, MAT.steel, column);
  root.add(column);
  const wheel = new THREE.Group();
  wheel.name = 'handlebars';
  wheel.userData.keep = true;
  wheel.position.set(0, 0.42, 0);
  column.add(wheel);
  add(new THREE.TorusGeometry(0.2, 0.017, 8, 28).rotateX(Math.PI / 2), MAT.black, wheel);
  add(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 12), MAT.steel, wheel);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    tube([0, 0, 0], [Math.sin(a) * 0.2, 0, Math.cos(a) * 0.2], 0.012, MAT.steel, wheel);
  }
  // Where a girl's hands go: the rim at nine and three o'clock, turning with the wheel (npc/companionDriving.js reads these by name).
  for (const side of [1, -1]) {
    const grip = new THREE.Object3D();
    grip.name = side > 0 ? 'gripLeft' : 'gripRight';
    grip.userData.keep = true;
    grip.position.set(side * 0.2, 0, 0);
    wheel.add(grip);
  }
  // Your own arms aren't drawn: the group is only here because Quad expects one.
  const hands = new THREE.Group();
  hands.name = 'riderHands';
  hands.userData.keep = true;
  hands.visible = false;
  wheel.add(hands);

  // The dash, on the scuttle's top, tilted up to the driver.
  const dash = buildDash(dashStyle);
  dash.group.position.set(0, 1.43, 0.3);
  dash.group.rotation.x = 1.05;
  dash.group.userData.keep = true;
  root.add(dash.group);
  quad.userData.dash = dash;
  quad.userData.podMount = null;

  // The stop knob, pulled out to stop it; the hand throttle on the right of the column; (there's no fuel tap).
  const stopKnob = new THREE.Group();
  stopKnob.name = 'stopKnob';
  stopKnob.userData.keep = true;
  stopKnob.position.set(-0.17, 1.4, 0.38);
  tube([0, 0, 0], [0, 0.03, 0.05], 0.008, MAT.steel, stopKnob);
  add(new THREE.SphereGeometry(0.02, 10, 8), MAT.chrome, stopKnob).position.set(0, 0.04, 0.07);
  root.add(stopKnob);
  const hand = new THREE.Group();
  hand.name = 'handThrottle';
  hand.userData.keep = true;
  hand.position.set(-0.27, 1.36, 0.1);
  rbox(0.02, 0.012, 0.16, 0.004, MAT.steel, 0, 0, 0, root).position.copy(hand.position); // the quadrant plate it moves over
  tube([0, 0, 0], [0, 0.09, 0], 0.007, MAT.steel, hand);
  add(new THREE.SphereGeometry(0.016, 8, 6), MAT.knob, hand).position.set(0, 0.1, 0);
  root.add(hand);
  const tap = new THREE.Group();
  tap.name = 'fuelTap';
  tap.userData.keep = true;
  tap.position.set(0.28, 0.82, 0.5);
  tap.visible = false; // a proper tractor has no fuel tap; Quad still poses the part, so it stays hidden
  root.add(tap);
  // The quads' choke lever has no place here; Quad still poses it, so it stays hidden.
  const choke = new THREE.Group();
  choke.name = 'chokeLever';
  choke.userData.keep = true;
  choke.visible = false;
  root.add(choke);

  // The gear lever, tall by the seat on the right, and the clutch and brake pedals on the footplate.
  const lever = new THREE.Group();
  lever.name = 'gearLever';
  lever.userData.keep = true;
  lever.position.set(-0.17, 1.03, -0.42);
  tube([0, 0, 0], [0, 0.34, 0.0], 0.012, MAT.steel, lever);
  add(new THREE.SphereGeometry(0.025, 10, 8), MAT.knob, lever).position.set(0, 0.36, 0);
  root.add(lever);
  const clutch = new THREE.Group();
  clutch.name = 'clutchPedal';
  clutch.userData.keep = true;
  clutch.position.set(0.17, 0.78, -0.2);
  tube([0, 0, 0], [0, 0.18, 0.1], 0.012, MAT.steel, clutch);
  rbox(0.1, 0.02, 0.07, 0.006, MAT.black, 0, 0.19, 0.11, clutch);
  root.add(clutch);
  for (const s of [-1, 1]) {
    tube([s * 0.17, 0.78, -0.2], [s * 0.17, 0.94, -0.08], 0.011, MAT.steel, root);
    rbox(0.1, 0.02, 0.07, 0.006, MAT.black, s * 0.17, 0.95, -0.07, root);
  }

  // The drawbar and lower links at the back.
  rbox(0.1, 0.07, 0.7, 0.02, MAT.steel, 0, 0.52, -1.3, root);
  for (const s of [-1, 1]) tube([s * 0.22, 0.6, -0.95], [s * 0.4, 0.5, -1.45], 0.02, MAT.steel, root);
  tube([-0.4, 0.5, -1.45], [0.4, 0.5, -1.45], 0.016, MAT.steel, root);

  // Anchors for people and the camera. A girl can sit on top of each rear wheel arch (npc/mudguardRide.js).
  for (const [name, s] of [['mudguardLeft', 1], ['mudguardRight', -1]]) {
    const a = new THREE.Object3D();
    a.name = name;
    a.position.set(s * MUDGUARD.x, MUDGUARD.top, MUDGUARD.z);
    root.add(a);
  }
  const riderAnchor = new THREE.Object3D();
  riderAnchor.name = 'riderAnchor';
  riderAnchor.position.set(0, 1.15, -0.8);
  root.add(riderAnchor);
  const cameraAnchor = new THREE.Object3D();
  cameraAnchor.name = 'cameraAnchor';
  cameraAnchor.position.set(0, 1.86, -0.84); // eyes 0.7 m above the seat
  root.add(cameraAnchor);

  // Wheels sit outside the body so they don't rock with it.
  for (const w of TRACTOR_LAYOUT.wheels) {
    const wheelModel = buildWheel(w, grey);
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

/** Poses the levers and pedals from the controls: the gear lever in its gate, the hand throttle, the clutch pedal. */
export function poseTractorControls(model, { gear, hand, pedal }) {
  const lever = model.getObjectByName('gearLever');
  const [fb, lr] = GATE[gear] ?? GATE[0];
  lever.rotation.set(fb, 0, lr);
  const throttle = model.getObjectByName('handThrottle');
  throttle.rotation.x = 0.7 - 1.4 * hand;
  model.getObjectByName('clutchPedal').rotation.x = -0.45 * pedal;
}
