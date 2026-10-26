import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bentTube, loftGeometry, rod, sweepGeometry, springGeometry, gripGeometry, mergeStatic } from './quadGeometry.js';
import { cableGeometry, hoseGeometry } from './detail/cables.js';
import { treadTyre } from './detail/tread.js';
import { buildChainDrive } from './detail/chainDrive.js';
import { decalMesh, MAKER_FOR } from './detail/decals.js';
import { chokeSymbol } from './blasterDetail.js';
import { mesh, rbox, tube, pipe, CHOKE_KNOB, CHOKE_MARK } from './tz65Detail.js';
import {
  BANTAM_WHEELS, BANTAM_RAKE, forkZ, BANTAM_BARS_AT, BANTAM_FORK, BANTAM_BARS, BANTAM_SEAT, BANTAM_SADDLE_SPRING, BANTAM_TANK, BANTAM_LAMP,
  BANTAM_FRONT_FENDER, BANTAM_REAR_FENDER, BANTAM_FRAME, BANTAM_ENGINE, BANTAM_CARB, BANTAM_TAP, BANTAM_EXHAUST, BANTAM_KICK, BANTAM_PEGS,
  BANTAM_STAND, BANTAM_CARRIER, BANTAM_TAIL, BANTAM_SWITCH,
} from './bantamBody.js';

// The old bike's parts (#38), after a 1949 rigid-frame single: spoked 19 inch wheels with drum brakes, telescopic forks in rubber gaiters, deep
// valanced fenders, a sprung saddle, a loop of single tube round a naked alloy-and-iron two-stroke, a tapering silencer, a kickstart on the
// right and an advance-retard lever on the left bar. The numbers are bantamBody.js's; each builder takes the quad's materials (`MAT`) and
// adds to the group it is given.

const R = BANTAM_WHEELS.radius;
const DEG = Math.PI / 180;

/** The cream panel on each side of the tank, and the red pin line round it. */
export const CREAM = 0xe9e1c8;

// Fenders ----------------------------------------------------------------------

/**
 * A fender: a crowned strip of width `width` swept on an arc of radius `r` about the axle, from angle `from` to `to` degrees (0 straight up,
 * forward positive), with a valance `flange` deep down each side. In the axle's frame (the arc lies in the y-z plane, centred on the origin).
 */
export function fenderGeometry({ r, width, flange, from, to }, steps = 24) {
  const hw = width / 2;
  const profile = [[-hw, -flange], [-hw, -0.003], [-hw * 0.5, 0.004], [0, 0.007], [hw * 0.5, 0.004], [hw, -0.003], [hw, -flange]];
  const pos = [];
  const idx = [];
  for (let i = 0; i <= steps; i++) {
    const a = (from + ((to - from) * i) / steps) * DEG;
    for (const [x, d] of profile) pos.push(x, Math.cos(a) * (r + d), Math.sin(a) * (r + d));
  }
  const n = profile.length;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j;
      idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Wheels ---------------------------------------------------------------------

const tyres = {};
const tyre = (front) => (tyres[front ? 'f' : 'r'] ??= treadTyre(front ? 'rib' : 'road', {
  radius: R,
  width: BANTAM_WHEELS.width,
  rimR: BANTAM_WHEELS.rim - 0.01,
  count: 30,
  segments: 40,
}));

/** The tyre, the chromed rim with its crossed spokes, the drum hub (and the rear sprocket): all of it turns with the wheel, in `spin`. */
export function buildBantamSpin(spin, MAT, paint, front) {
  const rimR = BANTAM_WHEELS.rim;
  mesh(tyre(front), MAT.rubber, spin);
  mesh(new THREE.TorusGeometry(rimR - 0.004, 0.0085, 6, 40).rotateY(Math.PI / 2), MAT.chrome, spin);
  const spokes = [];
  const n = 18;
  const hubR = 0.082;
  for (const s of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const b = a + (s > 0 ? 0.5 : -0.5);
      spokes.push(rod([s * 0.03, Math.sin(a) * hubR * 0.9, Math.cos(a) * hubR * 0.9], [s * 0.004, Math.sin(b) * (rimR - 0.008), Math.cos(b) * (rimR - 0.008)], 0.0011, 3));
    }
  }
  mesh(mergeGeometries(spokes), MAT.steel, spin);
  // The brake drum, a deep pressed hub in the body's colour with a lip, and the spindle through it.
  mesh(new THREE.CylinderGeometry(hubR, hubR, 0.06, 20).rotateZ(Math.PI / 2), paint, spin);
  mesh(new THREE.CylinderGeometry(hubR + 0.006, hubR + 0.006, 0.008, 20).rotateZ(Math.PI / 2).translate(0.03, 0, 0), MAT.engineDark, spin);
  mesh(new THREE.CylinderGeometry(0.014, 0.014, BANTAM_WHEELS.width + 0.07, 8).rotateZ(Math.PI / 2), MAT.engineDark, spin);
  if (!front) {
    mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.014, 12).rotateZ(Math.PI / 2).translate(0.04, 0, 0), MAT.engineDark, spin);
  }
  mergeStatic(spin);
}

/** The front wheel's fixed side: the lower fork legs on the axle, the valanced fender on its stays, and the brake's torque arm. Local to the axle. */
export function buildBantamFork(wheel, MAT, paint) {
  const F = BANTAM_FORK;
  const ly = (y) => y - R; // world height to the wheel group's
  const lz = (y) => forkZ(y) - BANTAM_WHEELS.frontZ;
  for (const s of [-1, 1]) {
    tube([s * F.x, 0, 0], [s * F.x, ly(F.lowerTop), lz(F.lowerTop)], 0.0165, paint, wheel, 10);
    rbox(0.032, 0.05, 0.04, 0.012, MAT.alloy, s * F.x, 0.0, 0.0, wheel); // the axle lug
    // The fender's stay from each leg, up and over to the fender's sides.
    tube([s * (F.x + 0.012), ly(0.5), lz(0.5)], [s * (BANTAM_FRONT_FENDER.width / 2 + 0.004), ly(0.64), lz(0.64) + 0.06], 0.006, paint, wheel, 6);
  }
  tube([-F.x - 0.04, 0, 0], [F.x + 0.04, 0, 0], 0.01, MAT.engineDark, wheel, 8); // the axle
  mesh(fenderGeometry(BANTAM_FRONT_FENDER), paint, wheel, 'frontFender');
  // The brake's torque arm: a strap from the drum's plate up to the left leg.
  tube([0.052, 0.02, 0], [F.x, ly(0.44), lz(0.44)], 0.005, MAT.steel, wheel, 6);
}

/** The rear wheel's fender and its stays are on the frame; the drum's backing plate and brake arm are in the wheel's group so they move with it. */
export function buildBantamRearBrake(wheel, MAT) {
  mesh(new THREE.CylinderGeometry(0.086, 0.086, 0.012, 22).rotateZ(Math.PI / 2).translate(-0.04, 0, 0), MAT.engineDark, wheel, 'brakePlate');
  tube([-0.045, 0, 0], [-0.045, 0.012, 0.1], 0.005, MAT.steel, wheel, 6); // the brake arm and its rod stub
}

// Frame ------------------------------------------------------------------------

/** The loop of tube: head tube on the fork's axis, top tube, the single downtube, cradle, seat stays, and the rear-wheel mounts. */
export function addBantamFrame(root, MAT, paint) {
  const F = BANTAM_FRAME;
  const at = (run, s) => run.map(([z, y]) => [s * F.x, y, z]);
  // The head tube, along the fork's axis, with its lugs; one down tube and one top tube (the real frame is a single loop either side).
  const h0 = [0, F.head[0], forkZ(F.head[0])];
  const h1 = [0, F.head[1], forkZ(F.head[1])];
  tube(h0, h1, 0.022, paint, root, 10);
  pipe([[0, 0.83, forkZ(0.83) - 0.003], [0, 0.84, 0.3], ...[[0.1, 0.7], [-0.15, 0.66]].map(([z, y]) => [0.0, y, z])], 0.014, paint, root, { bend: 0.05, steps: 4 });
  pipe([[0, 0.76, forkZ(0.76)], [0, 0.5, 0.28], [0, 0.3, 0.2]], 0.015, paint, root, { bend: 0.06, steps: 4 });
  for (const s of [-1, 1]) {
    pipe(at(F.seatStay, s), 0.0105, paint, root, { bend: 0.06, steps: 4 });
    pipe(at(F.cradle, s), 0.0125, paint, root, { bend: 0.06, steps: 4 });
  }
  // Cross tubes at the seat tube and over the swingless rear, so every tube meets another.
  tube([-F.x, 0.66, -0.15], [F.x, 0.66, -0.15], 0.011, paint, root, 8);
  tube([-F.x, 0.31, BANTAM_WHEELS.rearZ], [F.x, 0.31, BANTAM_WHEELS.rearZ], 0.009, paint, root, 8);
  tube([-F.x, 0.2, 0.12], [F.x, 0.2, 0.12], 0.009, paint, root, 8);
  // The rear axle's plates: a flat lug each side where the stays and the cradle meet, with the chain adjuster.
  for (const s of [-1, 1]) rbox(0.012, 0.06, 0.06, 0.004, MAT.steel, s * 0.066, 0.3, BANTAM_WHEELS.rearZ, root);
  // The spring under the saddle's tail between the frame and the saddle (the real frame is rigid, the saddle sprung).
  const S = BANTAM_SADDLE_SPRING;
  for (const s of [-1, 1]) {
    const coil = mesh(springGeometry(S.y1 - S.y0, S.r, 0.0042, 7), MAT.chrome, root);
    coil.position.set(s * S.x, S.y1, S.z);
  }
  tube([-S.x - 0.03, S.y0, S.z], [S.x + 0.03, S.y0, S.z], 0.009, MAT.steel, root, 6);
  // The chain and both sprockets (the guard covers the top run).
  buildChainDrive(root, { x: 0.06, front: { y: 0.3, z: -0.24, r: 0.036 }, rear: { y: R, z: BANTAM_WHEELS.rearZ, r: 0.075 } });
  // The chain guard over the top run of the chain on the left, in the body's colour, from the sprocket to the rear hub.
  mesh(loftGeometry([{ z: -0.22, w: 0.016, x: 0.073, y0: 0.31, y1: 0.355 }, { z: -0.4, w: 0.016, x: 0.073, y0: 0.31, y1: 0.35 }, { z: -0.6, w: 0.016, x: 0.073, y0: 0.305, y1: 0.345 }], { exponent: 3 }), paint, root, 'chainGuard');
}

// Bodywork ---------------------------------------------------------------------

/** A cream panel with a red pin line, drawn on a canvas, to lay a millimetre off the tank's side. */
function panelTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 256);
  g.fillStyle = '#c4281c';
  g.beginPath();
  g.roundRect(4, 8, 504, 240, 70);
  g.fill();
  g.fillStyle = '#e9e1c8';
  g.beginPath();
  g.roundRect(16, 20, 480, 216, 60);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The tank, the saddle, the fenders, the carrier and the tail lamp. */
export function addBantamBody(root, MAT, paint, seatMat) {
  mesh(loftGeometry(BANTAM_SEAT, { exponent: 3, segments: 28 }), seatMat, root, 'seat');
  // Press studs and the welt round the saddle's edge, as small chrome heads.
  for (const [z, w] of [[-0.12, 0.13], [-0.24, 0.165], [-0.38, 0.17]]) for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.0055, 6, 4).translate(s * (w / 2 + 0.001), 0.715, z), MAT.chrome, root);
  // The tank, its cap and the cream panel on each side.
  mesh(loftGeometry(BANTAM_TANK.stations, { exponent: 3, segments: 28 }), paint, root, 'tank');
  const cap = mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.014, 14), MAT.chrome, root, 'tankCap');
  cap.position.set(0, BANTAM_TANK.cap.y, BANTAM_TANK.cap.z);
  const P = BANTAM_TANK.panel;
  const tex = panelTexture();
  for (const s of [-1, 1]) {
    // The side of the tank at the panel's height leans out; the panel stands off it by a millimetre and tilts with it.
    const m = new THREE.Mesh(new THREE.PlaneGeometry(P.w, P.h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.name = 'tankPanel';
    m.position.set(s * (P.x + 0.001), P.y, P.z);
    m.rotation.y = s * (Math.PI / 2);
    m.rotation.x = 0;
    root.add(m);
  }
  // The rear fender, deep and valanced, on the rear wheel's arc, with the saddle's rear stay and the carrier's rails over it.
  const rf = mesh(fenderGeometry(BANTAM_REAR_FENDER), paint, root, 'rearFender');
  rf.position.set(0, R, BANTAM_WHEELS.rearZ);
  // The fender's stays down to the axle on each side.
  for (const s of [-1, 1]) tube([s * 0.075, R, BANTAM_WHEELS.rearZ], [s * BANTAM_FRAME.x, 0.635, -0.3], 0.006, paint, root, 6); // up to the seat stay
  const C = BANTAM_CARRIER;
  for (const s of [-1, 1]) {
    pipe([[s * C.w / 2, 0.62, -0.28], [s * C.w / 2, C.y, C.z0], [s * C.w / 2, C.y, C.z1], [s * C.w / 2, 0.56, C.z1 - 0.1]], 0.0065, paint, root, { bend: 0.03, steps: 3 });
  }
  tube([-C.w / 2, C.y, C.z0], [C.w / 2, C.y, C.z0], 0.0065, paint, root, 6);
  tube([-C.w / 2, C.y, C.z1], [C.w / 2, C.y, C.z1], 0.0065, paint, root, 6);
  tube([-C.w / 2, C.y, (C.z0 + C.z1) / 2], [C.w / 2, C.y, (C.z0 + C.z1) / 2], 0.005, paint, root, 6);
  // The tail lamp on the fender's tail, its housing bedded into the metal, and the number plate hanging from it: a red lens in a plain housing,
  // a black plate. (The arc ends at z -0.99, y 0.22; the housing runs from z -1.05 to -0.99 across it, so it is bolted on, not floating.)
  const T = BANTAM_TAIL;
  rbox(0.1, 0.05, 0.065, 0.012, MAT.plastic, 0, T.y, T.z, root, 'tailHousing');
  rbox(0.085, 0.04, 0.02, 0.01, MAT.tail, 0, T.y, T.z - 0.034, root, 'tailLight');
  rbox(0.22, 0.17, 0.008, 0.004, MAT.rubber, 0, T.y - 0.105, T.z - 0.02, root, 'numberPlate'); // from the housing's underside, 2 mm in, down to 9 cm off the ground
}

// Engine ----------------------------------------------------------------------

/** The kickstart pedal's pivot group: a lever swinging down and forward from the crank, with a rubber; named `kickStart` (the game poses it). */
function addKickStart(root, MAT) {
  const K = BANTAM_KICK;
  const pivot = new THREE.Group();
  pivot.name = 'kickStart';
  pivot.userData.keep = true;
  pivot.userData.restAngle = K.restAngle;
  pivot.position.set(K.x, K.y, K.z);
  pivot.rotation.x = K.restAngle; // the pedal's resting angle: down and slightly back; kicking swings it forward and down
  root.add(pivot);
  // The crank hub on the shaft, then the lever (straight down in the group's frame) bending slightly outboard, a rubber at its foot.
  mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.026, 10).rotateZ(Math.PI / 2), MAT.steel, pivot);
  pipe([[0, 0, 0], [-0.006, -K.length * 0.5, 0.004], [-0.034, -K.length, 0.01]], 0.009, MAT.chrome, pivot, { bend: 0.04, steps: 3 });
  const foot = rbox(0.056, 0.02, 0.03, 0.008, MAT.rubber, -0.05, -K.length - 0.002, 0.012, pivot, 'kickRubber');
  foot.rotation.z = 0.2;
}

/** The engine in the open: crankcase, magneto cover, primary cover, finned barrel and head, the carb with its tickler and choke, the tap, the exhaust. */
export function addBantamEngine(root, MAT, paint) {
  const E = BANTAM_ENGINE;
  const c = E.case;
  rbox(c.w, c.h, c.d, 0.035, MAT.engine, 0, c.y, c.z, root, 'crankcase');
  rbox(c.w * 0.72, c.h * 0.6, 0.12, 0.025, MAT.engine, 0, c.y - 0.03, c.z - 0.17, root); // the gearbox behind
  // The magneto cover on the left, round and polished, a bump for the points' cap; the primary cover on the right, large, with its screws.
  const mg = E.magneto;
  mesh(new THREE.CylinderGeometry(mg.r, mg.r, 0.022, 22).rotateZ(Math.PI / 2).translate(mg.x, mg.y, mg.z), MAT.alloy, root, 'magnetoCover');
  mesh(new THREE.CylinderGeometry(mg.r * 0.4, mg.r * 0.4, 0.014, 14).rotateZ(Math.PI / 2).translate(mg.x + 0.016, mg.y, mg.z), MAT.engineDark, root);
  const pr = E.primary;
  mesh(new THREE.CylinderGeometry(pr.r, pr.r, 0.024, 24).rotateZ(Math.PI / 2).translate(pr.x, pr.y, pr.z), MAT.alloy, root, 'primaryCover');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    mesh(new THREE.SphereGeometry(0.0055, 6, 4).translate(pr.x - 0.014, pr.y + Math.sin(a) * pr.r * 0.82, pr.z + Math.cos(a) * pr.r * 0.82), MAT.chrome, root);
  }
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 14).rotateZ(Math.PI / 2).translate(pr.x - 0.018, pr.y, pr.z), MAT.engineDark, root);
  // The cylinder: a finned black iron barrel leaning slightly forward, a silver finned head, a plug and its cap.
  const cy = E.cylinder;
  const barrel = new THREE.Group();
  barrel.position.set(0, cy.y, cy.z);
  barrel.rotation.x = cy.lean;
  root.add(barrel);
  mesh(new THREE.CylinderGeometry(cy.r, cy.r * 1.06, cy.h, 18), MAT.engineDark, barrel);
  for (let i = 0; i < 7; i++) mesh(new THREE.CylinderGeometry(cy.r * 1.45, cy.r * 1.45, 0.007, 18).translate(0, -cy.h / 2 + 0.014 + i * 0.022, 0), MAT.engineDark, barrel);
  mesh(new THREE.CylinderGeometry(cy.r * 1.2, cy.r * 1.2, 0.05, 18).translate(0, cy.h / 2 + 0.025, 0), MAT.engine, barrel);
  for (let i = 0; i < 3; i++) mesh(new THREE.CylinderGeometry(cy.r * 1.5, cy.r * 1.5, 0.006, 18).translate(0, cy.h / 2 + 0.008 + i * 0.016, 0), MAT.engine, barrel);
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.034, 10).translate(0, cy.h / 2 + 0.065, 0), MAT.plastic, barrel);
  // The carb on the barrel's right (-x), a mixing chamber along x, a bowl underneath, a top cap with the tickler, the cable into it.
  const C = BANTAM_CARB;
  mesh(new THREE.CylinderGeometry(C.r, C.r, C.len, 16).rotateZ(Math.PI / 2).translate(C.x, C.y, C.z), MAT.engine, root, 'carb');
  rbox(0.05, 0.06, 0.06, 0.012, MAT.engine, C.x, C.y, C.z, root);
  mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.04, 14).translate(C.x, C.bowlY - 0.026, C.z), MAT.engineDark, root);
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.035, 14).translate(C.x, C.y + 0.048, C.z), MAT.engine, root);
  // The tickler: a small spring-loaded plunger through the bowl's top, with a brass-knurled button; the game presses it (it is named `tickler`).
  const tick = new THREE.Group();
  tick.name = 'tickler';
  tick.userData.keep = true;
  tick.userData.travel = 0.012;
  tick.position.set(C.x, C.y + 0.068, C.z - 0.01);
  root.add(tick);
  mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.016, 8).translate(0, 0.0, 0), MAT.chrome, tick);
  mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.01, 12).translate(0, 0.012, 0), new THREE.MeshStandardMaterial({ color: 0xb08a3a, roughness: 0.35, metalness: 0.85 }), tick, 'ticklerButton');
  // The choke strangler: a plunger on the intake end, out to the right (the game pulls it out, along -x).
  const intakeX = C.x - C.len / 2;
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.026, 14).rotateZ(Math.PI / 2).translate(intakeX - 0.012, C.y, C.z), MAT.engineDark, root);
  const mount = new THREE.Group();
  mount.userData.keep = true;
  mount.position.set(intakeX - 0.027, C.y, C.z);
  mount.rotation.z = -Math.PI / 2; // its +y is towards the carb, so pulling down is pulling out (-x, away)
  root.add(mount);
  const choke = new THREE.Group();
  choke.name = 'chokeLever';
  choke.userData.keep = true;
  choke.userData.baseY = 0;
  choke.userData.travel = 0.07;
  mount.add(choke);
  mesh(rod([0, 0, 0], [0, 0.07, 0], 0.0045, 8), MAT.chrome, choke);
  mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.016, 14).translate(0, -0.008, 0), CHOKE_KNOB, choke, 'chokeKnob');
  const symbol = chokeSymbol(CHOKE_MARK);
  symbol.rotation.x = Math.PI / 2;
  symbol.position.set(0, -0.0165, 0);
  choke.add(symbol);
  // The fuel tap under the tank on its right: a body with a lever the game turns, and the pipe down to the bowl.
  const [tx, ty, tz] = BANTAM_TAP.pos;
  rbox(0.034, 0.03, 0.03, 0.008, MAT.chrome, tx, ty, tz, root, 'fuelTapBody');
  const tap = new THREE.Group();
  tap.name = 'fuelTap';
  tap.userData.keep = true;
  tap.position.set(tx - 0.022, ty, tz);
  root.add(tap);
  const tapMat = new THREE.MeshStandardMaterial({ color: 0x26282a, roughness: 0.5 });
  mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.01, 14).rotateZ(Math.PI / 2), tapMat, tap);
  rbox(0.01, 0.007, 0.03, 0.002, tapMat, 0, 0, 0.019, tap);
  const hose = hoseGeometry([[tx, ty - 0.015, tz], [tx - 0.005, 0.64, 0.05], [C.x, C.y + 0.05, C.z + 0.03]], 0.0045, { sag: 0.01, radial: 6, clamps: false });
  mesh(hose.hose, MAT.rubber, root, 'fuelHose');
  // The throttle cable from the carb's cap, a pair of braided runs up the downtube: drawn as one in the bars.
  addExhaust(root, MAT);
  addKickStart(root, MAT);
}

function addExhaust(root, MAT) {
  const X = BANTAM_EXHAUST;
  const curve = new THREE.CatmullRomCurve3(X.path.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const n = X.radii.length - 1;
  const radius = (t) => {
    const f = t * n;
    const i = Math.min(n - 1, Math.floor(f));
    const k = f - i;
    return X.radii[i] + (X.radii[i + 1] - X.radii[i]) * k;
  };
  mesh(sweepGeometry(curve.getPoints(40), radius, { radial: 12 }), MAT.chrome, root, 'exhaustPipe');
  const [fx, fy, fz] = X.path[0];
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.014, 12).rotateX(Math.PI / 2 + 0.7).translate(fx, fy, fz + 0.004), MAT.steel, root, 'exhaustFlange');
  // The silencer: a long tapered cylinder, a rolled end, a stay to the frame; its tip is `exhaustTip`.
  const a = new THREE.Vector3(...X.can.from);
  const b = new THREE.Vector3(...X.can.to);
  const dir = b.clone().sub(a);
  const len = dir.length();
  const can = new THREE.Group();
  can.position.copy(a).addScaledVector(dir, 0.5);
  can.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  root.add(can);
  mesh(new THREE.CylinderGeometry(X.can.r1, X.can.r0, len, 18), MAT.chrome, can, 'silencer');
  mesh(new THREE.TorusGeometry(X.can.r1 * 0.99, 0.004, 5, 18).rotateX(Math.PI / 2).translate(0, len / 2, 0), MAT.steel, can);
  mesh(new THREE.CircleGeometry(X.can.r1 * 0.5, 12).rotateX(-Math.PI / 2).translate(0, len / 2 + 0.001, 0), MAT.hole, can);
  tube([-0.17, 0.33, -0.55], [-0.075, 0.4, -0.55], 0.0055, MAT.steel, root, 6); // the silencer's stay to the frame's stay
  const tip = new THREE.Object3D();
  tip.name = 'exhaustTip';
  tip.position.copy(b).addScaledVector(dir.normalize(), 0.012);
  root.add(tip);
}

/** The foot rests, the brake pedal (right) and the gear lever (left), and the centre stand folded down behind the cradle. */
export function addBantamPegs(root, MAT) {
  const P = BANTAM_PEGS;
  for (const s of [-1, 1]) {
    tube([s * 0.07, P.y, P.z], [s * (P.x - 0.03), P.y, P.z], 0.011, MAT.steel, root, 6);
    rbox(0.08, 0.026, 0.034, 0.01, MAT.rubber, s * P.x, P.y, P.z, root, s > 0 ? 'pegLeft' : 'pegRight');
  }
  pipe([[-0.075, 0.26, -0.25], [-0.13, 0.24, -0.15], [-0.15, 0.245, -0.02]], 0.0065, MAT.steel, root, { bend: 0.03, steps: 3 });
  rbox(0.05, 0.01, 0.028, 0.004, MAT.steel, -0.155, 0.248, -0.012, root); // the brake pedal's pad
  pipe([[0.08, 0.31, -0.2], [0.12, 0.33, -0.12], [0.15, 0.32, -0.04]], 0.006, MAT.steel, root, { bend: 0.03, steps: 3 });
  rbox(0.022, 0.014, 0.028, 0.004, MAT.rubber, 0.158, 0.32, -0.035, root);
  // The centre stand: two legs down from the cradle to a cross foot, with a spring.
  const S = BANTAM_STAND;
  for (const s of [-1, 1]) {
    tube([s * 0.065, 0.2, S.z - 0.02], [s * 0.1, S.y, S.z - 0.1], 0.0085, MAT.steel, root, 6);
  }
  tube([-S.w / 2, S.y, S.z - 0.1], [S.w / 2, S.y, S.z - 0.1], 0.0085, MAT.steel, root, 6);
  tube([-0.065, 0.2, S.z - 0.02], [0.065, 0.2, S.z - 0.02], 0.0075, MAT.steel, root, 6);
}

// Handlebars ----------------------------------------------------------------

/**
 * The bars and the steering assembly's upper half, in the bars' frame (origin BANTAM_BARS_AT): the chromed bars, the grips (fixed points),
 * the levers (clutch and the advance-retard lever on the left, front brake on the right), the twist-grip housing, the cables, the fork's
 * gaiters and top yoke, and the headlamp shell with the speedo's cup on top. The speedo (the dash) and the pod mount are the model's.
 */
export function addBantamBars(bars, MAT, paint, lensMat) {
  const T = BANTAM_BARS;
  const half = T.half;
  pipe([...half, ...half.slice().reverse().map(([x, y, z]) => [-x, y, z])], 0.0105, MAT.chrome, bars, { bend: 0.03, steps: 4 });
  for (const s of [-1, 1]) {
    const grip = mesh(gripGeometry(T.gripLen, 0.0145), MAT.rubber, bars, s > 0 ? 'gripLeft' : 'gripRight');
    grip.position.set(s * T.grip[0], T.grip[1], T.grip[2]);
    grip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(s * T.gripDir[0], T.gripDir[1], T.gripDir[2]).normalize());
    // The perch and its lever (clutch on the left, brake on the right), curving out ahead of the grip.
    const lever = [[0, 0.004, 0.006], [s * 0.02, 0.012, 0.014], [s * 0.085, 0.014, -0.014], [s * 0.105, 0.012, -0.028]];
    const px = 0.2;
    rbox(0.034, 0.024, 0.034, 0.008, MAT.chrome, s * px, 0.05, -0.02, bars);
    const g = new THREE.Group();
    g.position.set(s * px, 0.05, -0.02);
    bars.add(g);
    pipe(lever, 0.0052, MAT.chrome, g, { bend: 0.02 });
  }
  // The twist grip's housing on the right and its cable.
  rbox(0.04, 0.034, 0.034, 0.01, MAT.chrome, -0.22, 0.056, -0.034, bars, 'throttleHousing');
  // The lights switch (a plain on / off rocker, P): a chrome housing clamped round the left bar just inboard of the clutch perch, with the rocker on its top.
  const [sx, sy, sz] = BANTAM_SWITCH.pos;
  rbox(0.034, 0.03, 0.034, 0.008, MAT.chrome, sx, sy, sz, bars, 'lightsSwitchHousing');
  const rocker = new THREE.Group();
  rocker.name = 'lightsRocker';
  rocker.userData.keep = true;
  rocker.position.set(sx, sy + 0.015, sz);
  bars.add(rocker);
  rbox(0.022, 0.008, 0.024, 0.003, new THREE.MeshStandardMaterial({ color: 0x25272a, roughness: 0.6 }), 0, 0.001, 0, rocker, 'lightsRockerCap');
  // The advance-retard lever: a small lever under the clutch's perch, its pivot on the bar, swinging through about 60 degrees; named `advanceLever`.
  const adv = new THREE.Group();
  adv.name = 'advanceLever';
  adv.userData.keep = true;
  adv.position.set(...BANTAM_SWITCH.lever); // on the clutch perch's inner face, so it is clipped to the bar
  bars.add(adv);
  mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.024, 12).rotateZ(Math.PI / 2), MAT.chrome, adv);
  const arm = new THREE.Group();
  arm.name = 'advanceArm';
  arm.userData.keep = true;
  adv.add(arm);
  mesh(rod([0, 0, 0], [0.0, 0.0, -0.075], 0.004, 8), MAT.chrome, arm);
  mesh(new THREE.SphereGeometry(0.0085, 10, 8).translate(0, 0, -0.078), MAT.rubber, arm, 'advanceKnob');
  // The cables: the clutch's and the throttle's down to the head and the brake's out of the front perch, as braided runs with sag.
  mesh(cableGeometry([[0.2, 0.05, -0.02], [0.15, -0.02, 0.0], [0.09, -0.1, 0.02], [0.04, -0.17, 0.0]], 0.0032, { sag: 0.03 }), MAT.rubber, bars, 'clutchCable');
  mesh(cableGeometry([[-0.22, 0.056, -0.034], [-0.18, -0.02, -0.01], [-0.1, -0.1, 0.02], [-0.045, -0.17, 0.0]], 0.0032, { sag: 0.03 }), MAT.rubber, bars, 'throttleCable');
  mesh(cableGeometry([[-0.2, 0.05, -0.02], [-0.16, -0.05, 0.01], [-0.12, -0.2, 0.02], [-0.085, -0.34, 0.01]], 0.0035, { sag: 0.04 }), MAT.rubber, bars, 'brakeCable');
  // The fork's top: the yoke, the stanchions in their gaiters (a bellows of rubber rings), the fork nuts and the head's lamp brackets.
  const F = BANTAM_FORK;
  const local = (x, y) => [x, y - BANTAM_BARS_AT[1], forkZ(y) - BANTAM_BARS_AT[2]];
  for (const s of [-1, 1]) {
    tube(local(s * F.x, F.gaiter[0]), local(s * F.x, F.upperTop), 0.013, MAT.chrome, bars, 10);
    // The gaiter: rings of black rubber from gaiter[0] to gaiter[1].
    const [x0, y0, z0] = local(s * F.x, F.gaiter[0]);
    const [x1, y1, z1] = local(s * F.x, F.gaiter[1]);
    const rings = [];
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      rings.push(new THREE.CylinderGeometry(0.0225, 0.0225, 0.014, 14).rotateX(-Math.atan(BANTAM_RAKE)).translate(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t));
    }
    mesh(mergeGeometries(rings), MAT.rubber, bars);
    // The fork nut on top of the yoke.
    const [nx, ny, nz] = local(s * F.x, F.upperTop + 0.006);
    mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.016, 8).translate(nx, ny, nz), MAT.rubber, bars);
  }
  for (const y of [F.yoke, F.lowerYoke]) {
    const [, ly, lz] = local(0, y);
    rbox(0.21, 0.024, 0.05, 0.01, paint, 0, ly, lz, bars);
  }
  tube(local(0, F.lowerYoke), local(0, F.yoke + 0.012), 0.016, MAT.chrome, bars, 8); // the steering stem
  // The headlamp: a green shell on two brackets from the stanchions, a chrome rim, the glass facing forward (the lens the game lights).
  const L = BANTAM_LAMP;
  const [, lampY, lampZ] = local(0, L.y);
  const lz = lampZ + L.ahead;
  const shell = mesh(new THREE.SphereGeometry(L.r, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62).rotateX(-Math.PI / 2).scale(1, 1, 1.2), paint, bars, 'lampShell');
  shell.position.set(0, lampY, lz - L.depth * 0.3);
  // The shell is a dome a little more than a hemisphere (polar angle 111.6 degrees), so its rim stands 0.368 r (times the 1.2 stretch) ahead of its centre and
  // 0.93 r out from the axis: the chrome rim sits right on that edge, and the glass is a thin disc just inside it, so nothing floats in front of the shell.
  const rimZ = shell.position.z + 0.3681 * L.r * 1.2;
  const rimR = L.r * 0.9298;
  mesh(new THREE.TorusGeometry(rimR, 0.0055, 6, 28).translate(0, lampY, rimZ), MAT.chrome, bars);
  mesh(new THREE.CylinderGeometry(rimR - 0.003, rimR - 0.003, 0.012, 28).rotateX(Math.PI / 2).translate(0, lampY, rimZ - 0.002), lensMat, bars, 'headlight');
  for (const s of [-1, 1]) tube([s * F.x, F.gaiter[1] - BANTAM_BARS_AT[1] + 0.02, forkZ(F.gaiter[1]) - BANTAM_BARS_AT[2]], [s * (L.r - 0.012), lampY, lz - L.depth * 0.25], 0.0055, paint, bars, 6);
  return { lampY, lampZ: lz };
}

// Stickers ---------------------------------------------------------------------

/** The maker's badge on the tank's cream panel on each side, a millimetre off it. */
export function addBantamDecals(root) {
  const P = BANTAM_TANK.panel;
  const x = P.x + 0.003;
  for (const s of [-1, 1]) {
    const badge = decalMesh('badge', { maker: MAKER_FOR.plover, model: 'Plover' }, { width: 0.12, name: 'badge' });
    badge.position.set(s * x, P.y + 0.005, P.z + 0.02);
    badge.rotation.y = s * (Math.PI / 2);
    root.add(badge);
  }
}
