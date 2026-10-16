import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { buildDash } from './dash.js';
import { addHeadlightBeams, addTailLights, addSignalLamps, addSignalStalk, addHazardSwitch } from './quadModel.js';
import { bentTube, loftGeometry, mergeStatic, rod, springGeometry } from './quadGeometry.js';
import { treadTyre } from './detail/tread.js';
import { buildBuckledBelt, webbingMaterial } from './detail/belts.js';
import { decalMesh, MAKER_FOR } from './detail/decals.js';
import { buildMuleSpin, addMuleFront, addMuleCab, addMuleDoors, addMuleBed, addMuleGate, addMuleHitch } from './muleDetail.js';
import { MULE_WHEELS, MULE_BED, MULE_DOOR, MULE_HITCH, MULE_DASH, loftTop } from './muleBody.js';
import { buildHandbrake } from './detail/cabControls.js';

// The farm UTV (TODO 99): the Ridgeback Yak 4010, a Mule-4010-style side-by-side (muleBody.js has the numbers, muleDetail.js the parts),
// procedural like the quads and the tractor. A diesel, with a bench seat for
// three under a roll cage and flat roof, a windscreen, a mesh behind the seat and door nets that swing out, a steering wheel on the right (it's British), a pedal pair on the floor, a centre console with the
// forward and reverse lever, the 4WD and diff lock switches, the light switch and the bed's tip lever, and a black tipping bed behind the seat with a drop-down tailgate. Same named parts as a quad's model so Quad
// drives it unchanged (see quadModel.js), plus the ones only it has:
//
//   quad
//   ├── body                       rocked by vibration
//   │   └── bodyRoot               ground-referenced: y = 0 is the ground at rest, so it sits at UTV_GROUND_OFFSET in the chassis
//   │       ├── bonnet, fenders, dash panel, floor, bench seat (seatLeft, seatMid anchors), roll cage, roof, exhaust
//   │       ├── dash                       the digital cluster, on the dash panel in front of the driver, not turning with the wheel
//   │       ├── driveLever, driveSwitchRocker, diffLockButton, lightRocker, tipLever    the centre console (poseUtvControls, poseUtvBed)
//   │       ├── steeringColumn > handlebars    the wheel; turns about the column's axis (and holds riderHands, gripLeft, gripRight)
//   │       ├── bed                        hinged at the back: tips up (rotation.x negative). Holds bedSeat and the tailgate
//   │       │   └── tailgate               hinged at its bottom edge: 0 shut, -pi/2 lying flat
//   │       └── riderAnchor, cameraAnchor  the driver's hips and eyes
//   └── wheel_fl / wheel_fr / wheel_rl / wheel_rr   (each with a 'spin' child)
//
// +Z is forward and +X is the driver's left (the driver sits on the right, at -X).

export const UTV_GROUND_OFFSET = -0.6; // chassis origin to the ground at rest, metres
const R = MULE_WHEELS.radius; // 25 inch tyres
const REST = 0.2; // suspension rest length: matches the spec's suspensionRestLength

const wheelY = R + REST + UTV_GROUND_OFFSET; // where each wheel's suspension mount sits in the chassis frame

/** Where the wheels, their mounts and the bodywork box are, for QuadPhysics. */
export const UTV_LAYOUT = {
  spawnSag: 0.14, // how far the springs sink under its weight when it first lands, measured: it starts already sunk
  wheels: [
    { name: 'wheel_fl', x: MULE_WHEELS.x, z: MULE_WHEELS.z, front: true, radius: R, y: wheelY },
    { name: 'wheel_fr', x: -MULE_WHEELS.x, z: MULE_WHEELS.z, front: true, radius: R, y: wheelY },
    { name: 'wheel_rl', x: MULE_WHEELS.x, z: -MULE_WHEELS.z, front: false, radius: R, y: wheelY },
    { name: 'wheel_rr', x: -MULE_WHEELS.x, z: -MULE_WHEELS.z, front: false, radius: R, y: wheelY },
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
// The hips sit about 0.12 m in front of the backrest's face (-0.43), as a person's do; they were 0.23 m, which sat everyone too far
// forward (Jamie). The worn belts' chest and lap points moved back with them (SEAT_BACK).
const SEAT_BACK = -0.11;
export const UTV_SEATS = {
  driver: { x: -0.34, y: 0.76, z: -0.31 },
  mid: { x: 0, y: 0.76, z: -0.31 },
  left: { x: 0.34, y: 0.76, z: -0.31 },
  bed: { x: 0, y: 0.8, z: -1.81 }, // on the open tailgate, hips over its middle (the tailgate is at -1.64)
};
export const UTV_STAND = {
  left: { x: 1.35, z: -0.1 },
  mid: { x: 1.35, z: -0.1 }, // the middle seat is reached from the left, over the other girl's knees, or from the left when she's not there
  bed: { x: 0, z: -2.61 },
  driver: { x: -1.35, z: -0.1 }, // the wheel is on the right, so a girl driving climbs in from that side (x is negative)
};

/**
 * Where things stand in the bed, as the bed's own frame (x across, z from the hinge at the back, y up from its floor): two rows of three
 * in the clear between the wheel wells (they take up |x| 0.45 to 0.75 for 0.71 to 1.45 m behind the cab), the long things turned along it.
 */
export const BED_CARGO_SPOTS = [-0.3, 0, 0.3].flatMap((x) => [0.81, 0.28].map((z) => ({ x, z })));
export const BED_CARGO_YAWS = { jumpLeads: 0 }; // by the item's model name; the leads are roundish
export const BED_CARGO_YAW = Math.PI / 2; // and everything else
export const BED_FLOOR_Y = 0.085; // the top of the floor, in the bed's frame
/** The invisible box you look at to put something in the bed, in the bed's frame. */
export const BED_PROXY = { w: 1.5, h: 0.6, d: 1.15, x: 0, y: 0.3, z: 0.55 };

/** The most the bed tips, and the tailgate's open angle (radians). */
export const BED_MAX_TIP = 0.82;
export const TAILGATE_OPEN = -Math.PI / 2 - 0.04;

const HINGE = MULE_BED.hinge; // the bed's pivot, at the back of its floor

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
  orange: new THREE.MeshStandardMaterial({ color: 0xd9531e, roughness: 0.5 }), // the diff lock button
  indicator: new THREE.MeshStandardMaterial({ color: 0x5c2c08, roughness: 0.25 }), // the indicator lenses, front and back: dark amber until they flash (addSignalLamps gives each side its own and lights it)
  reverse: new THREE.MeshStandardMaterial({ color: 0x4d5254, roughness: 0.2 }), // the reverse lens on each tail lamp: smoked until it lights
  buckleRed: new THREE.MeshStandardMaterial({ color: 0xc8261e, roughness: 0.45 }), // the red release button on a seat belt buckle
  grille: new THREE.MeshStandardMaterial({ color: 0x141516, roughness: 0.6 }),
  bumper: new THREE.MeshStandardMaterial({ color: 0x252628, roughness: 0.9, bumpScale: 0.6 }), // moulded black plastic with a grain (its map is made when the first model is built)
  glovebox: new THREE.MeshStandardMaterial({ color: 0x2a2b2d, roughness: 0.6 }),
  rim: new THREE.MeshStandardMaterial({ color: 0x2a2e2d, roughness: 0.55, metalness: 0.45 }), // the wheels: black steel
  flare: new THREE.MeshStandardMaterial({ color: 0x1a1b1c, roughness: 0.8, side: THREE.DoubleSide }), // the moulded black fender flares
  roof: new THREE.MeshStandardMaterial({ color: 0xb4b6b0, roughness: 0.55 }), // the flat grey roof panel
  glass: new THREE.MeshStandardMaterial({ color: 0xaec4cc, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }), // the windscreen
  net: new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.6, metalness: 0.4 }), // the mesh behind the seat and in the door nets
  reflector: new THREE.MeshStandardMaterial({ color: 0xe6e6e6, roughness: 0.1, metalness: 1 }),
};

/** Where each seat's belt anchors (shoulder, x) and buckles (x): the driver's from the right, the others' from the left. */
export const BELTS = {
  driver: { anchor: -0.5, buckle: -0.2 },
  mid: { anchor: 0.17, buckle: -0.12 },
  left: { anchor: 0.5, buckle: 0.2 },
};

/** A fine moulded grain for the bumper's black plastic: random light and dark flecks, tiled. */
function grainTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, size, size);
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    const v = Math.floor(60 + rand() * 140);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(Math.floor(rand() * size), Math.floor(rand() * size), 1 + (rand() > 0.7 ? 1 : 0), 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 2);
  return tex;
}

/** A grey cloth weave with dark flecks, drawn once and tiled over the seat. */
let cloth = null;
function clothTexture() {
  if (cloth) return cloth;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#9a9c9a';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < size; i += 4) {
    // Warp and weft threads, a shade lighter and darker in turn.
    g.fillStyle = i % 8 ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.16)';
    g.fillRect(i, 0, 2, size);
    g.fillRect(0, i, size, 2);
  }
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 380; i++) {
    g.fillStyle = rand() > 0.5 ? 'rgba(20,20,20,0.35)' : 'rgba(230,230,230,0.25)';
    g.fillRect(Math.floor(rand() * size), Math.floor(rand() * size), 2, 2);
  }
  cloth = new THREE.CanvasTexture(c);
  cloth.wrapS = cloth.wrapT = THREE.RepeatWrapping;
  cloth.repeat.set(3, 3);
  cloth.colorSpace = THREE.SRGBColorSpace;
  cloth.anisotropy = 4;
  return cloth;
}

// The made-up maker on the badges and decals (never a real one's name or logo).
const MAKER = 'RIDGEBACK';
const MODEL_NAME = 'YAK 4010';

/** A flat printed label: a canvas drawn once, on a plane of w by h metres. Facing +Z; the caller turns it. Not merged (it has a map). */
function decal(w, h, draw, { px = 400, transparent = true } = {}) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * px);
  c.height = Math.round(h * px);
  const g = c.getContext('2d');
  g.scale(px, px);
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

/** Puts a decal on a flat face: `at` is its centre, `facing` the way it looks ('+x', '-x', '-z', '+z' or 'up'). */
function stick(label, parent, at, facing) {
  label.position.set(...at);
  if (facing === '+x') label.rotation.y = Math.PI / 2;
  else if (facing === '-x') label.rotation.y = -Math.PI / 2;
  else if (facing === '-z') label.rotation.y = Math.PI;
  else if (facing === 'up') label.rotation.set(-Math.PI / 2, 0, Math.PI); // lying flat, its top towards +Z so the driver reads it
  parent.add(label);
  return label;
}

function text(g, str, x, y, size, colour, { align = 'center', weight = 'bold' } = {}) {
  // Drawn at the real pixel size: the decals draw in metres under a big scale, and a font a fraction of a pixel high is dropped by some
  // browsers (Firefox), which left the console's legend blank.
  const k = g.getTransform().a;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = colour;
  g.font = `${weight} ${size * k}px Helvetica, Arial, sans-serif`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillText(str, x * k, y * k);
  g.restore();
}

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

function buildWheel(w) {
  const side = Math.sign(w.x);
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  spin.name = 'spin';
  spin.userData.keep = true;
  wheel.add(spin);
  buildMuleSpin(spin, MAT, w.front, side); // the tyre, the dished black rim and its nuts, all inboard of the tyre's face (muleDetail.js)
  mergeStatic(wheel);
  return wheel;
}

// The UTV ----------------------------------------------------------------------

export function buildUtvModel({ bodyColor = 0x367c2b, dashStyle = 'utv' } = {}) {
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.42, side: THREE.DoubleSide });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x191a1b, roughness: 0.55 }); // black vinyl, as in the photos
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x2c302c, roughness: 0.08, metalness: 0.2, emissive: 0x000000 });

  MAT.bumper.bumpMap ??= grainTexture();
  const beltWebbing = webbingMaterial();
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
  for (const z of [1.18, 0.55, -0.3, -0.62, -1.5]) tube([-0.42, 0.36, z], [0.42, 0.36, z], 0.03, MAT.frame, root);
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

  // The front (muleDetail.js): the ribbed green hood over the mesh grille, the lamps at the nose's corners, the bumper and the black flares.
  addMuleFront(root, MAT, paint, lensMat);

  // The cab: floor with ribs, rocker panels, the dash panel across the front with its glovebox and grab handle.
  rbox(1.2, 0.03, 1.1, 0.01, MAT.floor, 0, 0.34, 0.0, root);
  for (let i = 0; i < 14; i++) rbox(1.1, 0.012, 0.02, 0.004, MAT.plastic, 0, 0.358, -0.5 + i * 0.075, root);
  for (const s of [-1, 1]) {
    rbox(0.1, 0.2, 1.15, 0.03, paint, s * 0.64, 0.42, 0.0, root);
    rbox(0.12, 0.03, 1.0, 0.01, MAT.steel, s * 0.72, 0.34, 0.0, root); // the step along the sill
  }
  add(loftGeometry(MULE_DASH, { exponent: 3 }), MAT.plastic, root, 'dashPanel');
  // The glovebox: a big moulded lid on the passenger side, flush with the dash's face, with a recessed handle bar and the warning sticker.
  rbox(0.5, 0.27, 0.014, 0.02, MAT.glovebox, 0.3, 0.84, 0.337, root, 'gloveboxLid');
  rbox(0.13, 0.026, 0.02, 0.008, MAT.floor, 0.3, 0.935, 0.326, root); // the recess its handle sits in
  rbox(0.11, 0.014, 0.022, 0.006, MAT.plastic, 0.3, 0.935, 0.322, root, 'gloveboxHandle');
  const warn = decalMesh('warning', {}, { width: 0.2, name: 'gloveboxWarning' });
  warn.position.set(0.3, 0.82, 0.3293);
  warn.rotation.y = Math.PI;
  root.add(warn);
  // The passenger's grab handle: a bent bar standing on two plates bolted to the dash's top, at its true height there.
  const gx = [0.14, 0.52];
  const gy = gx.map((x) => loftTop(MULE_DASH, x, 0.4, 3));
  add(bentTube([[gx[0], gy[0] - 0.02, 0.4], [gx[0], gy[0] + 0.18, 0.4], [gx[1], gy[1] + 0.18, 0.4], [gx[1], gy[1] - 0.02, 0.4]], 0.014, { bend: 0.03, radial: 6 }), MAT.steel, root, 'grabHandle');
  gx.forEach((x, i) => rbox(0.06, 0.014, 0.06, 0.006, MAT.steel, x, gy[i] + 0.002, 0.4, root));
  for (const x of [0.22, 0.33]) add(new THREE.CylinderGeometry(0.03, 0.026, 0.02, 14), MAT.floor, root).position.set(x, loftTop(MULE_DASH, x, 0.52, 3) - 0.004, 0.52); // cup holders
  for (const x of [0.22, 0.33]) add(new THREE.CylinderGeometry(0.026, 0.026, 0.002, 14), MAT.plastic, root).position.set(x, loftTop(MULE_DASH, x, 0.52, 3) + 0.006, 0.52);

  // The bench: a base, a cushion and a split backrest, in grey cloth, with the three seat belts stowed down the back.
  rbox(1.12, 0.3, 0.46, 0.04, MAT.plastic, 0, 0.55, -0.2, root); // the base it sits on, with the engine under it
  rbox(1.14, 0.1, 0.5, 0.05, seatMat, 0, 0.71, -0.19, root, 'seatCushion');
  const back = rbox(1.14, 0.56, 0.1, 0.05, seatMat, 0, 1.06, -0.48, root, 'seatBack');
  back.rotation.x = -0.12; // leans back a touch
  for (const x of [-0.19, 0.19]) {
    rbox(0.012, 0.02, 0.5, 0.004, MAT.plastic, x, 0.762, -0.19, root); // the seams
    const seam = rbox(0.012, 0.56, 0.02, 0.004, MAT.plastic, x, 1.06, -0.43, root);
    seam.rotation.x = -0.12;
  }
  // The seat belts (detail/belts.js buildBuckledBelt): each seat's D-loop hangs from the rear cage's bar, the reel sits in the seat back's crease
  // and the buckle on its strap in the crease on the other side of the seat. Stowed they hang down the backrest, worn they run across whoever
  // sits there to the tongue clicked into the buckle (poseUtvBelts).
  for (const [seat, belt] of Object.entries(BELTS)) {
    const hip = [UTV_SEATS[seat].x, UTV_SEATS[seat].y - 0.05, UTV_SEATS[seat].z + SEAT_BACK]; // the sitter's hips sink into the cushion: the belt lies lower
    const top = [belt.anchor, 1.3, -0.52];
    const low = [belt.anchor, 0.8, -0.44];
    const buckle = [belt.buckle, 0.8, -0.38];
    tube([belt.anchor, 1.45, -0.58], [belt.anchor, 1.32, -0.52], 0.008, MAT.steel, root, 6); // the strap bracket down from the bar to the loop
    root.add(buildBuckledBelt(seat, { top, low, buckle, hip, faceZ: -0.42, mats: { webbing: beltWebbing } }));
  }

  // The cage, roof, windscreen, rear net, mirrors and the lamps' plate (muleDetail.js), and the door nets that swing out.
  addMuleCab(root, MAT, paint);
  quad.userData.doorNets = addMuleDoors(root, MAT);

  // The steering wheel on its column, raked back to the driver (on the right). `handlebars` is the wheel itself, so it turns about the
  // column's axis; the dash sits on the column's shroud so it doesn't turn with it.
  const column = new THREE.Group();
  column.name = 'steeringColumn';
  column.userData.keep = true;
  column.position.set(-0.34, 0.84, 0.5);
  column.rotation.x = -0.95;
  tube([0, 0, 0], [0, 0.46, 0], 0.025, MAT.steel, column);
  root.add(column);
  addSignalStalk(column, 0.28, MAT.steel, { modern: true });
  const wheel = new THREE.Group();
  wheel.name = 'handlebars';
  wheel.userData.keep = true;
  wheel.position.set(0, 0.46, 0);
  column.add(wheel);
  add(new THREE.TorusGeometry(0.19, 0.017, 8, 32).rotateX(Math.PI / 2), MAT.plastic, wheel);
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 14), MAT.plastic, wheel, 'hornPad'); // the horn pad, which sinks while it sounds
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
  dash.group.scale.setScalar(0.95); // a small old-fashioned cluster, in proportion to the console's switches
  dash.group.userData.keep = true;
  root.add(dash.group);
  quad.userData.dash = dash;
  quad.userData.podMount = null;

  buildConsole(root);

  // Controls: the brake and accelerator on the floor, the parking brake handle by the door.
  rbox(0.1, 0.016, 0.08, 0.005, MAT.plastic, -0.42, 0.37, 0.3, root).rotation.x = -0.5; // the brake, wide
  rbox(0.05, 0.016, 0.12, 0.005, MAT.plastic, -0.27, 0.37, 0.3, root).rotation.x = -0.5; // the accelerator, narrow
  // The parking brake, a car's: a lever with a grip and a release button at its end on a bracket on the sill's top beside the driver's seat, under
  // a rubber boot; pulled up for on (poseUtvControls).
  rbox(0.07, 0.03, 0.2, 0.01, MAT.steel, -0.62, 0.535, -0.12, root, 'handbrakeBracket');
  const park = buildHandbrake('centre');
  park.name = 'parkBrakeLever';
  park.userData.keep = true;
  park.position.set(-0.62, 0.575, -0.2);
  root.add(park);
  add(new THREE.CylinderGeometry(0.03, 0.04, 0.03, 12), MAT.rubber, root, 'handbrakeBoot').position.set(-0.62, 0.56, -0.2);
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

  // The exhaust: a silencer under the bed between the right rail and the transaxle, clear of the frame, and a tailpipe running over the rear
  // cross member to the back.
  const exX = -0.27;
  add(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 14).rotateX(Math.PI / 2), MAT.rust, root, 'silencer').position.set(exX, 0.45, -1.0);
  tube([exX, 0.45, -1.25], [exX, 0.47, -1.58], 0.024, MAT.steel, root);
  tube([-0.12, 0.45, -0.8], [exX, 0.45, -0.78], 0.024, MAT.steel, root); // the pipe in from the transaxle
  const tip = new THREE.Object3D();
  tip.name = 'exhaustTip';
  tip.position.set(exX, 0.47, -1.6); // smoke leaves along its -Z, which is straight back
  root.add(tip);
  // Mudflaps behind the rear wheels.
  for (const s of [-1, 1]) rbox(0.3, 0.26, 0.012, 0.004, MAT.rubber, s * 0.66, 0.4, -1.34, root);

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
  // Where your eyes are riding in the middle or the left of the bench.
  for (const [name, seat] of [['cameraMid', UTV_SEATS.mid], ['cameraLeft', UTV_SEATS.left]]) {
    const a = new THREE.Object3D();
    a.name = name;
    a.position.set(seat.x, seat.y + 0.7, seat.z - 0.04);
    root.add(a);
  }

  // The bed: green steel with pressed beads, a front wall, the wheel wells in black plastic and tie-down hooks, on a hinge at the back.
  const bed = new THREE.Group();
  bed.name = 'bed';
  bed.position.set(0, HINGE.y, HINGE.z);
  root.add(bed);
  const zc = (z) => z - HINGE.z; // a world z, as the bed's own
  const yc = (y) => y - HINGE.y;
  addMuleBed(bed, MAT, paint, yc, zc);
  // The tailgate, hinged along its bottom edge: shut, it stands up; open, it lies flat behind the bed (where a girl can sit).
  const gate = new THREE.Group();
  gate.name = 'tailgate';
  gate.userData.keep = true;
  gate.position.set(0, yc(MULE_BED.floorY + 0.03), zc(MULE_BED.gate));
  addMuleGate(gate, MAT, paint);
  bed.add(gate);
  addMuleHitch(root, MAT);
  addSignalLamps(quad, MAT.indicator, MAT.reverse);
  addTailLights(quad, MAT.tail); // before the bed is merged: the cab's lamps become the quad's own tail material, lit by the headlight supply
  // The tailgate's seat: hips on its middle when it's down, facing backwards (a girl riding where she shouldn't).
  const bedSeat = new THREE.Object3D();
  bedSeat.name = 'bedSeat';
  bedSeat.position.set(UTV_SEATS.bed.x, yc(UTV_SEATS.bed.y), zc(UTV_SEATS.bed.z));
  bedSeat.rotation.y = Math.PI;
  bed.add(bedSeat);
  mergeStatic(gate);
  mergeStatic(bed);
  bed.userData.keep = true;
  // Where a jerry can or the toolbox stands in the bed, and a box to look at to put one there. They ride the bed as it tips.
  BED_CARGO_SPOTS.forEach((c, i) => {
    const a = new THREE.Object3D();
    a.name = `bedCargo${i}`;
    a.position.set(c.x, BED_FLOOR_Y, c.z);
    bed.add(a);
  });
  const bedProxy = new THREE.Mesh(new THREE.BoxGeometry(BED_PROXY.w, BED_PROXY.h, BED_PROXY.d), new THREE.MeshBasicMaterial({ visible: false }));
  bedProxy.name = 'bedProxy';
  bedProxy.position.set(BED_PROXY.x, BED_PROXY.y, BED_PROXY.z);
  bed.add(bedProxy);

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


// The centre console -----------------------------------------------------------

// A small pod on the dash, tilted up to the driver like the cluster, with its controls standing out of the face. In the pod's own frame:
// +x is the driver's left, +y up the slope of the face and -z out of it, towards the driver.
const POD = { x: -0.035, y: 1.045, z: 0.44, tilt: 0.95, w: 0.285, h: 0.1, d: 0.06 };
const FACE = -POD.d / 2 - 0.001; // the face, where the controls come out
const CTRL = {
  gear: { x: -0.117, y: 0.041 }, // a lever in a vertical slot: F at the top, N, R at the bottom
  // A bank of four matching rockers, each with its symbol on the cap, lit when it is on.
  fourWd: { x: -0.071, y: 0.043 },
  lock: { x: -0.035, y: 0.043 },
  lights: { x: 0.001, y: 0.043 },
  tip: { x: 0.037, y: 0.043 },
  hazard: { x: 0.075, y: 0.043 }, // and the hazard switch, red, at the end of the bank
};
const CAP = { w: 0.027, h: 0.032, d: 0.011 };
const OFF = '#6a6d70'; // an unlit symbol
const GREEN = '#6fe08a';
const BLUE = '#5ab0ff';
const AMBER = '#ffb52e';

/** The legend printed on the pod's face: the gear slot and the names under the switches. */
function podLegend(g, w, h) {
  const px = (x) => w / 2 - x; // the picture's right is the driver's right, which is -x
  const py = (y) => h - y;
  g.fillStyle = '#0e0f10';
  g.fillRect(0, 0, w, h);
  // The badge across the top: the maker's name (made up) and the model, with antlers either side.
  const cx = w / 2;
  text(g, MAKER, cx, py(0.089), 0.0105, '#f1c40f');
  text(g, MODEL_NAME, cx, py(0.0785), 0.0066, '#9a9d9f');
  g.strokeStyle = '#f1c40f';
  g.lineWidth = 0.0012;
  g.beginPath();
  g.moveTo(0.012, py(0.0715));
  g.lineTo(w - 0.012, py(0.0715));
  g.stroke();
  for (const side of [-1, 1]) {
    const ax = cx + side * 0.074;
    g.lineWidth = 0.0016;
    g.beginPath();
    g.moveTo(ax, py(0.082));
    g.lineTo(ax, py(0.093));
    g.moveTo(ax, py(0.086));
    g.lineTo(ax - side * 0.007, py(0.0955));
    g.moveTo(ax, py(0.09));
    g.lineTo(ax + side * 0.005, py(0.0975));
    g.stroke();
  }
  g.fillStyle = '#050505';
  g.beginPath();
  g.roundRect(px(CTRL.gear.x) - 0.009, py(CTRL.gear.y + 0.028), 0.018, 0.056, 0.009);
  g.fill();
  // F, N and R beside the slot, on the switches' side of it.
  text(g, 'F', px(CTRL.gear.x + 0.024), py(CTRL.gear.y + 0.021), 0.012, '#e9e9e9');
  text(g, 'N', px(CTRL.gear.x + 0.024), py(CTRL.gear.y), 0.012, '#e9e9e9');
  text(g, 'R', px(CTRL.gear.x + 0.024), py(CTRL.gear.y - 0.021), 0.012, '#ff7a5a');
  const name = (c, str, dy = 0) => text(g, str, px(c.x), py(c.y - 0.026 - dy), 0.0075, '#e9e9e9');
  name(CTRL.fourWd, '4WD');
  name(CTRL.lock, 'DIFF');
  name(CTRL.lock, 'LOCK', 0.0075);
  name(CTRL.lights, 'LIGHTS');
  name(CTRL.tip, 'BED');
}

// The symbols on the rocker caps. Each is drawn on a small canvas (in 0..1 across the cap) and redrawn only when what it shows changes.
const ICONS = {
  // Four wheels with their axles: the rear one always, the front one and the drive shaft to it once 4WD is in.
  fourWd: (g, on) => {
    const c = on ? GREEN : OFF;
    g.fillStyle = '#c8c8c8';
    for (const x of [0.12, 0.72]) g.fillRect(x, 0.6, 0.16, 0.26);
    g.fillRect(0.2, 0.72, 0.6, 0.04);
    g.fillStyle = c;
    for (const x of [0.12, 0.72]) g.fillRect(x, 0.14, 0.16, 0.26);
    g.fillRect(0.2, 0.26, 0.6, 0.04);
    g.fillRect(0.48, 0.3, 0.04, 0.44);
  },
  // Two wheels on one axle with the differential between them, and the lock bars across it when locked.
  lock: (g, on) => {
    const c = on ? AMBER : OFF;
    g.fillStyle = '#c8c8c8';
    for (const x of [0.06, 0.78]) g.fillRect(x, 0.3, 0.16, 0.4);
    g.fillRect(0.2, 0.47, 0.6, 0.06);
    g.strokeStyle = c;
    g.fillStyle = '#101112';
    g.lineWidth = 0.05;
    g.beginPath();
    g.arc(0.5, 0.5, 0.17, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    if (on) {
      g.fillStyle = c;
      g.fillRect(0.33, 0.46, 0.34, 0.08);
    }
  },
  // A headlamp with its beams: slanting down for dipped, level for main beam, dull when off.
  lights: (g, mode) => {
    const c = mode === 'high' ? BLUE : mode === 'low' ? GREEN : OFF;
    g.strokeStyle = c;
    g.fillStyle = c;
    g.lineWidth = 0.05;
    g.beginPath();
    g.arc(0.38, 0.5, 0.2, -Math.PI / 2, Math.PI / 2);
    g.closePath();
    g.stroke();
    if (mode !== 'off') g.fill();
    g.fillStyle = c;
    for (let i = 0; i < 3; i++) {
      const y = 0.32 + i * 0.18;
      g.beginPath();
      g.moveTo(0.64, y);
      g.lineTo(0.94, y + (mode === 'high' ? 0 : 0.08));
      g.lineWidth = 0.05;
      g.stroke();
    }
  },
  // A tipping bed on its hinge with an arrow up, lit when the bed is raised.
  tip: (g, on) => {
    const c = on ? AMBER : OFF;
    g.fillStyle = '#c8c8c8';
    g.fillRect(0.1, 0.72, 0.8, 0.07);
    g.save();
    g.translate(0.9, 0.72);
    g.rotate(-0.5);
    g.fillStyle = c;
    g.fillRect(-0.7, -0.22, 0.7, 0.2);
    g.fillRect(-0.7, -0.22, 0.07, 0.34);
    g.restore();
    g.strokeStyle = c;
    g.lineWidth = 0.05;
    g.beginPath();
    g.moveTo(0.22, 0.4);
    g.lineTo(0.22, 0.12);
    g.moveTo(0.12, 0.22);
    g.lineTo(0.22, 0.1);
    g.lineTo(0.32, 0.22);
    g.stroke();
  },
};

/** A symbol on a flat plane, redrawn through `set(state)` when the state changes. */
function icon(kind) {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 112;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(CAP.w * 0.86, CAP.h * 0.86), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  mesh.rotation.y = Math.PI; // looking out of the pod, towards the driver
  let shown;
  const set = (state) => {
    if (state === shown) return;
    shown = state;
    g.clearRect(0, 0, c.width, c.height);
    g.save();
    g.scale(c.width, c.height);
    ICONS[kind](g, state);
    g.restore();
    tex.needsUpdate = true;
  };
  set(kind === 'lights' ? 'off' : false);
  return { mesh, set };
}

function buildConsole(root) {
  const pod = new THREE.Group();
  pod.name = 'consolePod';
  pod.position.set(POD.x, POD.y, POD.z);
  pod.rotation.x = POD.tilt;
  root.add(pod);
  rbox(POD.w + 0.02, POD.h + 0.02, POD.d, 0.02, MAT.plastic, 0, POD.h / 2, 0, pod);
  stick(decal(POD.w, POD.h, podLegend, { px: 2200, transparent: false }), pod, [0, POD.h / 2, FACE], '-z');

  // The F / N / R lever: a stalk out of the face in its slot, swung up for forward and down for reverse.
  const lever = new THREE.Group();
  lever.name = 'driveLever';
  lever.userData.keep = true;
  lever.position.set(CTRL.gear.x, CTRL.gear.y, FACE);
  tube([0, 0, 0], [0, 0, -0.04], 0.005, MAT.steel, lever);
  add(new THREE.SphereGeometry(0.012, 10, 8), MAT.knob, lever).position.z = -0.045;
  pod.add(lever);

  // The bank of rockers: 4WD, diff lock, lights and the bed. All alike, each with its symbol on the cap and the selected half pushed in.
  const icons = {};
  const rocker = (name, kind) => {
    const c = CTRL[name];
    const g = new THREE.Group();
    g.name = `utv_${name}`;
    g.userData.keep = true;
    g.position.set(c.x, c.y, FACE);
    rbox(CAP.w + 0.006, CAP.h + 0.006, 0.004, 0.003, MAT.grille, 0, 0, 0.0005, g); // the surround it sits in
    rbox(CAP.w, CAP.h, CAP.d, 0.004, MAT.knob, 0, 0, -0.004, g);
    const sym = icon(kind);
    sym.mesh.position.z = -0.0102;
    g.add(sym.mesh);
    icons[name] = sym;
    pod.add(g);
  };
  rocker('fourWd', 'fourWd');
  rocker('lock', 'lock');
  rocker('lights', 'lights');
  rocker('tip', 'tip');
  pod.userData.icons = icons;
  rbox(CAP.w + 0.006, CAP.h + 0.006, 0.004, 0.003, MAT.grille, CTRL.hazard.x, CTRL.hazard.y, FACE + 0.0005, pod); // the hazard switch sits in a surround like the rockers
  const hazard = addHazardSwitch(pod, CTRL.hazard.x, CTRL.hazard.y, FACE, { plate: false, w: CAP.w, h: CAP.h });
  hazard.rotation.y = Math.PI; // facing the driver (-z)
}

/** The console's parts, looked up once. */
function consoleParts(model) {
  return (model.userData.controls ??= {
    lever: model.getObjectByName('driveLever'),
    fourWd: model.getObjectByName('utv_fourWd'),
    lock: model.getObjectByName('utv_lock'),
    lights: model.getObjectByName('utv_lights'),
    tip: model.getObjectByName('utv_tip'),
    horn: model.getObjectByName('hornPad'),
    park: model.getObjectByName('parkBrakeLever'),
    icons: model.getObjectByName('consolePod').userData.icons,
  });
}

/** Poses the bed and tailgate: `tip` is how far the bed has risen (0..1), `gate` how open the tailgate is (0 shut, 1 flat). The console's bed rocker follows the bed. */
export function poseUtvBed(model, { tip, gate }) {
  model.getObjectByName('bed').rotation.x = -BED_MAX_TIP * tip;
  model.getObjectByName('tailgate').rotation.x = TAILGATE_OPEN * gate;
  const parts = consoleParts(model);
  parts.tip.rotation.x = 0.3 - 0.6 * tip; // the lower half goes in as the bed goes up
  parts.icons.tip.set(tip > 0.02);
}

/**
 * Poses the console: the F / N / R lever (up for forward, down for reverse), the four rockers (the selected half goes in: the lower half
 * for 4WD, the lock and the bed up, and for the lights the top for off, the middle for dipped and the lower for main beam) with their
 * symbols lit (the lamp green for dipped and blue for main beam), the horn pad on the wheel and the parking brake handle.
 */
export function poseUtvControls(model, { reverse, neutral, lights, horn, fourWd, locked, park }) {
  const parts = consoleParts(model);
  parts.lever.rotation.x = reverse ? -0.45 : neutral ? 0 : 0.45;
  parts.fourWd.rotation.x = fourWd ? -0.3 : 0.3;
  parts.lock.rotation.x = locked ? -0.3 : 0.3;
  parts.lights.rotation.x = { off: 0.3, low: 0, high: -0.3 }[lights] ?? 0;
  parts.icons.fourWd.set(!!fourWd);
  parts.icons.lock.set(!!locked);
  parts.icons.lights.set(lights ?? 'off');
  parts.horn.position.y = horn ? -0.008 : 0;
  parts.park.rotation.x += ((park ? -0.45 : 0.08) - parts.park.rotation.x) * 0.3; // pulled up when on, let down when off, eased
}

/** Swings the door nets, each side on its own: `open` is { left, right }, each 0 (shut) to 1 (swung out on the front post). */
export function poseUtvDoors(model, open) {
  const nets = model.userData.doorNets;
  if (!nets) return;
  nets.left.rotation.y = -MULE_DOOR.open * open.left; // hinged at the front, the free end at the back swings out to the side
  nets.right.rotation.y = MULE_DOOR.open * open.right;
}

/** Shows each seat's belt worn (across whoever is in it) or stowed down the backrest. `belted` is { driver, mid, left } of booleans. */
export function poseUtvBelts(model, belted) {
  // Every seat in `belted` that has a belt in this model (the 200TDi's back bench has three more than the UTV), found once each.
  const parts = (model.userData.belts ??= {});
  for (const seat of Object.keys(belted)) {
    if (seat in parts) continue;
    const g = model.getObjectByName(`belt_${seat}`);
    parts[seat] = g ? { stowed: g.getObjectByName('stowed'), worn: g.getObjectByName('worn') } : null;
  }
  for (const [seat, p] of Object.entries(parts)) {
    if (!p) continue;
    p.worn.visible = !!belted[seat];
    p.stowed.visible = !belted[seat];
  }
}
