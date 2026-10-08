import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildDash } from './dash.js';
import { addHeadlightBeams } from './quadModel.js';
import { loftGeometry, mergeStatic, rod, springGeometry } from './quadGeometry.js';

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
  primer: new THREE.MeshStandardMaterial({ color: 0x74402f, roughness: 0.8, metalness: 0.2 }), // paint worn through to red oxide primer
  rustPatch: new THREE.MeshStandardMaterial({ color: 0x5c3a22, roughness: 0.9, metalness: 0.3 }), // and through that to bare, rusty steel
  oil: new THREE.MeshStandardMaterial({ color: 0x14100b, roughness: 0.3, metalness: 0.1 }), // oil weeping from the joints and the sump
  mud: new THREE.MeshStandardMaterial({ color: 0x4a3b29, roughness: 1 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb08d3c, roughness: 0.35, metalness: 0.8 }),
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
  const parts = [];
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

/** The drum under the rear lugs: carcass with the caked mud of the field between the lugs. */
function rearDrum() {
  return new THREE.CylinderGeometry(REAR_R - 0.065, REAR_R - 0.065, 0.38, 36).rotateZ(Math.PI / 2);
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
  if (rear) add(cached('rearDrum', rearDrum), MAT.mud, spin);
  // The rim stands proud of the tyre's sides with a flange each side, and the outside is closed by a dished disc with cast spokes
  // standing off it, so the gaps between them read as the cut-outs of an old pressed wheel.
  const rimR = rear ? 0.42 : 0.24;
  const tyreW = rear ? 0.38 : 0.15;
  axleCyl(rimR, tyreW + 0.06, rimMat, 0, 0, 0, spin);
  for (const f of [-1, 1]) axleCyl(rimR * 1.07, 0.02, rimMat, f * (tyreW / 2 + 0.03), 0, 0, spin);
  const out = side * (tyreW / 2 + 0.04);
  axleCyl(rimR * 0.97, 0.02, MAT.castDark, out, 0, 0, spin);
  const spokes = rear ? 6 : 5;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const len = rimR * 0.78;
    const sp = rbox(0.03, len, rear ? 0.1 : 0.06, 0.01, rimMat, out + side * 0.015, 0, 0, spin);
    sp.geometry.translate(0, len / 2 + rimR * 0.12, 0);
    sp.rotation.x = a;
  }
  axleCyl(rear ? 0.11 : 0.07, 0.1, MAT.cast, side * (tyreW / 2 + 0.07), 0, 0, spin);
  axleCyl(rear ? 0.06 : 0.04, 0.03, MAT.chrome, side * (tyreW / 2 + 0.13), 0, 0, spin);
  const nuts = rear ? 6 : 5;
  const nutR = rear ? 0.17 : 0.1;
  for (let i = 0; i < nuts; i++) {
    const a = ((i + 0.5) / nuts) * Math.PI * 2;
    const n = add(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 6).rotateZ(Math.PI / 2), MAT.chrome, spin);
    n.position.set(side * (tyreW / 2 + 0.065), Math.sin(a) * nutR, Math.cos(a) * nutR);
  }
  if (!rear) {
    // The yoke and steering arm of the stub axle, inside the wheel and turning with it (the wheel group is what steers).
    rbox(0.05, 0.42, 0.09, 0.02, MAT.castDark, -side * 0.1, 0.02, 0, wheel);
    tube([-side * 0.1, 0.1, 0], [-side * 0.1, 0.1, -0.2], 0.014, MAT.steel, wheel);
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

  // Engine and bonnet. The block shows under the bonnet's edge, as on the real thing, with the manifolds on its left and the sump below.
  rbox(0.5, 0.5, 1.1, 0.04, MAT.cast, 0, 0.69, 0.7, root);
  rbox(0.42, 0.14, 0.9, 0.03, MAT.castDark, 0, 0.46, 0.75, root); // sump
  rbox(0.3, 0.34, 0.5, 0.04, MAT.castDark, 0, 0.62, 1.12, root); // the front pedestal the axle pivots on
  axleCyl(0.1, 0.06, MAT.castDark, 0, 0.78, 1.3, root); // fan belt pulley
  tube([0.27, 0.9, 0.35], [0.27, 0.9, 0.95], 0.03, MAT.rust, root); // the manifolds, along the left
  tube([0.27, 0.8, 0.35], [0.27, 0.8, 0.95], 0.026, MAT.cast, root);
  for (const z of [0.45, 0.65, 0.85]) rbox(0.05, 0.16, 0.05, 0.01, MAT.cast, 0.26, 0.85, z, root);
  add(loftGeometry([
    { z: 0.34, w: 0.5, y0: 0.93, y1: 1.3 },
    { z: 0.7, w: 0.5, y0: 0.93, y1: 1.35 },
    { z: 1.05, w: 0.47, y0: 0.93, y1: 1.34 },
    { z: 1.36, w: 0.4, y0: 0.93, y1: 1.26 },
  ], { exponent: 3 }), paint, root, 'bonnet');
  // The radiator cap and the oil bath air cleaner with its pipe, side louvres, and the seam down the middle.
  add(new THREE.CylinderGeometry(0.045, 0.055, 0.04, 14), MAT.castDark, root).position.set(0, 1.28, 1.28);
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12), MAT.brass, root).position.set(0, 1.32, 1.28);
  add(new THREE.CylinderGeometry(0.085, 0.07, 0.3, 16), MAT.castDark, root).position.set(-0.33, 1.1, 0.62);
  add(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16), MAT.cast, root).position.set(-0.33, 1.27, 0.62);
  tube([-0.33, 1.05, 0.62], [-0.24, 0.95, 0.5], 0.03, MAT.black, root);
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) rbox(0.012, 0.1, 0.03, 0.004, MAT.black, s * 0.256, 1.12, 0.52 + i * 0.07, root);
  rbox(0.012, 0.014, 1.0, 0.004, MAT.castDark, 0, 1.352, 0.8, root);
  // The front bolster and the grille: a dark casting with a chrome frame and slats, and a badge.
  rbox(0.46, 0.62, 0.1, 0.03, MAT.castDark, 0, 0.98, 1.4, root);
  rbox(0.4, 0.5, 0.03, 0.01, MAT.chrome, 0, 1.0, 1.44, root);
  for (let i = 0; i < 6; i++) rbox(0.37, 0.022, 0.02, 0.006, MAT.black, 0, 0.8 + i * 0.08, 1.46, root);
  rbox(0.014, 0.5, 0.025, 0.004, MAT.chrome, 0, 1.0, 1.465, root);
  rbox(0.14, 0.06, 0.02, 0.01, MAT.brass, 0, 1.3, 1.4, root);
  // Headlamps on stalks off the bolster's corners.
  for (const s of [-1, 1]) {
    tube([s * 0.22, 1.05, 1.38], [s * 0.26, 1.14, 1.42], 0.012, MAT.steel, root);
    add(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 20).rotateX(Math.PI / 2), MAT.chrome, root).position.set(s * 0.26, 1.14, 1.43);
    const lens = add(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 20).rotateX(Math.PI / 2), lensMat, root);
    lens.position.set(s * 0.26, 1.14, 1.465);
  }

  // The fuel tank behind the bonnet, domed, with the dash on top and the filler cap beside it.
  add(loftGeometry([
    { z: 0.04, w: 0.5, y0: 0.96, y1: 1.4 },
    { z: 0.22, w: 0.54, y0: 0.94, y1: 1.43 },
    { z: 0.4, w: 0.5, y0: 0.96, y1: 1.4 },
  ], { exponent: 3 }), paint, root);
  rbox(0.5, 0.04, 0.34, 0.015, grey, 0, 1.4, 0.22, root);
  add(new THREE.CylinderGeometry(0.04, 0.045, 0.03, 12), MAT.castDark, root).position.set(0.19, 1.43, 0.08);

  // Gearbox and clutch housing, rear axle and final drives. The housing is cast in steps, with a bell at the engine end.
  add(new THREE.CylinderGeometry(0.26, 0.26, 0.2, 20).rotateX(Math.PI / 2), MAT.cast, root).position.set(0, 0.7, 0.18);
  rbox(0.58, 0.5, 0.82, 0.05, MAT.cast, 0, 0.7, -0.32, root);
  rbox(0.44, 0.1, 0.5, 0.03, grey, 0, 0.98, -0.4, root); // the cover the seat bracket and lever stand on
  rbox(0.5, 0.26, 0.4, 0.05, MAT.cast, 0, 0.98, -1.12, root); // the hydraulic lift housing behind the seat
  axleCyl(0.09, 1.5, MAT.castDark, 0, 0.72, -0.95, root);
  for (const s of [-1, 1]) axleCyl(0.17, 0.3, MAT.cast, s * 0.46, 0.72, -0.95, root);
  // The power take off stub and its guard, the lift arms with their rods down to the lower links, and the top link.
  tube([0, 0.7, -1.2], [0, 0.7, -1.5], 0.032, MAT.steel, root, 10);
  add(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 12).rotateX(Math.PI / 2), MAT.castDark, root).position.set(0, 0.7, -1.2);
  for (const s of [-1, 1]) {
    tube([s * 0.28, 1.03, -1.16], [s * 0.54, 0.96, -1.5], 0.025, MAT.castDark, root);
    tube([s * 0.52, 0.97, -1.46], [s * 0.4, 0.55, -1.42], 0.012, MAT.steel, root);
  }
  tube([0, 1.12, -1.2], [0, 0.88, -1.62], 0.016, MAT.steel, root);
  rbox(0.06, 0.12, 0.06, 0.01, MAT.castDark, 0, 1.14, -1.2, root);
  // Front axle beam and the kingpin housings, with the track rod behind them and the drag link from the steering box.
  rbox(1.0, 0.1, 0.12, 0.03, MAT.castDark, 0, 0.5, 0.95, root);
  for (const s of [-1, 1]) {
    rbox(0.09, 0.2, 0.09, 0.03, MAT.cast, s * 0.58, 0.46, 0.95, root);
    tube([s * 0.5, 0.4, 0.8], [s * 0.1, 0.55, 0.45], 0.014, MAT.steel, root); // radius rods back to the engine
  }
  tube([-0.62, 0.42, 0.75], [0.62, 0.42, 0.75], 0.016, MAT.steel, root);

  // Rear mudguards, wide curved shells over the big wheels with a rolled lip each edge, a stay each, and the paint worn off the lip.
  for (const s of [-1, 1]) {
    const g = new THREE.CylinderGeometry(REAR_R + 0.17, REAR_R + 0.17, 0.58, 28, 1, true, -0.12, Math.PI + 0.24).rotateZ(Math.PI / 2);
    add(g, paint, root).position.set(s * 0.88, REAR_R, -0.95);
    tube([s * 0.62, 1.0, -0.95], [s * 0.64, 1.45, -0.95], 0.016, MAT.steel, root);
    // A torus is in XY about Z; turned about Y it lies in YZ, and phi = pi - theta matches the shell's angle theta.
    const lip = (from, to, mat, r, edge) => {
      const arc = new THREE.TorusGeometry(REAR_R + 0.17, r, 6, 24, to - from).rotateZ(Math.PI - to).rotateY(Math.PI / 2);
      add(arc, mat, root).position.set(s * 0.88 + edge * 0.29, REAR_R, -0.95);
    };
    for (const e of [-1, 1]) lip(-0.12, Math.PI + 0.12, paint, 0.014, e);
    // Rust through at the front of the outside lip, and at the back where it's been backed into things.
    lip(0.1, 0.55, MAT.primer, 0.017, s);
    lip(0.25, 0.4, MAT.rustPatch, 0.018, s);
    lip(2.5, 3.0, MAT.rustPatch, 0.017, s);
  }
  // Steps and the footplate.
  for (const s of [-1, 1]) rbox(0.22, 0.03, 0.55, 0.01, MAT.steel, s * 0.46, 0.7, -0.35, root);

  // The pan seat on its spring bracket, between the mudguards: a pressed steel pan with a turned lip and drain holes, a thin
  // cushion on it, a coil under it, and the back pad.
  tube([0, 1.0, -0.55], [0, 1.08, -0.78], 0.02, MAT.steel, root);
  add(springGeometry(0.1, 0.035, 0.007, 5), MAT.steel, root).position.set(0, 1.12, -0.8);
  add(new THREE.CylinderGeometry(0.19, 0.17, 0.03, 20), MAT.steel, root).position.set(0, 1.12, -0.8);
  add(new THREE.TorusGeometry(0.19, 0.012, 6, 20).rotateX(Math.PI / 2), MAT.steel, root).position.set(0, 1.135, -0.8);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    add(new THREE.CylinderGeometry(0.014, 0.014, 0.034, 8), MAT.black, root).position.set(Math.sin(a) * 0.09, 1.12, -0.8 + Math.cos(a) * 0.09);
  }
  const pad = add(new THREE.SphereGeometry(0.17, 16, 8), MAT.seat, root);
  pad.scale.set(1, 0.3, 1.05);
  pad.position.set(0, 1.15, -0.8);
  rbox(0.3, 0.2, 0.05, 0.02, MAT.seat, 0, 1.3, -0.97, root);
  tube([0, 1.1, -0.95], [0, 1.22, -0.97], 0.015, MAT.steel, root);

  // Years of use: oil weeping from the joints and the sump, and mud flung up under the body.
  for (const s of [-1, 1]) {
    rbox(0.012, 0.22, 0.32, 0.004, MAT.oil, s * 0.293, 0.62, -0.28, root);
    rbox(0.012, 0.12, 0.08, 0.004, MAT.oil, s * 0.293, 0.76, -0.08, root);
    rbox(0.012, 0.1, 0.5, 0.004, MAT.oil, s * 0.213, 0.46, 0.75, root);
    rbox(0.012, 0.16, 0.34, 0.004, MAT.mud, s * 0.254, 0.5, 0.4, root);
    rbox(0.07, 0.04, 0.3, 0.02, MAT.mud, s * 0.4, 0.52, -0.5, root);
    // The paint worn through along the bonnet's side and over the grille surround.
    rbox(0.02, 0.07, 0.3, 0.01, MAT.primer, s * 0.247, 1.02, 0.6, root);
    rbox(0.021, 0.025, 0.14, 0.01, MAT.rustPatch, s * 0.247, 1.0, 0.55, root);
    rbox(0.025, 0.07, 0.07, 0.01, MAT.primer, s * 0.2, 0.7, 1.4, root);
  }
  rbox(0.02, 0.4, 0.04, 0.008, MAT.oil, 0.06, 0.86, 1.455, root); // a drip down the grille from the radiator cap
  rbox(0.1, 0.01, 0.1, 0.004, MAT.primer, 0.1, 1.348, 1.0, root); // a rubbed patch on the bonnet's crown
  rbox(0.07, 0.05, 0.4, 0.01, MAT.mud, 0, 0.62, 1.4, root); // the front pedestal caked with it

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

  // The drawbar and lower links at the back, with the hitch pin through the drawbar's end.
  rbox(0.1, 0.07, 0.7, 0.02, MAT.steel, 0, 0.52, -1.3, root);
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 8), MAT.steel, root).position.set(0, 0.54, -1.5);
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
