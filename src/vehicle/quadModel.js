import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WHEELS } from './quadPhysics.js';
import { buildDash } from './dash.js';
import {
  bentTube,
  bootGeometry,
  gripGeometry,
  lathe,
  loftGeometry,
  mergeStatic,
  rimGeometry,
  rod,
  shellGeometry,
  springGeometry,
  sweepGeometry,
  tyreGeometry,
} from './quadGeometry.js';

// Farm quad built from procedural parts. One group with named parts so it can
// be replaced by a real model later without touching the code that drives it:
//
//   quad
//   ├── body                  rocked by vibration
//   │   └── bodyRoot          ground-referenced parts (y = 0 is the ground at rest)
//   │       ├── seat, pillionSeat, engine, fenders, racks …
//   │       ├── suspension arms, swingarm and shocks, posed by poseSuspension()
//   │       ├── handlebars    steering pivot; holds dash, rpmNeedle, tempLight,
//   │       │                 ignitionLight, chokeLever, riderHands
//   │       └── riderAnchor, pillionAnchor, cameraAnchor
//   └── wheel_fl / wheel_fr / wheel_rl / wheel_rr  (each with a 'spin' child)
//
// +Z is forward and +X is the rider's left. Wheel centres sit at y = 0.3 in
// bodyRoot space at rest, matching the physics.

const WHEEL_RADIUS = 0.3;
const REST_WHEEL_Y = 0.3;

// Shared materials. Paint, lenses, rims and springs are made per quad in buildQuadModel.
const MAT = {
  plastic: new THREE.MeshStandardMaterial({ color: 0x1d1e1f, roughness: 0.78 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.93 }),
  seat: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.48 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x1f2123, roughness: 0.42, metalness: 0.45 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.45, metalness: 0.6 }),
  engine: new THREE.MeshStandardMaterial({ color: 0x9a9da0, roughness: 0.42, metalness: 0.75 }),
  engineDark: new THREE.MeshStandardMaterial({ color: 0x45484b, roughness: 0.5, metalness: 0.55 }),
  alloy: new THREE.MeshStandardMaterial({ color: 0xb8bbbe, roughness: 0.32, metalness: 0.85 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xd8dadc, roughness: 0.14, metalness: 1.0 }),
  exhaust: new THREE.MeshStandardMaterial({ color: 0x3b3631, roughness: 0.62, metalness: 0.55 }),
  hole: new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 }),
  reflector: new THREE.MeshStandardMaterial({ color: 0xe6e6e6, roughness: 0.08, metalness: 1.0 }),
  tail: new THREE.MeshStandardMaterial({ color: 0x9a120c, roughness: 0.2, emissive: 0x2a0000 }),
  glove: new THREE.MeshStandardMaterial({ color: 0x2d3a26, roughness: 0.8 }),
  sleeve: new THREE.MeshStandardMaterial({ color: 0x3f4d34, roughness: 0.9 }),
};

// Per-style details. Body shapes live in the builders below.
const STYLE = {
  utility: {
    rim: new THREE.MeshStandardMaterial({ color: 0xa9acaf, roughness: 0.35, metalness: 0.7, side: THREE.DoubleSide }),
    rimOpts: { holes: 4, holeR: 0.022 },
    rimR: 0.15,
    spring: new THREE.MeshStandardMaterial({ color: 0xb3261c, roughness: 0.35, metalness: 0.4 }),
    bars: MAT.chrome,
    rear: 'swingarm',
    fwd: true,
  },
  utility2: {
    rim: new THREE.MeshStandardMaterial({ color: 0x74787d, roughness: 0.38, metalness: 0.65, side: THREE.DoubleSide }),
    rimOpts: { spokes: true },
    rimR: 0.15,
    spring: new THREE.MeshStandardMaterial({ color: 0x2a2c2f, roughness: 0.4, metalness: 0.5 }),
    bars: MAT.frame,
    rear: 'arms',
    fwd: true,
  },
  sport: {
    rim: new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.25, metalness: 0.9, side: THREE.DoubleSide }),
    rimOpts: { holes: 8, holeR: 0.014 },
    rimR: 0.14,
    spring: new THREE.MeshStandardMaterial({ color: 0xc8211a, roughness: 0.35, metalness: 0.4 }),
    bars: MAT.alloy,
    rear: 'swingarm',
    fwd: false,
  },
};

function add(geo, mat, parent, name) {
  const m = new THREE.Mesh(geo, mat);
  if (name) m.name = name;
  parent.add(m);
  return m;
}

/** Rounded box. */
function rbox(w, h, d, r, mat, x, y, z, parent, name, segments = 2) {
  const m = add(new RoundedBoxGeometry(w, h, d, segments, Math.min(r, w / 2, h / 2, d / 2) * 0.999), mat, parent, name);
  m.position.set(x, y, z);
  return m;
}

/** Straight tube between two points. */
function tube(a, b, r, mat, parent, radial = 8) {
  return add(rod(a, b, r, radial), mat, parent);
}

/** Bent tube through corner points. */
function pipe(corners, r, mat, parent, opts) {
  return add(bentTube(corners, r, opts), mat, parent);
}

/** Lathe part (made around +Y) turned to face along +Z, at a position. */
function latheZ(points, mat, x, y, z, parent, segments = 20) {
  const g = lathe(points, segments);
  g.rotateX(Math.PI / 2);
  const m = add(g, mat, parent);
  m.position.set(x, y, z);
  return m;
}

/** Points left/right mirrored: [x, y, z] → [s * x, y, z]. */
const mx = (s, pts) => pts.map(([x, y, z]) => [s * x, y, z]);

// Wheels ---------------------------------------------------------------------

const wheelCache = new Map();
function cached(key, make) {
  if (!wheelCache.has(key)) wheelCache.set(key, make());
  return wheelCache.get(key);
}

function buildWheel(w, width, style, cfg) {
  const s = Math.sign(w.x);
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  spin.name = 'spin';
  spin.userData.keep = true;
  wheel.add(spin);
  const tyre = cached(`tyre${width}|${cfg.rimR}`, () => tyreGeometry(WHEEL_RADIUS, width, cfg.rimR, 20));
  add(tyre, MAT.rubber, spin);
  const rim = cached(`rim${style}|${width}|${s}`, () => rimGeometry(cfg.rimR, width, s, cfg.rimOpts));
  add(rim.rim, cfg.rim, spin);
  add(rim.dark, MAT.hole, spin);
  add(rim.nuts, MAT.chrome, spin);

  // Hub and brake drum, inboard, turning with the steering but not the wheel.
  const hub = add(cached('hub', () => new THREE.CylinderGeometry(0.07, 0.07, 0.07, 16).rotateZ(Math.PI / 2)), MAT.engineDark, wheel);
  hub.position.x = -s * (width / 2 - 0.05);
  const independent = w.front || cfg.rear === 'arms';
  if (independent) {
    // Knuckle joining the upper and lower ball joints.
    tube([-s * 0.08, -0.075, 0], [-s * 0.08, 0.09, 0], 0.016, MAT.frame, wheel);
    tube([-s * 0.08, -0.06, 0], [-s * 0.08, -0.06, w.front ? -0.09 : 0.09], 0.01, MAT.frame, wheel);
  }
  mergeStatic(wheel);
  return wheel;
}

// Suspension -----------------------------------------------------------------

/**
 * Double wishbones and a coil-over for one wheel. The arms pivot on the frame
 * and are swung by poseSuspension to follow the wheel.
 */
function buildArms(root, w, i, cfg, rig) {
  const s = Math.sign(w.x);
  const inner = 0.15;
  const L = 0.25;
  const levels = [
    { y: REST_WHEEL_Y - 0.06, lower: true },
    { y: REST_WHEEL_Y + 0.08, lower: false },
  ];
  let lowerArm = null;
  for (const lv of levels) {
    const g = new THREE.Group();
    g.position.set(s * inner, lv.y, w.z);
    g.userData.keep = true;
    root.add(g);
    // A-shape: two legs from the frame bushes to the ball joint.
    const spread = lv.lower ? 0.12 : 0.1;
    tube([0, 0, spread], [s * L, 0, 0], 0.013, MAT.frame, g);
    tube([0, 0, -spread], [s * L, 0, 0], 0.013, MAT.frame, g);
    tube([s * L * 0.35, 0, spread * 0.65], [s * L * 0.35, 0, -spread * 0.65], 0.01, MAT.frame, g);
    for (const z of [spread, -spread]) {
      const bush = add(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 10), MAT.rubber, g);
      bush.rotation.x = Math.PI / 2;
      bush.position.z = z;
    }
    const ball = add(new THREE.SphereGeometry(0.018, 10, 8), MAT.steel, g);
    ball.position.x = s * L;
    mergeStatic(g);
    rig.links.push({ kind: 'arm', group: g, wheel: i, s, len: L, angle: 0 });
    if (lv.lower) lowerArm = rig.links[rig.links.length - 1];
  }

  // Drive shaft with its CV boots, on four-wheel-drive axles.
  if (w.front ? cfg.fwd : cfg.rear === 'arms') {
    const g = new THREE.Group();
    g.position.set(s * 0.1, REST_WHEEL_Y, w.z);
    g.userData.keep = true;
    root.add(g);
    const len = 0.3;
    tube([0, 0, 0], [s * len, 0, 0], 0.012, MAT.steel, g);
    for (const [x0, r0, r1] of [[0.01, 0.03, 0.02], [len - 0.1, 0.02, 0.03]]) {
      const boot = bootGeometry(0.09, r0, r1, 4);
      boot.rotateZ(-s * (Math.PI / 2));
      boot.translate(s * x0, 0, 0);
      add(boot, MAT.rubber, g);
    }
    mergeStatic(g);
    rig.links.push({ kind: 'arm', group: g, wheel: i, s, len, angle: 0 });
  }

  // Coil-over from a frame bracket down to the lower arm.
  addShock(root, rig, [s * 0.15, 0.68, w.z + (w.front ? -0.04 : 0.04)], lowerArm, s * 0.15, 0, cfg);
}

/** Swingarm with a solid rear axle and a single shock. */
function buildSwingarm(root, cfg, sport, rig) {
  const g = new THREE.Group();
  const pivot = [0, 0.36, -0.1];
  g.position.set(...pivot);
  g.userData.keep = true;
  root.add(g);
  const axle = [0, REST_WHEEL_Y - pivot[1], WHEELS[2].z - pivot[2]];
  for (const s of [-1, 1]) {
    pipe([[s * 0.12, 0, 0.02], [s * 0.15, axle[1] * 0.5, axle[2] * 0.35], [s * 0.15, axle[1], axle[2] + 0.04]], 0.02, MAT.frame, g, { bend: 0.08 });
  }
  tube([-0.15, 0, -0.05], [0.15, 0, -0.05], 0.02, MAT.frame, g);
  tube([-0.15, axle[1] * 0.6, axle[2] * 0.55], [0.15, axle[1] * 0.6, axle[2] * 0.55], 0.016, MAT.frame, g);
  // Axle carrier, axle and brake disc.
  rbox(0.34, 0.11, 0.12, 0.03, MAT.engineDark, 0, axle[1], axle[2], g);
  tube([-0.36, axle[1], axle[2]], [0.36, axle[1], axle[2]], 0.022, MAT.steel, g, 10);
  const disc = add(new THREE.CylinderGeometry(0.09, 0.09, 0.008, 20).rotateZ(Math.PI / 2), MAT.alloy, g);
  disc.position.set(-0.22, axle[1], axle[2]);
  if (sport) {
    // Chain drive on the left.
    const sprocket = add(new THREE.CylinderGeometry(0.085, 0.085, 0.01, 20).rotateZ(Math.PI / 2), MAT.steel, g);
    sprocket.position.set(0.22, axle[1], axle[2]);
    const c = [];
    for (let k = 0; k <= 12; k++) {
      const a = -Math.PI / 2 + (k / 12) * Math.PI;
      c.push([0.2, axle[1] + Math.sin(a) * 0.09, axle[2] - Math.cos(a) * 0.09]);
    }
    for (let k = 0; k <= 12; k++) {
      const a = Math.PI / 2 + (k / 12) * Math.PI;
      c.push([0.2, 0.0 + Math.sin(a) * 0.035, 0.06 - Math.cos(a) * 0.035]);
    }
    add(sweepGeometry(c.map((p) => new THREE.Vector3(...p)), 0.007, { radial: 5, closed: true }), MAT.frame, g);
  } else {
    // Shaft drive: final drive housing on the right.
    rbox(0.1, 0.16, 0.16, 0.04, MAT.engine, -0.24, axle[1], axle[2], g);
  }
  mergeStatic(g);
  const yz = [axle[1], axle[2]];
  const link = { kind: 'swing', group: g, wheels: [2, 3], len: Math.hypot(yz[0], yz[1]), rest: Math.atan2(yz[0], -yz[1]), pivot, angle: 0 };
  rig.links.push(link);
  addShock(root, rig, [0, 0.72, -0.48], link, axle[1] * 0.6 + 0.02, axle[2] * 0.55, cfg);
}

/** Coil-over shock from a fixed top mount to a point on a moving link. */
function addShock(root, rig, top, link, a, b, cfg) {
  const g = new THREE.Group();
  g.position.set(...top);
  g.userData.keep = true;
  root.add(g);
  const bottom = new THREE.Vector3();
  const shock = { group: g, top: new THREE.Vector3(...top), link, a, b, bottom, rest: 0, spring: null, lower: null };
  shockBottom(shock);
  shock.rest = bottom.distanceTo(shock.top);
  const rest = shock.rest;
  // Body and reservoir at the top, spring around it, shaft and eye at the bottom.
  const body = new THREE.Group();
  body.userData.keep = true;
  g.add(body);
  add(new THREE.CylinderGeometry(0.022, 0.022, rest * 0.55, 10).translate(0, -rest * 0.3, 0), MAT.engineDark, body);
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 12).translate(0, -0.035, 0), MAT.steel, body);
  add(new THREE.SphereGeometry(0.018, 8, 6), MAT.steel, body);
  mergeStatic(body);
  const spring = add(springGeometry(rest - 0.07, 0.03, 0.0055, 7), cfg.spring, g);
  spring.position.y = -0.035;
  const lower = new THREE.Group();
  g.add(lower);
  add(new THREE.CylinderGeometry(0.008, 0.008, rest * 0.5, 8).translate(0, rest * 0.25, 0), MAT.chrome, lower);
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 12).translate(0, 0.035, 0), MAT.steel, lower);
  add(new THREE.SphereGeometry(0.016, 8, 6), MAT.steel, lower);
  mergeStatic(lower);
  shock.spring = spring;
  shock.lower = lower;
  rig.shocks.push(shock);
}

/** Where the bottom of a shock is now, in bodyRoot space. */
function shockBottom(sh) {
  const l = sh.link;
  const p = l.group.position;
  if (l.kind === 'arm') {
    // Rotation about Z of the point (a, b) in the arm's XY plane.
    const c = Math.cos(l.angle);
    const s = Math.sin(l.angle);
    sh.bottom.set(p.x + sh.a * c - sh.b * s, p.y + sh.a * s + sh.b * c, p.z);
  } else {
    // Rotation about X of the point (y = a, z = b).
    const c = Math.cos(l.angle);
    const s = Math.sin(l.angle);
    sh.bottom.set(p.x, p.y + sh.a * c - sh.b * s, p.z + sh.a * s + sh.b * c);
  }
  return sh.bottom;
}

const DOWN = new THREE.Vector3(0, -1, 0);
const tmpDir = new THREE.Vector3();

/**
 * Swings the arms, swingarm and shocks to follow the wheels. `wheelY` holds
 * each wheel centre's height in bodyRoot space, in WHEELS order.
 */
export function poseSuspension(quad, wheelY) {
  const rig = quad.userData.suspension;
  for (const l of rig.links) {
    if (l.kind === 'arm') {
      const dy = THREE.MathUtils.clamp(wheelY[l.wheel] - REST_WHEEL_Y, -0.8 * l.len, 0.8 * l.len);
      l.angle = l.s * Math.asin(dy / l.len);
      l.group.rotation.z = l.angle;
    } else {
      const y = (wheelY[l.wheels[0]] + wheelY[l.wheels[1]]) / 2 - l.pivot[1];
      const dy = THREE.MathUtils.clamp(y, -0.8 * l.len, 0.8 * l.len);
      l.angle = Math.asin(dy / l.len) - l.rest;
      l.group.rotation.x = l.angle;
    }
  }
  for (const sh of rig.shocks) {
    shockBottom(sh);
    tmpDir.subVectors(sh.bottom, sh.top);
    const len = tmpDir.length();
    sh.group.quaternion.setFromUnitVectors(DOWN, tmpDir.multiplyScalar(1 / len));
    sh.spring.scale.y = (len - 0.07) / (sh.rest - 0.07);
    sh.lower.position.y = -len;
  }
}

// Handlebars -----------------------------------------------------------------

function buildHandlebars(dashStyle, cfg) {
  const bars = new THREE.Group();
  bars.name = 'handlebars';
  bars.userData.keep = true;

  // Bar with a slight sweep back towards the rider, in a clamp on a riser.
  pipe([[0.43, 0.072, -0.07], [0.2, 0.06, -0.012], [-0.2, 0.06, -0.012], [-0.43, 0.072, -0.07]], 0.011, cfg.bars, bars, { bend: 0.07, steps: 5 });
  tube([0, 0, 0], [0, 0.05, -0.01], 0.02, MAT.steel, bars);
  rbox(0.09, 0.03, 0.045, 0.01, MAT.engineDark, 0, 0.06, -0.012, bars);
  for (const s of [-1, 1]) {
    const grip = add(gripGeometry(0.115, 0.016), MAT.rubber, bars, s > 0 ? 'gripLeft' : 'gripRight');
    const a = new THREE.Vector3(s * 0.318, 0.0675, -0.042);
    const b = new THREE.Vector3(s * 0.433, 0.0725, -0.07);
    grip.position.copy(a);
    grip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    // Brake lever on a perch, curving out ahead of the grip.
    rbox(0.03, 0.026, 0.03, 0.008, MAT.engineDark, s * 0.262, 0.066, -0.018, bars);
    pipe([[s * 0.262, 0.07, -0.012], [s * 0.29, 0.076, 0.0], [s * 0.4, 0.076, -0.028], [s * 0.418, 0.072, -0.04]], 0.0055, MAT.alloy, bars, { bend: 0.02 });
  }

  // Dash pod in the middle, face tilted towards the rider.
  const dash = buildDash(dashStyle);
  dash.group.position.set(0, 0.1, 0.02);
  dash.group.rotation.x = 0.75;
  dash.group.userData.keep = true;
  bars.add(dash.group);
  bars.userData.dash = dash;

  // Choke lever on the left bar, inboard of the grip. Rotates about X.
  const chokeHousing = rbox(0.03, 0.026, 0.032, 0.008, MAT.plastic, 0.29, 0.07, -0.03, bars, 'chokeHousing');
  chokeHousing.rotation.y = 0.2;
  const choke = new THREE.Group();
  choke.name = 'chokeLever';
  choke.userData.keep = true;
  choke.position.set(0.29, 0.085, -0.03);
  bars.add(choke);
  rbox(0.01, 0.055, 0.012, 0.004, MAT.chrome, 0, 0.026, 0, choke, 'chokeLeverArm', 1);
  rbox(0.018, 0.012, 0.016, 0.005, new THREE.MeshStandardMaterial({ color: 0xd8c020, roughness: 0.5 }), 0, 0.055, 0, choke, 'chokeLeverKnob', 1);

  // Thumb throttle and its housing on the right.
  rbox(0.04, 0.036, 0.042, 0.01, MAT.plastic, -0.3, 0.066, -0.032, bars);
  const thumb = rbox(0.012, 0.032, 0.022, 0.005, MAT.plastic, -0.32, 0.06, -0.06, bars, 'thumbThrottle', 1);
  thumb.rotation.y = -0.3;

  // The rider's gloves and forearms, only shown while riding.
  const hands = new THREE.Group();
  hands.name = 'riderHands';
  hands.userData.keep = true;
  hands.visible = false;
  for (const s of [-1, 1]) {
    const glove = add(new THREE.CapsuleGeometry(0.03, 0.06, 4, 8), MAT.glove, hands);
    glove.position.set(s * 0.375, 0.075, -0.055);
    glove.rotation.z = Math.PI / 2;
    tube([s * 0.37, 0.09, -0.08], [s * 0.33, 0.17, -0.24], 0.032, MAT.sleeve, hands, 10);
  }
  bars.add(hands);

  return bars;
}

function numberPlateTexture(text) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f2ea';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#151515';
  ctx.font = 'bold 96px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Lights ---------------------------------------------------------------------

/** Round headlamp facing +Z: bezel cup, reflector and a domed lens. */
function roundLamp(parent, x, y, z, r, lensMat, bezelMat, name) {
  latheZ([[r * 0.7, -0.05], [r * 1.05, -0.035], [r * 1.2, -0.005], [r * 1.24, 0.004], [r * 1.12, 0.01], [r * 1.0, 0.006]], bezelMat, x, y, z, parent, 20);
  latheZ([[r * 0.95, 0.0], [r * 0.5, -0.022], [0.01, -0.03]], MAT.reflector, x, y, z, parent, 16);
  const R = r / Math.sin(0.55);
  const lens = new THREE.SphereGeometry(R, 20, 4, 0, Math.PI * 2, 0, 0.55);
  lens.translate(0, -R * Math.cos(0.55), 0);
  lens.rotateX(Math.PI / 2);
  const m = add(lens, lensMat, parent, name);
  m.position.set(x, y, z + 0.004);
  return m;
}

/** Rectangular headlamp facing +Z, in a rounded bezel. */
function squareLamp(parent, x, y, z, w, h, lensMat, name) {
  rbox(w + 0.03, h + 0.03, 0.04, 0.014, MAT.plastic, x, y, z - 0.012, parent);
  rbox(w, h, 0.012, 0.008, MAT.reflector, x, y, z + 0.006, parent, undefined, 1);
  const lens = rbox(w, h, 0.012, 0.01, lensMat, x, y, z + 0.012, parent, name, 2);
  lens.scale.z = 0.8;
  return lens;
}

// Racks ----------------------------------------------------------------------

/**
 * Tubular rack: a rounded hoop with cross slats, on legs down to the body.
 * `raised` adds a second hoop above, joined by uprights.
 */
function rack(root, z0, z1, y, slats, legY, raised = 0) {
  const W = 0.41;
  const dir = Math.sign(z1 - z0);
  const hoop = [[W, y, z0], [W, y, z1], [-W, y, z1], [-W, y, z0]];
  pipe(hoop, 0.013, MAT.frame, root, { bend: 0.06, closed: true, steps: 5 });
  for (let i = 1; i < slats; i++) {
    const z = z0 + ((z1 - z0) * i) / slats;
    tube([-W, y, z], [W, y, z], 0.0095, MAT.frame, root, 6);
  }
  for (const x of [-0.16, 0.16]) tube([x, y - 0.004, z0], [x, y - 0.004, z1], 0.009, MAT.frame, root, 6);
  // Points on the side rails just clear of the corner bends.
  const ends = [z0 + dir * 0.07, z1 - dir * 0.07];
  if (raised) {
    pipe(hoop.map(([x, , z]) => [x, y + raised, z]), 0.011, MAT.frame, root, { bend: 0.06, closed: true, steps: 5 });
    for (const s of [-1, 1]) {
      for (const z of [...ends, (z0 + z1) / 2]) tube([s * W, y, z], [s * W, y + raised, z], 0.009, MAT.frame, root, 6);
    }
  }
  // Legs from the side rails down into the plastics.
  for (const s of [-1, 1]) {
    for (const z of ends) tube([s * W, y, z], [s * 0.26, legY, z], 0.011, MAT.frame, root, 6);
  }
}

// Bodywork -------------------------------------------------------------------

// Fender cross-sections: [t across the width, drop towards the wheel].
const SECTION = {
  // Rounded crown, a short skirt inboard and a rolled lip outboard.
  utility: [[0, 0.07], [0.02, 0.022], [0.07, 0.004], [0.3, -0.01], [0.6, -0.012], [0.82, -0.004], [0.92, 0.01], [0.97, 0.032], [1.0, 0.06], [0.985, 0.088]],
  // Flatter top with a squarer, deeper flare.
  utility2: [[0, 0.07], [0.02, 0.02], [0.06, 0.0], [0.5, -0.008], [0.86, -0.002], [0.93, 0.006], [0.965, 0.028], [0.975, 0.06], [0.962, 0.075]],
  // Thin, crowned race fenders with a small lip.
  sport: [[0, 0.05], [0.03, 0.012], [0.1, 0.0], [0.45, -0.014], [0.8, -0.006], [0.93, 0.01], [0.98, 0.03], [0.97, 0.05]],
};

// Side profiles round each wheel, [z, y] from the wheel centre, front to back.
const PROFILE = {
  utility: {
    front: [[0.43, 0.12], [0.4, 0.24], [0.31, 0.34], [0.16, 0.405], [-0.02, 0.418], [-0.18, 0.39], [-0.3, 0.31], [-0.36, 0.18], [-0.37, 0.05]],
    rear: [[0.37, 0.05], [0.36, 0.2], [0.29, 0.32], [0.15, 0.405], [-0.04, 0.42], [-0.2, 0.395], [-0.32, 0.32], [-0.39, 0.2], [-0.41, 0.1]],
    width: [0.25, 0.655],
  },
  utility2: {
    front: [[0.44, 0.1], [0.42, 0.24], [0.36, 0.33], [0.22, 0.4], [0.0, 0.412], [-0.2, 0.405], [-0.32, 0.36], [-0.37, 0.22], [-0.38, 0.05]],
    rear: [[0.38, 0.05], [0.37, 0.22], [0.32, 0.35], [0.18, 0.41], [-0.05, 0.42], [-0.24, 0.41], [-0.36, 0.34], [-0.41, 0.22], [-0.42, 0.1]],
    width: [0.25, 0.67],
  },
  sport: {
    front: [[0.42, 0.33], [0.35, 0.35], [0.2, 0.38], [0.03, 0.39], [-0.13, 0.37], [-0.25, 0.3], [-0.32, 0.18], [-0.34, 0.08]],
    rear: [[0.32, 0.16], [0.24, 0.3], [0.1, 0.375], [-0.08, 0.385], [-0.26, 0.36], [-0.4, 0.33], [-0.5, 0.34]],
    width: [0.2, 0.64],
  },
};

function fenders(root, style, paint) {
  const P = PROFILE[style];
  for (const w of WHEELS) {
    const s = Math.sign(w.x);
    const outer = P.width[1] + (style === 'sport' && !w.front ? 0.03 : 0);
    const geo = shellGeometry(w.front ? P.front : P.rear, SECTION[style], s * P.width[0], s * outer, { samples: 36 });
    const f = add(geo, paint, root, `fender_${w.name.slice(-2)}`);
    f.position.set(0, REST_WHEEL_Y, w.z);
  }
}

/**
 * Where a passenger holds on with nobody in front: pillionGripLeft and
 * pillionGripRight, on the rails or either end of a grab strap.
 */
function pillionGrips(root, x, y, z, strap) {
  for (const s of [-1, 1]) {
    const grip = new THREE.Object3D();
    grip.name = s > 0 ? 'pillionGripLeft' : 'pillionGripRight';
    grip.position.set(s * x, y, z);
    grip.userData.strap = strap;
    root.add(grip);
  }
}

/** Footboards with a raised outer lip, grip ribs and a heel guard. */
function footwells(root) {
  for (const s of [-1, 1]) {
    rbox(0.27, 0.024, 0.6, 0.008, MAT.plastic, s * 0.445, 0.325, -0.01, root, s > 0 ? 'footwellLeft' : 'footwellRight');
    rbox(0.024, 0.085, 0.6, 0.01, MAT.plastic, s * 0.574, 0.36, -0.01, root);
    for (let i = 0; i < 7; i++) rbox(0.2, 0.01, 0.016, 0.004, MAT.plastic, s * 0.44, 0.34, -0.25 + i * 0.075, root, undefined, 1);
    rbox(0.24, 0.1, 0.024, 0.01, MAT.plastic, s * 0.45, 0.38, -0.3, root);
  }
}

/** Sport nerf bars: tube loops either side with a footpeg inboard. */
function nerfBars(root) {
  for (const s of [-1, 1]) {
    pipe(mx(s, [[0.2, 0.33, 0.44], [0.5, 0.36, 0.36], [0.56, 0.37, 0.12], [0.56, 0.37, -0.22], [0.5, 0.36, -0.38], [0.2, 0.33, -0.44]]), 0.016, MAT.frame, root, { bend: 0.09, steps: 5 });
    pipe(mx(s, [[0.21, 0.33, 0.26], [0.42, 0.345, 0.22], [0.5, 0.36, 0.08]]), 0.011, MAT.frame, root, { bend: 0.06 });
    pipe(mx(s, [[0.21, 0.33, -0.28], [0.42, 0.345, -0.24], [0.5, 0.36, -0.12]]), 0.011, MAT.frame, root, { bend: 0.06 });
    // Toothed peg.
    const parts = [new THREE.CylinderGeometry(0.016, 0.016, 0.11, 10).rotateZ(Math.PI / 2)];
    for (let k = 0; k < 4; k++) parts.push(new THREE.BoxGeometry(0.006, 0.012, 0.04).translate(-0.04 + k * 0.027, 0.016, 0));
    const peg = add(mergeGeometries(parts), MAT.steel, root, s > 0 ? 'pegLeft' : 'pegRight');
    peg.position.set(s * 0.29, 0.33, -0.06);
  }
}

// Engine and exhaust ---------------------------------------------------------

function buildEngine(root, sport) {
  const engine = new THREE.Group();
  engine.name = 'engine';
  root.add(engine);
  const crankcase = sport
    ? [
        { z: 0.19, w: 0.16, y0: 0.37, y1: 0.52 },
        { z: 0.16, w: 0.25, y0: 0.33, y1: 0.56 },
        { z: -0.12, w: 0.26, y0: 0.32, y1: 0.55 },
        { z: -0.16, w: 0.16, y0: 0.36, y1: 0.5 },
      ]
    : [
        { z: 0.23, w: 0.2, y0: 0.36, y1: 0.52 },
        { z: 0.2, w: 0.28, y0: 0.32, y1: 0.56 },
        { z: -0.12, w: 0.3, y0: 0.31, y1: 0.56 },
        { z: -0.18, w: 0.26, y0: 0.33, y1: 0.52 },
        { z: -0.2, w: 0.18, y0: 0.36, y1: 0.48 },
      ];
  add(loftGeometry(crankcase, { exponent: 3 }), MAT.engine, engine, 'crankcase');
  // Side covers: clutch and flywheel on the two-stroke, the CVT case and pull starter on the four-strokes.
  if (sport) {
    for (const s of [-1, 1]) {
      const cover = add(lathe([[0.105, 0.0], [0.1, 0.015], [0.08, 0.03], [0.001, 0.03]], 20), MAT.engine, engine);
      cover.rotation.z = -s * (Math.PI / 2);
      cover.position.set(s * 0.12, 0.44, s > 0 ? -0.02 : 0.05);
    }
  } else {
    add(
      loftGeometry([
        { z: 0.27, w: 0.06, y0: 0.4, y1: 0.5, x: 0.19 },
        { z: 0.22, w: 0.09, y0: 0.33, y1: 0.57, x: 0.19 },
        { z: 0.1, w: 0.09, y0: 0.32, y1: 0.58, x: 0.19 },
        { z: -0.08, w: 0.09, y0: 0.35, y1: 0.54, x: 0.19 },
        { z: -0.18, w: 0.08, y0: 0.39, y1: 0.5, x: 0.19 },
        { z: -0.21, w: 0.05, y0: 0.42, y1: 0.47, x: 0.19 },
      ], { exponent: 2.6 }),
      MAT.engineDark,
      engine,
    );
    const pull = add(lathe([[0.08, 0.0], [0.075, 0.02], [0.06, 0.035], [0.001, 0.035]], 18), MAT.engineDark, engine);
    pull.rotation.z = Math.PI / 2;
    pull.position.set(-0.15, 0.45, 0.1);
  }

  // Air-cooled cylinder, tilted forward on the four-strokes.
  const tilt = sport ? 0.12 : 0.35;
  const cyl = new THREE.Group();
  cyl.position.set(0, 0.56, sport ? 0.1 : 0.12);
  cyl.rotation.x = tilt;
  engine.add(cyl);
  rbox(0.16, 0.24, 0.16, 0.03, MAT.engine, 0, 0.1, 0, cyl, 'cylinder');
  const fins = sport ? 9 : 6;
  for (let i = 0; i < fins; i++) {
    const fw = sport ? 0.29 - Math.abs(i - 4) * 0.006 : 0.25;
    rbox(fw, 0.009, sport ? 0.27 : 0.23, 0.004, MAT.engine, 0, 0.02 + i * (sport ? 0.024 : 0.03), 0, cyl, undefined, 1);
  }
  rbox(sport ? 0.2 : 0.2, 0.06, sport ? 0.2 : 0.19, 0.025, sport ? MAT.engine : MAT.engineDark, 0, sport ? 0.24 : 0.215, 0, cyl);
  tube([0.04, 0.26, 0.04], [0.06, 0.31, 0.07], 0.009, MAT.rubber, cyl, 6);
  // Carb and intake boot running back to the airbox under the seat.
  tube([0, 0.1, -0.08], [0, 0.12, -0.17], 0.026, MAT.engine, cyl, 10);
  pipe([[0, 0.12, -0.17], [0, 0.16, -0.26], [0, 0.17, -0.4]], 0.03, MAT.rubber, cyl, { bend: 0.06 });
  rbox(0.2, 0.14, 0.22, 0.03, MAT.plastic, 0, 0.66, -0.36, engine);
  return engine;
}

/** Swept tube along a smooth curve with radius varying through the control points. */
function swept(points, radii, mat, parent, samples = 40) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const n = radii.length - 1;
  const r = (t) => {
    const f = t * n;
    const i = Math.min(n - 1, Math.floor(f));
    const k = f - i;
    const e = k * k * (3 - 2 * k);
    return radii[i] + (radii[i + 1] - radii[i]) * e;
  };
  return add(sweepGeometry(curve.getPoints(samples), r, { radial: 14 }), mat, parent);
}

function buildExhaust(engine, sport) {
  const exhaustTip = new THREE.Object3D();
  exhaustTip.name = 'exhaustTip';
  engine.add(exhaustTip);
  if (sport) {
    // Two-stroke expansion chamber: swelling belly down the right, tapering up to a high silencer.
    const blued = new THREE.MeshStandardMaterial({ color: 0x9aa0ab, roughness: 0.28, metalness: 0.9 });
    swept(
      [
        [-0.03, 0.66, 0.2],
        [-0.12, 0.55, 0.4],
        [-0.27, 0.46, 0.32],
        [-0.34, 0.47, 0.04],
        [-0.33, 0.53, -0.28],
        [-0.28, 0.66, -0.5],
        [-0.265, 0.71, -0.58],
      ],
      [0.024, 0.03, 0.05, 0.068, 0.05, 0.026, 0.024],
      blued,
      engine,
      56,
    );
    // Silencer can with a chrome end cap.
    const can = latheZ([[0.03, -0.17], [0.046, -0.15], [0.05, -0.1], [0.046, 0.15], [0.038, 0.17], [0.02, 0.175]], MAT.alloy, -0.26, 0.74, -0.73, engine, 16);
    can.rotation.x = 0.33;
    const tip = latheZ([[0.022, -0.02], [0.022, 0.02], [0.016, 0.02]], MAT.chrome, -0.26, 0.795, -0.89, engine, 12);
    tip.rotation.x = 0.33;
    exhaustTip.position.set(-0.26, 0.81, -0.9);
  } else {
    pipe([[-0.03, 0.67, 0.25], [-0.1, 0.6, 0.42], [-0.24, 0.48, 0.36], [-0.27, 0.46, 0.0], [-0.27, 0.5, -0.5]], 0.025, MAT.exhaust, engine, { bend: 0.1, steps: 6 });
    // Silencer with a heat shield and a chrome tip.
    latheZ([[0.035, -0.22], [0.058, -0.2], [0.064, -0.16], [0.064, 0.16], [0.058, 0.2], [0.035, 0.22], [0.02, 0.22]], MAT.exhaust, -0.27, 0.53, -0.74, engine, 18);
    const shield = add(new THREE.CylinderGeometry(0.07, 0.07, 0.26, 16, 1, true, -0.4, 2.2), MAT.engineDark, engine);
    shield.rotation.x = Math.PI / 2;
    shield.position.set(-0.27, 0.53, -0.72);
    latheZ([[0.02, -0.03], [0.02, 0.03], [0.014, 0.03]], MAT.chrome, -0.27, 0.53, -0.98, engine, 12);
    exhaustTip.position.set(-0.27, 0.53, -1.01);
  }
}

// Frame ----------------------------------------------------------------------

function buildFrame(root, sport) {
  for (const s of [-1, 1]) {
    // Lower cradle rail, up to the steering head at the front and the rear sub-frame at the back.
    pipe(mx(s, [[0.14, 0.62, 0.7], [0.19, 0.36, 0.92], [0.2, 0.3, 0.6], [0.2, 0.3, -0.72], [0.19, 0.66, -0.98]]), 0.02, MAT.frame, root, { bend: 0.12, steps: 6 });
    // Upper rail under the tank and seat.
    pipe(mx(s, [[0.05, 0.78, 0.52], [0.15, 0.74, 0.22], [0.17, 0.74, -0.98]]), 0.017, MAT.frame, root, { bend: 0.1 });
    tube([s * 0.17, 0.74, -0.25], [s * 0.2, 0.3, -0.2], 0.016, MAT.frame, root);
  }
  for (const z of [0.9, 0.58, -0.7]) tube([-0.2, 0.31, z], [0.2, 0.31, z], 0.016, MAT.frame, root);
  tube([-0.17, 0.74, -0.9], [0.17, 0.74, -0.9], 0.016, MAT.frame, root);
  // Skid plate under the engine.
  rbox(0.4, 0.012, 0.86, 0.006, sport ? MAT.alloy : MAT.engineDark, 0, 0.285, 0.12, root, undefined, 1);
  // Steering column.
  tube([0, 0.55, 0.62], [0, 1.0, 0.46], 0.022, MAT.steel, root, 10);
}

// Model ----------------------------------------------------------------------

/**
 * @param {object} [opts]
 * @param {number} [opts.bodyColor] Paint colour for the plastics.
 * @param {string} [opts.dashStyle] 'classic', 'modern' or 'sport', see dash.js.
 * @param {string} [opts.style]     Body style:
 *   'utility'  Honda-style farm quad: racks front and back, footwells, round headlights in the nose, raised pillion;
 *   'utility2' Yamaha-style farm quad: brush guard, square headlights, deeper railed racks, a grey seat, independent rear;
 *   'sport'    two-stroke sport quad: number plate, no racks, nerf bars, expansion chamber, chain drive, a slim pillion pad.
 */
export function buildQuadModel({ bodyColor = 0xa8271f, dashStyle = 'classic', style = 'utility' } = {}) {
  const sport = style === 'sport';
  const cfg = STYLE[style] ?? STYLE.utility;
  const quad = new THREE.Group();
  quad.name = 'quad';
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.3, metalness: 0.0, side: THREE.DoubleSide });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0xe8e8dc, roughness: 0.05, emissive: 0x000000 });
  const seatMat = style === 'utility2' ? new THREE.MeshStandardMaterial({ color: 0x3b3e42, roughness: 0.55 }) : MAT.seat;
  quad.userData.lensMaterial = lensMat;
  const rig = { links: [], shocks: [] };
  quad.userData.suspension = rig;

  const body = new THREE.Group();
  body.name = 'body';
  quad.add(body);
  const root = new THREE.Group();
  root.name = 'bodyRoot';
  body.add(root);

  buildFrame(root, sport);
  const engine = buildEngine(root, sport);
  buildExhaust(engine, sport);

  // Suspension: wishbones at the front, a swingarm or more wishbones at the back.
  for (let i = 0; i < WHEELS.length; i++) {
    const w = WHEELS[i];
    if (w.front || cfg.rear === 'arms') buildArms(root, w, i, cfg, rig);
  }
  if (cfg.rear === 'swingarm') buildSwingarm(root, cfg, sport, rig);
  // Differentials for the shaft-driven axles.
  if (cfg.fwd) rbox(0.16, 0.15, 0.16, 0.04, MAT.engine, 0, REST_WHEEL_Y, WHEELS[0].z, root);
  if (cfg.rear === 'arms') rbox(0.16, 0.15, 0.16, 0.04, MAT.engine, 0, REST_WHEEL_Y, WHEELS[2].z, root);

  fenders(root, style, paint);

  // Body panels, nose and lights.
  if (sport) {
    // Narrow nose cowl carrying the number plate, lamps in a black pod below.
    add(
      loftGeometry([
        { z: 0.3, w: 0.28, y0: 0.7, y1: 0.8 },
        { z: 0.5, w: 0.4, y0: 0.64, y1: 0.785 },
        { z: 0.78, w: 0.42, y0: 0.6, y1: 0.745 },
        { z: 0.9, w: 0.38, y0: 0.58, y1: 0.72 },
        { z: 0.94, w: 0.32, y0: 0.6, y1: 0.69 },
        { z: 0.955, w: 0.22, y0: 0.62, y1: 0.67 },
      ], { exponent: 3.5 }),
      paint,
      root,
      'nose',
    );
    add(
      loftGeometry([
        { z: -0.28, w: 0.26, y0: 0.7, y1: 0.8 },
        { z: -0.5, w: 0.38, y0: 0.69, y1: 0.815 },
        { z: -0.88, w: 0.36, y0: 0.72, y1: 0.835 },
        { z: -0.98, w: 0.3, y0: 0.73, y1: 0.83 },
        { z: -1.02, w: 0.18, y0: 0.75, y1: 0.81 },
      ], { exponent: 3.5 }),
      paint,
      root,
      'tail',
    );
    // Side panels under the seat.
    for (const s of [-1, 1]) {
      const side = rbox(0.03, 0.15, 0.42, 0.014, paint, s * 0.16, 0.71, -0.2, root);
      side.rotation.z = s * 0.12;
    }
    const plate = new THREE.Mesh(new THREE.CircleGeometry(0.11, 28), new THREE.MeshStandardMaterial({ map: numberPlateTexture('7'), roughness: 0.6 }));
    plate.scale.set(1.25, 1, 1);
    plate.position.set(0, 0.7, 0.985);
    plate.rotation.x = -0.25;
    root.add(plate);
    const backing = add(new THREE.CylinderGeometry(0.118, 0.118, 0.012, 28).rotateX(Math.PI / 2), MAT.plastic, root);
    backing.scale.set(1.25, 1, 1);
    backing.position.set(0, 0.699, 0.977);
    backing.rotation.x = -0.25;
    rbox(0.38, 0.09, 0.1, 0.035, MAT.plastic, 0, 0.545, 0.98, root);
    for (const s of [-1, 1]) roundLamp(root, s * 0.12, 0.548, 1.034, 0.032, lensMat, MAT.plastic);
    // Small front bumper and a rear grab bar.
    pipe([[0.18, 0.38, 0.9], [0.26, 0.42, 1.1], [-0.26, 0.42, 1.1], [-0.18, 0.38, 0.9]], 0.016, MAT.frame, root, { bend: 0.07 });
    pipe([[0.16, 0.74, -0.92], [0.2, 0.77, -1.07], [-0.2, 0.77, -1.07], [-0.16, 0.74, -0.92]], 0.015, MAT.frame, root, { bend: 0.07 });
    rbox(0.1, 0.035, 0.015, 0.008, MAT.tail, 0, 0.78, -1.025, root, undefined, 1);
  } else if (style === 'utility2') {
    // Squarer bodywork: square lamps in the fascia, a black lower apron and a tubular brush guard.
    add(
      loftGeometry([
        { z: 0.3, w: 0.42, y0: 0.62, y1: 0.75 },
        { z: 0.45, w: 0.58, y0: 0.6, y1: 0.77 },
        { z: 0.9, w: 0.62, y0: 0.58, y1: 0.775 },
        { z: 1.0, w: 0.62, y0: 0.6, y1: 0.77 },
        { z: 1.025, w: 0.56, y0: 0.62, y1: 0.75 },
      ], { exponent: 7 }),
      paint,
      root,
      'frontPanel',
    );
    add(
      loftGeometry([
        { z: -0.3, w: 0.42, y0: 0.6, y1: 0.77 },
        { z: -0.5, w: 0.58, y0: 0.6, y1: 0.79 },
        { z: -0.98, w: 0.6, y0: 0.6, y1: 0.79 },
        { z: -1.06, w: 0.56, y0: 0.62, y1: 0.77 },
      ], { exponent: 7 }),
      paint,
      root,
      'rearPanel',
    );
    rbox(0.5, 0.12, 0.1, 0.03, MAT.plastic, 0, 0.53, 0.96, root);
    for (const s of [-1, 1]) {
      squareLamp(root, s * 0.19, 0.69, 1.02, 0.13, 0.065, lensMat);
      // Brush guard.
      tube([s * 0.24, 0.45, 1.13], [s * 0.18, 0.4, 0.92], 0.015, MAT.frame, root);
      rbox(0.06, 0.03, 0.012, 0.008, MAT.tail, s * 0.22, 0.7, -1.065, root, undefined, 1);
    }
    pipe([[0.24, 0.4, 1.14], [0.24, 0.8, 1.1], [-0.24, 0.8, 1.1], [-0.24, 0.4, 1.14]], 0.018, MAT.frame, root, { bend: 0.08, steps: 6 });
    tube([-0.24, 0.55, 1.128], [0.24, 0.55, 1.128], 0.015, MAT.frame, root);
    for (const s of [-1, 1]) tube([s * 0.1, 0.55, 1.128], [s * 0.1, 0.8, 1.1], 0.012, MAT.frame, root);
    const skid = rbox(0.44, 0.012, 0.24, 0.006, MAT.frame, 0, 0.38, 1.03, root, undefined, 1);
    skid.rotation.x = -0.25;
    // Rear bumper under the tail lights.
    pipe([[0.2, 0.5, -0.96], [0.25, 0.5, -1.11], [-0.25, 0.5, -1.11], [-0.2, 0.5, -0.96]], 0.017, MAT.frame, root, { bend: 0.07 });
  } else {
    // Rounded hood dropping into a nose with round headlights, and a tubular bumper.
    add(
      loftGeometry([
        { z: 0.3, w: 0.4, y0: 0.62, y1: 0.74 },
        { z: 0.45, w: 0.54, y0: 0.6, y1: 0.75 },
        { z: 0.75, w: 0.58, y0: 0.56, y1: 0.75 },
        { z: 0.95, w: 0.58, y0: 0.5, y1: 0.73 },
        { z: 1.04, w: 0.56, y0: 0.47, y1: 0.685 },
        { z: 1.075, w: 0.5, y0: 0.49, y1: 0.64 },
        { z: 1.085, w: 0.4, y0: 0.51, y1: 0.6 },
      ], { exponent: 5 }),
      paint,
      root,
      'frontPanel',
    );
    add(
      loftGeometry([
        { z: -0.3, w: 0.4, y0: 0.6, y1: 0.76 },
        { z: -0.5, w: 0.54, y0: 0.6, y1: 0.78 },
        { z: -0.95, w: 0.56, y0: 0.58, y1: 0.78 },
        { z: -1.04, w: 0.52, y0: 0.6, y1: 0.75 },
        { z: -1.06, w: 0.44, y0: 0.62, y1: 0.72 },
      ], { exponent: 5 }),
      paint,
      root,
      'rearPanel',
    );
    for (const s of [-1, 1]) {
      roundLamp(root, s * 0.17, 0.57, 1.085, 0.048, lensMat, MAT.chrome, s > 0 ? 'headlightLeft' : 'headlightRight');
      rbox(0.07, 0.035, 0.014, 0.008, MAT.tail, s * 0.14, 0.69, -1.062, root, undefined, 1);
    }
    pipe([[0.16, 0.34, 0.9], [0.21, 0.41, 1.13], [-0.21, 0.41, 1.13], [-0.16, 0.34, 0.9]], 0.017, MAT.frame, root, { bend: 0.07 });
    rbox(0.36, 0.08, 0.06, 0.025, MAT.plastic, 0, 0.44, 1.05, root);
    // Slotted grille between the lamps.
    rbox(0.13, 0.05, 0.02, 0.012, MAT.plastic, 0, 0.555, 1.083, root);
    for (let k = 0; k < 3; k++) rbox(0.11, 0.006, 0.006, 0.002, MAT.hole, 0, 0.541 + k * 0.014, 1.094, root, undefined, 1);
  }
  if (!sport) {
    // Black side covers under the seat.
    for (const s of [-1, 1]) rbox(0.03, 0.14, 0.5, 0.014, MAT.plastic, s * 0.185, 0.69, -0.12, root);
    // Tow hitch: a drawbar out of the frame with a ball on a plate.
    rbox(0.05, 0.05, 0.3, 0.01, MAT.frame, 0, 0.37, -1.0, root);
    rbox(0.1, 0.012, 0.09, 0.004, MAT.frame, 0, 0.4, -1.12, root, undefined, 1);
    tube([0, 0.4, -1.13], [0, 0.43, -1.13], 0.012, MAT.chrome, root);
    const ball = add(new THREE.SphereGeometry(0.024, 14, 10), MAT.chrome, root);
    ball.position.set(0, 0.445, -1.13);
  }

  // Tank cover, with the fuel tap on its left: lever forward for ON, down for RES, back for OFF.
  const tankStations = sport
    ? [
        { z: 0.12, w: 0.2, y0: 0.74, y1: 0.85 },
        { z: 0.2, w: 0.31, y0: 0.72, y1: 0.905 },
        { z: 0.38, w: 0.32, y0: 0.71, y1: 0.92 },
        { z: 0.5, w: 0.24, y0: 0.72, y1: 0.88 },
        { z: 0.54, w: 0.12, y0: 0.74, y1: 0.84 },
      ]
    : [
        { z: 0.13, w: 0.26, y0: 0.72, y1: 0.85 },
        { z: 0.2, w: 0.37, y0: 0.7, y1: 0.9 },
        { z: 0.36, w: 0.38, y0: 0.7, y1: 0.918 },
        { z: 0.46, w: 0.32, y0: 0.7, y1: 0.885 },
        { z: 0.5, w: 0.2, y0: 0.72, y1: 0.84 },
      ];
  add(loftGeometry(tankStations, { exponent: style === 'utility2' ? 5 : 3.2 }), paint, root, 'tank');
  rbox(0.06, 0.03, 0.035, 0.008, MAT.plastic, 0.18, 0.8, 0.3, root, 'fuelTapBody', 1);
  const tap = new THREE.Group();
  tap.name = 'fuelTap';
  tap.userData.keep = true;
  tap.position.set(0.213, 0.8, 0.3);
  root.add(tap);
  const tapLever = add(new RoundedBoxGeometry(0.008, 0.012, 0.045, 1, 0.003), MAT.chrome, tap);
  tapLever.position.z = 0.02;
  const tankCap = add(lathe([[0.036, -0.012], [0.036, 0.004], [0.03, 0.012], [0.001, 0.012]], 18), MAT.chrome, root);
  tankCap.position.set(0, 0.928, 0.36);

  // Racks (utility quads only).
  if (style === 'utility') {
    rack(root, 0.5, 0.98, 0.84, 5, 0.73);
    rack(root, -0.82, -1.04, 0.92, 3, 0.775);
  } else if (style === 'utility2') {
    rack(root, 0.48, 0.98, 0.84, 6, 0.77, 0.06);
    rack(root, -0.8, -1.06, 0.93, 4, 0.79, 0.07);
  }

  // Seats. Utility quads carry a raised pillion seat; the sport quad's long seat
  // squeezes a passenger onto a slim pad at the back, with a grab strap.
  if (sport) {
    add(
      loftGeometry([
        { z: 0.14, w: 0.14, y0: 0.8, y1: 0.85 },
        { z: 0.08, w: 0.25, y0: 0.79, y1: 0.885 },
        { z: -0.08, w: 0.29, y0: 0.78, y1: 0.905, e: 3 },
        { z: -0.5, w: 0.3, y0: 0.78, y1: 0.91, e: 3 },
        { z: -0.8, w: 0.29, y0: 0.79, y1: 0.905, e: 3 },
        { z: -0.87, w: 0.24, y0: 0.8, y1: 0.89 },
        { z: -0.9, w: 0.14, y0: 0.81, y1: 0.87 },
      ], { exponent: 3, segments: 28 }),
      seatMat,
      root,
      'seat',
    );
    add(
      loftGeometry([
        { z: -0.55, w: 0.18, y0: 0.9, y1: 0.94 },
        { z: -0.58, w: 0.26, y0: 0.895, y1: 0.958 },
        { z: -0.74, w: 0.26, y0: 0.895, y1: 0.96 },
        { z: -0.77, w: 0.18, y0: 0.9, y1: 0.945 },
      ], { exponent: 3, segments: 24 }),
      seatMat,
      root,
      'pillionSeat',
    );
    rbox(0.31, 0.012, 0.03, 0.005, MAT.plastic, 0, 0.912, -0.47, root, 'grabStrap', 1);
    pillionGrips(root, 0.09, 0.912, -0.47, true);
  } else {
    add(
      loftGeometry([
        { z: 0.19, w: 0.14, y0: 0.8, y1: 0.85 },
        { z: 0.13, w: 0.26, y0: 0.78, y1: 0.878 },
        { z: 0.02, w: 0.32, y0: 0.76, y1: 0.892, e: 3 },
        { z: -0.2, w: 0.35, y0: 0.76, y1: 0.9, e: 3 },
        { z: -0.4, w: 0.36, y0: 0.76, y1: 0.9, e: 3 },
        { z: -0.46, w: 0.33, y0: 0.77, y1: 0.89 },
        { z: -0.49, w: 0.24, y0: 0.78, y1: 0.87 },
      ], { exponent: 3, bottom: 8, segments: 28 }),
      seatMat,
      root,
      'seat',
    );
    add(
      loftGeometry([
        { z: -0.38, w: 0.26, y0: 0.88, y1: 0.96 },
        { z: -0.42, w: 0.35, y0: 0.865, y1: 0.998 },
        { z: -0.6, w: 0.38, y0: 0.86, y1: 1.01, e: 3 },
        { z: -0.78, w: 0.36, y0: 0.865, y1: 1.0 },
        { z: -0.82, w: 0.26, y0: 0.88, y1: 0.97 },
      ], { exponent: 3.2, segments: 28 }),
      seatMat,
      root,
      'pillionSeat',
    );
    rbox(0.34, 0.1, 0.38, 0.03, MAT.plastic, 0, 0.82, -0.6, root, 'pillionBase');
    for (const s of [-1, 1]) {
      pipe(mx(s, [[0.2, 0.84, -0.4], [0.25, 0.99, -0.44], [0.25, 0.99, -0.78], [0.2, 0.84, -0.82]]), 0.013, MAT.chrome, root, { bend: 0.05, steps: 5 });
    }
    pillionGrips(root, 0.25, 0.99, -0.55, false);
  }

  // Where the rider's feet go: footwells on the utilities, nerf bars and pegs on the sport quad.
  if (sport) nerfBars(root);
  else footwells(root);

  // Handlebars.
  const bars = buildHandlebars(dashStyle, cfg);
  if (sport) {
    // Motocross bars with a padded crossbar, ahead of the dash so it doesn't block the display.
    for (const s of [-1, 1]) tube([s * 0.2, 0.065, -0.01], [s * 0.17, 0.18, 0.08], 0.01, MAT.alloy, bars);
    tube([-0.17, 0.18, 0.08], [0.17, 0.18, 0.08], 0.011, MAT.alloy, bars);
    const pad = add(new THREE.CapsuleGeometry(0.02, 0.13, 4, 10).rotateZ(Math.PI / 2), MAT.plastic, bars, 'barPad');
    pad.position.set(0, 0.18, 0.08);
  }
  quad.userData.dash = bars.userData.dash;
  bars.position.set(0, 1.0, 0.46);
  root.add(bars);

  // Anchors for people and the camera.
  const riderAnchor = new THREE.Object3D();
  riderAnchor.name = 'riderAnchor';
  riderAnchor.position.set(0, 0.9, -0.18);
  root.add(riderAnchor);
  const pillionAnchor = new THREE.Object3D();
  pillionAnchor.name = 'pillionAnchor';
  pillionAnchor.position.set(0, sport ? 0.98 : 1.0, sport ? -0.66 : -0.6);
  root.add(pillionAnchor);
  const cameraAnchor = new THREE.Object3D();
  cameraAnchor.name = 'cameraAnchor';
  // The rider's eyes: 0.79 m above the seat, as for someone of the player's standing
  // eye height (1.62 m). Any lower and you sit shorter than she does behind you.
  cameraAnchor.position.set(0, 1.69, -0.22);
  root.add(cameraAnchor);

  // Wheels sit outside the body so they don't rock with it.
  for (const w of WHEELS) {
    const width = w.front ? 0.22 : sport ? 0.29 : 0.25;
    const wheel = buildWheel(w, width, style, cfg);
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

export function setHeadlights(quad, on) {
  const lens = quad.userData.lensMaterial;
  lens.emissive.setHex(on ? 0xfff2cc : 0x000000);
  lens.emissiveIntensity = on ? 1.2 : 0;
}
