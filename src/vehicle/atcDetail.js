import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { loftGeometry, rod, sweepGeometry, gripGeometry } from './quadGeometry.js';
import { cableGeometry } from './detail/cables.js';
import { treadTyre } from './detail/tread.js';
import { decalMesh, MAKER_FOR } from './detail/decals.js';
import { chokeSymbol } from './blasterDetail.js';
import { mesh, rbox, tube, pipe, CHOKE_KNOB, CHOKE_MARK } from './tz65Detail.js';
import {
  ATC_WHEELS, ATC_BARS_AT, ATC_FORK, ATC_FRONT_FENDER, ATC_FRONT_FLAP, ATC_LAMP, ATC_BARS, ATC_TANK, ATC_SEAT, ATC_REAR_BODY, ATC_FLARE, ATC_RACK,
  ATC_BUMPER, ATC_TAIL, ATC_ENGINE, ATC_CARB, ATC_TAP, ATC_EXHAUST, ATC_FRAME, ATC_CHAIN, ATC_PEGS, forkZ,
} from './atcBody.js';

// The old three-wheeler's parts (TODO 95), after a Honda-style ATC185S: fat balloon tyres on plain silver steel rims, a front end of chrome
// legs in black boots under two red steering columns, a rectangular headlamp between them, a wide flat front fender with a black flap, swept
// bars with a crossbar pad, a small tank and a long flat seat on one wide red rear body with black flares over the tyres, a chrome grab rail
// and bumper at the back, and the engine in the open with its round side covers. The numbers are atcBody.js's; each builder takes the
// quad's materials (`MAT`) and adds to the group it is given.

const R = ATC_WHEELS.radius;

// Wheels ---------------------------------------------------------------------

const tyres = {};
const tyre = (front) => (tyres[front ? 'f' : 'r'] ??= treadTyre('trike', {
  radius: R,
  width: front ? ATC_WHEELS.front : ATC_WHEELS.rear,
  rimR: front ? ATC_WHEELS.rimFront : ATC_WHEELS.rimRear,
  count: 18,
  segments: 32,
}));

/** The tyre, the plain silver rim (a dished face with a few holes and a lip each side) and the hub. */
export function buildAtcSpin(spin, MAT, front) {
  const W = front ? ATC_WHEELS.front : ATC_WHEELS.rear;
  const half = W / 2;
  const rimR = front ? ATC_WHEELS.rimFront : ATC_WHEELS.rimRear;
  mesh(tyre(front), MAT.rubber, spin);
  mesh(new THREE.CylinderGeometry(rimR, rimR, W * 0.8, 28).rotateZ(Math.PI / 2), MAT.alloy, spin);
  for (const s of [-1, 1]) {
    mesh(new THREE.TorusGeometry(rimR, 0.009, 6, 30).rotateY(Math.PI / 2).translate(s * (half - 0.018), 0, 0), MAT.alloy, spin);
    mesh(new THREE.CylinderGeometry(rimR - 0.004, rimR - 0.004, 0.01, 30).rotateZ(Math.PI / 2).translate(s * (half - 0.05), 0, 0), MAT.alloy, spin);
    mesh(new THREE.CylinderGeometry(0.034, 0.04, 0.05, 14).rotateZ(Math.PI / 2).translate(s * (half - 0.036), 0, 0), MAT.steel, spin);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      mesh(new THREE.CircleGeometry(0.014, 10).rotateY(s * Math.PI / 2).translate(s * (half - 0.0445), Math.sin(a) * rimR * 0.62, Math.cos(a) * rimR * 0.62), MAT.hole, spin);
    }
  }
  mesh(new THREE.CylinderGeometry(0.014, 0.014, W * 0.9, 8).rotateZ(Math.PI / 2), MAT.engineDark, spin);
}

/** A group at `a` whose +y runs to `b`, for parts built along an axis. */
function along(a, b, parent) {
  const g = new THREE.Group();
  g.position.set(...a);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize());
  parent.add(g);
  return g;
}

/** A point on the steering axis at height y (the wheel group's frame: origin at the axle) plus an offset x. */
const inWheel = (x, y) => [x, y - R, forkZ(y) - ATC_WHEELS.frontZ];

/** The front wheel's fixed side: chrome legs in black boots, the crown, the wide fender with its flap and its brackets. Local to the axle. */
export function buildAtcFork(wheel, MAT, paint) {
  const F = ATC_FORK;
  for (const s of [-1, 1]) {
    const x = s * F.legX;
    tube(inWheel(x, R), inWheel(x, F.bootBottom), 0.0155, MAT.chrome, wheel, 10);
    // The boot: a ribbed rubber gaiter over the leg's upper half.
    const a = inWheel(x, F.bootBottom);
    const b = inWheel(x, F.bootTop);
    const boot = along(a, b, wheel);
    const len = Math.hypot(b[1] - a[1], b[2] - a[2]);
    mesh(new THREE.CylinderGeometry(0.022, 0.022, len, 12).translate(0, len / 2, 0), MAT.rubber, boot);
    for (let i = 0; i <= 6; i++) mesh(new THREE.TorusGeometry(0.0255, 0.0045, 5, 12).rotateX(Math.PI / 2).translate(0, (len * i) / 6, 0), MAT.rubber, boot);
    tube(inWheel(x, F.bootTop), inWheel(x, F.crown), 0.019, MAT.frame, wheel, 10);
    rbox(0.04, 0.06, 0.05, 0.012, MAT.alloy, x, 0, 0, wheel); // the axle lug
    rbox(0.03, 0.05, 0.05, 0.01, paint, ...inWheel(x, 0.66), wheel); // a bracket up into the fender
  }
  rbox(0.3, 0.04, 0.05, 0.012, MAT.frame, ...inWheel(0, F.crown), wheel); // the crown between the legs
  const stations = ATC_FRONT_FENDER.map((st) => ({ ...st, z: st.z - ATC_WHEELS.frontZ, y0: st.y0 - R, y1: st.y1 - R }));
  mesh(loftGeometry(stations, { exponent: 3 }), paint, wheel, 'frontFender');
  const P = ATC_FRONT_FLAP;
  rbox(P.w, P.top - P.bottom, 0.012, 0.004, MAT.rubber, 0, (P.top + P.bottom) / 2 - R, P.z - ATC_WHEELS.frontZ, wheel, 'frontFlap');
}

// Frame, chain ----------------------------------------------------------------

/** The frame: a black cradle round the engine and spine under the tank on each side, the rear legs to the axle housing, the chain and its guard. */
export function addAtcFrame(root, MAT) {
  const F = ATC_FRAME;
  const run = (s, pts, r, opts = { bend: 0.06, steps: 4 }) => pipe(pts.map(([z, y]) => [s * F.x, y, z]), r, MAT.frame, root, opts);
  for (const s of [-1, 1]) {
    run(s, F.cradle, 0.017);
    run(s, F.spine, 0.017);
    run(s, F.rear, 0.016);
  }
  // The head: where the spines and cradles come together behind the columns, and the cross-tubes.
  rbox(0.26, 0.09, 0.07, 0.02, MAT.frame, 0, 0.74, forkZ(0.74) - 0.04, root);
  tube([-F.x, 0.62, -0.3], [F.x, 0.62, -0.3], 0.014, MAT.frame, root, 6);
  // The solid axle across the back (fixed: it measures as part of the body, not of the wheel) with the chain's sprocket on the left.
  tube([-ATC_WHEELS.halfTrack, R, ATC_WHEELS.rearZ], [ATC_WHEELS.halfTrack, R, ATC_WHEELS.rearZ], 0.022, MAT.steel, root);
  mesh(new THREE.CylinderGeometry(ATC_CHAIN.rearR, ATC_CHAIN.rearR, 0.006, 28).rotateZ(Math.PI / 2).translate(ATC_CHAIN.x, R, ATC_WHEELS.rearZ), MAT.steel, root);
  mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.014, 12).rotateZ(Math.PI / 2).translate(ATC_CHAIN.x - 0.004, R, ATC_WHEELS.rearZ), MAT.engineDark, root);
  // The axle housing, a black box across the back between the tyres.
  rbox(ATC_WHEELS.halfTrack * 1.3, 0.07, 0.08, 0.02, MAT.frame, 0, R, ATC_WHEELS.rearZ, root, 'axleHousing');
  // The chain on the left: two runs from the engine's sprocket to the rear axle's, with a guard over the top run.
  const E = ATC_ENGINE.sprocket;
  const rz = ATC_WHEELS.rearZ;
  tube([ATC_CHAIN.x, E.y + E.r, E.z], [ATC_CHAIN.x, R + ATC_CHAIN.rearR, rz], 0.0055, MAT.steel, root, 5);
  tube([ATC_CHAIN.x, E.y - E.r, E.z], [ATC_CHAIN.x, R - ATC_CHAIN.rearR, rz], 0.0055, MAT.steel, root, 5);
  mesh(new THREE.CylinderGeometry(E.r, E.r, 0.012, 14).rotateZ(Math.PI / 2).translate(ATC_CHAIN.x, E.y, E.z), MAT.steel, root);
  rbox(0.024, 0.014, 0.3, 0.005, MAT.plastic, ATC_CHAIN.x, 0.355, -0.34, root);
}

// Body ------------------------------------------------------------------------

/** The seat, the rear body, the flares, the tank, the rack and bumper and the tail light. */
export function addAtcBody(root, MAT, paint, seatMat) {
  mesh(loftGeometry(ATC_SEAT, { exponent: 3, segments: 28 }), seatMat, root, 'seat');
  mesh(loftGeometry(ATC_REAR_BODY, { exponent: 3.2, segments: 32 }), paint, root, 'rearBody');
  for (const s of [-1, 1]) {
    mesh(loftGeometry(ATC_FLARE.map((st) => ({ ...st, x: s * st.x })), { exponent: 3 }), MAT.rubber, root, 'flare');
  }
  mesh(loftGeometry(ATC_TANK.stations, { exponent: 3 }), paint, root, 'tank');
  const cap = mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.012, 14), MAT.plastic, root, 'tankCap');
  cap.position.set(0, ATC_TANK.cap.y, ATC_TANK.cap.z);
  mesh(new THREE.TorusGeometry(0.024, 0.003, 5, 16).rotateX(Math.PI / 2).translate(0, ATC_TANK.cap.y + 0.006, ATC_TANK.cap.z), MAT.steel, root);
  // The chrome grab rail over the back of the body, standing on it at its rear legs, and the bumper bar under the tail.
  const K = ATC_RACK;
  pipe([[-K.x, K.base, K.front], [-K.x, K.top, K.front - 0.08], [-K.x, K.top, K.back], [K.x, K.top, K.back], [K.x, K.top, K.front - 0.08], [K.x, K.base, K.front]], 0.012, MAT.chrome, root, { bend: 0.05, steps: 4 });
  for (const s of [-1, 1]) tube([s * K.x, K.top, K.back], [s * K.x, 0.66, K.back], 0.011, MAT.chrome, root, 8);
  const B = ATC_BUMPER;
  pipe([[-B.x, 0.62, -0.74], [-B.x, B.y, B.z], [B.x, B.y, B.z], [B.x, 0.62, -0.74]], 0.012, MAT.chrome, root, { bend: 0.04, steps: 4 });
  // The tail light on the back of the body.
  rbox(0.12, 0.05, 0.02, 0.008, MAT.tail, 0, ATC_TAIL.y, ATC_TAIL.z - 0.005, root, 'tailLight');
  // The airbox, a black box under the front of the rear body (it sits on the body's underside, with the boot into it).
  rbox(0.2, 0.12, 0.2, 0.03, MAT.plastic, 0, 0.6, ATC_CARB.airboxZ, root, 'airbox');
}

/** Foot rests (rubber pads on chrome bars, fixed to where the old model had them), the brake pedal (right) and the gear lever (left). */
export function addAtcPegs(root, MAT) {
  const P = ATC_PEGS;
  for (const s of [-1, 1]) {
    tube([s * 0.12, 0.27, P.z], [s * (P.x - 0.03), P.y, P.z], 0.011, MAT.chrome, root, 6);
    rbox(0.08, 0.022, 0.17, 0.006, MAT.rubber, s * P.x, P.y, P.z, root, s > 0 ? 'pegLeft' : 'pegRight');
  }
  pipe([[-0.1, 0.24, -0.12], [-0.17, 0.215, -0.04], [-0.2, 0.215, 0.1]], 0.007, MAT.chrome, root, { bend: 0.03, steps: 3 });
  rbox(0.05, 0.008, 0.03, 0.003, MAT.chrome, -0.2, 0.218, 0.115, root);
  pipe([[0.1, 0.3, -0.06], [0.16, 0.3, 0.0], [0.19, 0.285, 0.1]], 0.006, MAT.chrome, root, { bend: 0.03, steps: 3 });
  rbox(0.022, 0.014, 0.028, 0.004, MAT.rubber, 0.2, 0.285, 0.11, root);
}

// Engine ----------------------------------------------------------------------

/**
 * The engine in the open: the crankcase with its big round covers, the recoil starter on the left, the finned barrel and head, the carb behind
 * with the choke plunger (named chokeLever, pulled out along +x by quad.js) and the fuel tap with its hose, and the intake boot to the airbox.
 */
export function addAtcEngine(root, MAT) {
  const E = ATC_ENGINE;
  const c = E.case;
  rbox(c.w, c.h, c.d, 0.03, MAT.engine, 0, c.y, c.z, root, 'crankcase');
  rbox(c.w * 0.8, c.h * 0.6, 0.12, 0.02, MAT.engine, 0, c.y - 0.02, -0.15, root); // the gearbox behind
  // The clutch cover on the right, a big silver disc with a black round cap low on it, and the recoil starter's cup on the left.
  mesh(new THREE.CylinderGeometry(E.cover.r, E.cover.r, 0.03, 24).rotateZ(Math.PI / 2).translate(-E.cover.x, E.cover.y, E.cover.z), MAT.alloy, root, 'clutchCover');
  mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.02, 16).rotateZ(Math.PI / 2).translate(-E.cover.x - 0.02, E.cover.y - 0.03, E.cover.z - 0.01), MAT.plastic, root);
  const rc = E.recoil;
  mesh(new THREE.CylinderGeometry(rc.r, rc.r, 0.04, 20).rotateZ(Math.PI / 2).translate(rc.x, rc.y, rc.z), MAT.plastic, root, 'recoilStarter');
  mesh(new THREE.CylinderGeometry(rc.r * 0.55, rc.r * 0.55, 0.01, 14).rotateZ(Math.PI / 2).translate(rc.x + 0.024, rc.y, rc.z), MAT.engineDark, root);
  mesh(cableGeometry([[rc.x + 0.02, rc.y - 0.04, rc.z], [rc.x + 0.03, rc.y - 0.06, rc.z + 0.01], [rc.x + 0.03, rc.y - 0.09, rc.z + 0.02]], 0.0022, { sag: 0.01 }), MAT.rubber, root);
  rbox(0.014, 0.034, 0.014, 0.004, MAT.plastic, rc.x + 0.03, rc.y - 0.105, rc.z + 0.02, root, 'recoilHandle');
  // The cylinder: a finned barrel leaning a little forward, a silver head with rocker covers, and the plug's cap on the left.
  const cy = E.cylinder;
  const barrel = new THREE.Group();
  barrel.position.set(0, cy.y, cy.z);
  barrel.rotation.x = cy.lean;
  root.add(barrel);
  mesh(new THREE.CylinderGeometry(cy.r, cy.r * 1.05, cy.h, 18), MAT.engine, barrel);
  for (let i = 0; i < 7; i++) mesh(new THREE.CylinderGeometry(cy.r * 1.22, cy.r * 1.22, 0.007, 18).translate(0, -cy.h / 2 + 0.02 + i * 0.026, 0), MAT.engine, barrel);
  rbox(0.15, 0.07, 0.14, 0.02, MAT.engine, 0, cy.h / 2 + 0.02, 0, barrel);
  rbox(0.1, 0.03, 0.1, 0.012, MAT.engineDark, 0, cy.h / 2 + 0.065, 0, barrel);
  mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.034, 10).rotateZ(Math.PI / 2).translate(0.1, cy.h / 2 + 0.02, 0), MAT.plastic, barrel); // the plug's cap
  // The carb, behind the barrel, with the throttle cable into the cap, and the boot back to the airbox.
  const C = ATC_CARB;
  mesh(new THREE.CylinderGeometry(C.r, C.r, C.len, 16).rotateX(Math.PI / 2).translate(C.x, C.y, C.z), MAT.engine, root, 'carb');
  rbox(0.066, 0.066, 0.02, 0.01, MAT.engine, C.x, C.y, C.z + C.len / 2 - 0.004, root);
  rbox(0.054, 0.034, 0.07, 0.01, MAT.engineDark, C.x, C.bowlY, C.z, root);
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 14).translate(C.x, C.capY - 0.012, C.z), MAT.engine, root);
  mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.012, 12).translate(C.x, C.capY + 0.01, C.z), MAT.chrome, root);
  mesh(rod([C.x, C.y, C.z - C.len / 2], [C.x, C.y, C.airboxZ + 0.1], C.r * 0.95, 14), MAT.rubber, root, 'intakeBoot');
  // The choke plunger's barrel and nut on the carb's left, and the plunger itself (the lever the game pulls).
  const pz = C.plungerZ;
  mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.03, 12).rotateZ(Math.PI / 2).translate(C.r + 0.012, C.y, pz), MAT.engineDark, root);
  mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.008, 6).rotateZ(Math.PI / 2).translate(C.r + 0.032, C.y, pz), MAT.chrome, root);
  const mount = new THREE.Group();
  mount.userData.keep = true;
  mount.position.set(C.r + 0.036, C.y, pz);
  mount.rotation.z = Math.PI / 2; // its +y is towards the carb, so pulling down is pulling out
  root.add(mount);
  const choke = new THREE.Group();
  choke.name = 'chokeLever';
  choke.userData.keep = true;
  choke.userData.baseY = 0;
  choke.userData.travel = 0.09;
  mount.add(choke);
  mesh(rod([0, 0, 0], [0, 0.09, 0], 0.005, 8), MAT.chrome, choke);
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.018, 14).translate(0, -0.008, 0), CHOKE_KNOB, choke, 'chokeKnob');
  const symbol = chokeSymbol(CHOKE_MARK);
  symbol.rotation.x = Math.PI / 2;
  symbol.position.set(0, -0.0172, 0);
  choke.add(symbol);
  // The fuel tap on the tank's left lower edge, a black knob, and a hose from it down to the carb's bowl.
  const [tx, ty, tz] = ATC_TAP.pos;
  rbox(0.05, 0.028, 0.034, 0.008, MAT.plastic, tx, ty, tz, root, 'fuelTapBody');
  const tap = new THREE.Group();
  tap.name = 'fuelTap';
  tap.userData.keep = true;
  tap.position.set(tx + 0.03, ty, tz);
  root.add(tap);
  const tapMat = new THREE.MeshStandardMaterial({ color: 0x26282a, roughness: 0.5 });
  mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.01, 14).rotateZ(Math.PI / 2), tapMat, tap);
  mesh(new RoundedBoxGeometry(0.012, 0.007, 0.03, 1, 0.002), tapMat, tap).position.z = 0.019;
  const hose = sweepGeometry([[tx - 0.01, ty - 0.014, tz], [0.08, 0.66, 0.03], [0.05, 0.6, 0.0], [0.03, C.bowlY + 0.004, C.z]], 0.0045, { radial: 6 });
  mesh(hose, MAT.rubber, root, 'fuelHose');
}

/** The exhaust, swept from the cylinder's front round the right of the engine to a can between the tyres; its tip is `exhaustTip`. */
export function addAtcExhaust(root, MAT) {
  const X = ATC_EXHAUST;
  const curve = new THREE.CatmullRomCurve3(X.path.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const n = X.radii.length - 1;
  const radius = (t) => {
    const f = t * n;
    const i = Math.min(n - 1, Math.floor(f));
    const k = f - i;
    return X.radii[i] + (X.radii[i + 1] - X.radii[i]) * (k * k * (3 - 2 * k));
  };
  mesh(sweepGeometry(curve.getPoints(40), radius, { radial: 12 }), MAT.exhaust, root, 'header');
  const [fx, fy, fz] = X.path[0];
  mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.014, 12).rotateX(Math.PI / 2 + ATC_ENGINE.cylinder.lean).translate(fx, fy, fz - 0.004), MAT.steel, root, 'exhaustFlange');
  const a = new THREE.Vector3(...X.can.from);
  const b = new THREE.Vector3(...X.can.to);
  const dir = b.clone().sub(a);
  const len = dir.length();
  const can = new THREE.Group();
  can.position.copy(a).addScaledVector(dir, 0.5);
  can.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  root.add(can);
  mesh(new THREE.CylinderGeometry(X.can.r, X.can.r, len, 16), MAT.exhaust, can, 'silencer');
  mesh(new THREE.CircleGeometry(X.can.r * 0.5, 12).rotateX(-Math.PI / 2).translate(0, len / 2 + 0.001, 0), MAT.hole, can);
  // A stay from the can up to the frame's rear leg.
  tube([X.can.from[0], X.can.from[1] + 0.03, X.can.from[2] - 0.08], [-ATC_FRAME.x, 0.56, -0.38], 0.007, MAT.steel, root, 6);
  const tip = new THREE.Object3D();
  tip.name = 'exhaustTip';
  tip.position.copy(b).addScaledVector(dir.normalize(), 0.012);
  root.add(tip);
}

// Handlebars and the steering's upper half -----------------------------------------

/**
 * The bars and the steering columns, in the bars' frame (origin ATC_BARS_AT): swept chrome bars with a crossbar and pad, the grips (fixed
 * points), the levers (clutch left, brake right), the throttle housing and lamp switch, cables, the two red columns down to the fork's crown
 * with their crossbar, and the rectangular headlamp between them. The key switch (the dash) and the pod mount are the model's.
 */
export function addAtcBars(bars, MAT, paint, lensMat) {
  const T = ATC_BARS;
  pipe([...T.half, ...T.half.slice().reverse().map(([x, y, z]) => [-x, y, z])], 0.0115, MAT.chrome, bars, { bend: 0.03, steps: 4 });
  tube([-T.crossX, T.crossY - 0.004, 0.0], [T.crossX, T.crossY - 0.004, 0.0], 0.009, MAT.chrome, bars, 6);
  rbox(0.2, 0.04, 0.04, 0.016, MAT.plastic, 0, T.crossY + 0.01, -0.07, bars, 'barPad'); // behind the key, which is on the crossbar
  for (const s of [-1, 1]) {
    const grip = mesh(gripGeometry(T.gripLen, 0.016), MAT.rubber, bars, s > 0 ? 'gripLeft' : 'gripRight');
    const a = new THREE.Vector3(s * T.grip[0], T.grip[1], T.grip[2]);
    grip.position.copy(a);
    grip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(s * T.gripDir[0], T.gripDir[1], T.gripDir[2]).normalize());
    // The perch and its lever, curving out ahead of the grip.
    const px = 0.24;
    const py = 0.054;
    rbox(0.03, 0.026, 0.03, 0.008, MAT.engineDark, s * px, py, -0.02, bars);
    const g = new THREE.Group();
    g.position.set(s * px, py, -0.02);
    bars.add(g);
    pipe([[0, 0.004, 0.006], [s * 0.025, 0.01, 0.012], [s * 0.1, 0.01, -0.016], [s * 0.118, 0.006, -0.028]], 0.0055, MAT.alloy, g, { bend: 0.02 });
  }
  rbox(0.04, 0.034, 0.04, 0.01, MAT.plastic, -0.255, 0.056, -0.04, bars, 'throttleHousing'); // the twist grip's housing on the right
  rbox(0.034, 0.028, 0.036, 0.01, MAT.plastic, 0.27, 0.052, -0.044, bars, 'lampSwitch'); // the lights switch on the left
  // Cables from the levers and the throttle housing down to the steering.
  mesh(cableGeometry([[0.24, 0.056, -0.02], [0.16, 0.0, 0.01], [0.08, -0.08, 0.04], [0.04, -0.14, 0.05]], 0.0035, { sag: 0.03 }), MAT.rubber, bars, 'clutchCable');
  mesh(cableGeometry([[-0.255, 0.07, -0.04], [-0.2, 0.0, -0.01], [-0.1, -0.08, 0.03], [-0.045, -0.14, 0.05]], 0.0035, { sag: 0.03 }), MAT.rubber, bars, 'throttleCable');
  mesh(cableGeometry([[-0.24, 0.056, -0.02], [-0.18, -0.01, 0.01], [-0.09, -0.1, 0.05], [-0.05, -0.16, 0.06]], 0.0035, { sag: 0.03 }), MAT.rubber, bars, 'brakeCable');
  // The steering: a clamp block over the two red columns, the columns down to the crown, their crossbar and the lamp.
  const F = ATC_FORK;
  const local = (x, y) => [x, y - ATC_BARS_AT[1], forkZ(y) - ATC_BARS_AT[2]];
  rbox(0.23, 0.032, 0.07, 0.014, MAT.frame, ...local(0, F.clamp + 0.015), bars, 'clampBlock');
  for (const s of [-1, 1]) {
    tube(local(s * F.columnX, F.crown), local(s * F.columnX, F.clamp), 0.024, paint, bars, 12);
    tube(local(s * F.columnX * 0.6, F.clamp), local(s * 0.06, F.clamp + 0.03), 0.02, MAT.frame, bars, 8);
  }
  tube(local(-F.columnX, F.crossbar), local(F.columnX, F.crossbar), 0.014, paint, bars, 8);
  const L = ATC_LAMP;
  const [, ly, lz] = local(0, L.y);
  const lampZ = lz + L.ahead;
  rbox(L.w, L.h, L.d, 0.02, MAT.chrome, 0, ly, lampZ, bars, 'lampHousing');
  rbox(L.w - 0.016, L.h - 0.016, 0.012, 0.01, MAT.reflector, 0, ly, lampZ + L.d / 2 - 0.004, bars);
  const lens = rbox(L.w - 0.02, L.h - 0.02, 0.012, 0.01, lensMat, 0, ly, lampZ + L.d / 2 + 0.002, bars, 'headlight');
  lens.scale.z = 0.8;
  for (const s of [-1, 1]) tube([s * (F.columnX - 0.005), ly, lz + 0.02], [s * (L.w / 2 - 0.01), ly, lampZ], 0.011, MAT.chrome, bars, 6); // the lamp's brackets to the columns
}

// Stickers ---------------------------------------------------------------------

/** The maker's badge and the model's stripe on each side of the tank, a millimetre off its face (flat at its middle). */
export function addAtcDecals(root) {
  for (const s of [-1, 1]) {
    const badge = decalMesh('badge', { maker: MAKER_FOR.atc, model: 'T185' }, { width: 0.12, name: 'badge' });
    badge.position.set(s * 0.1375, 0.86, 0.14);
    badge.rotation.y = s * (Math.PI / 2);
    root.add(badge);
    const stripe = decalMesh('stripes', { colours: ['#d9e6f7', '#1d3f8f'], text: '185 S' }, { width: 0.17, name: 'stripe' });
    stripe.position.set(s * 0.1375, 0.805, 0.14);
    stripe.rotation.y = s * (Math.PI / 2);
    root.add(stripe);
  }
}
