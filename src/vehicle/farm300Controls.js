import { part } from './part.js';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { sweepGeometry } from './quadGeometry.js';

// The red quad's bar controls (TODO 88), after the real machine's: a black switch pod on the left bar (a yellow LIGHTS rocker, a white
// HI / LO rocker, a red RUN / OFF engine-stop rocker, a start button and a ridged black choke slider in a slot), levers with a proper
// shape and a latch on the left one for the parking brake, and a labelled 2WD / 4WD rocker on the right. Every part the game poses
// keeps the name it always had (chokeLever, parkBrakeLever, parkBrakeCatch, driveSwitchRocker); the pod's own are lightsRocker,
// beamRocker, stopRocker and startButton (poseBarPod). Built in the bars' frame, +X the rider's left, the rider along -Z.

const strip = (g) => {
  g.deleteAttribute('uv');
  return g;
};

function rb(w, h, d, r, mat, x, y, z, parent, name, segments = 2) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, segments, Math.min(r, w / 2, h / 2, d / 2) * 0.999), mat);
  m.position.set(x, y, z);
  if (name) m.name = name;
  parent.add(m);
  return m;
}

export function labelMaterial(w, h, px, draw) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * px);
  c.height = Math.round(h * px);
  const g = c.getContext('2d');
  draw(g, c.width, c.height, px);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
}

/** Text drawn at pod-face metres (x right, y up from the face's middle) onto a canvas of `px` pixels a metre. */
export function put(g, W, H, px, text, x, y, size, { box = false, rot = 0, ink = '#e9e9e6' } = {}) {
  g.save();
  g.translate(W / 2 + x * px, H / 2 - y * px);
  g.rotate(rot);
  g.font = `900 ${size * px}px Helvetica, Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = ink;
  g.strokeStyle = ink;
  g.fillText(text, 0, 0);
  if (box) {
    const w = g.measureText(text).width + size * px * 0.5;
    g.lineWidth = Math.max(1, size * px * 0.08);
    g.strokeRect(-w / 2, -size * px * 0.62, w, size * px * 1.24);
  }
  g.restore();
}

export const POD = { w: 0.064, h: 0.11, d: 0.05, cy: -0.0089, rock: 0.18, slide: 0.03 };

/**
 * The left switch pod, built with its face towards +Z, +X to the picture's right, then turned to face the rider (the caller places
 * it). Positions are in metres from the middle of the lights rocker's row, as measured off a photo of the real pod (x right, y up).
 * Returns the group; its parts are found by name.
 */
export function buildLeftPod(MAT) {
  const pod = new THREE.Group();
  pod.name = 'controlPod';
  pod.userData.keep = true;
  pod.scale.setScalar(0.85); // the real pod is about 11 cm tall with its foot; the game's bars are a little small for that
  const body = MAT.plastic;
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe0bd1c, roughness: 0.5 });
  const white = new THREE.MeshStandardMaterial({ color: 0xd8d8d2, roughness: 0.5 });
  const red = new THREE.MeshStandardMaterial({ color: 0xbd1d14, roughness: 0.5 });
  const front = POD.d / 2;
  const dots = (parent, w, h, cols, rows) => {
    const list = [];
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) list.push(strip(new THREE.CylinderGeometry(0.0021, 0.0021, 0.0016, 6)).rotateX(Math.PI / 2).translate(((i + 0.5) / cols - 0.5) * w * 0.7, ((j + 0.5) / rows - 0.5) * h * 0.6, 0.0095));
    parent.add(new THREE.Mesh(mergeGeometries(list), parent.userData.mat));
  };
  const rocker = (name, x, y, w, h, mat) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, front);
    g.userData.mat = mat;
    pod.add(g);
    rb(w, h, 0.011, 0.003, mat, 0, 0, 0.0035, g, `${name}Cap`);
    dots(g, w, h, 3, 3);
    return g;
  };

  // The body (square-edged enough that the lettering on its face lies flat) and the clamp it hangs from behind.
  rb(POD.w, POD.h, POD.d, 0.002, body, 0, POD.cy, 0, pod, 'podBody', 1);
  rb(0.03, 0.02, 0.02, 0.004, body, 0.012, 0.012, -0.034, pod);

  // The lettering, on a plane lying on the body's face. `at` converts the photo's coordinates to the plane's.
  const face = labelMaterial(POD.w, POD.h, 4200, (g, W, H, px) => {
    const at = (x, y, text, size, o) => put(g, W, H, px, text, x, y - POD.cy, size, o);
    at(-0.0163, 0.032, 'LIGHTS', 0.0075, { box: true });
    at(0.0168, 0.0402, 'OFF', 0.0062);
    at(0.0168, -0.0035, 'ON', 0.0062);
    at(-0.0172, 0.0105, 'HI', 0.0072);
    at(-0.0172, -0.0315, 'LO', 0.0072);
    at(0.0053, -0.0245, 'RUN', 0.0066, { box: true });
    at(-0.0252, -0.0455, 'OFF', 0.0058, { rot: -Math.PI / 2 });
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(POD.w * 0.97, POD.h * 0.97), face);
  plane.position.set(0, POD.cy, front + 0.0001);
  plane.name = 'podLabels';
  pod.add(plane);

  // The yellow lights rocker (OFF at the top, ON at the bottom): the bottom end in for ON. The white HI / LO rocker below it on the left.
  rocker('lightsRocker', 0.0168, 0.0209, 0.0213, 0.032, yellow);
  rocker('beamRocker', -0.0172, -0.0088, 0.0205, 0.029, white);
  // The red engine stop, a pair of wedges with a split between, the OFF on its left.
  const stop = new THREE.Group();
  stop.name = 'stopRocker';
  stop.position.set(0.0015, -0.0455, front + 0.002);
  pod.add(stop);
  for (const s of [-1, 1]) rb(0.0205, 0.021, 0.011, 0.003, red, s * 0.0108, 0, 0.0035, stop, undefined, 1);

  // The foot under the body, standing out towards the rider: the choke's slot and slider on its top, the start button on its front.
  const footY = -0.0707;
  rb(0.082, 0.014, 0.062, 0.003, body, 0.0125, footY, 0.034, pod, 'chokePlate', 1);
  rb(0.05, 0.0015, 0.009, 0.0008, MAT.hole, 0.0275, footY + 0.0073, 0.05, pod, 'chokeSlot', 1);
  const footTop = footY + 0.007;
  const plateLabel = labelMaterial(0.05, 0.012, 5200, (g, W, H, px) => {
    put(g, W, H, px, 'CHOKE', 0.006, 0, 0.0085);
    g.strokeStyle = '#e9e9e6';
    g.lineWidth = H * 0.1;
    g.beginPath();
    g.moveTo(W * 0.04, H * 0.5);
    g.lineTo(W * 0.2, H * 0.5);
    g.moveTo(W * 0.04, H * 0.5);
    g.lineTo(W * 0.1, H * 0.3);
    g.moveTo(W * 0.04, H * 0.5);
    g.lineTo(W * 0.1, H * 0.7);
    g.stroke();
  });
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.012), plateLabel);
  pl.rotation.x = -Math.PI / 2;
  pl.position.set(0.0275, footTop + 0.0004, 0.032);
  pod.add(pl);
  const choke = new THREE.Group();
  choke.name = 'chokeLever';
  choke.userData.keep = true;
  choke.position.set(0.0405, footTop + 0.001, 0.05);
  choke.userData.baseX = choke.position.x;
  pod.add(choke);
  const grey = new THREE.MeshStandardMaterial({ color: 0x5a5d61, roughness: 0.6 });
  rb(0.022, 0.013, 0.016, 0.003, grey, 0, 0.0065, 0, choke, 'chokeLeverKnob', 1);
  const ribs = [];
  for (let i = 0; i < 4; i++) ribs.push(strip(new THREE.BoxGeometry(0.0024, 0.0024, 0.014)).translate(-0.0075 + i * 0.005, 0.0138, 0));
  choke.add(new THREE.Mesh(mergeGeometries(ribs), MAT.frame));
  choke.add(new THREE.Mesh(strip(new THREE.BoxGeometry(0.0035, 0.0016, 0.013)).translate(0.0125, 0.0138, 0), new THREE.MeshStandardMaterial({ color: 0xe9e9e4, roughness: 0.6 }))); // a white index mark on its edge
  // The start button on the foot's front face, low on the left, with its symbol.
  const start = new THREE.Group();
  start.name = 'startButton';
  start.position.set(-0.0165, footY, 0.0655);
  pod.add(start);
  rb(0.016, 0.011, 0.007, 0.003, body, 0, 0, 0, start, undefined, 1);
  const sym = labelMaterial(0.011, 0.008, 7000, (g, W, H) => {
    g.strokeStyle = '#e9e9e6';
    g.lineWidth = H * 0.1;
    g.beginPath();
    g.arc(W / 2, H / 2, H * 0.36, 0.4, Math.PI * 1.7);
    g.stroke();
    g.beginPath();
    g.moveTo(W * 0.56, H * 0.14);
    g.lineTo(W * 0.46, H * 0.52);
    g.lineTo(W * 0.54, H * 0.5);
    g.lineTo(W * 0.44, H * 0.88);
    g.stroke();
  });
  const symPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.011, 0.008), sym);
  symPlane.position.set(0, 0, 0.0036);
  start.add(symPlane);
  return pod;
}

/** Poses the pod: the lights rocker (ON: bottom in), the HI / LO rocker (HI: top in), the stop rocker (RUN when the key is on) and the start button. */
export function poseBarPod(model, { lights = 'low', keyOn = false, cranking = false } = {}) {
  const parts = (model.userData.barPod ??= {
    lights: model.getObjectByName('lightsRocker'),
    beam: model.getObjectByName('beamRocker'),
    stop: model.getObjectByName('stopRocker'),
    start: model.getObjectByName('startButton'),
  });
  if (!parts.lights) return;
  if (!parts.stop) {
    parts.lights.rotation.x = lights === 'off' ? -POD.rock : POD.rock; // a plain on / off rocker (the yellow's): top in for off, bottom in for on
    return;
  }
  if (parts.lights.userData.sideways) {
    parts.lights.rotation.y = lights === 'high' ? POD.rock : lights === 'off' ? -POD.rock : 0; // the RB300's: OFF left, dipped in the middle, main beam right
  } else if (parts.beam) {
    parts.lights.rotation.x = lights === 'off' ? -POD.rock : POD.rock;
    parts.beam.rotation.x = lights === 'high' ? -POD.rock : POD.rock;
  } else {
    parts.lights.rotation.x = lights === 'high' ? -POD.rock : lights === 'off' ? POD.rock : 0; // the blue's one rocker: HI at the top (top in), LO in the middle, OFF at the bottom
  }
  parts.stop.rotation.y = keyOn ? 0.14 : -0.14;
  parts.start.userData.z0 ??= parts.start.position.z;
  parts.start.position.z = parts.start.userData.z0 - (cranking ? 0.004 : 0);
}

/**
 * A brake lever and its perch (`s`: +1 for the left, -1 for the right), the lever tapered with a ball end. The left one is the parking
 * brake: `parkBrakeLever` turns to squeeze it, and a latch (`parkBrakeCatch`, shown only while it is held) swings out of a slot in
 * the perch to hold it. The perch's own parts are plain black plastic with an adjuster barrel where the cable goes in.
 */
export function buildBrakeLever(bars, s, MAT) {
  const g = new THREE.Group();
  g.position.set(s * 0.262, 0.066, -0.018);
  g.userData.keep = true;
  bars.add(g);
  // The perch: a clamp body, a cable adjuster barrel and (left) the slot the latch comes out of.
  rb(0.034, 0.028, 0.036, 0.008, MAT.plastic, 0, 0, 0, bars, undefined).position.set(s * 0.262, 0.066, -0.018);
  const barrel = new THREE.Mesh(strip(new THREE.CylinderGeometry(0.006, 0.006, 0.014, 8)).rotateZ(Math.PI / 2), MAT.alloy);
  barrel.position.set(s * 0.246, 0.07, 0.003);
  bars.add(barrel);
  const path = new THREE.CatmullRomCurve3([[0, 0.004, 0.006], [s * 0.028, 0.01, 0.012], [s * 0.138, 0.01, -0.016], [s * 0.156, 0.006, -0.028]].map((p) => new THREE.Vector3(...p)), false, 'centripetal').getPoints(14);
  const blade = sweepGeometry(path.map((p) => [p.x, p.y, p.z]), (t) => 0.0085 - 0.0042 * t, { radial: 8 });
  g.add(new THREE.Mesh(blade, MAT.frame));
  const ball = new THREE.Mesh(strip(new THREE.SphereGeometry(0.0072, 8, 6)), MAT.frame);
  ball.position.set(s * 0.157, 0.006, -0.029);
  g.add(ball);
  g.add(new THREE.Mesh(strip(new THREE.CylinderGeometry(0.0055, 0.0055, 0.034, 8)).rotateX(Math.PI / 2).translate(0, 0.002, 0.004), MAT.chrome)); // the pivot pin
  if (s > 0) {
    g.name = 'parkBrakeLever';
    // The slot, and the latch that swings out of it over the lever when it is squeezed in: a black pawl with a red button.
    rb(0.016, 0.006, 0.012, 0.002, MAT.hole, 0.292, 0.083, -0.012, bars, 'parkBrakeSlot', 1);
    const latch = new THREE.Group();
    latch.name = 'parkBrakeCatch';
    latch.position.set(0.292, 0.09, -0.012);
    latch.visible = false;
    bars.add(latch);
    rb(0.012, 0.008, 0.02, 0.003, MAT.frame, 0, 0, 0, latch, undefined, 1);
    rb(0.008, 0.005, 0.01, 0.002, new THREE.MeshStandardMaterial({ color: 0xc01818, roughness: 0.5 }), 0, 0.0055, -0.004, latch, undefined, 1);
  }
  return g;
}

/**
 * The 2WD / 4WD switch on the right bar: a black housing with a bezel, the rocker in it (`driveSwitchRocker`, posed by the quad: the
 * rider's end in for 4WD) and the two positions printed on the housing, 4WD towards you and 2WD ahead.
 */
export function buildDriveSwitch(bars, MAT, at = [-0.19, 0.068, -0.03]) {
  const house = rb(0.046, 0.026, 0.066, 0.003, MAT.plastic, at[0], at[1], at[2], bars, 'driveSwitchHousing', 1);
  house.userData.keep = true;
  // A raised bezel round the rocker's opening.
  const bezel = [
    strip(new THREE.BoxGeometry(0.038, 0.003, 0.003)).translate(0, 0, -0.0225),
    strip(new THREE.BoxGeometry(0.038, 0.003, 0.003)).translate(0, 0, 0.0225),
    strip(new THREE.BoxGeometry(0.003, 0.003, 0.046)).translate(-0.0185, 0, 0),
    strip(new THREE.BoxGeometry(0.003, 0.003, 0.046)).translate(0.0185, 0, 0),
  ];
  const b = new THREE.Mesh(mergeGeometries(bezel), MAT.frame);
  b.position.set(at[0], at[1] + 0.0145, at[2]);
  bars.add(b);
  const rocker = new THREE.Group();
  rocker.name = 'driveSwitchRocker';
  rocker.position.set(at[0], at[1] + 0.016, at[2]);
  rocker.userData.keep = true;
  bars.add(rocker);
  rb(0.03, 0.009, 0.04, 0.003, new THREE.MeshStandardMaterial({ color: 0x25272a, roughness: 0.6 }), 0, 0.002, 0, rocker, 'driveSwitchRockerCap', 1);
  const ribs = [];
  for (let i = 0; i < 5; i++) ribs.push(strip(new THREE.BoxGeometry(0.026, 0.0016, 0.0022)).translate(0, 0.0072, -0.014 + i * 0.007));
  rocker.add(new THREE.Mesh(mergeGeometries(ribs), MAT.rubber));
  const label = labelMaterial(0.04, 0.066, 4200, (g, W, H, px) => {
    put(g, W, H, px, '2WD', 0, 0.0285, 0.0055, { rot: 0 }); // small, and in from the housing's rounded ends, up against the rocker
    put(g, W, H, px, '4WD', 0, -0.0285, 0.0055, { rot: 0 });
  });
  const lp = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.066), label);
  lp.rotation.x = -Math.PI / 2;
  lp.rotation.z = Math.PI; // read from the rider's side
  lp.position.set(at[0], at[1] + 0.0131, at[2]);
  bars.add(lp);
  return rocker;
}

/**
 * The thumb throttle on the right grip: a housing on the bar with a cable adjuster, and a paddle lever (`thumbThrottle`) standing
 * out below the grip for the thumb, pivoting about X at its root and pushed forward (away from you) by `poseThumbThrottle`.
 */
export function buildThumbThrottle(bars, MAT, dy = 0, x = -0.3) {
  // `dy` and `x` move it along a bar that is not the red's straight one (the sport quads' V bars: the housing sits on the rise, and is the right lever's perch too).
  rb(0.046, 0.034, 0.046, 0.007, MAT.plastic, x, 0.066 + dy, -0.03, bars, 'thumbHousing');
  const barrel = new THREE.Mesh(strip(new THREE.CylinderGeometry(0.0055, 0.0055, 0.014, 8)).rotateZ(Math.PI / 2), MAT.alloy);
  barrel.position.set(x + 0.018, 0.075 + dy, -0.004);
  bars.add(barrel);
  const lever = new THREE.Group();
  lever.name = 'thumbThrottle';
  lever.position.set(x - 0.022, 0.054 + dy, -0.045);
  lever.userData.keep = true;
  bars.add(lever);
  // A curved paddle with a ridged pad, reaching back and down from its pivot under the grip.
  const path = new THREE.CatmullRomCurve3([[0, 0, 0], [0, -0.008, -0.014], [0, -0.012, -0.03], [0, -0.01, -0.042]].map((p) => new THREE.Vector3(...p))).getPoints(10);
  lever.add(new THREE.Mesh(sweepGeometry(path.map((p) => [p.x, p.y, p.z]), (t) => 0.0045 + 0.004 * t, { radial: 8 }), MAT.frame));
  const pad = rb(0.024, 0.006, 0.026, 0.003, MAT.frame, 0, -0.011, -0.036, lever, 'thumbPad', 1);
  pad.rotation.x = 0.35;
  const ribs = [];
  for (let i = 0; i < 4; i++) ribs.push(strip(new THREE.BoxGeometry(0.02, 0.0016, 0.0024)).translate(0, -0.0072, -0.026 - i * 0.0065));
  const rr = new THREE.Mesh(mergeGeometries(ribs), MAT.rubber);
  rr.rotation.x = 0.35;
  lever.add(rr);
  return lever;
}

/** Poses the thumb throttle: `amount` 0..1, the paddle pushed forward and down by the thumb. */
export function poseThumbThrottle(model, amount) {
  const lever = part(model, 'thumbThrottle');
  if (lever && lever.userData.keep) lever.rotation.x = amount * 0.5;
}
