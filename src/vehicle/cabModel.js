import { part } from './part.js';
import * as THREE from 'three';
import { markGlass } from './wiperModel.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { buildDash } from './dash.js';
import { addHeadlightBeams, addSignalLamps, addSignalStalk, addHazardSwitch, faceAlong } from './quadModel.js';
import { bentTube, mergeStatic, rod } from './quadGeometry.js';
import { treadTyre } from './detail/tread.js';
import { buildTorModel } from './torModel.js';
import { buildCragModel } from './cragModel.js';
import { DEF_WHEELBASE, DEF_TRACK } from './cragBody.js';

// The Tor: an old 88-inch pick-up, procedural like the UTV. Ladder chassis on leaf springs and live axles, flat-topped
// front wings with the headlamps in them, a black grille, the spare wheel on the bonnet, a bumper with the hole for the starting
// handle, an upright windscreen frame, a truck cab with a white roof and a three-seat bench, and an open tub behind with a drop
// tailgate and a towing jaw. Right-hand drive. Same named parts as the UTV's model so Quad drives it unchanged, plus its own:
//
//   quad
//   ├── body                         rocked by vibration
//   │   └── bodyRoot                 ground-referenced: y = 0 is the ground at rest, so it sits at CAB_GROUND_OFFSET in the chassis
//   │       ├── steeringColumn > handlebars    the wheel (holds riderHands, gripLeft, gripRight)
//   │       ├── dash                 the Tor binnacle in front of the driver
//   │       ├── gearLever, transferKnob (4WD), diffLockKnob, handThrottleKnob, chokeKnob   posed by poseCabControls
//   │       ├── riderAnchor, seatMid, seatLeft, cameraAnchor
//   │       └── crankHole, towHitch, exhaustTip
//   └── wheel_fl / wheel_fr / wheel_rl / wheel_rr   (each with a 'spin' child)
//
// +Z is forward and +X is the driver's left (the driver sits on the right, at -X).

export const CAB_GROUND_OFFSET = -0.62; // chassis origin to the ground at rest, metres
export const R = 0.38; // 7.50 x 16 tyres
export const REST = 0.2; // suspension rest length: matches the spec's suspensionRestLength
const TYRE_W = 0.21;
const RIM_R = 0.21; // a 16 inch rim
export const WHEELBASE = 2.23; // 88 inches
const TRACK = 1.31;

const wheelY = R + REST + CAB_GROUND_OFFSET;

// The windscreen: its frame stands on the bulkhead and rakes back about 11 degrees to meet the roof's underside, so everything that
// joins it (the doors' front uprights, the glass) is worked out from these.
const SCREEN_BASE = { y: 1.17, z: 0.595 };
const SCREEN_RAKE = 0.2;
const SCREEN_TOP_Y = 1.73; // a hair into the roof, which is 1.72 underneath
const SCREEN_H = (SCREEN_TOP_Y - SCREEN_BASE.y) / Math.cos(SCREEN_RAKE);
const SCREEN_TOP_Z = SCREEN_BASE.z - SCREEN_H * Math.sin(SCREEN_RAKE);
export const HANDBRAKE_OFF = 1.1; // the lever's lean when off (forward and low), and when on
export const HANDBRAKE_ON = -0.1;
export const TUB_FLOOR = 1.02; // the tub's floor, clear of the wheel tops (0.96) when they ride up
const KNOB_Z = 0.4; // the dash face the choke and hand throttle knobs come out of
const KNOB_TRAVEL = 0.1; // how far a knob pulls out
export const PLATE = 'FRM 88L'; // the Tor's registration, front and back (an L, 1972)

/** Where the wheels, their mounts and the bodywork box are, for QuadPhysics. */
export const TOR_LAYOUT = {
  spawnSag: 0.128, // how far the springs sink under its weight in the first moments, measured: it starts already sunk, so it doesn't settle in front of you
  wheels: [
    { name: 'wheel_fl', x: TRACK / 2, z: WHEELBASE / 2, front: true, radius: R, y: wheelY },
    { name: 'wheel_fr', x: -TRACK / 2, z: WHEELBASE / 2, front: true, radius: R, y: wheelY },
    { name: 'wheel_rl', x: TRACK / 2, z: -WHEELBASE / 2, front: false, radius: R, y: wheelY },
    { name: 'wheel_rr', x: -TRACK / 2, z: -WHEELBASE / 2, front: false, radius: R, y: wheelY },
  ],
  topY: wheelY,
  chassis: { hx: 0.8, hy: 0.36, hz: 1.8, y: 0.85 + CAB_GROUND_OFFSET },
};

/** The 200TDi's wheels and bodywork box: the Crag 90's longer wheelbase (2.36 m) and wider track (1.486 m). */
export const CRAG_LAYOUT = {
  spawnSag: 0.128, // as the Tor's
  wheels: [
    { name: 'wheel_fl', x: DEF_TRACK / 2, z: DEF_WHEELBASE / 2, front: true, radius: R, y: wheelY },
    { name: 'wheel_fr', x: -DEF_TRACK / 2, z: DEF_WHEELBASE / 2, front: true, radius: R, y: wheelY },
    { name: 'wheel_rl', x: DEF_TRACK / 2, z: -DEF_WHEELBASE / 2, front: false, radius: R, y: wheelY },
    { name: 'wheel_rr', x: -DEF_TRACK / 2, z: -DEF_WHEELBASE / 2, front: false, radius: R, y: wheelY },
  ],
  topY: wheelY,
  chassis: { hx: 0.82, hy: 0.36, hz: 1.9, y: 0.85 + CAB_GROUND_OFFSET },
};

/** The invisible box you look at to get in: ground to roof, a little wider than the body. */
export const CAB_PROXY = { w: 1.95, h: 2.1, d: 3.9 };

/** Where people sit on the bench (the driver, you, at -X) and where a girl stands to climb in, by the passenger's door. */
export const CAB_SEATS = {
  driver: { x: -0.42, y: 0.94, z: -0.34 },
  mid: { x: 0, y: 0.94, z: -0.34 },
  left: { x: 0.42, y: 0.94, z: -0.34 },
};
// Jamie: everyone sat too far forward. The hips were 0.24 m in front of the backrests' faces (about 0.12 is a person's), which also
// put the wheel too close and the mirror over your head; they moved back 0.12 m, and the worn belts' chest and lap points with them.
export const SEAT_BACK = -0.12;
export const CAB_STAND = {
  left: { x: 1.45, z: 0 },
  mid: { x: 1.45, z: 0 }, // the middle seat is reached through the passenger's door, as in the real thing
  driver: { x: -1.45, z: 0 }, // the driver's door, on the right
};

/**
 * The 200TDi's back bench, three in a row facing forward behind the front ones, a little higher, with a footwell in front of it and the
 * wheel boxes beside the outer seats. It is reached through a front door with that side's front seat tipped forward: the back's left
 * and middle seats by the passenger's door (the left seat tips), the right one by the driver's (the driver's seat tips).
 */
export const CRAG_REAR_SEATS = {
  rearLeft: { x: 0.38, y: 0.98, z: -1.12, door: 'left' },
  rearMid: { x: 0, y: 0.98, z: -1.12, door: 'left' },
  rearRight: { x: -0.38, y: 0.98, z: -1.12, door: 'driver' },
};
/** Where a girl stands to climb into the back: at the door, a little back from where she gets into the front. */
export const CRAG_REAR_STAND = {
  rearLeft: { x: 1.45, z: -0.2 },
  rearMid: { x: 1.45, z: -0.2 },
  rearRight: { x: -1.45, z: -0.2 },
};
/** Their belts: a diagonal and lap belt for the outer two from the body side, a lap belt for the middle (as CAB_BELTS). */
export const CRAG_REAR_BELTS = {
  rearLeft: { anchor: 0.7, buckle: 0.2, diagonal: true },
  rearMid: { anchor: -0.16, buckle: 0.16, diagonal: false },
  rearRight: { anchor: -0.7, buckle: -0.2, diagonal: true },
};
/** How far a front seat's backrest tips forward (radians) to let someone into the back, and the seats that do. */
export const SEAT_TIP = 0.95;
export const TIPPING_SEATS = ['left', 'driver'];

/** How far ahead of the driver's eye the windscreen's glass is, at eye height (the cars are held to it: tests/carModel.test.js). */
export function cabEyeToGlass() {
  const ey = CAB_SEATS.driver.y + 0.69;
  const ez = CAB_SEATS.driver.z + 0.02;
  return SCREEN_BASE.z - (ey - SCREEN_BASE.y) * Math.tan(SCREEN_RAKE) - ez;
}

/** The starting handle's hole in the front bumper, in the model's frame: where you stand to swing it, and the towing jaw behind. */
export const CRANK_HOLE = { x: 0, y: 0.56, z: 1.84 };
export const TOW_HITCH = { x: 0, y: 0.56, z: -2.02 };

/**
 * Where each seat's belt anchors and buckles (x). The driver's and the left seat's have a diagonal from the B pillar on their outer side
 * to a buckle on the inner one; the middle seat has a lap belt only, between two stalks.
 */
export const CAB_BELTS = {
  driver: { anchor: -0.78, buckle: -0.23, diagonal: true },
  mid: { anchor: -0.19, buckle: 0.19, diagonal: false },
  left: { anchor: 0.78, buckle: 0.23, diagonal: true },
};

export const MAT = {
  rubber: new THREE.MeshStandardMaterial({ color: 0x1b1a18, roughness: 0.95 }),
  chassis: new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.6, metalness: 0.3 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.5, metalness: 0.6 }),
  galv: new THREE.MeshStandardMaterial({ color: 0x8e9396, roughness: 0.45, metalness: 0.7 }), // galvanised: the windscreen frame, hinges
  black: new THREE.MeshStandardMaterial({ color: 0x1c1d1e, roughness: 0.7 }), // the grille, bumper, dash
  roof: new THREE.MeshStandardMaterial({ color: 0xe8e4d6, roughness: 0.5, side: THREE.DoubleSide }), // Limestone
  rim: new THREE.MeshStandardMaterial({ color: 0xc9c7bc, roughness: 0.45, metalness: 0.4 }), // the steel wheels in Limestone
  rimGrey: new THREE.MeshStandardMaterial({ color: 0xa9adb0, roughness: 0.4, metalness: 0.5 }), // the 200TDi's, silver
  glass: markGlass(new THREE.MeshStandardMaterial({ color: 0x9fb3b8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, side: THREE.DoubleSide })),
  knob: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.35 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xe0b020, roughness: 0.35 }), // the 4WD knob
  red: new THREE.MeshStandardMaterial({ color: 0xb02018, roughness: 0.35 }), // the diff lock's
  rust: new THREE.MeshStandardMaterial({ color: 0x4b3a2e, roughness: 0.7, metalness: 0.5 }),
  belt: new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.9 }), // the webbing, dark grey so it shows on black vinyl
  amber: new THREE.MeshStandardMaterial({ color: 0xd88a18, roughness: 0.3 }),
  clear: new THREE.MeshStandardMaterial({ color: 0xdfe4e6, roughness: 0.2 }), // the reverse lens
};

export function add(geo, mat, parent, name) {
  const m = new THREE.Mesh(geo, mat);
  if (name) m.name = name;
  parent.add(m);
  return m;
}

export function rbox(w, h, d, r, mat, x, y, z, parent, name) {
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
export function archFlare(x, zc, mat, parent) {
  const m = add(new THREE.TorusGeometry(ARCH_R + 0.012, 0.016, 6, 24, Math.PI).rotateY(Math.PI / 2), mat, parent);
  m.position.set(x, ARCH_Y, zc);
  return m;
}

/** A square-section post from a to b (a window pillar or screen upright). */
export function post(a, b, t1, t2, mat, parent) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const m = add(new THREE.BoxGeometry(t1, va.distanceTo(vb), t2), mat, parent);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.sub(va).normalize());
  return m;
}

export function canvasTexture(w, h, draw, { repeat = null } = {}) {
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
export function seeded(seed) {
  let v = seed;
  return () => ((v = (v * 16807) % 2147483647) / 2147483647);
}

/**
 * A flat label (plate, badge, rip) on a plane of w by h metres, facing +Z; the caller places and turns it. Has a map, so it isn't merged.
 * `draw(g, W, H)` draws in pixels of a canvas `px` to the metre, because browsers mangle text set at a fraction of a pixel.
 */
export function label(w, h, px, draw, parent) {
  const tex = canvasTexture(Math.round(w * px), Math.round(h * px), (g, cw, ch) => draw(g, cw, ch));
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  return add(new THREE.PlaneGeometry(w, h), mat, parent);
}

/** Text of at most `size` pixels, shrunk until it is no wider than `maxW`, centred on (x, y). */
export function fitText(g, str, x, y, size, maxW, weight = 'bold') {
  g.font = `${weight} ${size}px Helvetica, Arial, sans-serif`;
  const w = g.measureText(str).width;
  if (w > maxW) g.font = `${weight} ${size * (maxW / w)}px Helvetica, Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(str, x, y);
}

/** A number plate, white at the front and yellow at the back, with the registration in black, filling most of it. */
export function plate(text, bg, parent, { x, y, z, facing }) {
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
export function badge(parent, { x, y, z, facing, w = 0.2, h = w * 0.4, twoLines = false, px = 700 }) {
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
      fitText(g, 'MOOR', W / 2, H * 0.36, H * 0.3, W * 0.5);
      fitText(g, 'LAND', W / 2, H * 0.66, H * 0.3, W * 0.62);
    } else {
      fitText(g, 'MOORLAND', W / 2, H / 2 + H * 0.02, H * 0.34, W * 0.78);
    }
  }, parent);
  m.position.set(x, y, z);
  if (facing < 0) m.rotation.y = Math.PI;
  return m;
}

/** The trim's textures, made when a Tor or Crag is built (they need a canvas). */
export function trimMaterials(crag = false) {
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
  if (crag) {
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
export function seatRip(parent) {
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

export function tube(a, b, r, mat, parent, radial = 8) {
  return add(rod(a, b, r, radial), mat, parent);
}

export function axleCyl(r, len, mat, x, y, z, parent, segments = 20) {
  const m = add(new THREE.CylinderGeometry(r, r, len, segments).rotateZ(Math.PI / 2), mat, parent);
  m.position.set(x, y, z);
  return m;
}

// Wheels ---------------------------------------------------------------------

const cache = new Map();
export const cached = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

/** A narrow all-terrain tyre on a drum: blocky tread in two staggered rows. */
export function tyre() {
  return treadTyre('allTerrain', { radius: R, width: TYRE_W, rimR: RIM_R, count: 28, segments: 44 });
}

/** A steel wheel: the dished disc with its ring of holes suggested by bolts, in Limestone, and a hub cap. */
export function addWheelFace(spin, side, rim = MAT.rim) {
  axleCyl(RIM_R, TYRE_W + 0.02, rim, 0, 0, 0, spin);
  axleCyl(RIM_R * 0.8, 0.03, rim, side * (TYRE_W / 2 + 0.005), 0, 0, spin);
  axleCyl(0.06, 0.05, MAT.galv, side * (TYRE_W / 2 + 0.03), 0, 0, spin);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const n = add(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 6).rotateZ(Math.PI / 2), MAT.galv, spin);
    n.position.set(side * (TYRE_W / 2 + 0.03), Math.sin(a) * 0.1, Math.cos(a) * 0.1);
  }
}

/** How far (radians) a pedal swings from the top of its arm when it is pressed right down. */
const PEDAL_TRAVEL = 0.28;

/** Swings the pedals with what your feet are doing, eased so they don't snap (`pedalClutch`, `pedalBrake`, `pedalAccel`, from addPedals). */
export function posePedals(model, { clutch = 0, brake = 0, throttle = 0 }) {
  for (const [name, press] of [['pedalClutch', clutch], ['pedalBrake', brake], ['pedalAccel', throttle]]) {
    const pedal = part(model, name);
    if (pedal) pedal.rotation.x += (-PEDAL_TRAVEL * Math.min(1, Math.max(0, press)) - pedal.rotation.x) * 0.5;
  }
}

/**
 * The three pedals (clutch, brake, accelerator), each a group pivoting at the top of its arm (`pivot`: y, z, on the bulkhead's lining under the dash)
 * with the arm and a ribbed pad hanging from it to `foot` (y, z); `poseCabControls` swings them with what your feet are doing. Named
 * `pedalClutch`, `pedalBrake` and `pedalAccel`, and kept apart from the merge. The driver sits on the right (x -0.42), so the clutch is furthest left
 * of him (the largest x, nearest the console) and the accelerator furthest right (the smallest, by the door), as on any right-hand-drive car.
 */
export function addPedals(root, { pivot, foot, xs = [-0.25, -0.4, -0.55], widths = [0.075, 0.075, 0.045], padMat = MAT.black, armMat = MAT.galv, ribMat = MAT.knob }) {
  ['pedalClutch', 'pedalBrake', 'pedalAccel'].forEach((name, i) => {
    const g = new THREE.Group();
    g.name = name;
    g.userData.keep = true;
    g.position.set(xs[i], pivot[0], pivot[1]);
    const dy = foot[0] - pivot[0];
    const dz = foot[1] - pivot[1];
    tube([0, 0, 0], [0, dy, dz], 0.008, armMat, g, 5); // the arm, from its pivot to the pad
    const pad = new THREE.Group();
    pad.position.set(0, dy, dz);
    pad.rotation.x = -0.6;
    add(new THREE.BoxGeometry(widths[i], 0.016, 0.1), padMat, pad);
    for (const z of [-0.03, 0, 0.03]) add(new THREE.BoxGeometry(widths[i] - 0.01, 0.006, 0.008), ribMat, pad).position.set(0, 0.01, z); // the ribs
    g.add(pad);
    root.add(g);
  });
}

export function buildWheel(w, rim) {
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

// The Tor or Crag ----------------------------------------------------------------

export function buildCabModel({ bodyColor = 0x3b4a36, dashStyle = 'tor', variant = 'tor', reg = null } = {}) {
  // Each has its own model: cragModel.js, torModel.js. The variant is kept for the snorkel, which stands on a different wing.
  const model = variant === 'crag' ? buildCragModel({ bodyColor, dashStyle, reg }) : buildTorModel({ bodyColor, dashStyle, reg });
  model.userData.variant = variant;
  return model;
}

/** Tips the 200TDi's outer front backrests forward, 0 (upright) to 1 (right forward), by seat name ({ left, driver }). */
export function poseSeatTips(model, tips) {
  for (const name of TIPPING_SEATS) {
    const back = part(model, `seatBack_${name}`);
    if (back) back.rotation.x = SEAT_TIP * Math.min(1, Math.max(0, tips[name] ?? 0));
  }
}

/**
 * The gear lever's lean (radians) for a gear, in the usual H. Four-speed (the Tor): first top-left, second below it, third top-right,
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
export function poseCabControls(model, { gear = 0, gears = 4, fourWd = false, locked = false, choke = 0, hand = 0, park = false, clutch = 0, brake = 0, throttle = 0 }) {
  const g = part(model, 'gearLever');
  if (!g) return;
  posePedals(model, { clutch, brake, throttle });
  const pose = gearLeverPose(gear, gears);
  g.rotation.set(pose.along, 0, pose.across);
  part(model, 'transferKnob').position.y = 0.84 - (fourWd ? 0.05 : 0);
  part(model, 'diffLockKnob').position.y = 0.84 - (locked ? 0.05 : 0);
  const knobZ = model.userData.knobZ ?? KNOB_Z; // the Tor's dash face is further back than the 200TDi's has
  part(model, 'chokeKnob').position.z = knobZ - KNOB_TRAVEL * choke;
  part(model, 'handThrottleKnob').position.z = knobZ - KNOB_TRAVEL * hand;
  // The handbrake lever swings up and back when it goes on, eased so it doesn't snap.
  const hb = part(model, 'parkBrakeLever');
  hb.rotation.x += ((park ? HANDBRAKE_ON : HANDBRAKE_OFF) - hb.rotation.x) * 0.3;
}
