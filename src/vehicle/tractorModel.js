import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { buildDash } from './dash.js';
import { loftGeometry, mergeStatic, rod, springGeometry, sweepGeometry } from './quadGeometry.js';
import { treadTyre } from './detail/tread.js';
import { decalMesh, MAKER_FOR } from './detail/decals.js';
import { MF_WHEELS, MF_BONNET, MF_NOSE, MF_GRILLE, MF_NOSE_FACE, MF_LAMP, MF_PANEL, MF_COWL, MF_STEERING, MF_SEAT, MF_GUARD, MF_FOOT, MF_PEDALS, MF_LEVERS, MF_EXHAUST, MF_AIR, MF_ACCEL, MF_HANDBRAKE, cowlTop } from './mf35Body.js';
import { addHeadlightBeams, addTailLights } from './quadModel.js';

// The old farm tractor (TODO 98): a Massey-Ferguson-35-style three-cylinder diesel in red and grey (the Hartley 35; mf35Body.js has the
// numbers), procedural like the quads: a red bonnet over a grey engine, a red cowl behind it with the instruments set straight into its
// metal, a pan seat between two big rear wheels, a steering wheel on a raked column, an upright exhaust with a flap on top, and a drawbar.
// No cab. Same named parts as a quad's model so Quad drives it unchanged (see quadModel.js), plus the controls only it has:
//
//   quad
//   ├── body                       rocked by vibration
//   │   └── bodyRoot               ground-referenced: y = 0 is the ground at rest, so it sits at TRACTOR_GROUND_OFFSET in the chassis
//   │       ├── bonnet, engine, cowl, gearbox, fenders, seat, exhaust (exhaustFlap, exhaustTip), lamps, drawbar
//   │       ├── dash                       on the cowl's sloping top, not turning with the wheel
//   │       ├── steeringColumn > handlebars    the wheel; turns about the column's axis (and holds riderHands)
//   │       ├── gearLever, handThrottle, clutchPedal, stopKnob   posed from the controls (quad.js poseControls)
//   │       └── riderAnchor, cameraAnchor
//   └── wheel_fl / wheel_fr / wheel_rl / wheel_rr   (each with a 'spin' child)
//
// +Z is forward and +X is the rider's left.

export const SPIKE_RAIL_Z = -1.78; // the bale spike's mast, behind the lift housing
export const SPIKE_PLATE_Z = -1.85; // and its plate on the carriage, where the spike starts (it points out of the back)
export const TRACTOR_GROUND_OFFSET = -0.8; // chassis origin to the ground at rest, metres
const REAR_R = MF_WHEELS.rearR; // big rear wheels
const FRONT_R = MF_WHEELS.frontR; // small front ones
const REST = 0.12; // suspension rest length: matches the spec's suspensionRestLength

const wheelY = (r) => r + REST + TRACTOR_GROUND_OFFSET; // where each suspension mount sits in the chassis frame

/** Where the wheels, their mounts and the bodywork box are, for QuadPhysics. */
export const TRACTOR_LAYOUT = {
  spawnSag: 0.155, // how far the springs sink under its weight when it first lands, measured: it starts already sunk
  wheels: [
    { name: 'wheel_fl', x: MF_WHEELS.frontX, z: MF_WHEELS.frontZ, front: true, radius: FRONT_R, y: wheelY(FRONT_R) },
    { name: 'wheel_fr', x: -MF_WHEELS.frontX, z: MF_WHEELS.frontZ, front: true, radius: FRONT_R, y: wheelY(FRONT_R) },
    { name: 'wheel_rl', x: MF_WHEELS.rearX, z: MF_WHEELS.rearZ, front: false, radius: REAR_R, y: wheelY(REAR_R) },
    { name: 'wheel_rr', x: -MF_WHEELS.rearX, z: MF_WHEELS.rearZ, front: false, radius: REAR_R, y: wheelY(REAR_R) },
  ],
  topY: wheelY(REAR_R),
  chassis: { hx: 0.55, hy: 0.5, hz: 1.5, y: 0.95 + TRACTOR_GROUND_OFFSET },
};

/** The tops of the rear wheel arches, where a girl sits (chassis frame, metres), and where she stands on the ground to climb up. */
export const MUDGUARD = { x: MF_WHEELS.rearX, top: REAR_R + MF_GUARD.r, z: MF_WHEELS.rearZ, standX: 1.5, standZ: -0.35 };

/** The invisible box you look at to get on: ground to roof, wider than the body so it's easy to target. */
export const TRACTOR_PROXY = { w: 2.0, h: 2.0, d: 3.2 };

// Which way each gear's lever leans, as a gate: [forward/back, left/right] in radians (reverse back-right, 1 and 2 left, 3 right).
const GATE = { '-1': [0.3, -0.22], 0: [0, 0], 1: [-0.3, 0.22], 2: [0.3, 0.22], 3: [-0.3, -0.22] };

const MAT = {
  rubber: new THREE.MeshStandardMaterial({ color: 0x1a1917, roughness: 0.95 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.5, metalness: 0.6 }),
  rust: new THREE.MeshStandardMaterial({ color: 0x4b3a2e, roughness: 0.7, metalness: 0.5 }),
  cast: new THREE.MeshStandardMaterial({ color: 0x858886, roughness: 0.62, metalness: 0.3 }), // the engine and gearbox, painted grey
  castDark: new THREE.MeshStandardMaterial({ color: 0x5b5e5f, roughness: 0.65, metalness: 0.35 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xd8dadc, roughness: 0.14, metalness: 1.0 }),
  black: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.7 }),
  seat: new THREE.MeshStandardMaterial({ color: 0x9a9b94, roughness: 0.6 }), // the grey vinyl cushion
  glove: new THREE.MeshStandardMaterial({ color: 0x2d3a26, roughness: 0.8 }),
  sleeve: new THREE.MeshStandardMaterial({ color: 0x3f4d34, roughness: 0.9 }),
  knob: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 }),
  red: new THREE.MeshStandardMaterial({ color: 0xb02a20, roughness: 0.45 }),
  primer: new THREE.MeshStandardMaterial({ color: 0x74402f, roughness: 0.8, metalness: 0.2 }), // paint worn through to red oxide primer
  rustPatch: new THREE.MeshStandardMaterial({ color: 0x5c3a22, roughness: 0.9, metalness: 0.3 }), // and through that to bare, rusty steel
  oil: new THREE.MeshStandardMaterial({ color: 0x14100b, roughness: 0.3, metalness: 0.1 }), // oil weeping from the joints and the sump
  mud: new THREE.MeshStandardMaterial({ color: 0x4a3b29, roughness: 1 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb08d3c, roughness: 0.35, metalness: 0.8 }),
  manifold: new THREE.MeshStandardMaterial({ color: 0x6b4a34, roughness: 0.75, metalness: 0.5 }), // the cast exhaust manifold, rusty brown
  label: new THREE.MeshStandardMaterial({ color: 0x3f7fb4, roughness: 0.6 }), // the filters' blue bands
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
  return treadTyre('tractor', { radius: REAR_R, width: MF_WHEELS.rearW, rimR: MF_WHEELS.rearRim, count: 22, segments: 48 });
}

/** The drum under the rear lugs: carcass with the caked mud of the field between the lugs. */
function rearDrum() {
  return new THREE.CylinderGeometry(REAR_R - 0.055, REAR_R - 0.055, MF_WHEELS.rearW - 0.06, 36, 1, true).rotateZ(Math.PI / 2); // open-ended and narrower than the tyre, so the rim and disc show inboard of the face
}

/** A narrow ribbed front tyre. */
function frontTyre() {
  return treadTyre('rib', { radius: FRONT_R, width: MF_WHEELS.frontW, rimR: MF_WHEELS.frontRim, segments: 32 });
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
  // Pressed steel, painted grey, as in the photos, all of it inboard of the tyre's outer face: the rim between the beads, a dished disc (a
  // funnel, open to the outside, wide at the rim and narrowing inwards to the hub) and a cast hub standing up out of its middle with a
  // flange carrying a ring of studs and nuts, and a cap, none of it past the rubber.
  const rimR = rear ? MF_WHEELS.rearRim : MF_WHEELS.frontRim;
  const tyreW = rear ? MF_WHEELS.rearW : MF_WHEELS.frontW;
  const face = tyreW / 2; // the tyre's outer face
  const x = (d) => side * (face - d); // d metres in from the face
  const funnel = rimMat.clone();
  funnel.side = THREE.DoubleSide;
  add(new THREE.CylinderGeometry(rimR, rimR, tyreW - 0.03, 36, 1, true).rotateZ(Math.PI / 2), funnel, spin, 'wheelRim'); // the rim's barrel, open ended: a closed one would cap the dish over with a flat disc
  for (const f of [-1, 1]) add(new THREE.TorusGeometry(rimR * 1.02, 0.014, 6, 36).rotateY(Math.PI / 2), rimMat, spin).position.x = f * (face - 0.03); // the rim's flanges, rings round it (a solid disc here would cover the dish)
  add(new THREE.TorusGeometry(rimR * 1.025, 0.016, 6, 36).rotateY(Math.PI / 2), MAT.rustPatch, spin).position.x = x(0.03); // bare, rusty outer flange
  const depth = rear ? 0.075 : 0.05; // how far the disc dishes in
  const dish = add(new THREE.CylinderGeometry(rimR * 0.3, rimR * 0.97, depth, 36, 1, true).rotateZ(side * Math.PI / 2), funnel, spin, 'wheelDisc');
  dish.position.set(x(0.03 + depth / 2), 0, 0);
  const hubR = rear ? 0.1 : 0.06;
  axleCyl(hubR, depth + 0.012, MAT.castDark, x(0.03 + depth / 2 - 0.006), 0, 0, spin).name = 'wheelHub'; // the hub casting, from the dish's floor out to the face
  const flangeR = rear ? 0.175 : 0.1;
  axleCyl(flangeR, 0.016, MAT.cast, x(0.052), 0, 0, spin).name = 'wheelFlange'; // the flange the studs are in, standing out of the disc
  const nuts = rear ? 8 : 6;
  const nutR = flangeR - (rear ? 0.032 : 0.02);
  for (let i = 0; i < nuts; i++) {
    const a = ((i + 0.5) / nuts) * Math.PI * 2;
    const nr = rear ? 0.021 : 0.014;
    const n = add(new THREE.CylinderGeometry(nr, nr, 0.026, 6).rotateZ(Math.PI / 2), MAT.chrome, spin, 'wheelNut');
    n.position.set(x(0.052 - 0.018), Math.sin(a) * nutR, Math.cos(a) * nutR); // each nut proud of the flange, a bright hex
  }
  axleCyl(rear ? 0.055 : 0.032, 0.02, MAT.chrome, x(0.03), 0, 0, spin).name = 'wheelCap'; // the cap on the axle's end, in the hub's middle
  if (!rear) {
    // The yoke and steering arm of the stub axle, inside the wheel and turning with it (the wheel group is what steers).
    rbox(0.05, 0.3, 0.09, 0.02, MAT.castDark, -side * 0.09, 0.02, 0, wheel);
    tube([-side * 0.09, 0.08, 0], [-side * 0.09, 0.08, -0.2], 0.014, MAT.steel, wheel);
  }
  mergeStatic(wheel);
  return wheel;
}


/** The height of the panel's plane at z (see mf35Body.js), for sitting things on the cowl's top. */
const panelY0 = (z) => MF_PANEL.at[1] + Math.tan(Math.PI / 2 - MF_PANEL.tilt) * (z - MF_PANEL.at[2]);

// The tractor ------------------------------------------------------------------

export function buildTractorModel({ bodyColor = 0xb02a20, dashStyle = 'tractor' } = {}) {
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5, side: THREE.DoubleSide });
  const grey = new THREE.MeshStandardMaterial({ color: 0xa9aaa4, roughness: 0.55, side: THREE.DoubleSide }); // the faded grey of the wheels and the body
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x2c302c, roughness: 0.08, metalness: 0.2, emissive: 0x000000 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x9a120c, roughness: 0.2, emissive: 0x2a0000 }); // the guards' tail lamps: addTailLights makes them light with the headlamps and brighter on the brake

  const quad = new THREE.Group();
  quad.name = 'quad';
  quad.userData.lensMaterial = lensMat;
  const body = new THREE.Group();
  body.name = 'body';
  quad.add(body);
  const root = new THREE.Group();
  root.name = 'bodyRoot';
  body.add(root);

  // The engine, grey and in the open under the bonnet's lower edge: the block, the sump and the pedestal the front axle pivots on, with
  // the cast manifold, the injection pump and the two filters on its left.
  rbox(0.36, 0.44, 0.9, 0.04, MAT.cast, 0, 0.68, 0.78, root, 'engine');
  rbox(0.34, 0.14, 0.62, 0.03, MAT.castDark, 0, 0.42, 0.74, root); // sump
  rbox(0.3, 0.3, 0.42, 0.04, MAT.castDark, 0, 0.5, 1.02, root); // the front pedestal the axle pivots on
  axleCyl(0.09, 0.06, MAT.castDark, 0, 0.78, 1.17, root); // fan belt pulley
  tube([0.19, 0.9, 0.5], [0.19, 0.9, 0.95], 0.035, MAT.manifold, root); // the manifold, along the left
  tube([0.19, 0.84, 0.5], [0.19, 0.84, 0.95], 0.028, MAT.cast, root);
  for (const z of [0.55, 0.72, 0.9]) rbox(0.05, 0.14, 0.05, 0.01, MAT.manifold, 0.19, 0.86, z, root);
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 18).rotateX(Math.PI / 2), MAT.castDark, root).position.set(0.21, 0.66, 0.98); // the injection pump, a cylinder lying along the engine
  add(new THREE.CylinderGeometry(0.052, 0.052, 0.03, 16).rotateX(Math.PI / 2), MAT.cast, root).position.set(0.21, 0.66, 1.07); // its drive end cap
  for (const z of [0.5, 0.64]) {
    add(new THREE.CylinderGeometry(0.034, 0.034, 0.15, 14), MAT.cast, root).position.set(0.215, 0.72, z); // the filters
    add(new THREE.CylinderGeometry(0.0345, 0.0345, 0.04, 14), MAT.label, root).position.set(0.215, 0.72, z);
  }
  add(new THREE.CylinderGeometry(0.048, 0.048, 0.15, 18).rotateX(Math.PI / 2), MAT.castDark, root).position.set(-0.205, 0.66, 0.9); // the dynamo on the right, a cylinder
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 18).rotateX(Math.PI / 2), MAT.cast, root).position.set(-0.205, 0.66, 0.985); // its end cap
  add(new THREE.CylinderGeometry(0.052, 0.052, 0.012, 18).rotateX(Math.PI / 2), MAT.black, root).position.set(-0.205, 0.66, 0.8); // and its belt pulley
  for (const s of [-1, 1]) tube([s * 0.17, 0.5, 0.35], [s * 0.17, 0.5, 1.12], 0.02, MAT.castDark, root); // the engine's mounting rails

  // The bonnet: a rounded red hood with a raised lid down its middle, over the engine's top half, and the nose shell round the radiator.
  add(loftGeometry(MF_BONNET, { exponent: 3 }), paint, root, 'bonnet');
  rbox(0.2, 0.014, 0.74, 0.006, paint, 0, 1.208, 0.76, root, 'bonnetLid'); // the hinged lid down its crown
  add(loftGeometry(MF_NOSE, { exponent: 3.4 }), paint, root, 'nose');
  // The side panel's lower edge: a darker crease line and the maker's name along it.
  for (const s of [-1, 1]) {
    const name = decalMesh('badge', { maker: MAKER_FOR.tractor, model: '35' }, { width: 0.2, name: 'bonnetName' });
    name.position.set(s * 0.2305, 1.04, 0.74);
    name.rotation.y = s * (Math.PI / 2);
    root.add(name);
  }
  // The air cleaner: a short, fat red stack on a collar on the bonnet's right, with a flat-topped round cap and a rolled lip, as in the photos.
  const AIRH = MF_AIR.top - MF_AIR.base;
  add(new THREE.CylinderGeometry(0.036, 0.04, 0.03, 16), MAT.castDark, root).position.set(MF_AIR.x, MF_AIR.base - 0.01, MF_AIR.z); // the collar it stands in, on the bonnet
  add(new THREE.CylinderGeometry(0.028, 0.03, AIRH, 16), paint, root, 'airCleaner').position.set(MF_AIR.x, MF_AIR.base + AIRH / 2 - 0.02, MF_AIR.z);
  add(new THREE.CylinderGeometry(0.046, 0.04, 0.03, 18), paint, root, 'airCleanerCap').position.set(MF_AIR.x, MF_AIR.top - 0.008, MF_AIR.z);
  add(new THREE.TorusGeometry(0.045, 0.006, 6, 18).rotateX(Math.PI / 2), paint, root).position.set(MF_AIR.x, MF_AIR.top - 0.015, MF_AIR.z);
  // The radiator cap on top of the nose, and the grille: a grey frame with two banks of slats either side of a plain middle strip.
  add(new THREE.CylinderGeometry(0.04, 0.05, 0.04, 14), MAT.castDark, root).position.set(0, 1.155, 1.25);
  add(new THREE.CylinderGeometry(0.026, 0.026, 0.05, 12), MAT.brass, root).position.set(0, 1.19, 1.25);
  // The grille is the nose face's own shape pulled in a little (the same superellipse as the loft's end), so it fits the front body: a grey frame
  // round a dark back, two banks of slats whose ends follow the outline, and a plain strip down the middle.
  const G = MF_GRILLE;
  const NF = MF_NOSE_FACE;
  const outline = (hw, hh, n = 40) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const c = Math.cos(t);
      const sn = Math.sin(t);
      pts.push(new THREE.Vector2(NF.cx + hw * Math.sign(c) * Math.abs(c) ** (2 / NF.e), NF.cy + hh * Math.sign(sn) * Math.abs(sn) ** (2 / NF.e)));
    }
    return pts;
  };
  const gw = NF.hw * G.inset;
  const gh = NF.hh * G.inset;
  const extrude = (shape, depth, z) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, z);
  add(extrude(new THREE.Shape(outline(gw, gh)), 0.02, NF.z - 0.012), MAT.black, root, 'grilleDark');
  const ring = new THREE.Shape(outline(gw, gh));
  ring.holes.push(new THREE.Path(outline(gw - 0.012, gh - 0.012).reverse()));
  add(extrude(ring, 0.012, NF.z - 0.002), grey, root, 'grilleFrame'); // the frame, standing 1 cm proud of the face
  for (let i = 0; i < G.slats; i++) {
    const dy = -(gh - 0.035) + (i * 2 * (gh - 0.035)) / (G.slats - 1);
    const half = gw * (1 - Math.abs(dy / gh) ** NF.e) ** (1 / NF.e) - 0.014; // the slat's reach follows the outline at its height
    if (half < 0.03) continue;
    for (const s of [-1, 1]) rbox(half - 0.012, 0.02, 0.022, 0.007, grey, s * (half / 2 + 0.01), NF.cy + dy, NF.z + 0.004, root, 'grilleSlat');
  }
  rbox(0.032, gh * 2 - 0.03, 0.026, 0.01, grey, 0, NF.cy, NF.z + 0.004, root, 'grilleStrip');
  rbox(0.07, 0.07, 0.014, 0.006, MAT.black, 0, 1.1, 1.385, root, 'badgeMount'); // the badge, on the nose above the grille
  // The headlamps: round, in a red cup on each side of the nose, with a chrome rim and a clear lens.
  const L = MF_LAMP;
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(L.cup, L.cup * 0.9, L.depth, 24).rotateX(Math.PI / 2), paint, root, 'lampCup').position.set(s * L.x, L.y, L.z);
    rbox(L.x - 0.15, 0.05, 0.05, 0.012, paint, s * (0.15 + (L.x - 0.15) / 2), L.y, L.z - 0.015, root, 'lampBracket'); // an arm from inside the nose's side out to the cup's back, so the cup is carried by the body
  }
  for (const s of [-1, 1]) {
    add(new THREE.TorusGeometry(L.r, 0.007, 8, 28), MAT.chrome, root).position.set(s * L.x, L.y, L.z + L.depth / 2 + 0.002);
    const lens = add(new THREE.SphereGeometry(L.r * 1.9, 24, 6, 0, Math.PI * 2, 0, 0.55).rotateX(Math.PI / 2), lensMat, root, 'headlight');
    lens.position.set(s * L.x, L.y, L.z + L.depth / 2 + 0.002 - L.r * 1.9 * Math.cos(0.55) + 0.012);
  }

  // The cowl behind the bonnet: the fuel tank and the instrument panel in one, its top sloping to the driver. The panel is a pressed steel
  // plate, the same red, with the dash's dials, key and lamps set straight into it (no housing, no plastic).
  add(loftGeometry(MF_COWL, { exponent: 6 }), paint, root, 'cowl'); // a squarer section than the bonnet's, so its top is flat out to its edges and the controls on it stand on it
  add(new THREE.CylinderGeometry(0.036, 0.04, 0.025, 14), MAT.castDark, root).position.set(0.17, panelY0(-0.02) + 0.004, -0.02); // the filler cap, behind the panel
  // The dash group on the cowl's slope, scaled up to the real size of the instruments (the mockup is in millimetres at half scale).
  const DASH_SCALE = 1.5;
  const nrm = new THREE.Vector3(0, Math.sin(MF_PANEL.tilt), -Math.cos(MF_PANEL.tilt));
  const dashAt = new THREE.Vector3(...MF_PANEL.at).addScaledVector(nrm, 0.002 - 0.0356 * DASH_SCALE);
  const dash = buildDash(dashStyle);
  dash.group.position.copy(dashAt);
  dash.group.rotation.x = MF_PANEL.tilt;
  dash.group.scale.setScalar(DASH_SCALE);
  dash.group.userData.keep = true;
  root.add(dash.group);
  quad.userData.dash = dash;
  quad.userData.metalBody = true; // painted steel (or aluminium) panels, not plastic: they chip and rust rather than fade (effects/wearLayer.js)
  // The pressed steel panel behind the dials: a V-nosed plate in the dash's own frame, its face 1 mm behind the dials' and its edge rolled.
  const plateShape = new THREE.Shape([[-0.115, -0.1], [0.115, -0.1], [0.115, 0.03], [0, 0.1], [-0.115, 0.03]].map(([x, y]) => new THREE.Vector2(x, y)));
  const plateGeo = new THREE.ExtrudeGeometry(plateShape, { depth: 0.004, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 4 });
  const plate = add(plateGeo.translate(0, 0, -0.0316), paint, dash.group, 'dashPlate');
  plate.geometry.computeVertexNormals();
  // The ignition switch, in 3D now (it was a flat yellow disc drawn on the dial face): a brass bezel ring standing proud of the plate round a
  // dark key barrel, with a chrome lever that turns a quarter when the key does (the dash's update is wrapped to turn it).
  const ign = new THREE.Group();
  ign.name = 'ignitionSwitch';
  ign.position.set(0.07, -0.022, -0.0345);
  add(new THREE.CylinderGeometry(0.0115, 0.0125, 0.008, 20).rotateX(Math.PI / 2), MAT.brass, ign).position.z = -0.004; // the brass base plate
  add(new THREE.TorusGeometry(0.0105, 0.0028, 8, 20), MAT.brass, ign).position.z = -0.009; // its rolled bezel
  add(new THREE.CylinderGeometry(0.0072, 0.0072, 0.01, 16).rotateX(Math.PI / 2), MAT.castDark, ign).position.z = -0.011; // the key barrel
  const ignLever = new THREE.Group();
  ignLever.position.z = -0.0165;
  tube([0, 0, 0], [0, 0.0145, -0.003], 0.0023, MAT.chrome, ignLever, 6); // the lever
  add(new THREE.SphereGeometry(0.0035, 8, 6), MAT.chrome, ignLever).position.set(0, 0.0155, -0.0035);
  add(new THREE.CylinderGeometry(0.0034, 0.0034, 0.004, 10).rotateX(Math.PI / 2), MAT.chrome, ignLever); // and its hub
  ign.add(ignLever);
  dash.group.add(ign);
  const dashUpdate = dash.update;
  dash.update = (s) => {
    dashUpdate(s);
    ignLever.rotation.z = s.keyOn ? -0.3 : Math.PI / 2; // up and a little left with the key on, across to the left off
  };
  // The data plate low on its left, and the lights switch low on its right: a chrome bat on a brass bush set in the panel, named `lightsRocker`
  // so the quad's lights switch tips it (P: up for off, down for on; poseBarPod).
  const dataPlate = rbox(0.04, 0.022, 0.002, 0.002, MAT.castDark, 0.065, -0.075, -0.0338, dash.group, 'dataPlate');
  dataPlate.rotation.z = 0;
  add(new THREE.CylinderGeometry(0.0085, 0.0085, 0.01, 12).rotateX(Math.PI / 2), MAT.brass, dash.group).position.set(-0.07, -0.075, -0.0375);
  const lightsRocker = new THREE.Group();
  lightsRocker.name = 'lightsRocker';
  lightsRocker.userData.keep = true;
  lightsRocker.position.set(-0.07, -0.075, -0.044);
  tube([0, 0, 0], [0, 0.017, -0.004], 0.0028, MAT.chrome, lightsRocker);
  add(new THREE.SphereGeometry(0.0055, 8, 6), MAT.chrome, lightsRocker).position.set(0, 0.018, -0.004);
  dash.group.add(lightsRocker);
  // An accessory pod stands on a short steel post on the cowl beside the panel (its right, so the dials stay clear), leaning back to you.
  const podPost = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.15, 10), new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6, metalness: 0.5 }));
  podPost.position.set(-0.16, panelY0(0.3) + 0.045, 0.3); // on the cowl's top: well inside its edge (it is 0.44 wide there)
  podPost.userData.keep = true;
  podPost.visible = false; // only there while a pod stands on it (Quad.fitPod): a bare stub looked like something floating
  quad.userData.podPost = podPost;
  root.add(podPost);
  const podMount = new THREE.Object3D();
  podMount.name = 'podMount';
  podMount.position.set(-0.16, panelY0(0.3) + 0.115, 0.3); // the post's top
  podMount.rotation.x = 0.35;
  podMount.userData.keep = true;
  root.add(podMount);
  quad.userData.podMount = podMount;

  // Gearbox and clutch housing, rear axle and final drives, all grey. The clutch bell at the engine end, the gearbox in steps behind it, the
  // lift cover on the back with its flat top the lift arms ride on, and the final drives on the axle tubes.
  add(new THREE.CylinderGeometry(0.22, 0.22, 0.26, 20).rotateX(Math.PI / 2), MAT.cast, root).position.set(0, 0.68, 0.2);
  rbox(0.5, 0.46, 0.72, 0.05, MAT.cast, 0, 0.7, -0.3, root, 'gearbox');
  rbox(0.4, 0.12, 0.5, 0.03, MAT.castDark, 0, 0.945, -0.4, root, 'tunnelCover'); // the cover the seat bracket and levers stand on
  rbox(0.5, 0.2, 0.4, 0.05, MAT.cast, 0, 0.97, -1.12, root); // the hydraulic lift housing behind the seat
  axleCyl(0.08, 1.3, MAT.castDark, 0, MF_WHEELS.rearR, MF_WHEELS.rearZ, root);
  for (const s of [-1, 1]) axleCyl(0.15, 0.3, MAT.cast, s * 0.38, MF_WHEELS.rearR, MF_WHEELS.rearZ, root);
  // The power take off stub and its guard, the lift arms with their rods down to the lower links, and the top link.
  tube([0, 0.72, -1.2], [0, 0.72, -1.5], 0.032, MAT.steel, root, 10);
  add(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 12).rotateX(Math.PI / 2), MAT.castDark, root).position.set(0, 0.72, -1.2);
  for (const s of [-1, 1]) {
    tube([s * 0.28, 1.03, -1.16], [s * 0.54, 0.96, -1.5], 0.025, MAT.castDark, root);
    tube([s * 0.52, 0.97, -1.46], [s * 0.4, 0.55, -1.42], 0.012, MAT.steel, root);
  }
  tube([0, 1.12, -1.2], [0, 0.88, -1.62], 0.016, MAT.steel, root);
  rbox(0.06, 0.12, 0.06, 0.01, MAT.castDark, 0, 1.14, -1.2, root);
  // Front axle beam and the kingpin housings, with the track rod behind them and the drag link from the steering box.
  const fy = FRONT_R + 0.03;
  rbox(0.95, 0.09, 0.12, 0.03, MAT.castDark, 0, fy, MF_WHEELS.frontZ, root, 'frontAxle');
  for (let i = -3; i <= 3; i++) add(new THREE.CylinderGeometry(0.012, 0.012, 0.125, 8).rotateX(Math.PI / 2), MAT.steel, root).position.set(i * 0.12, fy, MF_WHEELS.frontZ); // the beam's bolts
  for (const s of [-1, 1]) {
    rbox(0.09, 0.2, 0.09, 0.03, MAT.cast, s * 0.5, fy, MF_WHEELS.frontZ, root);
    tube([s * 0.46, fy - 0.02, MF_WHEELS.frontZ - 0.1], [s * 0.1, 0.5, 0.45], 0.014, MAT.steel, root); // radius rods back to the engine
  }
  tube([-0.54, fy - 0.03, MF_WHEELS.frontZ - 0.15], [0.54, fy - 0.03, MF_WHEELS.frontZ - 0.15], 0.016, MAT.steel, root);

  // Rear mudguards: wide curved red shells over the big wheels with a rolled lip each edge, an arm down to the axle housing, a red lamp on
  // the back edge and the paint worn off the lip.
  const GR = MF_GUARD.r;
  for (const s of [-1, 1]) {
    const g = new THREE.CylinderGeometry(GR, GR, MF_GUARD.w, 28, 1, true, MF_GUARD.from, MF_GUARD.to - MF_GUARD.from).rotateZ(Math.PI / 2);
    add(g, paint, root, 'mudguard').position.set(s * MF_WHEELS.rearX, REAR_R, MF_WHEELS.rearZ);
    const onShell = (theta) => [s * (MF_WHEELS.rearX - MF_GUARD.w / 2 + 0.02), REAR_R + GR * Math.sin(theta), MF_WHEELS.rearZ + GR * Math.cos(theta)];
    rbox(0.14, 0.05, 0.26, 0.015, MAT.castDark, s * 0.5, 0.88, MF_WHEELS.rearZ, root); // the bracket, on top of the final drive housing
    tube([s * 0.5, 0.9, MF_WHEELS.rearZ], onShell(Math.PI / 2), 0.02, MAT.steel, root);
    rbox(0.06, 0.02, 0.1, 0.006, MAT.steel, s * (MF_WHEELS.rearX - MF_GUARD.w / 2 + 0.02), REAR_R + GR - 0.012, MF_WHEELS.rearZ, root); // the plate it bolts to under the shell
    // A torus is in XY about Z; turned about Y it lies in YZ, and phi = pi - theta matches the shell's angle theta.
    const lip = (from, to, mat, r, edge) => {
      const arc = new THREE.TorusGeometry(GR, r, 6, 24, to - from).rotateZ(Math.PI - to).rotateY(Math.PI / 2);
      add(arc, mat, root).position.set(s * MF_WHEELS.rearX + edge * (MF_GUARD.w / 2 - 0.005), REAR_R, MF_WHEELS.rearZ);
    };
    for (const e of [-1, 1]) lip(MF_GUARD.from, MF_GUARD.to, paint, 0.014, e);
    // Rust through at the front of the outside lip, and at the back where it's been backed into things.
    lip(0.1, 0.55, MAT.primer, 0.017, s);
    lip(0.25, 0.4, MAT.rustPatch, 0.018, s);
    lip(2.7, 3.2, MAT.rustPatch, 0.017, s);
    // The red lamp at the guard's back edge, on a little bracket.
    const bx = s * (MF_WHEELS.rearX + 0.1);
    const bz = MF_WHEELS.rearZ + GR * Math.cos(MF_GUARD.to) - 0.01;
    const by = REAR_R + GR * Math.sin(MF_GUARD.to) + 0.02;
    add(new THREE.CylinderGeometry(0.025, 0.028, 0.04, 12).rotateX(Math.PI / 2), tailMat, root, 'guardLamp').position.set(bx, by, bz - 0.01);
  }
  // The footplates either side of the transmission: a flat plate with a raised grid of ribs, and a step down to the ground at its edge.
  const F = MF_FOOT;
  for (const s of [-1, 1]) {
    const cx = s * (F.x0 + F.x1) / 2;
    const cz = (F.z0 + F.z1) / 2;
    rbox(F.x1 - F.x0, 0.025, F.z1 - F.z0, 0.008, MAT.castDark, cx, F.y, cz, root, 'footplate');
    for (let i = 0; i < 9; i++) rbox(F.x1 - F.x0 - 0.04, 0.008, 0.014, 0.003, MAT.cast, cx, F.y + 0.016, F.z0 + 0.04 + (i * (F.z1 - F.z0 - 0.08)) / 8, root);
    tube([s * F.x0, F.y - 0.01, F.z0 + 0.05], [s * 0.3, 0.9, F.z0 + 0.05], 0.014, MAT.steel, root); // its hanger up to the housing
  }

  // The pan seat on its spring bracket, between the mudguards: a red pressed steel pan with a turned lip and drain holes, a thin grey vinyl
  // cushion on it, a coil under it, and a low back pad.
  const Z = MF_SEAT;
  // The seat is carried on a pressed steel bracket bolted to the top of the gearbox cover, with a flat arm running back from it under the pan
  // and a coil spring standing on the arm's end.
  rbox(0.16, 0.05, 0.2, 0.012, paint, 0, 0.99, -0.56, root, 'seatBracket');
  for (const x of [-0.05, 0.05]) add(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 6), MAT.steel, root).position.set(x, 1.019, -0.56); // its bolts
  const armTop = 1.005;
  rbox(0.09, 0.02, 0.44, 0.008, paint, 0, armTop - 0.01, -0.77, root, 'seatArm');
  add(springGeometry(Z.y - 0.035 - armTop - 0.011, 0.035, 0.007, 5), MAT.steel, root, 'seatSpring').position.set(0, Z.y - 0.035, Z.z);
  rbox(0.12, 0.014, 0.12, 0.006, MAT.castDark, 0, armTop + 0.004, Z.z, root); // the plate the spring seats on
  add(new THREE.CylinderGeometry(Z.r, Z.r * 0.9, 0.03, 24), paint, root, 'seatPan').position.set(0, Z.y - 0.02, Z.z);
  add(new THREE.TorusGeometry(Z.r, 0.012, 6, 24).rotateX(Math.PI / 2), paint, root).position.set(0, Z.y - 0.005, Z.z);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    add(new THREE.CylinderGeometry(0.013, 0.013, 0.034, 8), MAT.black, root).position.set(Math.sin(a) * 0.1, Z.y - 0.02, Z.z + Math.cos(a) * 0.1);
  }
  const seatMat = MAT.seat.clone(); // its own, so the frost on this seat is not on anything else's
  quad.userData.seatMaterial = seatMat;
  const pad = add(new THREE.SphereGeometry(Z.r - 0.02, 20, 8), seatMat, root, 'seatCushion');
  pad.scale.set(1, 0.24, 1.05);
  pad.position.set(0, Z.y + 0.022, Z.z);
  add(loftGeometry([{ z: Z.z - 0.2, w: 0.34, y0: Z.y + 0.04, y1: Z.y + 0.2 }, { z: Z.z - 0.24, w: 0.3, y0: Z.y + 0.06, y1: Z.y + 0.22 }], { exponent: 3 }), seatMat, root, 'seatBack');
  tube([0, Z.y, Z.z - 0.17], [0, Z.y + 0.1, Z.z - 0.22], 0.015, paint, root);
  rbox(0.1, 0.04, 0.04, 0.01, MAT.castDark, 0, armTop + 0.02, Z.z - 0.17, root); // the arm carries the pan's rear lip too, so the back stands on something

  // Years of use: oil weeping from the joints and the sump, and mud flung up under the body.
  for (const s of [-1, 1]) {
    rbox(0.012, 0.22, 0.32, 0.004, MAT.oil, s * 0.253, 0.62, -0.28, root);
    rbox(0.012, 0.12, 0.08, 0.004, MAT.oil, s * 0.253, 0.76, -0.08, root);
    rbox(0.012, 0.1, 0.5, 0.004, MAT.oil, s * 0.173, 0.46, 0.75, root);
    rbox(0.012, 0.16, 0.34, 0.004, MAT.mud, s * 0.184, 0.5, 0.4, root);
    rbox(0.07, 0.04, 0.3, 0.02, MAT.mud, s * 0.4, 0.52, -0.5, root);
    // The paint worn through along the bonnet's side and over the nose.
    rbox(0.02, 0.07, 0.3, 0.01, MAT.primer, s * 0.222, 1.0, 0.6, root);
    rbox(0.021, 0.025, 0.14, 0.01, MAT.rustPatch, s * 0.222, 0.98, 0.55, root);
    rbox(0.025, 0.07, 0.07, 0.01, MAT.primer, s * 0.2, 0.7, 1.3, root);
  }
  rbox(0.016, 0.1, 0.03, 0.006, MAT.oil, 0.03, 0.56, 1.37, root); // a drip under the nose, below the grille
  rbox(0.1, 0.01, 0.1, 0.004, MAT.primer, 0.1, 1.204, 1.0, root); // a rubbed patch on the bonnet's crown
  rbox(0.07, 0.05, 0.4, 0.01, MAT.mud, 0, 0.52, 1.1, root); // the front pedestal caked with it

  // The upright exhaust on the left, outside the bonnet: out of the manifold's rear end, up past the bonnet's side, a silencer drum part-way
  // up and a hinged flap on top.
  const E = MF_EXHAUST;
  tube([E.manifold[0], E.manifold[1], E.manifold[2]], [E.x, 1.0, E.z], 0.032, MAT.manifold, root, 10);
  tube([E.x, 1.0, E.z], [E.x, E.top, E.z], 0.03, MAT.black, root, 10);
  add(new THREE.CylinderGeometry(0.052, 0.052, 0.3, 14), MAT.black, root).position.set(E.x, 1.3, E.z);
  const flap = new THREE.Group();
  flap.name = 'exhaustFlap';
  flap.userData.keep = true;
  flap.position.set(E.x, E.top + 0.005, E.z - 0.04); // hinged at the back
  add(new THREE.CylinderGeometry(0.046, 0.046, 0.012, 14), MAT.steel, flap).position.set(0, 0, 0.04);
  root.add(flap);
  const tip = new THREE.Object3D();
  tip.name = 'exhaustTip';
  tip.position.set(E.x, E.top + 0.05, E.z);
  tip.rotation.x = Math.PI / 2; // smoke leaves along its -Z, which now points up
  root.add(tip);

  // The steering wheel on its column, raked back towards the rider. `handlebars` is the wheel itself, so it turns about the column.
  const S = MF_STEERING;
  const column = new THREE.Group();
  column.name = 'steeringColumn';
  column.userData.keep = true;
  column.position.set(...S.column);
  column.rotation.x = -S.rake;
  tube([0, -0.1, 0], [0, S.length, 0], 0.024, MAT.black, column);
  add(new THREE.CylinderGeometry(0.045, 0.06, 0.04, 16), MAT.black, column).position.set(0, 0.0, 0); // the rubber boot where it comes out of the cowl
  root.add(column);
  const wheel = new THREE.Group();
  wheel.name = 'handlebars';
  wheel.userData.keep = true;
  wheel.position.set(0, S.length, 0);
  column.add(wheel);
  add(new THREE.TorusGeometry(S.r, 0.014, 8, 36).rotateX(Math.PI / 2), MAT.black, wheel, 'wheelRim');
  add(new THREE.SphereGeometry(0.045, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.black, wheel, 'wheelHub').position.y = 0;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    add(sweepGeometry([[0, -0.012, 0], [Math.sin(a) * S.r * 0.55, -0.02, Math.cos(a) * S.r * 0.55], [Math.sin(a) * S.r, 0, Math.cos(a) * S.r]], 0.011, { radial: 8 }), MAT.black, wheel, 'wheelSpoke');
  }
  // Where a girl's hands go: the rim at nine and three o'clock, turning with the wheel (npc/companionDriving.js reads these by name).
  for (const side of [1, -1]) {
    const grip = new THREE.Object3D();
    grip.name = side > 0 ? 'gripLeft' : 'gripRight';
    grip.userData.keep = true;
    grip.position.set(side * S.r, 0, 0);
    wheel.add(grip);
  }
  // Your own arms aren't drawn: the group is only here because Quad expects one.
  const hands = new THREE.Group();
  hands.name = 'riderHands';
  hands.userData.keep = true;
  hands.visible = false;
  wheel.add(hands);

  // The stop knob, a black pull knob on a chrome shank low on the panel's right, pulled out to stop it (the diesel's key does not); the hand
  // throttle, a lever on its own pivot bracket bolted to the cowl on the panel's right, sweeping over a toothed quadrant plate.
  const stopKnob = new THREE.Group();
  stopKnob.name = 'stopKnob';
  stopKnob.userData.keep = true;
  stopKnob.position.set(-0.13, panelY0(0.07) - 0.012, 0.07);
  add(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 12).rotateX(Math.PI / 2), MAT.castDark, root).position.set(-0.13, panelY0(0.07) - 0.012, 0.075); // the boss it pulls out of
  tube([0, 0, 0], [0, 0.012, -0.05], 0.006, MAT.chrome, stopKnob);
  add(new THREE.SphereGeometry(0.02, 10, 8), MAT.knob, stopKnob).position.set(0, 0.014, -0.065);
  root.add(stopKnob);
  const hand = new THREE.Group();
  hand.name = 'handThrottle';
  hand.userData.keep = true;
  const hx = -0.2;
  const hz = 0.09;
  const top = cowlTop(hx, hz); // the cowl's true surface here (it is not the dash's plane this far out and back), so the plate lies on it
  const slope = Math.atan(top.slope);
  hand.position.set(hx, top.y + 0.026, hz);
  const quadrant = rbox(0.014, 0.004, 0.2, 0.002, MAT.black, hx, top.y - 0.0005, hz, root, 'throttleQuadrant'); // the slot the lever works in, cut flush into the cowl (a thin dark line, no slab)
  quadrant.rotation.x = slope;
  const bracket = rbox(0.06, 0.05, 0.05, 0.01, MAT.castDark, hx, top.y + 0.006, hz, root, 'throttleBracket'); // the pivot bracket, bolted down through it
  bracket.rotation.x = slope;
  add(new THREE.CylinderGeometry(0.016, 0.016, 0.06, 14).rotateZ(Math.PI / 2), MAT.chrome, hand); // the pivot and its friction nut, on the lever's foot
  tube([0, 0, 0], [0, 0.25, 0], 0.0075, MAT.steel, hand);
  const grip = add(new THREE.SphereGeometry(0.022, 14, 10), MAT.knob, hand, 'throttleGrip'); // a proper black knob on the end
  grip.scale.set(0.9, 1.35, 0.9);
  grip.position.set(0, 0.275, 0);
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

  // The gear lever, ball-topped and standing straight out of the grey casting just ahead of the seat through a bolted cover plate and a
  // rubber gaiter (the main lever, the one the game poses through its gate; the real tractor's second, range lever has no use here).
  const lever = new THREE.Group();
  lever.name = 'gearLever';
  lever.userData.keep = true;
  lever.position.set(...MF_LEVERS.gear);
  tube([0, 0, 0], [0, MF_LEVERS.length, 0], 0.011, MAT.steel, lever);
  add(new THREE.SphereGeometry(0.026, 12, 8), MAT.knob, lever).position.set(0, MF_LEVERS.length + 0.014, 0);
  root.add(lever);
  rbox(0.1, 0.012, 0.1, 0.006, MAT.castDark, MF_LEVERS.gear[0], MF_LEVERS.gear[1] - 0.004, MF_LEVERS.gear[2], root);
  add(new THREE.CylinderGeometry(0.022, 0.03, 0.03, 12), MAT.rubber, root).position.set(MF_LEVERS.gear[0], MF_LEVERS.gear[1] + 0.012, MF_LEVERS.gear[2]);
  // The hand brake: a ratchet lever on the right of the seat, up out of a bracket bolted on the casting (`parkBrakeLever`, posed by the park brake).
  const park = new THREE.Group();
  park.name = 'parkBrakeLever';
  park.userData.keep = true;
  park.position.set(...MF_HANDBRAKE);
  rbox(0.05, 0.05, 0.12, 0.01, MAT.castDark, 0, -0.03, 0, park); // the bracket it pivots in
  tube([0, 0, 0.0], [0, 0.22, 0.05], 0.0085, MAT.steel, park);
  add(new THREE.CylinderGeometry(0.014, 0.014, 0.07, 10).translate(0, 0.25, 0.055), MAT.rubber, park); // the grip
  root.add(park);
  rbox(0.014, 0.012, 0.14, 0.004, MAT.steel, MF_HANDBRAKE[0] - 0.03, MF_HANDBRAKE[1] + 0.02, MF_HANDBRAKE[2] + 0.03, root); // and the toothed quadrant beside it
  // The spike's lift lever, on the left of the seat over its quadrant: forward is down, back is up (posed by poseBaleSpike).
  const spikeLever = new THREE.Group();
  spikeLever.name = 'spikeLever';
  spikeLever.userData.keep = true;
  spikeLever.position.set(0.15, 0.995, -0.5); // well inside the cover's edge (it spans x +-0.2), so it stands on it
  rbox(0.02, 0.014, 0.34, 0.005, MAT.steel, 0, 0, 0, root).position.copy(spikeLever.position); // the quadrant plate it moves over
  for (const dz of [-0.17, 0.17]) rbox(0.03, 0.03, 0.012, 0.004, MAT.red, 0.15, 1.01, -0.5 + dz, root); // the stops at each end
  tube([0, 0, 0], [0, 0.3, 0], 0.011, MAT.steel, spikeLever);
  add(new THREE.SphereGeometry(0.024, 10, 8), MAT.red, spikeLever).position.set(0, 0.32, 0);
  root.add(spikeLever);
  // The pedals: the clutch under the left foot and the two brakes under the right, each a flat steel arm out of a slot in the footplate
  // with a plain pad on a stalk, the brakes latched together by a bar between them.
  const clutch = new THREE.Group();
  clutch.name = 'clutchPedal';
  clutch.userData.keep = true;
  clutch.position.set(...MF_PEDALS.clutch);
  tube([0, 0, 0], [0, 0.15, 0.08], 0.011, MAT.steel, clutch);
  rbox(0.09, 0.02, 0.1, 0.006, MAT.castDark, 0, 0.16, 0.09, clutch);
  root.add(clutch);
  // The two brake pedals are one group (latched together), pressed by the brake; the accelerator is a narrow pedal beside them.
  const brakes = new THREE.Group();
  brakes.name = 'brakePedals';
  brakes.userData.keep = true;
  brakes.position.set(0, MF_PEDALS.brakes[0][1], MF_PEDALS.brakes[0][2]);
  for (const [x] of MF_PEDALS.brakes) {
    tube([x, 0, 0], [x, 0.15, 0.08], 0.011, MAT.steel, brakes);
    rbox(0.09, 0.02, 0.1, 0.006, MAT.castDark, x, 0.16, 0.09, brakes);
  }
  tube([MF_PEDALS.brakes[0][0], 0.1, 0.05], [MF_PEDALS.brakes[1][0], 0.1, 0.05], 0.008, MAT.steel, brakes); // the latch bar
  root.add(brakes);
  const accel = new THREE.Group();
  accel.name = 'accelPedal';
  accel.userData.keep = true;
  accel.position.set(...MF_ACCEL);
  tube([0, 0, 0], [0, 0.13, 0.07], 0.009, MAT.steel, accel);
  rbox(0.05, 0.018, 0.12, 0.006, MAT.castDark, 0, 0.14, 0.08, accel);
  root.add(accel);

  // The drawbar and lower links at the back, with the hitch pin through the drawbar's end.
  rbox(0.1, 0.07, 0.7, 0.02, MAT.steel, 0, 0.5, -1.3, root);
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 8), MAT.steel, root).position.set(0, 0.52, -1.5);
  for (const s of [-1, 1]) tube([s * 0.22, 0.6, -0.95], [s * 0.4, 0.5, -1.45], 0.02, MAT.steel, root);
  tube([-0.4, 0.5, -1.45], [0.4, 0.5, -1.45], 0.016, MAT.steel, root);

  // The bale spike (items/baleSpike.js): a mast of two rails braced back to the lift housing, and a carriage that runs up and down it with
  // a spike pointing out of the back. The carriage is posed by poseBaleSpike; the whole group is hidden while a trailer is on the drawbar.
  const spikeMast = new THREE.Group();
  spikeMast.name = 'baleSpike';
  spikeMast.userData.keep = true;
  for (const s of [-1, 1]) {
    tube([s * 0.3, 0.45, SPIKE_RAIL_Z], [s * 0.3, 2.2, SPIKE_RAIL_Z], 0.028, MAT.red, spikeMast);
    tube([s * 0.3, 1.45, SPIKE_RAIL_Z], [s * 0.4, 0.58, -1.45], 0.02, MAT.steel, spikeMast); // a stay down the back of the rail to the lower link's end: it stays behind the guards (they end at z -1.6 and the stay is at x 0.3 to 0.4, inside their 0.43), so nothing crosses them from any side
    tube([s * 0.3, 0.55, SPIKE_RAIL_Z], [s * 0.4, 0.5, -1.45], 0.02, MAT.steel, spikeMast);
  }
  rbox(0.68, 0.05, 0.05, 0.015, MAT.red, 0, 2.2, SPIKE_RAIL_Z, spikeMast);
  rbox(0.6, 0.05, 0.05, 0.015, MAT.red, 0, 0.5, SPIKE_RAIL_Z, spikeMast); // and a foot bar across the bottom, so the rails are one frame
  const carriage = new THREE.Group();
  carriage.name = 'spikeCarriage';
  rbox(0.64, 0.34, 0.05, 0.02, MAT.rust, 0, 0, SPIKE_PLATE_Z, carriage); // wide enough to reach the carriage blocks on the rails either side
  for (const s of [-1, 1]) rbox(0.07, 0.5, 0.1, 0.02, MAT.red, s * 0.3, 0, SPIKE_RAIL_Z - 0.05, carriage);
  add(new THREE.CylinderGeometry(0.014, 0.05, 1.5, 12).rotateX(-Math.PI / 2), MAT.steel, carriage).position.set(0, 0, SPIKE_PLATE_Z - 0.75);
  add(new THREE.CylinderGeometry(0.065, 0.065, 0.08, 12).rotateX(-Math.PI / 2), MAT.castDark, carriage).position.set(0, 0, SPIKE_PLATE_Z - 0.06);
  carriage.position.y = 1.1;
  carriage.userData.keep = true;
  spikeMast.add(carriage);
  mergeStatic(carriage);
  mergeStatic(spikeMast);
  root.add(spikeMast);

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
  addTailLights(quad, tailMat);
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
 * Poses the levers and pedals from the controls: the gear lever in its gate, the hand throttle, the clutch, the brake and accelerator pedals,
 * the hand brake and the stop knob (`stop` 0..1, pulled out).
 */
export function poseTractorControls(model, { gear, hand, pedal, brake = 0, throttle = 0, park = 0, stop = 0 }) {
  const parts = (model.userData.controlParts ??= {
    lever: model.getObjectByName('gearLever'),
    throttle: model.getObjectByName('handThrottle'),
    clutch: model.getObjectByName('clutchPedal'),
    brakes: model.getObjectByName('brakePedals'),
    accel: model.getObjectByName('accelPedal'),
    park: model.getObjectByName('parkBrakeLever'),
    stop: model.getObjectByName('stopKnob'),
  });
  const [fb, lr] = GATE[gear] ?? GATE[0];
  parts.lever.rotation.set(fb, 0, lr);
  parts.throttle.rotation.x = 0.7 - 1.4 * hand;
  parts.clutch.rotation.x = -0.45 * pedal;
  parts.brakes.rotation.x = -0.4 * Math.min(1, brake);
  parts.accel.rotation.x = -0.3 * Math.min(1, throttle);
  parts.park.rotation.x = 0.15 - 0.5 * park; // the lever pulled back and up to hold it on
  parts.stop.userData.z0 ??= parts.stop.position.z;
  parts.stop.position.z = parts.stop.userData.z0 - 0.06 * stop; // pulled out towards the driver (the shank points that way)
}

/** Poses the bale spike's carriage at `plateY` metres up and its lever in the cab at `lift` (0 to 1), and hides the whole fitting while `shown` is false (a trailer on the drawbar). */
export function poseBaleSpike(model, plateY, shown = true, lift = 0) {
  const mast = model.getObjectByName('baleSpike');
  if (!mast) return;
  model.getObjectByName('spikeLever').rotation.x = 0.6 - 1.2 * lift;
  mast.visible = shown;
  model.getObjectByName('spikeCarriage').position.y = plateY;
}
