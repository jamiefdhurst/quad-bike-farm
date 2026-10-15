import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bentTube, loftGeometry, rod, sweepGeometry, springGeometry, gripGeometry, mergeStatic } from './quadGeometry.js';
import { cableGeometry, hoseGeometry } from './detail/cables.js';
import { discGeometry, caliperGeometry } from './detail/brakes.js';
import { treadTyre } from './detail/tread.js';
import { decalMesh, MAKER_FOR } from './detail/decals.js';
import { chokeSymbol, silverMaterial } from './blasterDetail.js';
import {
  TZ_WHEELS, TZ_RAKE, forkZ, TZ_BARS_AT, TZ_FORK, TZ_FRONT_FENDER, TZ_PLATE, TZ_BARS, TZ_SEAT, TZ_TAIL, TZ_SHROUD, TZ_TANK, TZ_SIDE_BOARD,
  TZ_RADIATOR, TZ_ENGINE, TZ_CARB, TZ_TAP, TZ_EXHAUST, TZ_SWINGARM, TZ_SHOCK, TZ_FRAME, TZ_CHAIN, TZ_PEGS,
} from './tz65Body.js';

// The mini moto's parts (TODO 94), after a YZ65: forks with gold tubes and blue legs, a high front fender and a front number plate, level
// bars with a crossbar pad, thin shrouds and side boards over a naked engine, an expansion chamber and a silver silencer, an aluminium
// swingarm and monoshock, spoked wheels with discs. The numbers are tz65Body.js's; each builder takes the quad's materials (`MAT`) and
// adds to the group it is given.

const mesh = (geo, mat, parent, name) => {
  const m = new THREE.Mesh(geo, mat);
  if (name) m.name = name;
  parent.add(m);
  return m;
};
const rbox = (w, h, d, r, mat, x, y, z, parent, name) => {
  const m = mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.999), mat, parent, name);
  m.position.set(x, y, z);
  return m;
};
const tube = (a, b, r, mat, parent, radial = 8) => mesh(rod(a, b, r, radial), mat, parent);
const pipe = (corners, r, mat, parent, opts) => mesh(bentTube(corners, r, opts), mat, parent);
const mx = (s, pts) => pts.map(([x, y, z]) => [s * x, y, z]);

const CHOKE_KNOB = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
const CHOKE_MARK = new THREE.MeshStandardMaterial({ color: 0xe9e9e4, roughness: 0.6 });
const GOLD = () => new THREE.MeshStandardMaterial({ color: 0xb38a38, roughness: 0.3, metalness: 0.85 });
const RIM_BLUE = () => new THREE.MeshStandardMaterial({ color: 0x2b55a8, roughness: 0.3, metalness: 0.8 });

const R = TZ_WHEELS.radius;

// Wheels ---------------------------------------------------------------------

const tyres = {};
const tyre = (front) => (tyres[front ? 'f' : 'r'] ??= treadTyre('knobbly', {
  radius: R,
  width: front ? TZ_WHEELS.front : TZ_WHEELS.rear,
  rimR: front ? TZ_WHEELS.rimFront : TZ_WHEELS.rimRear,
  count: 24,
  segments: 32,
}));

/** The tyre, the blue rim with its spokes, the hub and the disc (and the rear sprocket): all of it turns with the wheel, in `spin`. */
export function buildTzSpin(spin, MAT, front) {
  const rimR = front ? TZ_WHEELS.rimFront : TZ_WHEELS.rimRear;
  const half = (front ? TZ_WHEELS.front : TZ_WHEELS.rear) / 2;
  mesh(tyre(front), MAT.rubber, spin);
  const blue = RIM_BLUE();
  mesh(new THREE.TorusGeometry(rimR - 0.006, 0.0105, 6, 32).rotateY(Math.PI / 2), blue, spin);
  // Wire spokes from the hub flanges out to the rim, each crossing its neighbour's way.
  const spokes = [];
  const n = 16;
  for (const s of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const b = a + (s > 0 ? 0.42 : -0.42);
      spokes.push(rod([s * 0.024, Math.sin(a) * 0.032, Math.cos(a) * 0.032], [s * 0.004, Math.sin(b) * (rimR - 0.012), Math.cos(b) * (rimR - 0.012)], 0.0011, 3));
    }
  }
  mesh(mergeGeometries(spokes), MAT.chrome, spin);
  mesh(new THREE.CylinderGeometry(0.034, 0.034, front ? 0.07 : 0.085, 14).rotateZ(Math.PI / 2), MAT.alloy, spin);
  mesh(new THREE.CylinderGeometry(0.012, 0.012, half * 2 + 0.07, 8).rotateZ(Math.PI / 2), MAT.engineDark, spin);
  // The disc on the right (x negative); the rear wheel's sprocket is on the left.
  const { disc, dark } = discGeometry({ r: front ? 0.105 : 0.085, holes: 8, hat: 0.35 });
  const discX = -(half + 0.004);
  mesh(disc.translate(discX, 0, 0), MAT.alloy, spin);
  if (dark) mesh(dark.translate(discX, 0, 0), MAT.hole, spin);
  if (!front) {
    mesh(new THREE.CylinderGeometry(TZ_CHAIN.rearR, TZ_CHAIN.rearR, 0.006, 26).rotateZ(Math.PI / 2).translate(TZ_CHAIN.x, 0, 0), MAT.steel, spin);
    mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.012, 12).rotateZ(Math.PI / 2).translate(TZ_CHAIN.x - 0.004, 0, 0), MAT.engineDark, spin);
  }
  mergeStatic(spin);
}

/** The front wheel's fixed side: the blue lower legs on the axle, the high fender on its stays and the caliper. Local to the axle. */
export function buildTzFork(wheel, MAT, paint) {
  const F = TZ_FORK;
  const ly = (y) => y - R; // world height to the wheel group's
  const lz = (y) => forkZ(y) - TZ_WHEELS.frontZ;
  for (const s of [-1, 1]) {
    tube([s * F.x, 0, 0], [s * F.x, ly(F.lowerTop), lz(F.lowerTop)], 0.0195, paint, wheel, 10);
    rbox(0.034, 0.05, 0.04, 0.012, MAT.alloy, s * F.x, 0.0, 0.0, wheel); // the axle lug
    // A bracket from each leg's top up into the fender.
    rbox(0.026, 0.07, 0.05, 0.008, paint, s * F.x, ly(0.525), lz(0.525), wheel);
  }
  tube([-F.x - 0.03, 0, 0], [F.x + 0.03, 0, 0], 0.011, MAT.engineDark, wheel, 8); // the axle
  // The fender, in the wheel's frame.
  const stations = TZ_FRONT_FENDER.map((st) => ({ ...st, z: st.z - TZ_WHEELS.frontZ, y0: st.y0 - R, y1: st.y1 - R }));
  mesh(loftGeometry(stations, { exponent: 3 }), paint, wheel, 'frontFender');
  // The caliper behind the right leg, over the disc.
  const half = TZ_WHEELS.front / 2;
  mesh(caliperGeometry({ r: 0.105, angle: 0.6, side: 1 }).translate(-(half + 0.004), 0, 0), MAT.engineDark, wheel, 'brakeCaliper');
}

/** The rear brake's caliper (in the rear wheel's group, so it moves with the swingarm). */
export function buildTzRearBrake(wheel, MAT) {
  const half = TZ_WHEELS.rear / 2;
  mesh(caliperGeometry({ r: 0.085, angle: -0.7, side: 1 }).translate(-(half + 0.004), 0, 0), MAT.engineDark, wheel, 'brakeCaliper');
}

// Frame, swingarm, shock, chain -----------------------------------------------

/** The frame: a silver perimeter of tubes round the engine, the head tube on the fork's axis, the swingarm, the shock and the chain. */
export function addTzFrame(root, MAT, silver) {
  const F = TZ_FRAME;
  const run = (s, pts, r, opts = { bend: 0.05, steps: 4 }) => pipe(pts.map(([z, y]) => [s * F.x, y, z]), r, silver, root, opts);
  for (const s of [-1, 1]) {
    run(s, F.spar, 0.014);
    run(s, F.seatRail, 0.012);
    run(s, F.rear, 0.014);
    run(s, F.cradle, 0.013);
  }
  tube([0, F.head[0], forkZ(F.head[0])], [0, F.head[1], forkZ(F.head[1])], 0.024, silver, root, 10);
  for (const y of [0.68, 0.74]) for (const s of [-1, 1]) tube([0, y, forkZ(y)], [s * F.x, y - 0.02, forkZ(y) - 0.0], 0.012, silver, root, 6); // the tubes into the head
  rbox(0.13, 0.02, 0.03, 0.006, silver, 0, 0.605, -0.115, root); // the cross-tube behind the engine
  // The swingarm: two silver boxes from the pivot to the axle, braced across.
  const A = TZ_SWINGARM;
  const dz = A.axle[0] - A.pivot[0];
  const dy = A.axle[1] - A.pivot[1];
  const len = Math.hypot(dz, dy);
  for (const s of [-1, 1]) {
    const arm = rbox(A.w, A.h, len, 0.01, MAT.alloy, s * A.x, (A.pivot[1] + A.axle[1]) / 2, (A.pivot[0] + A.axle[0]) / 2, root, 'swingarm');
    arm.rotation.x = -Math.atan(dy / dz); // pitched down towards the back
  }
  rbox(A.x * 2, 0.025, 0.025, 0.006, MAT.alloy, 0, (A.pivot[1] + A.axle[1]) / 2 + 0.01, (A.pivot[0] + A.axle[0]) / 2 - 0.02, root);
  // The monoshock leaning forward behind the engine: a silver body, a grey spring over its top and a blue ring.
  const S = TZ_SHOCK;
  const a = new THREE.Vector3(0, S.bottom[1], S.bottom[0]);
  const b = new THREE.Vector3(0, S.top[1], S.top[0]);
  const shock = new THREE.Group();
  shock.position.copy(a);
  shock.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  root.add(shock);
  const length = a.distanceTo(b);
  mesh(new THREE.CylinderGeometry(0.02, 0.02, length * 0.55, 12).translate(0, length * 0.275, 0), MAT.alloy, shock);
  mesh(springGeometry(length * 0.5, 0.03, 0.0045, 8).translate(0, length, 0), MAT.steel, shock);
  mesh(new THREE.TorusGeometry(0.03, 0.004, 5, 14).rotateX(Math.PI / 2).translate(0, length * 0.9, 0), RIM_BLUE(), shock);
  // The chain on the left: the two runs between the engine's sprocket and the rear wheel's, which is in the wheel (buildTzSpin).
  const E = TZ_ENGINE.sprocket;
  const rz = TZ_WHEELS.rearZ;
  const top = [E.x, E.y + E.r, E.z];
  const rearTop = [TZ_CHAIN.x, R + TZ_CHAIN.rearR, rz];
  const low = [E.x, E.y - E.r, E.z];
  const rearLow = [TZ_CHAIN.x, R - TZ_CHAIN.rearR, rz];
  tube(top, rearTop, 0.0055, MAT.steel, root, 5);
  tube(low, rearLow, 0.0055, MAT.steel, root, 5);
  mesh(new THREE.CylinderGeometry(E.r, E.r, 0.012, 14).rotateZ(Math.PI / 2).translate(E.x, E.y, E.z), MAT.steel, root);
  // The chain guard and slider: a short black block over the top run.
  rbox(0.02, 0.012, 0.12, 0.004, MAT.plastic, TZ_CHAIN.x, 0.325, -0.34, root);
}

// Body ----------------------------------------------------------------------

/** The outline polygon [z, y] as a thin board `thick` wide in x, outer face at x. */
function boardGeometry(outline, thick) {
  const shape = new THREE.Shape(outline.map(([z, y]) => new THREE.Vector2(-z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 1, curveSegments: 4 });
  g.rotateY(Math.PI / 2); // shape x (= -z) to world z, extrusion to +x
  return g;
}

/** The seat, the rear fender under it, the shrouds, the black tank, the side boards and the radiator covers. */
export function addTzBody(root, MAT, paint, seatMat) {
  mesh(loftGeometry(TZ_SEAT, { exponent: 3, segments: 28 }), seatMat, root, 'seat');
  mesh(loftGeometry(TZ_TAIL, { exponent: 3.5 }), paint, root, 'tail');
  for (const s of [-1, 1]) {
    mesh(loftGeometry(TZ_SHROUD.map((st) => ({ ...st, x: s * st.x })), { exponent: 3 }), paint, root, 'shroud');
    const board = mesh(boardGeometry(TZ_SIDE_BOARD.outline, TZ_SIDE_BOARD.thick), paint, root, 'sideBoard');
    board.position.x = s * (TZ_SIDE_BOARD.x - TZ_SIDE_BOARD.thick / 2);
    if (s < 0) board.scale.x = -1;
    const Rd = TZ_RADIATOR;
    rbox(Rd.w, Rd.h, Rd.d, 0.008, MAT.plastic, s * Rd.x, Rd.y, Rd.z, root, 'radiatorCover');
    for (let i = 0; i < 4; i++) rbox(0.008, 0.01, Rd.d - 0.04, 0.003, MAT.hole, s * (Rd.x + Rd.w / 2 + 0.002), Rd.y - 0.045 + i * 0.03, Rd.z, root);
  }
  mesh(loftGeometry(TZ_TANK.stations, { exponent: 3 }), MAT.plastic, root, 'tank');
  const cap = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 14), MAT.plastic, root, 'tankCap');
  cap.position.set(0, TZ_TANK.cap.y, TZ_TANK.cap.z);
  mesh(new THREE.TorusGeometry(0.022, 0.003, 5, 16).rotateX(Math.PI / 2).translate(0, TZ_TANK.cap.y + 0.006, TZ_TANK.cap.z), MAT.steel, root);
}

/** Pegs, the brake pedal (right) and the gear lever (left). */
export function addTzPegs(root, MAT) {
  const P = TZ_PEGS;
  for (const s of [-1, 1]) {
    tube([s * 0.07, P.y, P.z], [s * (P.x - 0.03), P.y, P.z], 0.011, MAT.steel, root, 6);
    rbox(0.07, 0.016, 0.03, 0.005, MAT.steel, s * P.x, P.y, P.z, root, s > 0 ? 'pegLeft' : 'pegRight');
  }
  pipe([[-0.09, 0.24, -0.1], [-0.13, 0.215, -0.02], [-0.15, 0.215, 0.05]], 0.007, MAT.steel, root, { bend: 0.03, steps: 3 });
  rbox(0.04, 0.008, 0.026, 0.003, MAT.steel, -0.15, 0.218, 0.062, root);
  pipe([[0.08, 0.295, -0.04], [0.12, 0.3, 0.02], [0.15, 0.285, 0.085]], 0.006, MAT.steel, root, { bend: 0.03, steps: 3 });
  rbox(0.022, 0.014, 0.028, 0.004, MAT.rubber, 0.155, 0.285, 0.09, root);
}

// Engine ----------------------------------------------------------------------

/**
 * The engine in the open: crankcase with its covers, the recoil starter's cup and cord handle on the left, the barrel and head, the carb
 * behind with the choke plunger (named chokeLever, pulled out along +x by quad.js) and a tap with its hose, and the airbox boot.
 */
export function addTzEngine(root, MAT, paint) {
  const E = TZ_ENGINE;
  const c = E.case;
  rbox(c.w, c.h, c.d, 0.03, MAT.engine, 0, c.y, c.z, root, 'crankcase');
  rbox(c.w * 0.7, c.h * 0.55, 0.1, 0.02, MAT.engine, 0, c.y - 0.03, -0.14, root); // the gearbox behind
  // The clutch cover on the right: round, with the maker's raised name.
  mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 20).rotateZ(Math.PI / 2).translate(-(c.w / 2 + 0.008), c.y - 0.01, c.z - 0.01), MAT.alloy, root);
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 14).rotateZ(Math.PI / 2).translate(-(c.w / 2 + 0.02), c.y - 0.01, c.z - 0.01), MAT.engineDark, root);
  // The recoil starter: a black cup over the flywheel on the left with its cord handle hanging from it.
  const rc = E.recoil;
  mesh(new THREE.CylinderGeometry(rc.r, rc.r, 0.04, 20).rotateZ(Math.PI / 2).translate(rc.x, rc.y, rc.z), MAT.plastic, root, 'recoilStarter');
  mesh(new THREE.CylinderGeometry(rc.r * 0.55, rc.r * 0.55, 0.01, 14).rotateZ(Math.PI / 2).translate(rc.x + 0.024, rc.y, rc.z), MAT.engineDark, root);
  mesh(cableGeometry([[rc.x + 0.02, rc.y - 0.04, rc.z], [rc.x + 0.03, rc.y - 0.06, rc.z + 0.01], [rc.x + 0.03, rc.y - 0.09, rc.z + 0.02]], 0.0022, { sag: 0.01 }), MAT.rubber, root);
  rbox(0.014, 0.034, 0.014, 0.004, MAT.plastic, rc.x + 0.03, rc.y - 0.105, rc.z + 0.02, root, 'recoilHandle');
  // The cylinder: a finned barrel leaning forward, a silver head, an exhaust flange on its front.
  const cy = E.cylinder;
  const barrel = new THREE.Group();
  barrel.position.set(0, cy.y, cy.z);
  barrel.rotation.x = cy.lean;
  root.add(barrel);
  mesh(new THREE.CylinderGeometry(cy.r, cy.r * 1.08, cy.h, 16), MAT.engineDark, barrel);
  for (let i = 0; i < 5; i++) mesh(new THREE.CylinderGeometry(cy.r * 1.2, cy.r * 1.2, 0.006, 16).translate(0, -cy.h / 2 + 0.014 + i * 0.022, 0), MAT.engineDark, barrel);
  mesh(new THREE.CylinderGeometry(cy.r * 1.1, cy.r * 1.1, 0.05, 16).translate(0, cy.h / 2 + 0.02, 0), MAT.alloy, barrel);
  mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 10).translate(0, cy.h / 2 + 0.05, 0), MAT.plastic, barrel); // the spark plug's cap
  // The carb: a mixing chamber along z, a slide cap and a float bowl, on the barrel's rear, with the throttle cable into the cap.
  const C = TZ_CARB;
  mesh(new THREE.CylinderGeometry(C.r, C.r, C.len, 16).rotateX(Math.PI / 2).translate(C.x, C.y, C.z), MAT.engine, root, 'carb');
  rbox(0.062, 0.062, 0.02, 0.01, MAT.engine, C.x, C.y, C.z + C.len / 2 - 0.004, root);
  rbox(0.05, 0.034, 0.066, 0.01, MAT.engineDark, C.x, C.bowlY, C.z, root);
  mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 14).translate(C.x, C.capY - 0.01, C.z), MAT.engine, root);
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 12).translate(C.x, C.capY + 0.012, C.z), MAT.chrome, root);
  // The intake boot back to the airbox under the seat, and the airbox.
  const boot = hoseGeometry([[C.x, C.y, C.z - C.len / 2], [C.x, C.y + 0.003, -0.14], [C.x, C.y, C.airboxZ + 0.1]], 0.027, { sag: 0 });
  mesh(boot.hose, MAT.rubber, root, 'intakeBoot');
  mesh(boot.clamps, MAT.steel, root);
  rbox(0.14, 0.12, 0.2, 0.03, MAT.plastic, 0, 0.57, C.airboxZ, root, 'airbox');
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
  choke.userData.travel = 0.09; // it comes out well clear of its barrel, so you can see it is on
  mount.add(choke);
  mesh(rod([0, 0, 0], [0, 0.09, 0], 0.005, 8), MAT.chrome, choke);
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.018, 14).translate(0, -0.008, 0), CHOKE_KNOB, choke, 'chokeKnob');
  const symbol = chokeSymbol(CHOKE_MARK);
  symbol.rotation.x = Math.PI / 2;
  symbol.position.set(0, -0.0172, 0);
  choke.add(symbol);
  // The fuel tap on the tank's left lower edge, a black knob, and the hose from it down to the bowl.
  const [tx, ty, tz] = TZ_TAP.pos;
  rbox(0.05, 0.028, 0.034, 0.008, MAT.plastic, tx, ty, tz, root, 'fuelTapBody');
  const tap = new THREE.Group();
  tap.name = 'fuelTap';
  tap.userData.keep = true;
  tap.position.set(tx + 0.03, ty, tz);
  root.add(tap);
  const tapMat = new THREE.MeshStandardMaterial({ color: 0x26282a, roughness: 0.5 });
  mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.01, 14).rotateZ(Math.PI / 2), tapMat, tap);
  mesh(new RoundedBoxGeometry(0.012, 0.007, 0.03, 1, 0.002), tapMat, tap).position.z = 0.019;
  const hose = hoseGeometry([[tx - 0.01, ty - 0.014, tz], [0.07, 0.58, 0.03], [0.05, 0.54, 0.0], [0.03, C.bowlY + 0.004, C.z]], 0.0045, { sag: 0.01, radial: 6, clamps: false });
  mesh(hose.hose, MAT.rubber, root, 'fuelHose');
}

/** The expansion chamber, swept from the cylinder's front round the engine to the silver silencer; its tip is `exhaustTip`. */
export function addTzExhaust(root, MAT) {
  const X = TZ_EXHAUST;
  const curve = new THREE.CatmullRomCurve3(X.path.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const n = X.radii.length - 1;
  const radius = (t) => {
    const f = t * n;
    const i = Math.min(n - 1, Math.floor(f));
    const k = f - i;
    return X.radii[i] + (X.radii[i + 1] - X.radii[i]) * (k * k * (3 - 2 * k));
  };
  mesh(sweepGeometry(curve.getPoints(48), radius, { radial: 14 }), MAT.exhaust, root, 'chamber');
  // The silencer: a closed silver can, a heat shield's worth of dark band, and a dark mouth.
  const a = new THREE.Vector3(...X.can.from);
  const b = new THREE.Vector3(...X.can.to);
  const dir = b.clone().sub(a);
  const len = dir.length();
  const can = new THREE.Group();
  can.position.copy(a).addScaledVector(dir, 0.5);
  can.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  root.add(can);
  mesh(new THREE.CylinderGeometry(X.can.r, X.can.r, len, 16), MAT.alloy, can, 'silencer');
  for (const t of [-0.3, 0.3]) mesh(new THREE.CylinderGeometry(X.can.r * 1.06, X.can.r * 1.06, 0.012, 16).translate(0, len * t, 0), MAT.steel, can);
  mesh(new THREE.CircleGeometry(X.can.r * 0.55, 12).rotateX(-Math.PI / 2).translate(0, len / 2 + 0.001, 0), MAT.hole, can);
  const tip = new THREE.Object3D();
  tip.name = 'exhaustTip';
  tip.position.copy(b).addScaledVector(dir.normalize(), 0.012);
  root.add(tip);
}

// Handlebars ----------------------------------------------------------------

/**
 * The bars and the steering assembly's upper half, in the bars' frame (origin TZ_BARS_AT): the bars, crossbar and pad, the grips (fixed
 * points), the levers, the throttle housing, the cables, the gold fork tubes and the clamps and the front number plate. The key switch (the
 * dash) and the pod mount are the model's.
 */
export function addTzBars(bars, MAT, paint) {
  const T = TZ_BARS;
  const half = T.half;
  pipe([...half, ...half.slice().reverse().map(([x, y, z]) => [-x, y, z])], 0.0108, MAT.frame, bars, { bend: 0.025, steps: 4 });
  tube([-T.crossX, T.crossY - 0.004, 0.004], [T.crossX, T.crossY - 0.004, 0.004], 0.008, MAT.frame, bars, 6);
  rbox(T.pad.w, T.pad.h, T.pad.d, 0.012, MAT.plastic, 0, T.pad.y, T.pad.z, bars, 'barPad');
  rbox(T.pad.w - 0.01, 0.008, 0.004, 0.002, MAT.steel, 0, T.pad.y, T.pad.z + T.pad.d / 2 + 0.001, bars); // the pad's maker's band
  for (const s of [-1, 1]) {
    const grip = mesh(gripGeometry(T.gripLen, 0.0145), MAT.rubber, bars, s > 0 ? 'gripLeft' : 'gripRight');
    const a = new THREE.Vector3(s * T.grip[0], T.grip[1], T.grip[2]);
    grip.position.copy(a);
    grip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(s * T.gripDir[0], T.gripDir[1], T.gripDir[2]).normalize());
    // The perch and its lever (clutch on the left, brake on the right), curving out ahead of the grip.
    const lever = [[0, 0.004, 0.006], [s * 0.02, 0.01, 0.012], [s * 0.085, 0.01, -0.016], [s * 0.1, 0.006, -0.026]];
    const px = s > 0 ? 0.225 : 0.2;
    const py = 0.052;
    rbox(0.03, 0.026, 0.03, 0.008, MAT.engineDark, s * px, py, -0.02, bars);
    const g = new THREE.Group();
    g.position.set(s * px, py, -0.02);
    bars.add(g);
    pipe(lever, 0.0052, MAT.alloy, g, { bend: 0.02 });
  }
  // The brake's master cylinder reservoir on the right, and the throttle's housing outboard of it.
  mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.024, 12).translate(-0.2, 0.078, -0.02), MAT.engineDark, bars);
  rbox(0.036, 0.032, 0.036, 0.01, MAT.plastic, -0.245, 0.056, -0.034, bars, 'throttleHousing');
  // Cables: the clutch's from the left perch and the throttle's from its housing, down to the steering head; the brake's hose likewise.
  mesh(cableGeometry([[0.222, 0.06, -0.02], [0.16, 0.0, 0.01], [0.08, -0.08, 0.04], [0.04, -0.12, 0.03]], 0.0035, { sag: 0.03 }), MAT.rubber, bars, 'clutchCable');
  mesh(cableGeometry([[-0.255, 0.07, -0.04], [-0.2, 0.0, -0.01], [-0.1, -0.08, 0.03], [-0.045, -0.12, 0.03]], 0.0035, { sag: 0.03 }), MAT.rubber, bars, 'throttleCable');
  mesh(hoseGeometry([[-0.205, 0.055, -0.01], [-0.14, 0.0, 0.04], [-0.09, -0.07, 0.06], [-0.07, -0.13, 0.05]], 0.0042, { sag: 0.02, radial: 6, clamps: false }).hose, MAT.engineDark, bars, 'brakeHose');
  // The fork's top: the clamps, the stem between them, the gold tubes, and the plate on their face.
  const F = TZ_FORK;
  const local = (x, y) => [x, y - TZ_BARS_AT[1], forkZ(y) - TZ_BARS_AT[2]];
  const gold = GOLD();
  for (const s of [-1, 1]) {
    tube(local(s * F.x, F.upperBottom), local(s * F.x, F.upperTop), 0.0155, gold, bars, 10);
    rbox(0.034, 0.026, 0.034, 0.01, MAT.frame, ...local(s * 0.045, 0.815), bars); // the bar riser
  }
  for (const y of [F.lowerClamp, F.upperClamp]) {
    const [, ly, lz] = local(0, y);
    rbox(0.18, 0.026, 0.06, 0.01, MAT.frame, 0, ly, lz, bars);
  }
  tube(local(0, F.lowerClamp), local(0, F.upperClamp), 0.02, MAT.alloy, bars, 8);
  const [, py, pz] = local(0, TZ_PLATE.y);
  const plate = rbox(TZ_PLATE.w, TZ_PLATE.h, TZ_PLATE.d, 0.012, paint, 0, py, pz + TZ_PLATE.ahead + 0.01, bars, 'numberPlate');
  plate.rotation.x = -Math.atan(TZ_RAKE);
  rbox(TZ_PLATE.w * 0.5, 0.05, 0.01, 0.004, MAT.plastic, 0, py - 0.075, pz + TZ_PLATE.ahead - 0.014, bars); // the plate's strap behind
}

// Stickers ---------------------------------------------------------------------

/** The maker's badge and the model's stripe on each side board, a millimetre off its face (which is flat). */
export function addTzDecals(root) {
  const x = TZ_SIDE_BOARD.x + 0.001 + 0.003; // the board's bevel is 3 mm
  for (const s of [-1, 1]) {
    const badge = decalMesh('badge', { maker: MAKER_FOR.moto, model: 'TZ 65' }, { width: 0.15, name: 'badge' });
    badge.position.set(s * x, 0.655, -0.38);
    badge.rotation.y = s * (Math.PI / 2);
    root.add(badge);
    const stripe = decalMesh('stripes', { colours: ['#cfe3fb', '#0b2a63'], text: 'TZ 65' }, { width: 0.2, name: 'stripe' });
    stripe.position.set(s * x, 0.595, -0.37);
    stripe.rotation.y = s * (Math.PI / 2);
    root.add(stripe);
  }
}

export { silverMaterial };
