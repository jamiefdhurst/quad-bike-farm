import * as THREE from 'three';
import { WHEELS } from './quadPhysics.js';

// Farm quad built from primitives. One group with named parts so it can be
// replaced by a real model later without touching the code that drives it:
//
//   quad
//   ├── body                  rocked by vibration
//   │   └── bodyRoot          ground-referenced parts (y = 0 is the ground at rest)
//   │       ├── seat, pillionSeat, frame, engine, fenders, racks …
//   │       ├── handlebars    steering pivot; holds dash, rpmNeedle, tempLight,
//   │       │                 ignitionLight, chokeLever, riderHands
//   │       └── riderAnchor, pillionAnchor, cameraAnchor
//   └── wheel_fl / wheel_fr / wheel_rl / wheel_rr  (each with a 'spin' child)
//
// +Z is forward and +X is the rider's left.

const MAT = {
  red: new THREE.MeshStandardMaterial({ color: 0xa8271f, roughness: 0.42, metalness: 0.05 }),
  black: new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6 }),
  seat: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.5 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.45, metalness: 0.6 }),
  engine: new THREE.MeshStandardMaterial({ color: 0x8a8c8e, roughness: 0.5, metalness: 0.5 }),
  rim: new THREE.MeshStandardMaterial({ color: 0xb4b6b8, roughness: 0.35, metalness: 0.7 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xd0d2d4, roughness: 0.2, metalness: 0.9 }),
  exhaust: new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.7, metalness: 0.4 }),
  lens: new THREE.MeshStandardMaterial({ color: 0xe8e8dc, roughness: 0.1, emissive: 0x000000 }),
  glove: new THREE.MeshStandardMaterial({ color: 0x2d3a26, roughness: 0.8 }),
  sleeve: new THREE.MeshStandardMaterial({ color: 0x3f4d34, roughness: 0.9 }),
  dashFace: new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.35 }),
};

function box(w, h, d, mat, x, y, z, parent, name) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (name) m.name = name;
  parent.add(m);
  return m;
}

/** Tube between two points. */
function tube(a, b, r, mat, parent, segments = 10) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const len = start.distanceTo(end);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, segments), mat);
  m.position.copy(start).add(end).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
  parent.add(m);
  return m;
}

/** Fender: an arched side profile extruded across the given width. */
function fender(width, radius, startDeg, endDeg, mat) {
  const shape = new THREE.Shape();
  const t = 0.05;
  const a0 = (startDeg * Math.PI) / 180;
  const a1 = (endDeg * Math.PI) / 180;
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const p = [Math.cos(a) * (radius + t), Math.sin(a) * (radius + t)];
    if (i === 0) shape.moveTo(...p);
    else shape.lineTo(...p);
  }
  for (let i = steps; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / steps;
    shape.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 });
  geo.translate(0, 0, -width / 2);
  // Profile is drawn in the XY plane (x = forward); turn it so it runs along Z.
  geo.rotateY(-Math.PI / 2);
  return new THREE.Mesh(geo, mat);
}

function treadTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#151515';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#262626';
  for (let i = 0; i < 16; i++) {
    const x = i * 16;
    ctx.beginPath();
    ctx.moveTo(x, 4);
    ctx.lineTo(x + 8, 30);
    ctx.lineTo(x, 60);
    ctx.lineTo(x + 5, 60);
    ctx.lineTo(x + 13, 30);
    ctx.lineTo(x + 5, 4);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

function buildWheel(radius, width, treadMat) {
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  spin.name = 'spin';
  wheel.add(spin);
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 28, 1, false), [
    treadMat,
    MAT.black,
    MAT.black,
  ]);
  tyre.rotation.z = Math.PI / 2;
  spin.add(tyre);
  // Rounded shoulders.
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.TorusGeometry(radius - 0.035, 0.035, 8, 28), MAT.black);
    shoulder.rotation.y = Math.PI / 2;
    shoulder.position.x = (s * width) / 2;
    spin.add(shoulder);
  }
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.6, radius * 0.6, width * 1.02, 18), MAT.rim);
  rim.rotation.z = Math.PI / 2;
  spin.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, width * 1.1, 8), MAT.steel);
  hub.rotation.z = Math.PI / 2;
  spin.add(hub);
  // Lug detail so the spin is visible.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const lug = new THREE.Mesh(new THREE.BoxGeometry(width * 1.06, 0.03, 0.03), MAT.steel);
    lug.position.set(0, Math.cos(a) * 0.1, Math.sin(a) * 0.1);
    spin.add(lug);
  }
  return wheel;
}

function dialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0c0c0c';
  ctx.beginPath();
  ctx.arc(128, 128, 126, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#9a9a9a';
  ctx.lineWidth = 5;
  ctx.stroke();
  // 0 to 10 thousand rpm over 270 degrees, starting bottom left.
  const start = Math.PI * 0.75;
  const sweep = Math.PI * 1.5;
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#c0221a';
  ctx.beginPath();
  ctx.arc(128, 128, 104, start + sweep * 0.75, start + sweep);
  ctx.stroke();
  ctx.fillStyle = '#eeeeee';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 10; i++) {
    const a = start + (sweep * i) / 10;
    ctx.strokeStyle = i >= 8 ? '#ff4433' : '#eeeeee';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112);
    ctx.lineTo(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92);
    ctx.stroke();
    if (i % 2 === 0) ctx.fillText(String(i), 128 + Math.cos(a) * 72, 128 + Math.sin(a) * 72);
  }
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#aaaaaa';
  ctx.fillText('x1000 rpm', 128, 180);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function labelTexture(text) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 48;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0e0e0e';
  ctx.fillRect(0, 0, 128, 48);
  ctx.fillStyle = '#cfcfcf';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 26);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const DIAL_START_ANGLE = Math.PI * 0.75;
export const DIAL_SWEEP = Math.PI * 1.5;
export const DIAL_MAX_RPM = 10000;

function buildHandlebars() {
  const bars = new THREE.Group();
  bars.name = 'handlebars';

  // Bar with a slight sweep back towards the rider.
  tube([0.4, 0.07, -0.06], [0.2, 0.06, -0.01], 0.014, MAT.chrome, bars);
  tube([0.2, 0.06, -0.01], [-0.2, 0.06, -0.01], 0.014, MAT.chrome, bars);
  tube([-0.2, 0.06, -0.01], [-0.4, 0.07, -0.06], 0.014, MAT.chrome, bars);
  tube([0, 0, 0], [0, 0.06, -0.01], 0.02, MAT.steel, bars);
  for (const s of [-1, 1]) {
    const grip = tube([s * 0.33, 0.068, -0.045], [s * 0.42, 0.071, -0.065], 0.02, MAT.black, bars);
    grip.name = s > 0 ? 'gripLeft' : 'gripRight';
    // Brake levers ahead of the grips.
    tube([s * 0.27, 0.075, 0.0], [s * 0.39, 0.07, 0.01], 0.006, MAT.steel, bars);
  }

  // Dash pod in the middle, face tilted towards the rider.
  const dash = new THREE.Group();
  dash.name = 'dash';
  dash.position.set(0, 0.1, 0.02);
  dash.rotation.x = 0.75;
  bars.add(dash);
  box(0.24, 0.13, 0.07, MAT.black, 0, 0, 0.0, dash, 'dashHousing');
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.11), MAT.dashFace);
  face.position.set(0, 0, -0.0351);
  face.rotation.y = Math.PI;
  dash.add(face);

  const dial = new THREE.Mesh(
    new THREE.CircleGeometry(0.048, 32),
    new THREE.MeshBasicMaterial({ map: dialTexture(), toneMapped: false }),
  );
  dial.name = 'rpmDial';
  dial.position.set(0.035, 0, -0.036);
  dial.rotation.y = Math.PI;
  dash.add(dial);
  const needlePivot = new THREE.Group();
  needlePivot.name = 'rpmNeedle';
  needlePivot.position.set(0.035, 0, -0.038);
  needlePivot.rotation.y = Math.PI;
  dash.add(needlePivot);
  const needle = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.0035, 0.001),
    new THREE.MeshBasicMaterial({ color: 0xff5522, toneMapped: false }),
  );
  needle.position.x = 0.018;
  needlePivot.add(needle);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(0.006, 12), new THREE.MeshBasicMaterial({ color: 0x222222 }));
  cap.position.z = 0.0005;
  needlePivot.add(cap);

  // Warning lights with labels underneath.
  const light = (name, x, y, label) => {
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.011, 16),
      new THREE.MeshBasicMaterial({ color: 0x1a1a1a, toneMapped: false }),
    );
    lens.name = name;
    lens.position.set(x, y, -0.037);
    lens.rotation.y = Math.PI;
    dash.add(lens);
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.036, 0.0135),
      new THREE.MeshBasicMaterial({ map: labelTexture(label), toneMapped: false }),
    );
    plate.position.set(x, y - 0.02, -0.037);
    plate.rotation.y = Math.PI;
    dash.add(plate);
  };
  light('tempLight', -0.065, 0.028, 'TEMP');
  light('ignitionLight', -0.065, -0.022, 'IGN');

  // Choke lever on the left bar, inboard of the grip. Rotates about X.
  const chokeHousing = box(0.03, 0.025, 0.03, MAT.black, 0.29, 0.07, -0.03, bars, 'chokeHousing');
  chokeHousing.rotation.y = 0.2;
  const choke = new THREE.Group();
  choke.name = 'chokeLever';
  choke.position.set(0.29, 0.085, -0.03);
  bars.add(choke);
  const lever = box(0.01, 0.055, 0.012, MAT.chrome, 0, 0.026, 0, choke);
  const knob = box(0.018, 0.012, 0.016, new THREE.MeshStandardMaterial({ color: 0xd8c020, roughness: 0.5 }), 0, 0.055, 0, choke);
  lever.name = 'chokeLeverArm';
  knob.name = 'chokeLeverKnob';

  // Thumb throttle on the right.
  box(0.012, 0.03, 0.02, MAT.black, -0.32, 0.06, -0.06, bars, 'thumbThrottle');

  // The rider's gloves and forearms, only shown while riding.
  const hands = new THREE.Group();
  hands.name = 'riderHands';
  hands.visible = false;
  for (const s of [-1, 1]) {
    const glove = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.06, 4, 8), MAT.glove);
    glove.position.set(s * 0.375, 0.075, -0.055);
    glove.rotation.z = Math.PI / 2;
    hands.add(glove);
    tube([s * 0.37, 0.09, -0.08], [s * 0.33, 0.17, -0.24], 0.032, MAT.sleeve, hands);
  }
  bars.add(hands);

  return bars;
}

export function buildQuadModel() {
  const quad = new THREE.Group();
  quad.name = 'quad';

  const body = new THREE.Group();
  body.name = 'body';
  quad.add(body);
  const root = new THREE.Group();
  root.name = 'bodyRoot';
  body.add(root);

  // Frame rails and engine.
  for (const s of [-1, 1]) {
    tube([s * 0.2, 0.32, -0.95], [s * 0.2, 0.32, 0.9], 0.022, MAT.steel, root);
    tube([s * 0.2, 0.32, 0.9], [s * 0.18, 0.62, 0.75], 0.02, MAT.steel, root);
    tube([s * 0.2, 0.32, -0.95], [s * 0.2, 0.7, -0.9], 0.02, MAT.steel, root);
  }
  const engine = new THREE.Group();
  engine.name = 'engine';
  root.add(engine);
  box(0.3, 0.3, 0.42, MAT.engine, 0, 0.44, 0.02, engine, 'crankcase');
  const cylinder = box(0.2, 0.22, 0.2, MAT.engine, 0, 0.66, 0.16, engine, 'cylinder');
  cylinder.rotation.x = 0.35;
  for (let i = 0; i < 5; i++) {
    const fin = box(0.26, 0.012, 0.25, MAT.engine, 0, 0.58 + i * 0.035, 0.15 + i * 0.012, engine);
    fin.rotation.x = 0.35;
  }
  // Exhaust down the right-hand side to a silencer under the rear fender.
  tube([-0.06, 0.62, 0.32], [-0.2, 0.5, 0.38], 0.032, MAT.exhaust, engine);
  tube([-0.2, 0.5, 0.38], [-0.28, 0.48, 0.0], 0.032, MAT.exhaust, engine);
  tube([-0.28, 0.48, 0.0], [-0.3, 0.56, -0.5], 0.032, MAT.exhaust, engine);
  const silencer = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 14), MAT.exhaust);
  silencer.rotation.x = Math.PI / 2;
  silencer.position.set(-0.3, 0.57, -0.72);
  engine.add(silencer);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.08, 10), MAT.chrome);
  tip.rotation.x = Math.PI / 2;
  tip.position.set(-0.3, 0.57, -0.96);
  engine.add(tip);

  // Fenders over each wheel and the body panels joining them.
  for (const w of WHEELS) {
    const f = fender(0.32, 0.36, w.front ? 10 : 18, w.front ? 165 : 172, MAT.red);
    f.position.set(w.x * 1.02, 0.3, w.z);
    f.name = `fender_${w.name.slice(-2)}`;
    root.add(f);
  }
  box(0.68, 0.14, 0.62, MAT.red, 0, 0.72, 0.68, root, 'frontPanel');
  box(0.6, 0.18, 0.12, MAT.red, 0, 0.62, 1.0, root, 'nose');
  box(0.68, 0.12, 0.6, MAT.red, 0, 0.74, -0.68, root, 'rearPanel');
  box(0.38, 0.16, 0.34, MAT.red, 0, 0.84, 0.32, root, 'tank');
  const tankCap = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 12), MAT.chrome);
  tankCap.position.set(0, 0.93, 0.36);
  root.add(tankCap);

  // Headlights on the nose; they glow with the ignition on.
  for (const s of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.05, 16), MAT.black);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(s * 0.18, 0.64, 1.07);
    root.add(lamp);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.048, 16), MAT.lens);
    lens.position.set(s * 0.18, 0.64, 1.096);
    lens.name = s > 0 ? 'headlightLeft' : 'headlightRight';
    root.add(lens);
  }

  // Racks.
  const rack = (z0, z1, y) => {
    for (const s of [-1, 1]) tube([s * 0.42, y, z0], [s * 0.42, y, z1], 0.014, MAT.black, root);
    for (let i = 0; i <= 4; i++) {
      const z = z0 + ((z1 - z0) * i) / 4;
      tube([-0.42, y, z], [0.42, y, z], 0.011, MAT.black, root);
    }
  };
  rack(0.5, 0.98, 0.84);
  rack(-0.82, -1.04, 0.92);
  for (const s of [-1, 1]) {
    tube([s * 0.42, 0.84, 0.98], [s * 0.36, 0.74, 1.0], 0.012, MAT.black, root);
    tube([s * 0.42, 0.92, -1.04], [s * 0.34, 0.78, -1.0], 0.012, MAT.black, root);
  }

  // Seats: the rider's, and a raised pillion seat behind it.
  const seat = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.48, 4, 12), MAT.seat);
  seat.name = 'seat';
  seat.rotation.x = Math.PI / 2;
  seat.scale.set(1.7, 1, 0.55);
  seat.position.set(0, 0.84, -0.16);
  root.add(seat);
  const pillion = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.24, 4, 12), MAT.seat);
  pillion.name = 'pillionSeat';
  pillion.rotation.x = Math.PI / 2;
  pillion.scale.set(1.85, 1, 0.8);
  pillion.position.set(0, 0.93, -0.6);
  root.add(pillion);
  box(0.34, 0.1, 0.34, MAT.black, 0, 0.84, -0.6, root, 'pillionBase');
  for (const s of [-1, 1]) {
    tube([s * 0.25, 1.0, -0.78], [s * 0.25, 1.0, -0.44], 0.014, MAT.chrome, root);
    tube([s * 0.25, 1.0, -0.78], [s * 0.22, 0.86, -0.8], 0.014, MAT.chrome, root);
    tube([s * 0.25, 1.0, -0.44], [s * 0.22, 0.86, -0.42], 0.014, MAT.chrome, root);
  }

  // Footwells.
  for (const s of [-1, 1]) {
    box(0.22, 0.03, 0.62, MAT.black, s * 0.44, 0.32, -0.02, root, s > 0 ? 'footwellLeft' : 'footwellRight');
    box(0.03, 0.12, 0.62, MAT.black, s * 0.555, 0.37, -0.02, root);
  }

  // Steering column and handlebars.
  tube([0, 0.55, 0.62], [0, 1.0, 0.46], 0.024, MAT.steel, root);
  const bars = buildHandlebars();
  bars.position.set(0, 1.0, 0.46);
  root.add(bars);

  // Anchors for people and the camera.
  const riderAnchor = new THREE.Object3D();
  riderAnchor.name = 'riderAnchor';
  riderAnchor.position.set(0, 0.9, -0.18);
  root.add(riderAnchor);
  const pillionAnchor = new THREE.Object3D();
  pillionAnchor.name = 'pillionAnchor';
  pillionAnchor.position.set(0, 1.0, -0.6);
  root.add(pillionAnchor);
  const cameraAnchor = new THREE.Object3D();
  cameraAnchor.name = 'cameraAnchor';
  cameraAnchor.position.set(0, 1.55, -0.22);
  root.add(cameraAnchor);

  // Wheels sit outside the body so they don't rock with it.
  const treadMat = new THREE.MeshStandardMaterial({ map: treadTexture(), roughness: 0.95 });
  for (const w of WHEELS) {
    const wheel = buildWheel(0.3, w.front ? 0.22 : 0.25, treadMat);
    wheel.name = w.name;
    quad.add(wheel);
  }

  quad.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return quad;
}

export function setHeadlights(quad, on) {
  MAT.lens.emissive.setHex(on ? 0xfff2cc : 0x000000);
  MAT.lens.emissiveIntensity = on ? 1.2 : 0;
}
