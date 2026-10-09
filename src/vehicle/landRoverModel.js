import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildDash } from './dash.js';
import { addHeadlightBeams, addSignalLamps } from './quadModel.js';
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

// The windscreen: its frame stands on the bulkhead and rakes back about 11 degrees to meet the roof's underside, so everything that
// joins it (the doors' front uprights, the glass) is worked out from these.
const SCREEN_BASE = { y: 1.17, z: 0.595 };
const SCREEN_RAKE = 0.2;
const SCREEN_TOP_Y = 1.73; // a hair into the roof, which is 1.72 underneath
const SCREEN_H = (SCREEN_TOP_Y - SCREEN_BASE.y) / Math.cos(SCREEN_RAKE);
const SCREEN_TOP_Z = SCREEN_BASE.z - SCREEN_H * Math.sin(SCREEN_RAKE);
const HANDBRAKE_OFF = 1.1; // the lever's lean when off (forward and low), and when on
const HANDBRAKE_ON = -0.1;
export const TUB_FLOOR = 1.02; // the tub's floor, clear of the wheel tops (0.96) when they ride up
const KNOB_Z = 0.4; // the dash face the choke and hand throttle knobs come out of
const KNOB_TRAVEL = 0.1; // how far a knob pulls out
const PLATE = 'FRM 88L'; // the Series' registration, front and back (an L, 1972)
const PLATE_200 = 'H471 DKP'; // and the 200TDi's (an H, 1990)

/** Where the wheels, their mounts and the bodywork box are, for QuadPhysics. */
export const LANDY_LAYOUT = {
  spawnSag: 0.128, // how far the springs sink under its weight in the first moments, measured: it starts already sunk, so it doesn't settle in front of you
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
  driver: { x: -1.45, z: 0 }, // the driver's door, on the right
};

/** The starting handle's hole in the front bumper, in the model's frame: where you stand to swing it, and the towing jaw behind. */
export const CRANK_HOLE = { x: 0, y: 0.56, z: 1.84 };
export const TOW_HITCH = { x: 0, y: 0.56, z: -2.02 };

/**
 * Where each seat's belt anchors and buckles (x). The driver's and the left seat's have a diagonal from the B pillar on their outer side
 * to a buckle on the inner one; the middle seat has a lap belt only, between two stalks.
 */
export const LANDY_BELTS = {
  driver: { anchor: -0.78, buckle: -0.23, diagonal: true },
  mid: { anchor: -0.19, buckle: 0.19, diagonal: false },
  left: { anchor: 0.78, buckle: 0.23, diagonal: true },
};

const MAT = {
  rubber: new THREE.MeshStandardMaterial({ color: 0x1b1a18, roughness: 0.95 }),
  chassis: new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.6, metalness: 0.3 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.5, metalness: 0.6 }),
  galv: new THREE.MeshStandardMaterial({ color: 0x8e9396, roughness: 0.45, metalness: 0.7 }), // galvanised: the windscreen frame, hinges
  black: new THREE.MeshStandardMaterial({ color: 0x1c1d1e, roughness: 0.7 }), // the grille, bumper, dash
  roof: new THREE.MeshStandardMaterial({ color: 0xe8e4d6, roughness: 0.5, side: THREE.DoubleSide }), // Limestone
  rim: new THREE.MeshStandardMaterial({ color: 0xc9c7bc, roughness: 0.45, metalness: 0.4 }), // the steel wheels in Limestone
  rimGrey: new THREE.MeshStandardMaterial({ color: 0xa9adb0, roughness: 0.4, metalness: 0.5 }), // the 200TDi's, silver
  glass: new THREE.MeshStandardMaterial({ color: 0x9fb3b8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
  knob: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.35 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xe0b020, roughness: 0.35 }), // the 4WD knob
  red: new THREE.MeshStandardMaterial({ color: 0xb02018, roughness: 0.35 }), // the diff lock's
  rust: new THREE.MeshStandardMaterial({ color: 0x4b3a2e, roughness: 0.7, metalness: 0.5 }),
  belt: new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.9 }), // the webbing, dark grey so it shows on black vinyl
  amber: new THREE.MeshStandardMaterial({ color: 0xd88a18, roughness: 0.3 }),
  clear: new THREE.MeshStandardMaterial({ color: 0xdfe4e6, roughness: 0.2 }), // the reverse lens
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

const ARCH_R = 0.42; // the wheel arches' radius, round a 0.38 m tyre
const ARCH_Y = R + REST; // the wheel centre above the ground

/**
 * A body side panel (in the Y-Z plane, `thick` thick, centred on x) with a round wheel arch cut from its bottom edge, so the tyre shows
 * through instead of being hidden behind a flat sheet. The arch is centred on `zc` at the wheel's height.
 */
export function archPanel(x, thick, yBottom, yTop, z0, z1, zc, mat, parent) {
  const dy = ARCH_Y - yBottom;
  const half = Math.sqrt(ARCH_R * ARCH_R - dy * dy);
  const shape = new THREE.Shape();
  shape.moveTo(z0, yBottom);
  shape.lineTo(zc - half, yBottom);
  const a = Math.asin(dy / ARCH_R); // the bottom edge is below the wheel's centre, so the arch runs from just under the horizontal
  shape.absarc(zc, ARCH_Y, ARCH_R, Math.PI + a, -a, true);
  shape.lineTo(z1, yBottom);
  shape.lineTo(z1, yTop);
  shape.lineTo(z0, yTop);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  // Shape x is z and extrusion runs along +z: turn it so the extrusion runs along -x, then centre it on x.
  g.rotateY(-Math.PI / 2);
  g.translate(x + thick / 2, 0, 0);
  return add(g, mat, parent);
}

/** The rolled lip round an arch, standing proud of the panel. */
function archFlare(x, zc, mat, parent) {
  const m = add(new THREE.TorusGeometry(ARCH_R + 0.012, 0.016, 6, 24, Math.PI).rotateY(Math.PI / 2), mat, parent);
  m.position.set(x, ARCH_Y, zc);
  return m;
}

/** A square-section post from a to b (a window pillar or screen upright). */
function post(a, b, t1, t2, mat, parent) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const m = add(new THREE.BoxGeometry(t1, va.distanceTo(vb), t2), mat, parent);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.sub(va).normalize());
  return m;
}

function canvasTexture(w, h, draw, { repeat = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(...repeat);
  }
  return tex;
}

/** A small seeded random, so the textures come out the same every time. */
function seeded(seed) {
  let v = seed;
  return () => ((v = (v * 16807) % 2147483647) / 2147483647);
}

/**
 * A flat label (plate, badge, rip) on a plane of w by h metres, facing +Z; the caller places and turns it. Has a map, so it isn't merged.
 * `draw(g, W, H)` draws in pixels of a canvas `px` to the metre, because browsers mangle text set at a fraction of a pixel.
 */
function label(w, h, px, draw, parent) {
  const tex = canvasTexture(Math.round(w * px), Math.round(h * px), (g, cw, ch) => draw(g, cw, ch));
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  return add(new THREE.PlaneGeometry(w, h), mat, parent);
}

/** Text of at most `size` pixels, shrunk until it is no wider than `maxW`, centred on (x, y). */
function fitText(g, str, x, y, size, maxW, weight = 'bold') {
  g.font = `${weight} ${size}px Helvetica, Arial, sans-serif`;
  const w = g.measureText(str).width;
  if (w > maxW) g.font = `${weight} ${size * (maxW / w)}px Helvetica, Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(str, x, y);
}

/** A number plate, white at the front and yellow at the back, with the registration in black, filling most of it. */
function plate(text, bg, parent, { x, y, z, facing }) {
  const m = label(0.52, 0.13, 800, (g, W, H) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#111';
    g.lineWidth = H * 0.04;
    g.strokeRect(H * 0.03, H * 0.03, W - H * 0.06, H - H * 0.06);
    g.fillStyle = '#111';
    fitText(g, text, W / 2, H / 2 + H * 0.03, H * 0.72, W * 0.86);
  }, parent);
  m.position.set(x, y, z);
  if (facing < 0) m.rotation.y = Math.PI;
  return m;
}

/** A green oval badge with the name in white, on one line or two ("LAND" over "ROVER", for the tailgate). */
function badge(parent, { x, y, z, facing, w = 0.2, h = w * 0.4, twoLines = false, px = 700 }) {
  const m = label(w, h, px, (g, W, H) => {
    const oval = (inset, colour) => {
      g.fillStyle = colour;
      g.beginPath();
      g.ellipse(W / 2, H / 2, W / 2 - inset, H / 2 - inset, 0, 0, Math.PI * 2);
      g.fill();
    };
    oval(H * 0.02, '#d6d3c4');
    oval(H * 0.1, '#1f4a2c');
    g.fillStyle = '#f2efe2';
    if (twoLines) {
      fitText(g, 'LAND', W / 2, H * 0.36, H * 0.3, W * 0.5);
      fitText(g, 'ROVER', W / 2, H * 0.66, H * 0.3, W * 0.62);
    } else {
      fitText(g, 'LAND ROVER', W / 2, H / 2 + H * 0.02, H * 0.34, W * 0.78);
    }
  }, parent);
  m.position.set(x, y, z);
  if (facing < 0) m.rotation.y = Math.PI;
  return m;
}

/** The model's name in small silver letters on a black plate, facing the back. */
function modelBadge(text, parent, { x, y, z }) {
  const m = label(0.14, 0.04, 1000, (g, W, H) => {
    g.fillStyle = '#17181a';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#d4d7da';
    fitText(g, text, W / 2, H / 2 + H * 0.04, H * 0.72, W * 0.88);
  }, parent);
  m.position.set(x, y, z);
  m.rotation.y = Math.PI;
  return m;
}

/** One seat's belt, named `belt_<seat>` with a `stowed` and a `worn` child, as poseUtvBelts expects, and its buckle stalk. */
function addBelt(root, seat, belt) {
  const group = new THREE.Group();
  group.name = `belt_${seat}`;
  group.userData.keep = true;
  const stowed = new THREE.Group();
  stowed.name = 'stowed';
  if (belt.diagonal) {
    rbox(0.045, 0.5, 0.012, 0.004, MAT.belt, belt.anchor, 1.2, -0.435, stowed); // hanging down the pillar
    rbox(0.05, 0.06, 0.02, 0.006, MAT.steel, belt.anchor, 0.92, -0.435, stowed); // the tongue, loose
  } else {
    rbox(0.04, 0.012, 0.18, 0.004, MAT.belt, belt.anchor, 0.958, -0.3, stowed); // lying on the cushion
  }
  const worn = new THREE.Group();
  worn.name = 'worn';
  worn.visible = false;
  const at = (t, y, z) => [belt.anchor + (belt.buckle - belt.anchor) * t, y, z];
  // (The sitters' hips are at y 0.94 and z -0.22: the belt lies about 0.4 above them for the chest and 0.05 for the lap.)
  if (belt.diagonal) {
    add(bentTube([[belt.anchor, 1.46, -0.5], at(0.15, 1.45, -0.3), at(0.32, 1.36, -0.02), at(0.6, 1.2, 0.04), at(0.88, 1.02, 0), [belt.buckle, 0.98, -0.13], [belt.buckle, 0.96, -0.34]], 0.016, { bend: 0.05, radial: 6 }), MAT.belt, worn);
    add(bentTube([[belt.anchor, 0.9, -0.45], at(0.25, 0.98, -0.1), at(0.6, 1.0, 0.0), [belt.buckle, 0.99, -0.05], [belt.buckle, 0.96, -0.34]], 0.016, { bend: 0.05, radial: 6 }), MAT.belt, worn);
  } else {
    add(bentTube([[belt.anchor, 0.96, -0.34], at(0.1, 0.99, -0.05), at(0.9, 0.99, -0.05), [belt.buckle, 0.96, -0.34]], 0.016, { bend: 0.05, radial: 6 }), MAT.belt, worn);
  }
  rbox(0.05, 0.05, 0.03, 0.008, MAT.steel, belt.buckle, 0.975, -0.335, worn); // the tongue, pushed home
  group.add(stowed, worn);
  root.add(group);
  // The buckle: a steel stalk up out of the seat's crease with a red release button on top (the middle seat's other end has a plain one).
  rbox(0.034, 0.075, 0.03, 0.008, MAT.steel, belt.buckle, 0.985, -0.38, root);
  rbox(0.026, 0.02, 0.022, 0.006, MAT.red, belt.buckle, 1.032, -0.38, root);
  if (!belt.diagonal) rbox(0.034, 0.075, 0.03, 0.008, MAT.steel, belt.anchor, 0.985, -0.38, root);
}

/** The trim's textures, made when a Land Rover is built (they need a canvas). */
function trimMaterials(defender = false) {
  // Black vinyl, pebbled, with a stitched inset on each face.
  const vinyl = canvasTexture(128, 128, (g, w, h) => {
    const rand = seeded(11);
    g.fillStyle = '#4a4743';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.22)';
      g.fillRect(rand() * w, rand() * h, 1.5, 1.5);
    }
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 1.5;
    g.strokeRect(10, 10, w - 20, h - 20);
    g.setLineDash([4, 3]);
    g.strokeStyle = 'rgba(190,180,150,0.45)'; // the stitching
    g.lineWidth = 1;
    g.strokeRect(14, 14, w - 28, h - 28);
  });
  // The dash pad: a fine grain.
  const grain = canvasTexture(128, 128, (g, w, h) => {
    const rand = seeded(23);
    g.fillStyle = '#34353a';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.3)';
      g.fillRect(rand() * w, rand() * h, 1.5, 1);
    }
  }, { repeat: [4, 2] });
  // The floor: a ribbed rubber mat, dusty and scuffed.
  const mat = canvasTexture(128, 128, (g, w, h) => {
    const rand = seeded(5);
    g.fillStyle = '#3b3a37';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) {
      g.fillStyle = 'rgba(0,0,0,0.38)';
      g.fillRect(0, y, w, 3);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fillRect(0, y + 3, w, 1.5);
    }
    for (let i = 0; i < 260; i++) {
      g.fillStyle = rand() > 0.4 ? 'rgba(120,98,70,0.35)' : 'rgba(0,0,0,0.3)'; // mud and scuffs
      g.fillRect(rand() * w, rand() * h, 2 + rand() * 3, 1 + rand() * 2);
    }
  }, { repeat: [3, 4] });
  if (defender) {
    // The 200TDi's: grey cloth seats with a check, a lighter grey dash moulding and a speckled carpet.
    const cloth = canvasTexture(128, 128, (g, w, h) => {
      const rand = seeded(17);
      g.fillStyle = '#5b5f64';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < h; i += 4) {
        g.fillStyle = 'rgba(0,0,0,0.16)';
        g.fillRect(0, i, w, 2);
        g.fillStyle = 'rgba(255,255,255,0.07)';
        g.fillRect(i, 0, 2, h);
      }
      for (let i = 0; i < 900; i++) {
        g.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.25)';
        g.fillRect(rand() * w, rand() * h, 1.5, 1.5);
      }
      g.strokeStyle = 'rgba(20,22,26,0.7)';
      g.lineWidth = 1.5;
      g.strokeRect(10, 10, w - 20, h - 20);
    });
    const dashGrain = canvasTexture(128, 128, (g, w, h) => {
      const rand = seeded(29);
      g.fillStyle = '#4a4d52';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2400; i++) {
        g.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.22)';
        g.fillRect(rand() * w, rand() * h, 1.5, 1);
      }
    }, { repeat: [4, 2] });
    const carpet = canvasTexture(128, 128, (g, w, h) => {
      const rand = seeded(8);
      g.fillStyle = '#34363a';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1800; i++) {
        g.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.3)';
        g.fillRect(rand() * w, rand() * h, 1.5, 1.5);
      }
    }, { repeat: [3, 4] });
    return {
      seat: new THREE.MeshStandardMaterial({ map: cloth, color: 0xcfcfcf, roughness: 0.9 }),
      dash: new THREE.MeshStandardMaterial({ map: dashGrain, roughness: 0.8 }),
      floor: new THREE.MeshStandardMaterial({ map: carpet, roughness: 1 }),
    };
  }
  return {
    seat: new THREE.MeshStandardMaterial({ map: vinyl, color: 0xb5b0a8, roughness: 0.6 }),
    dash: new THREE.MeshStandardMaterial({ map: grain, roughness: 0.8 }),
    floor: new THREE.MeshStandardMaterial({ map: mat, roughness: 0.95 }),
  };
}

/** A tear in the driver's seat: the vinyl split open, the yellow foam showing, a strip of silver tape across one end. */
function seatRip(parent) {
  return label(0.2, 0.14, 700, (g, W, H) => {
    const w = 0.2;
    const h = 0.14;
    g.scale(W / w, H / h); // drawn in metres
    const rand = seeded(3);
    const edge = [[0.02, 0.07], [0.05, 0.03], [0.09, 0.045], [0.12, 0.02], [0.16, 0.04], [0.18, 0.075], [0.15, 0.105], [0.12, 0.1], [0.09, 0.125], [0.05, 0.1]];
    g.beginPath();
    edge.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fillStyle = '#c9a443'; // the foam
    g.fill();
    g.save();
    g.clip();
    for (let i = 0; i < 90; i++) {
      g.fillStyle = rand() > 0.5 ? 'rgba(120,80,20,0.5)' : 'rgba(255,230,150,0.4)';
      g.fillRect(rand() * w, rand() * h, 0.008, 0.006);
    }
    g.restore();
    g.lineWidth = 0.006;
    g.strokeStyle = '#1a1917'; // the frayed vinyl edge
    g.stroke();
    g.fillStyle = 'rgba(160,165,168,0.92)'; // the tape
    g.save();
    g.translate(0.15, 0.08);
    g.rotate(-0.5);
    g.fillRect(-0.04, -0.018, 0.08, 0.036);
    g.restore();
  }, parent);
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
function addWheelFace(spin, side, rim = MAT.rim) {
  axleCyl(RIM_R, TYRE_W + 0.02, rim, 0, 0, 0, spin);
  axleCyl(RIM_R * 0.8, 0.03, rim, side * (TYRE_W / 2 + 0.005), 0, 0, spin);
  axleCyl(0.06, 0.05, MAT.galv, side * (TYRE_W / 2 + 0.03), 0, 0, spin);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const n = add(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 6).rotateZ(Math.PI / 2), MAT.galv, spin);
    n.position.set(side * (TYRE_W / 2 + 0.03), Math.sin(a) * 0.1, Math.cos(a) * 0.1);
  }
}

function buildWheel(w, rim) {
  const side = Math.sign(w.x);
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  spin.name = 'spin';
  spin.userData.keep = true;
  wheel.add(spin);
  add(cached('tyre', tyre), MAT.rubber, spin);
  addWheelFace(spin, side, rim);
  mergeStatic(wheel);
  return wheel;
}

// The Land Rover ----------------------------------------------------------------

export function buildLandRoverModel({ bodyColor = 0x3b4a36, dashStyle = 'series', variant = 'series' } = {}) {
  const D = variant === 'defender'; // the 200TDi: a square-back with the spare on its rear door, a newer dash and console
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.55, side: THREE.DoubleSide });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x2c302c, roughness: 0.08, metalness: 0.2, emissive: 0x000000 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x3c0b08, roughness: 0.25, emissive: 0x000000 });
  const rim = D ? MAT.rimGrey : MAT.rim;

  const quad = new THREE.Group();
  quad.name = 'quad';
  quad.userData.lensMaterial = lensMat;
  const trim = trimMaterials(D);
  const frame = D ? MAT.black : MAT.galv; // the screen and window frames: galvanised on the Series, black on the 200TDi
  quad.userData.seatMaterial = trim.seat;
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
  plate(D ? PLATE_200 : PLATE, '#ece9de', root, { x: 0.45, y: 0.56, z: 1.8475, facing: 1 }); // the front number plate
  for (const s of [-1, 1]) rbox(0.07, 0.17, 0.14, 0.02, MAT.chassis, s * 0.83, 0.56, 1.78, root); // the bumper's ends, turned back
  if (!D) {
    add(new THREE.TorusGeometry(0.035, 0.012, 8, 16), MAT.steel, root).position.set(CRANK_HOLE.x, CRANK_HOLE.y, CRANK_HOLE.z - 0.02); // the hole's ring
    add(new THREE.CircleGeometry(0.03, 14), MAT.knob, root).position.set(CRANK_HOLE.x, CRANK_HOLE.y, CRANK_HOLE.z - 0.025);
  }
  for (const s of [-1, 1]) rbox(0.06, 0.12, 0.2, 0.01, MAT.chassis, s * 0.43, 0.56, 1.68, root); // its mounts to the rails
  rbox(0.68, 0.5, 0.06, 0.02, MAT.black, 0, 0.83, 1.6, root); // the grille panel
  for (let i = 0; i < 9; i++) rbox(0.6, 0.012, 0.02, 0.004, MAT.chassis, 0, 0.64 + i * 0.048, 1.635, root); // its slats
  badge(root, { x: 0, y: 0.89, z: 1.648, facing: 1, w: 0.2 }); // the maker's badge on the grille
  for (const s of [-1, 1]) {
    const x = s * 0.6;
    rbox(0.48, 0.03, 1.0, 0.01, paint, x, 1.06, 1.1, root, 'wingTop'); // the flat top, which you can stand a mug on
    archPanel(s * 0.84, 0.03, 0.75, 1.075, 0.6, 1.6, 1.115, paint, root); // the outer side, with the wheel arch cut in it
    archFlare(s * 0.86, 1.115, D ? MAT.black : paint, root);
    rbox(0.48, 0.36, 0.03, 0.01, paint, x, 0.88, 1.6, root); // the front face, with the lamp
    rbox(0.03, 0.34, 1.0, 0.01, paint, s * 0.36, 0.9, 1.1, root); // the inner side, against the engine bay
    const bezel = add(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 22).rotateX(Math.PI / 2), D ? MAT.black : MAT.galv, root);
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
  if (D) {
    rbox(0.3, 0.05, 0.62, 0.02, paint, 0, 1.105, 1.08, root); // the 200TDi's raised ridge down the middle of the bonnet
  } else {
    // The spare wheel on the bonnet, lying flat and strapped down.
    const spare = new THREE.Group();
    spare.position.set(0, 1.21, 1.1);
    spare.rotation.z = Math.PI / 2;
    add(cached('tyre', tyre), MAT.rubber, spare);
    addWheelFace(spare, 1);
    root.add(spare);
    rbox(0.05, 0.02, 0.8, 0.005, MAT.chassis, 0, 1.33, 1.1, root); // the strap
  }

  // The bulkhead with its vent flaps, the dash rail, and the windscreen: a galvanised frame raked back about 11 degrees, with two panes and
  // a centre post. Its uprights at the sides are the doors' front pillars, and its top rail runs up into the roof's underside.
  rbox(1.62, 0.55, 0.05, 0.02, paint, 0, 0.88, 0.6, root);
  for (const s of [-1, 1]) rbox(0.5, 0.06, 0.03, 0.01, paint, s * 0.4, 1.12, 0.63, root); // the vent flaps under the screen
  const screen = new THREE.Group();
  screen.position.set(0, SCREEN_BASE.y, SCREEN_BASE.z);
  screen.rotation.x = -SCREEN_RAKE;
  root.add(screen);
  rbox(1.64, 0.06, 0.06, 0.01, frame, 0, 0.03, 0, screen); // the bottom rail, on the bulkhead
  rbox(1.64, 0.06, 0.06, 0.01, frame, 0, SCREEN_H - 0.03, 0, screen); // the top rail, into the roof
  for (const x of [-0.8, 0, 0.8]) rbox(0.05, SCREEN_H, 0.05, 0.01, frame, x, SCREEN_H / 2, 0, screen);
  for (const s of [-1, 1]) {
    const pane = add(new THREE.PlaneGeometry(0.72, SCREEN_H - 0.1), MAT.glass, screen);
    pane.position.set(s * 0.4, SCREEN_H / 2, 0);
  }
  rbox(0.2, 0.07, 0.03, 0.01, MAT.black, 0, 1.55, 0.43, root); // the rear-view mirror
  tube([0, 1.585, 0.43], [0, 1.72, 0.47], 0.006, MAT.galv, root, 4); // on its stalk from the screen header
  tube([-0.62, 1.2, 0.605], [-0.12, 1.56, 0.52], 0.006, MAT.chassis, root, 4); // a wiper, lying on the glass
  tube([0.1, 1.2, 0.605], [0.58, 1.56, 0.52], 0.006, MAT.chassis, root, 4);

  // The cab: doors with the window frames, the sides back to the cab's rear panel, its rear window, and the white roof.
  for (const s of [-1, 1]) {
    // Each door runs from the bulkhead to the B pillar with no gap. Its window frame's front upright is the screen's raked side post, and
    // the glass is cut to fit between that and the rear post.
    rbox(0.04, 0.6, 1.035, 0.01, paint, s * 0.82, 0.86, 0.0575, root, s > 0 ? 'doorLeft' : 'doorRight'); // the door's lower half
    rbox(0.03, 0.04, 1.035, 0.008, frame, s * 0.82, 1.17, 0.0575, root); // the top of the lower half
    post([s * 0.82, SCREEN_BASE.y, SCREEN_BASE.z], [s * 0.82, SCREEN_TOP_Y, SCREEN_TOP_Z], 0.04, 0.05, frame, root); // the front upright, raked with the screen
    rbox(0.03, 0.56, 0.04, 0.008, paint, s * 0.82, 1.45, -0.44, root); // the rear upright
    rbox(0.03, 0.05, SCREEN_TOP_Z + 0.46, 0.008, paint, s * 0.82, 1.705, (SCREEN_TOP_Z - 0.46) / 2, root); // the top rail, up against the roof
    const glass = add(new THREE.ShapeGeometry(new THREE.Shape([
      new THREE.Vector2(-0.42, 1.2), new THREE.Vector2(0.56, 1.2), new THREE.Vector2(SCREEN_TOP_Z + 0.03, 1.68), new THREE.Vector2(-0.42, 1.68),
    ])).rotateY(-Math.PI / 2), MAT.glass, root);
    glass.position.x = s * 0.82;
    rbox(0.03, 0.03, 0.1, 0.008, MAT.galv, s * 0.845, 1.07, -0.3, root); // the handle
    for (const z of [0.42, 0.18]) rbox(0.02, 0.06, 0.06, 0.005, MAT.galv, s * 0.84, 1.0, z, root); // the hinges, on the outside
    rbox(0.04, 1.2, D ? 0.12 : 0.22, 0.01, paint, s * 0.82, 1.22, D ? -0.5 : -0.56, root); // the B pillar (the Series' goes out to the cab's rear panel)
    if (!D) rbox(0.04, 0.42, 0.2, 0.01, paint, s * 0.82, 0.75, -0.62, root); // the cab side behind the door
    rbox(0.05, 0.09, 1.2, 0.01, MAT.chassis, s * 0.82, 0.55, 0.0, root); // the sill under the door, closing the gap to the chassis
    rbox(0.04, 0.64, 0.14, 0.01, paint, s * 0.82, 0.87, 0.65, root); // the hinge pillar between the door and the wing
  }
  if (!D) {
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
    for (const s of [-1, 1]) rbox(0.03, 0.03, 1.3, 0.008, MAT.galv, s * 0.86, 1.72, -0.02, root); // the rain gutters along the roof edges
    for (const s of [-1, 1]) rbox(0.1, 0.03, 0.04, 0.008, MAT.galv, s * 0.25, 1.09, 0.64, root); // the bonnet's hinges at the screen end
    for (let i = -3; i <= 3; i++) rbox(1.62, 0.012, 0.02, 0.004, MAT.roof, 0, 1.805, -0.02 + i * 0.16, root); // its ribs
  } else {
    // The 200TDi's roof runs the whole length of the square back, in the body colour, with black gutters.
    rbox(1.7, 0.06, 2.64, 0.03, paint, 0, 1.75, -0.69, root, 'roof');
    rbox(1.6, 0.03, 2.5, 0.015, paint, 0, 1.79, -0.69, root);
    for (const s of [-1, 1]) rbox(0.03, 0.03, 2.64, 0.008, MAT.black, s * 0.86, 1.72, -0.69, root); // the rain gutters along the roof edges
    for (const s of [-1, 1]) rbox(0.1, 0.03, 0.04, 0.008, MAT.black, s * 0.25, 1.09, 0.64, root); // the bonnet's hinges at the screen end
  }

  // Inside: the floor, the seat box with the bench on it (three in a row, black vinyl), the gearbox tunnel.
  rbox(1.56, 0.03, 1.1, 0.01, trim.floor, 0, 0.62, 0.05, root);
  rbox(1.56, 0.26, 0.5, 0.02, paint, 0, 0.76, -0.3, root, 'seatBox');
  rbox(D ? 0.4 : 0.36, D ? 0.26 : 0.22, 0.6, 0.04, D ? trim.dash : MAT.black, 0, D ? 0.75 : 0.73, 0.25, root); // the tunnel (the 200TDi's a moulded console)
  for (const seat of [LANDY_SEATS.driver, LANDY_SEATS.mid, LANDY_SEATS.left]) {
    rbox(0.42, 0.1, 0.46, 0.04, trim.seat, seat.x, 0.9, seat.z, root);
    const back = rbox(0.42, 0.48, 0.08, 0.04, trim.seat, seat.x, 1.18, -0.5, root); // clear of the cab's rear panel, even leant back
    back.rotation.x = -0.08;
    if (D && seat !== LANDY_SEATS.mid) {
      // A headrest on two steel posts sunk into the top of the backrest (the middle seat has none).
      rbox(0.24, 0.12, 0.07, 0.03, trim.seat, seat.x, 1.53, -0.52, root).rotation.x = -0.08;
      for (const dx of [-0.06, 0.06]) rbox(0.016, 0.16, 0.016, 0.004, MAT.steel, seat.x + dx, 1.47, -0.515, root).rotation.x = -0.08;
    }
  }
  if (!D) {
    // The driver's cushion is split: the foam showing, with a strip of tape over one end.
    const rip = seatRip(root);
    rip.position.set(LANDY_SEATS.driver.x - 0.03, 0.9505 + 0.0, LANDY_SEATS.driver.z + 0.06);
    rip.rotation.x = -Math.PI / 2;
    rip.rotation.z = 0.25;
  }
  // The seat belts: a diagonal and lap belt for the driver and the left seat from the B pillars, a lap belt for the middle. Each is
  // stowed (hanging on its pillar with the tongue loose) or worn across whoever sits there (`poseUtvBelts` poses the same names).
  for (const [seat, belt] of Object.entries(LANDY_BELTS)) addBelt(root, seat, belt);

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
  if (D) {
    // The 200TDi's: a thicker, softer rim on two spokes with a padded hub.
    add(new THREE.TorusGeometry(0.2, 0.02, 10, 40).rotateX(Math.PI / 2), MAT.black, wheel);
    rbox(0.13, 0.05, 0.1, 0.03, MAT.black, 0, 0, 0, wheel); // the hub
    for (const sx of [-1, 1]) rbox(0.13, 0.02, 0.05, 0.01, MAT.black, sx * 0.11, 0, 0, wheel); // the two spokes, left and right
    badge(wheel, { x: 0, y: 0.0265, z: 0, facing: 1, w: 0.07, h: 0.035, px: 1200 }).rotation.set(-Math.PI / 2, 0, Math.PI);
  } else {
    add(new THREE.TorusGeometry(0.21, 0.012, 8, 36).rotateX(Math.PI / 2), MAT.black, wheel);
    add(new THREE.CylinderGeometry(D ? 0.06 : 0.045, D ? 0.06 : 0.045, 0.035, 14), MAT.black, wheel); // the boss
    badge(wheel, { x: 0, y: 0.0185, z: 0, facing: 1, w: 0.07, h: 0.035, px: 1200 }).rotation.set(-Math.PI / 2, 0, Math.PI); // the badge in its centre, facing the driver
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      tube([0, 0, 0], [Math.sin(a) * 0.21, 0, Math.cos(a) * 0.21], D ? 0.01 : 0.007, D ? MAT.black : MAT.galv, wheel, 5);
    }
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
  rbox(1.56, 0.12, 0.2, 0.02, trim.dash, 0, 1.08, 0.5, root); // the padded dash top
  badge(root, { x: 0.3, y: 1.085, z: 0.396, facing: -1, w: 0.14, h: 0.056 }); // the maker's badge on the glovebox side of the dash
  const dash = buildDash(dashStyle);
  dash.group.position.set(-0.42, 1.21, 0.48);
  dash.group.rotation.x = 0.55;
  dash.group.scale.setScalar(1.5); // the binnacle's about 0.3 m wide, as on a Series III
  dash.group.userData.keep = true;
  root.add(dash.group);
  quad.userData.dash = dash;
  quad.userData.podMount = null;

  if (D) {
    // A diesel with glow plugs has no choke and no hand throttle; the pose code still looks the knobs up by name.
    for (const name of ['chokeKnob', 'handThrottleKnob']) {
      const g = new THREE.Group();
      g.name = name;
      g.userData.keep = true;
      g.visible = false;
      root.add(g);
    }
  } else {
    // Knobs on the dash under the binnacle, over the edge of the gearbox tunnel where you see them past the wheel (the hand throttle on the
    // left of the choke): the choke and the hand throttle, each pulled out towards the driver on a long shaft that
    // runs back into the dash, so it stays joined to it however far it is out (the pose moves the group by up to KNOB_TRAVEL).
    for (const [name, x, mat] of [['chokeKnob', -0.26, MAT.red], ['handThrottleKnob', -0.16, MAT.galv]]) {
      const knob = new THREE.Group();
      knob.name = name;
      knob.userData.keep = true;
      knob.position.set(x, 1.095, KNOB_Z);
      tube([0, 0, 0.16], [0, 0, -0.05], 0.005, MAT.galv, knob, 6);
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.028, 12).rotateX(Math.PI / 2), mat, knob).position.set(0, 0, -0.059); // light heads, to show on the black dash
      root.add(knob);
    }
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
  lever('gearLever', -0.1, MAT.knob, D ? 0.34 : 0.38, D ? 0.03 : 0.026);
  lever('transferKnob', D ? 0.05 : 0.04, D ? MAT.knob : MAT.yellow, 0.22, 0.018);
  lever('diffLockKnob', D ? 0.13 : 0.12, D ? MAT.yellow : MAT.red, 0.16, 0.016);
  if (D) {
    // The 200TDi's levers come up through rubber gaiters in the console.
    for (const x of [-0.1, 0.05, 0.13]) add(new THREE.CylinderGeometry(x === -0.1 ? 0.035 : 0.025, x === -0.1 ? 0.07 : 0.05, 0.07, 12), MAT.rubber, root).position.set(x, 0.89, 0.32);
    rbox(0.24, 0.015, 0.2, 0.005, MAT.steel, 0.09, 0.885, 0.32, root); // the plate round the transfer and diff lock levers
  }
  rbox(0.07, 0.02, 0.16, 0.005, MAT.black, -0.55, 0.66, 0.32, root).rotation.x = -0.6; // the pedals: clutch, brake, accelerator
  rbox(0.07, 0.02, 0.16, 0.005, MAT.black, -0.4, 0.66, 0.32, root).rotation.x = -0.6;
  rbox(0.04, 0.02, 0.14, 0.005, MAT.black, -0.25, 0.66, 0.32, root).rotation.x = -0.6;
  // The handbrake: a ratchet lever on the right of the tunnel, by the driver's left knee. Down and forward when off; pulled up and back
  // when on (poseLandyControls). It has a black grip with a push button on the end, and the ratchet quadrant it clicks along.
  const hb = new THREE.Group();
  hb.name = 'parkBrakeLever';
  hb.userData.keep = true;
  hb.position.set(-0.2, 0.8, 0.12);
  tube([0, 0, 0], [0, 0.3, 0], 0.01, MAT.galv, hb, 6);
  add(new THREE.CylinderGeometry(0.019, 0.022, 0.12, 10), MAT.knob, hb).position.set(0, 0.34, 0);
  rbox(0.014, 0.014, 0.02, 0.004, MAT.red, 0, 0.405, 0, hb); // the release button
  hb.rotation.x = HANDBRAKE_OFF;
  root.add(hb);
  rbox(0.012, 0.1, 0.1, 0.004, MAT.steel, -0.2, 0.84, 0.1, root); // the ratchet quadrant it moves against
  if (D) add(new THREE.CylinderGeometry(0.03, 0.045, 0.05, 10), MAT.rubber, root).position.set(-0.2, 0.84, 0.12); // the 200TDi's has a gaiter at its foot
  // Quad poses these two on a quad; the Land Rover's choke is the dash knob and it has no fuel tap.
  for (const name of ['fuelTap', 'chokeLever']) {
    const g = new THREE.Group();
    g.name = name;
    g.userData.keep = true;
    g.visible = false;
    root.add(g);
  }

  if (!D) {
    // The tub: the floor is above the wheels' tops (with a hump over each arch, not a box the tyre pokes into), sides with the wheel
    // arches cut in them, the drop tailgate with its chains, and the rear body panel below it with the lamps, the plate and the badge.
    rbox(1.6, 0.04, 1.3, 0.01, paint, 0, TUB_FLOOR, -1.3, root);
    for (const s of [-1, 1]) {
      archPanel(s * 0.82, 0.04, 0.78, 1.38, -1.95, -0.65, zR, paint, root); // side, with the wheel arch cut in it
      archFlare(s * 0.845, zR, paint, root);
      rbox(0.2, 0.26, 0.02, 0.005, MAT.black, s * 0.7, 0.5, zR - 0.52, root); // the mudflap behind the wheel
      rbox(0.08, 0.03, 1.3, 0.01, MAT.galv, s * 0.82, 1.39, -1.3, root); // its capping
      rbox(0.34, 0.1, 0.84, 0.04, paint, s * 0.62, TUB_FLOOR + 0.06, zR, root); // the hump over the arch, clear of the tyre
      for (const z of [-0.8, -1.8]) add(new THREE.TorusGeometry(0.02, 0.005, 6, 10), MAT.galv, root).position.set(s * 0.8, 1.32, z); // rope hooks
      rbox(0.08, 0.1, 0.03, 0.01, tailMat, s * 0.74, 0.86, -1.97, root); // the tail lamp
      rbox(0.08, 0.05, 0.03, 0.01, MAT.amber, s * 0.74, 0.77, -1.97, root); // and the indicator under it
      rbox(0.08, 0.04, 0.03, 0.01, MAT.clear, s * 0.74, 0.69, -1.97, root); // and a clear reverse lens under that
      tube([s * 0.78, 1.34, -1.94], [s * 0.8, 1.14, -1.95], 0.004, MAT.galv, root, 4); // the tailgate's chains
      rbox(0.05, 0.06, 0.05, 0.008, MAT.galv, s * 0.7, 0.99, -1.96, root); // the tailgate's hinges
    }
    rbox(1.6, 0.4, 0.04, 0.01, paint, 0, 1.18, -1.95, root, 'tailgate');
    rbox(1.6, 0.34, 0.04, 0.01, paint, 0, 0.8, -1.95, root); // the rear body panel under it
    for (const y of [1.03, 1.35]) rbox(1.5, 0.02, 0.01, 0.004, paint, 0, y, -1.975, root); // the tailgate's pressings
    rbox(0.1, 0.04, 0.02, 0.006, MAT.galv, 0, 1.07, -1.975, root); // its catch
    plate(PLATE, '#e8c51c', root, { x: 0, y: 0.78, z: -1.9755, facing: -1 }); // the rear number plate
    badge(root, { x: 0, y: 1.2, z: -1.9755, facing: -1, w: 0.2, h: 0.14, twoLines: true }); // the maker's badge on the tailgate, on two lines
  } else {
    // The 200TDi's square back: a carpeted load floor over the wheels, side bodywork with a window band and the wheel arches cut in
    // it, the rear door with its window and the spare wheel on it, and the same body panel below with the lamps and the plate.
    rbox(1.6, 0.04, 1.3, 0.01, trim.floor, 0, TUB_FLOOR, -1.3, root);
    for (const s of [-1, 1]) {
      archPanel(s * 0.82, 0.04, 0.78, 1.17, -1.95, -0.55, zR, paint, root); // the side below the windows, with the arch cut in it
      archFlare(s * 0.845, zR, MAT.black, root);
      rbox(0.2, 0.26, 0.02, 0.005, MAT.black, s * 0.7, 0.5, zR - 0.52, root); // the mudflap behind the wheel
      rbox(0.34, 0.1, 0.84, 0.04, paint, s * 0.62, TUB_FLOOR + 0.06, zR, root); // the hump over the arch, clear of the tyre
      const glass = add(new THREE.PlaneGeometry(1.3, 0.46), MAT.glass, root);
      glass.rotation.y = Math.PI / 2;
      glass.position.set(s * 0.82, 1.4, -1.22);
      for (const z of [-0.58, -1.38, -1.9]) rbox(0.04, 0.58, 0.07, 0.008, paint, s * 0.82, 1.4, z, root); // the window posts
      rbox(0.04, 0.1, 1.4, 0.008, paint, s * 0.82, 1.675, -1.24, root); // above the glass, up to the roof
      // The 200TDi's newer rear lamp: a tall black housing on the corner with the red stop and tail lamp over the amber indicator over a
      // clear reverse lens, instead of the Series' two small lamps.
      rbox(0.1, 0.36, 0.035, 0.012, MAT.black, s * 0.74, 0.86, -1.968, root);
      rbox(0.075, 0.13, 0.03, 0.008, tailMat, s * 0.74, 0.96, -1.975, root);
      rbox(0.075, 0.09, 0.03, 0.008, MAT.amber, s * 0.74, 0.86, -1.975, root);
      rbox(0.075, 0.09, 0.03, 0.008, MAT.clear, s * 0.74, 0.77, -1.975, root);
    }
    rbox(1.6, 0.34, 0.04, 0.01, paint, 0, 0.8, -1.95, root); // the rear body panel
    rbox(1.6, 0.3, 0.04, 0.01, paint, 0, 1.1, -1.95, root, 'rearDoor'); // the rear door, below its window
    for (const s of [-1, 1]) rbox(0.2, 0.46, 0.04, 0.01, paint, s * 0.7, 1.48, -1.95, root); // either side of the window
    rbox(1.6, 0.1, 0.04, 0.01, paint, 0, 1.675, -1.95, root); // and over it
    add(new THREE.PlaneGeometry(1.2, 0.4), MAT.glass, root).position.set(0, 1.45, -1.95);
    rbox(0.1, 0.04, 0.03, 0.006, MAT.black, 0.52, 1.0, -1.975, root); // the handle
    for (const s of [-1, 1]) rbox(0.05, 0.08, 0.06, 0.008, MAT.black, s * 0.79, 1.4, -1.96, root); // the door's hinges
    // The spare wheel on the door, face out, on a stub carrier.
    const spare = new THREE.Group();
    spare.position.set(0, 1.27, -2.075);
    spare.rotation.y = Math.PI / 2;
    add(cached('tyre', tyre), MAT.rubber, spare);
    addWheelFace(spare, 1, MAT.rimGrey);
    root.add(spare);
    rbox(0.1, 0.3, 0.04, 0.01, MAT.black, 0, 1.27, -2.0, root);
    plate(PLATE_200, '#e8c51c', root, { x: 0, y: 0.78, z: -1.9755, facing: -1 }); // the rear number plate
    badge(root, { x: 0.55, y: 1.18, z: -1.9755, facing: -1, w: 0.16, h: 0.064, px: 900 }); // the maker's badge on the door
    modelBadge('200Tdi', root, { x: -0.52, y: 1.17, z: -1.9755 }); // and the model's, the other side
  }

  // The rear crossmember with the towing jaw: a pin through a jaw, where the trailer's ring goes.
  rbox(1.0, 0.12, 0.1, 0.01, MAT.chassis, 0, 0.56, -1.95, root);
  rbox(0.08, 0.08, 0.1, 0.01, MAT.steel, TOW_HITCH.x, TOW_HITCH.y, TOW_HITCH.z + 0.02, root);
  tube([TOW_HITCH.x, TOW_HITCH.y + 0.06, TOW_HITCH.z - 0.01], [TOW_HITCH.x, TOW_HITCH.y - 0.06, TOW_HITCH.z - 0.01], 0.01, MAT.galv, root, 6);
  for (const [name, at] of D ? [['towHitch', TOW_HITCH]] : [['towHitch', TOW_HITCH], ['crankHole', CRANK_HOLE]]) {
    const o = new THREE.Object3D();
    o.name = name;
    o.position.set(at.x, at.y, at.z);
    root.add(o);
  }

  // The exhaust: a silencer under the right side, inboard of the rail, and a tailpipe running well inside the rear wheel to come out under
  // the back, clear of it so you can see it.
  add(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 14).rotateX(Math.PI / 2), MAT.rust, root).position.set(-0.34, 0.38, -0.6);
  tube([-0.34, 0.38, -0.9], [-0.36, 0.34, -2.04], 0.022, MAT.rust, root, 6);
  const tip = new THREE.Object3D();
  tip.name = 'exhaustTip';
  tip.position.set(-0.36, 0.34, -2.04);
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
  // Where your eyes are riding in the middle or the left of the bench.
  for (const [name, seat] of [['cameraMid', LANDY_SEATS.mid], ['cameraLeft', LANDY_SEATS.left]]) {
    const a = new THREE.Object3D();
    a.name = name;
    a.position.set(seat.x, seat.y + 0.72, seat.z + 0.02);
    root.add(a);
  }

  for (const w of LANDY_LAYOUT.wheels) {
    const wheelModel = buildWheel(w, rim);
    wheelModel.name = w.name;
    quad.add(wheelModel);
  }

  addHeadlightBeams(quad);
  addSignalLamps(quad, MAT.amber, MAT.clear);
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
 * The gear lever's lean (radians) for a gear, in the usual H. Four-speed (the Series): first top-left, second below it, third top-right,
 * fourth below that, and reverse top-left of first. Five-speed (the 200TDi): first and second on the left, third and fourth in the
 * middle, fifth top-right and reverse below it. Neutral is the middle. Top is forward, away from the driver; the driver's left is +x, so a
 * lean to the left is a negative turn about z. `along` is the turn about x (positive leans forward).
 */
export function gearLeverPose(gear, gears = 4) {
  const FORWARD = 0.25;
  const BACK = -0.25;
  if (gears >= 5) {
    const across = { 1: -0.18, 2: -0.18, 3: 0, 4: 0, 5: 0.18, '-1': 0.18 }[gear];
    if (across === undefined) return { along: 0, across: 0 };
    return { along: gear === -1 || gear % 2 === 0 ? BACK : FORWARD, across };
  }
  const LEFT = -0.12;
  const RIGHT = 0.12;
  const FAR_LEFT = -0.3;
  switch (gear) {
    case -1: return { along: FORWARD, across: FAR_LEFT };
    case 1: return { along: FORWARD, across: LEFT };
    case 2: return { along: BACK, across: LEFT };
    case 3: return { along: FORWARD, across: RIGHT };
    case 4: return { along: BACK, across: RIGHT };
    default: return { along: 0, across: 0 };
  }
}

/**
 * Poses the levers and knobs: the gear lever leans with the gear (-1 reverse to 4), the yellow 4WD knob and the red diff lock knob go
 * down when engaged, the choke and hand throttle knobs pull out towards the driver, and the handbrake lever goes up with the brake.
 */
export function poseLandyControls(model, { gear = 0, gears = 4, fourWd = false, locked = false, choke = 0, hand = 0, park = false }) {
  const g = model.getObjectByName('gearLever');
  if (!g) return;
  const pose = gearLeverPose(gear, gears);
  g.rotation.set(pose.along, 0, pose.across);
  model.getObjectByName('transferKnob').position.y = 0.84 - (fourWd ? 0.05 : 0);
  model.getObjectByName('diffLockKnob').position.y = 0.84 - (locked ? 0.05 : 0);
  model.getObjectByName('chokeKnob').position.z = KNOB_Z - KNOB_TRAVEL * choke;
  model.getObjectByName('handThrottleKnob').position.z = KNOB_Z - KNOB_TRAVEL * hand;
  // The handbrake lever swings up and back when it goes on, eased so it doesn't snap.
  const hb = model.getObjectByName('parkBrakeLever');
  hb.rotation.x += ((park ? HANDBRAKE_ON : HANDBRAKE_OFF) - hb.rotation.x) * 0.3;
}
