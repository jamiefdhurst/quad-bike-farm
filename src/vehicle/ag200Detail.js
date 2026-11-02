import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loftGeometry, rod, sweepGeometry, springGeometry, gripGeometry, mergeStatic } from './quadGeometry.js';
import { cableGeometry, hoseGeometry } from './detail/cables.js';
import { drumGeometry } from './detail/brakes.js';
import { treadTyre } from './detail/tread.js';
import { buildChainDrive } from './detail/chainDrive.js';
import { decalMesh, MAKER_FOR } from './detail/decals.js';
import { chokeSymbol } from './blasterDetail.js';
import { mesh, rbox, tube, pipe, CHOKE_KNOB, CHOKE_MARK } from './tz65Detail.js';
import { fenderGeometry } from './bantamDetail.js';
import {
  AG_WHEELS, forkZ, AG_BARS_AT, AG_FORK, AG_BARS, AG_SEAT, AG_STRAP, AG_TANK, AG_PANEL, AG_LAMP, AG_FRONT_FENDER, AG_REAR_FENDER, AG_FRAME,
  AG_SWINGARM, AG_SHOCK, AG_ENGINE, AG_CARB, AG_TAP, AG_EXHAUST, AG_KICK, AG_PEGS, AG_PILLION_PEGS, AG_STAND, AG_REAR_RACK, AG_FRONT_RACK, AG_TAIL,
} from './ag200Body.js';

// The farm bike's parts (#75), after a Yamaha AG200: spoked wheels with knobbly tyres and drum brakes, long-travel forks with a high front
// mudguard, a steel cradle frame with a swingarm and a single shock, a small air-cooled single with an upswept exhaust and a heat shield, a
// long flat dual seat with a grab strap, steel racks front and back, hand guards, a kickstart on the right. The numbers are ag200Body.js's; each
// builder takes the quad's materials (`MAT`) and adds to the group it is given.

const R = AG_WHEELS.radius;

/** Flat-faded paint for the racks and brackets: tubular steel painted silver, scuffed to bare metal at the edges. */
export const rackMaterial = () => new THREE.MeshStandardMaterial({ color: 0x8d9094, roughness: 0.5, metalness: 0.6 });

// Wheels ---------------------------------------------------------------------

const tyres = {};
const tyre = (front) => (tyres[front ? 'f' : 'r'] ??= treadTyre('knobbly', {
  radius: R,
  width: AG_WHEELS.width,
  rimR: front ? AG_WHEELS.rim : AG_WHEELS.rimRear,
  count: 22,
  segments: 32,
}));

/** The tyre, the rim with its crossed spokes, the drum hub (and the rear sprocket): all of it turns with the wheel, in `spin`. */
export function buildAgSpin(spin, MAT, front) {
  const rimR = front ? AG_WHEELS.rim : AG_WHEELS.rimRear;
  mesh(tyre(front), MAT.rubber, spin);
  mesh(new THREE.TorusGeometry(rimR - 0.004, 0.0095, 6, 36).rotateY(Math.PI / 2), MAT.alloy, spin);
  const spokes = [];
  const n = 18;
  const hubR = 0.07;
  for (const s of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const b = a + (s > 0 ? 0.5 : -0.5);
      spokes.push(rod([s * 0.03, Math.sin(a) * hubR * 0.9, Math.cos(a) * hubR * 0.9], [s * 0.004, Math.sin(b) * (rimR - 0.008), Math.cos(b) * (rimR - 0.008)], 0.0011, 3));
    }
  }
  mesh(mergeGeometries(spokes), MAT.steel, spin);
  // The drum hub: a ribbed alloy drum between the spoke flanges, and the spindle through it.
  mesh(drumGeometry({ r: hubR, width: 0.06, fins: 8, side: 1 }).drum, MAT.alloy, spin, 'hubDrum');
  mesh(new THREE.CylinderGeometry(0.013, 0.013, AG_WHEELS.width + 0.07, 8).rotateZ(Math.PI / 2), MAT.engineDark, spin);
  if (!front) mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.014, 12).rotateZ(Math.PI / 2).translate(0.04, 0, 0), MAT.engineDark, spin);
  mergeStatic(spin);
}

/** The front wheel's fixed side: the silver lower legs on the axle and the high front mudguard on its stays. Local to the axle. */
export function buildAgFork(wheel, MAT, paint) {
  const F = AG_FORK;
  const ly = (y) => y - R; // world height to the wheel group's
  const lz = (y) => forkZ(y) - AG_WHEELS.frontZ;
  for (const s of [-1, 1]) {
    tube([s * F.x, 0, 0], [s * F.x, ly(F.lowerTop), lz(F.lowerTop)], 0.0185, MAT.alloy, wheel, 10);
    rbox(0.034, 0.05, 0.04, 0.012, MAT.alloy, s * F.x, 0.0, 0.0, wheel); // the axle lug
    // The mudguard's stay from each leg, up and out to the guard's sides: the guard stands well clear of the tyre.
    const a = (-12 * Math.PI) / 180; // up behind the axle to a point on the guard's arc, clear of the tyre
    tube([s * (F.x + 0.012), ly(0.6), lz(0.6)], [s * 0.04, AG_FRONT_FENDER.r * Math.cos(a) - 0.004, AG_FRONT_FENDER.r * Math.sin(a)], 0.006, paint, wheel, 6);
    // The little reflector bracket on each leg's outside.
    rbox(0.012, 0.03, 0.02, 0.004, MAT.reflector, s * (F.x + 0.022), ly(0.4), lz(0.4), wheel);
  }
  tube([-F.x - 0.04, 0, 0], [F.x + 0.04, 0, 0], 0.01, MAT.engineDark, wheel, 8); // the axle
  mesh(fenderGeometry(AG_FRONT_FENDER), paint, wheel, 'frontFender');
  // The drum's backing plate and its torque arm: a strap up to the left leg.
  mesh(drumGeometry({ r: 0.07, width: 0.06, fins: 8, side: 1 }).plate, MAT.engineDark, wheel, 'brakePlate');
  tube([0.05, 0.02, 0], [F.x, ly(0.4), lz(0.4)], 0.005, MAT.steel, wheel, 6);
}

/** The rear drum's backing plate and brake arm, in the wheel's group so they move with it. */
export function buildAgRearBrake(wheel, MAT) {
  mesh(drumGeometry({ r: 0.07, width: 0.06, fins: 8, side: 1 }).plate, MAT.engineDark, wheel, 'brakePlate');
}

// Frame ------------------------------------------------------------------------

/** The cradle frame: head tube on the fork's axis, top tube and downtube, cradle, the seat rails and stays, swingarm, single shock, chain, stand. */
export function addAgFrame(root, MAT) {
  const F = AG_FRAME;
  const at = (run, s) => run.map(([z, y]) => [s * F.x, y, z]);
  const frame = MAT.frame;
  tube([0, F.head[0], forkZ(F.head[0])], [0, F.head[1], forkZ(F.head[1])], 0.024, frame, root, 10);
  pipe([[0, 0.9, forkZ(0.9) - 0.004], ...F.top.slice(1).map(([z, y]) => [0, y, z])], 0.015, frame, root, { bend: 0.05, steps: 4 });
  pipe([[0, 0.82, forkZ(0.82)], [0, 0.5, 0.26], [0, 0.3, 0.2]], 0.016, frame, root, { bend: 0.06, steps: 4 });
  for (const s of [-1, 1]) {
    pipe(at(F.cradle, s), 0.0125, frame, root, { bend: 0.06, steps: 4 });
    pipe(at(F.seatRail, s), 0.0115, frame, root, { bend: 0.05, steps: 4 });
    pipe(at(F.seatStay, s), 0.0105, frame, root, { bend: 0.06, steps: 4 });
  }
  // Cross tubes so every tube meets another: at the seat tube, under the tail, across the cradle's front.
  tube([-F.x, 0.7, -0.1], [F.x, 0.7, -0.1], 0.011, frame, root, 8);
  tube([-F.x, 0.7, -0.76], [F.x, 0.7, -0.76], 0.009, frame, root, 8);
  tube([-F.x, 0.2, 0.12], [F.x, 0.2, 0.12], 0.009, frame, root, 8);
  tube([-F.x, 0.28, -0.3], [F.x, 0.28, -0.3], 0.011, frame, root, 8);
  // The swingarm: two boxes from the pivot to the axle, braced across.
  const A = AG_SWINGARM;
  const dz = A.axle[0] - A.pivot[0];
  const dy = A.axle[1] - A.pivot[1];
  const len = Math.hypot(dz, dy);
  for (const s of [-1, 1]) {
    const arm = rbox(A.w, A.h, len, 0.01, MAT.frame, s * A.x, (A.pivot[1] + A.axle[1]) / 2, (A.pivot[0] + A.axle[0]) / 2, root, 'swingarm');
    arm.rotation.x = Math.atan(dy / dz);
    tube([s * F.x, A.pivot[1], A.pivot[0]], [s * A.x, A.pivot[1], A.pivot[0]], 0.012, MAT.steel, root, 8); // the pivot bolt through the frame's cradle
  }
  rbox(A.x * 2, 0.025, 0.025, 0.006, MAT.frame, 0, (A.pivot[1] + A.axle[1]) / 2 + 0.01, (A.pivot[0] + A.axle[0]) / 2 - 0.02, root);
  // The single shock leaning forward from the swingarm's cross to the frame under the seat, a black body, a silver spring and a dust cover.
  const S = AG_SHOCK;
  const a = new THREE.Vector3(0, S.bottom[1], S.bottom[0]);
  const b = new THREE.Vector3(0, S.top[1], S.top[0]);
  const shock = new THREE.Group();
  shock.position.copy(a);
  shock.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  root.add(shock);
  const length = a.distanceTo(b);
  mesh(new THREE.CylinderGeometry(0.02, 0.02, length * 0.55, 12).translate(0, length * 0.275, 0), MAT.engineDark, shock);
  mesh(springGeometry(length * 0.55, 0.03, 0.0045, 9).translate(0, length * 0.7, 0), MAT.steel, shock);
  tube([0, 0, 0], [0, 0, 0.05], 0.012, MAT.steel, shock, 6);
  // The chain and both sprockets, with a slider over the top run.
  const E = AG_ENGINE.sprocket;
  buildChainDrive(root, { x: E.x, front: { y: E.y, z: E.z, r: E.r }, rear: { y: R, z: AG_WHEELS.rearZ, r: 0.075 } });
  rbox(0.02, 0.012, 0.12, 0.004, MAT.plastic, E.x, 0.4, -0.42, root);
  // The centre stand folded under the cradle: two legs to a cross foot, with a spring.
  const St = AG_STAND;
  for (const s of [-1, 1]) tube([s * 0.065, 0.2, St.z - 0.02], [s * 0.11, St.y, St.z - 0.1], 0.0085, MAT.steel, root, 6);
  tube([-St.w / 2, St.y, St.z - 0.1], [St.w / 2, St.y, St.z - 0.1], 0.0085, MAT.steel, root, 6);
  tube([-0.065, 0.2, St.z - 0.02], [0.065, 0.2, St.z - 0.02], 0.0075, MAT.steel, root, 6);
  // The side stand on the left: a bar from the frame down and out to a foot.
  pipe([[0.07, 0.24, -0.2], [0.15, 0.1, -0.22], [0.22, 0.04, -0.2]], 0.0085, MAT.steel, root, { bend: 0.03, steps: 3 });
  rbox(0.05, 0.012, 0.045, 0.004, MAT.steel, 0.23, 0.036, -0.2, root);
}

// Bodywork ---------------------------------------------------------------------

/** The dual seat, the strap, the tank, the side panels, the rear mudguard and tail, and the rear rack with its twine. */
export function addAgBody(root, MAT, paint, seatMat, rack) {
  mesh(loftGeometry(AG_SEAT, { exponent: 3, segments: 28 }), seatMat, root, 'seat');
  // The seat's pillion half is its own named mesh for the wear layer: the same loft's rear stations, a hair proud so a worn patch can sit on it.
  mesh(loftGeometry(AG_SEAT.slice(2).map((st) => ({ ...st, y1: st.y1 + 0.002 })), { exponent: 3, segments: 20 }), seatMat, root, 'pillionSeat');
  // The grab strap: a loop of strap across the back of the seat, ends bolted either side.
  const T = AG_STRAP;
  const strap = new THREE.CatmullRomCurve3([[-T.half, T.y - 0.01, T.z], [-T.half * 0.6, T.y + 0.03, T.z], [T.half * 0.6, T.y + 0.03, T.z], [T.half, T.y - 0.01, T.z]].map((p) => new THREE.Vector3(...p)));
  mesh(sweepGeometry(strap.getPoints(14), () => 0.011, { radial: 6 }), MAT.rubber, root, 'grabStrap');
  for (const s of [-1, 1]) rbox(0.03, 0.01, 0.04, 0.004, MAT.steel, s * T.half, T.y - 0.012, T.z, root);
  // The tank, its cap, and a knee pad each side.
  mesh(loftGeometry(AG_TANK.stations, { exponent: 3, segments: 28 }), paint, root, 'tank');
  const cap = mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.014, 14), MAT.plastic, root, 'tankCap');
  cap.position.set(0, AG_TANK.cap.y, AG_TANK.cap.z);
  mesh(new THREE.TorusGeometry(0.028, 0.004, 5, 16).rotateX(Math.PI / 2).translate(0, AG_TANK.cap.y + 0.006, AG_TANK.cap.z), MAT.steel, root);
  for (const s of [-1, 1]) rbox(0.014, 0.12, 0.14, 0.005, MAT.rubber, s * 0.087, 0.88, 0.09, root, 'kneePad');
  // The side panels under the seat, in the body paint.
  const P = AG_PANEL;
  for (const s of [-1, 1]) {
    const panel = rbox(0.022, P.y1 - P.y0, P.z0 - P.z1, 0.01, paint, s * P.x, (P.y0 + P.y1) / 2, (P.z0 + P.z1) / 2, root, 'sidePanel');
    panel.rotation.z = s * -0.08;
  }
  // The rear mudguard, a plain strip under the seat's tail over the wheel, with a long rubber flap and the number plate on it.
  const rf = mesh(fenderGeometry(AG_REAR_FENDER), paint, root, 'rearFender');
  rf.position.set(0, R, AG_WHEELS.rearZ);
  for (const s of [-1, 1]) tube([s * 0.075, R + 0.34, AG_WHEELS.rearZ - 0.04], [s * 0.07, 0.69, -0.74], 0.006, paint, root, 6);
  const Tl = AG_TAIL;
  rbox(0.1, 0.05, 0.065, 0.012, MAT.plastic, 0, Tl.y, Tl.z, root, 'tailHousing');
  rbox(0.085, 0.04, 0.02, 0.01, MAT.tail, 0, Tl.y, Tl.z - 0.034, root, 'tailLight');
  rbox(0.2, 0.15, 0.008, 0.004, MAT.rubber, 0, Tl.y - 0.1, Tl.z - 0.02, root, 'numberPlate');
  rbox(0.2, 0.22, 0.01, 0.004, MAT.rubber, 0, 0.42, -1.0, root, 'mudFlap');
  // Indicators on short stalks at the rack's back corners.
  for (const s of [-1, 1]) {
    tube([s * 0.09, 0.76, -0.9], [s * 0.15, 0.76, -0.95], 0.004, MAT.steel, root, 5);
    rbox(0.035, 0.03, 0.03, 0.01, new THREE.MeshStandardMaterial({ color: 0xd9822a, roughness: 0.25 }), s * 0.16, 0.76, -0.96, root, 'indicator');
  }
  // The rear rack: a flat tubular steel rack over the wheel, a rail each side with a crossbar every so often, legs down to the seat rails and the
  // axle, a bit of orange baler twine knotted on the left rail.
  const K = AG_REAR_RACK;
  const hw = K.w / 2;
  const rails = [];
  for (const s of [-1, 1]) {
    pipe([[s * hw, 0.74, K.z0 + 0.04], [s * hw, K.y, K.z0], [s * hw, K.y, K.z1], [s * hw, 0.74, K.z1 - 0.02]], 0.0075, rack, root, { bend: 0.04, steps: 3 });
    tube([s * hw, K.y, K.z0 + 0.03], [s * 0.07, 0.7, -0.45], 0.006, rack, root, 6); // a leg down to the seat rail
    tube([s * hw, K.y, K.z1 + 0.1], [s * 0.07, 0.72, -0.76], 0.006, rack, root, 6); // and one at the back to the tail
  }
  for (const z of [K.z0, (K.z0 * 2 + K.z1) / 3, (K.z0 + K.z1 * 2) / 3, K.z1]) tube([-hw, K.y, z], [hw, K.y, z], 0.0065, rack, root, 6);
  void rails;
  const twine = new THREE.CatmullRomCurve3([[0.095, K.y + 0.002, -0.72], [0.1, K.y + 0.025, -0.725], [0.082, K.y + 0.03, -0.73], [0.088, K.y - 0.004, -0.735]].map((p) => new THREE.Vector3(...p)));
  mesh(sweepGeometry(twine.getPoints(12), () => 0.0028, { radial: 5 }), new THREE.MeshStandardMaterial({ color: 0xd2762a, roughness: 0.95 }), root, 'twine');
}

// Engine ----------------------------------------------------------------------

/** The kickstart pedal's pivot group on the right: a lever resting forward and down with a rubber; named `kickStart` (the game poses it). */
function addKickStart(root, MAT) {
  const K = AG_KICK;
  const pivot = new THREE.Group();
  pivot.name = 'kickStart';
  pivot.userData.keep = true;
  pivot.userData.restAngle = K.restAngle;
  pivot.position.set(K.x, K.y, K.z);
  pivot.rotation.x = K.restAngle;
  root.add(pivot);
  mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.026, 10).rotateZ(Math.PI / 2), MAT.steel, pivot);
  tube([K.x + 0.08, K.y, K.z], [K.x + 0.005, K.y, K.z], 0.011, MAT.steel, root, 8); // the kick shaft, from the gearbox out to the crank
  pipe([[0, 0, 0], [-0.006, -K.length * 0.5, 0.004], [-0.034, -K.length, 0.01]], 0.009, MAT.steel, pivot, { bend: 0.04, steps: 3 });
  const foot = rbox(0.056, 0.02, 0.03, 0.008, MAT.rubber, -0.05, -K.length - 0.002, 0.012, pivot, 'kickRubber');
  foot.rotation.z = 0.2;
}

/** The engine in the open: crankcase and gearbox, the covers, the finned barrel and head, the carb with its choke, the tap, the exhaust, the kickstart. */
export function addAgEngine(root, MAT) {
  const E = AG_ENGINE;
  const c = E.case;
  rbox(c.w, c.h, c.d, 0.035, MAT.engine, 0, c.y, c.z, root, 'crankcase');
  rbox(c.w * 0.72, c.h * 0.6, 0.12, 0.025, MAT.engine, 0, c.y - 0.03, c.z - 0.2, root); // the gearbox behind
  const g = E.generator;
  mesh(new THREE.CylinderGeometry(g.r, g.r, 0.022, 22).rotateZ(Math.PI / 2).translate(g.x, g.y, g.z), MAT.alloy, root, 'generatorCover');
  const cl = E.clutch;
  mesh(new THREE.CylinderGeometry(cl.r, cl.r, 0.024, 24).rotateZ(Math.PI / 2).translate(cl.x, cl.y, cl.z), MAT.alloy, root, 'clutchCover');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    mesh(new THREE.SphereGeometry(0.0055, 6, 4).translate(cl.x - 0.014, cl.y + Math.sin(a) * cl.r * 0.82, cl.z + Math.cos(a) * cl.r * 0.82), MAT.chrome, root);
  }
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 14).rotateZ(Math.PI / 2).translate(cl.x - 0.018, cl.y, cl.z), MAT.engineDark, root);
  // The barrel: finned, leaning forward, with the head, its fins and the plug cap.
  const cy = E.cylinder;
  const barrel = new THREE.Group();
  barrel.position.set(0, cy.y, cy.z);
  barrel.rotation.x = cy.lean;
  root.add(barrel);
  mesh(new THREE.CylinderGeometry(cy.r, cy.r * 1.06, cy.h, 18), MAT.engineDark, barrel);
  for (let i = 0; i < 7; i++) mesh(new THREE.CylinderGeometry(cy.r * 1.45, cy.r * 1.45, 0.007, 18).translate(0, -cy.h / 2 + 0.014 + i * 0.02, 0), MAT.engineDark, barrel);
  mesh(new THREE.CylinderGeometry(cy.r * 1.2, cy.r * 1.2, 0.06, 18).translate(0, cy.h / 2 + 0.03, 0), MAT.engine, barrel);
  for (let i = 0; i < 4; i++) mesh(new THREE.CylinderGeometry(cy.r * 1.5, cy.r * 1.5, 0.006, 18).translate(0, cy.h / 2 + 0.008 + i * 0.016, 0), MAT.engine, barrel);
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.034, 10).translate(0, cy.h / 2 + 0.075, 0), MAT.plastic, barrel);
  // The carb behind the barrel, a mixing chamber along x with a bowl underneath, an air-box hose to the panels, and the choke plunger on its left.
  const C = AG_CARB;
  mesh(new THREE.CylinderGeometry(C.r, C.r, C.len, 16).rotateZ(Math.PI / 2).translate(C.x, C.y, C.z), MAT.engine, root, 'carb');
  rbox(0.05, 0.06, 0.06, 0.012, MAT.engine, C.x, C.y, C.z, root);
  mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.04, 14).translate(C.x, C.y - 0.05, C.z), MAT.engineDark, root);
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.035, 14).translate(C.x, C.y + 0.048, C.z), MAT.engine, root);
  mesh(hoseGeometry([[C.x, C.y, C.z - 0.03], [C.x, C.y - 0.01, C.z - 0.1], [C.x, 0.58, -0.2]], 0.02, { sag: 0.0, radial: 8, clamps: false }).hose, MAT.rubber, root, 'airHose');
  const mount = new THREE.Group();
  mount.userData.keep = true;
  mount.position.set(C.x + C.len / 2 + 0.01, C.y, C.z);
  mount.rotation.z = Math.PI / 2; // its +y is away from the carb along +x
  root.add(mount);
  const choke = new THREE.Group();
  choke.name = 'chokeLever';
  choke.userData.keep = true;
  choke.userData.baseY = 0;
  choke.userData.travel = 0.06;
  mount.add(choke);
  mesh(rod([0, 0, 0], [0, -0.06, 0], 0.0045, 8), MAT.chrome, choke);
  mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.016, 14).translate(0, 0.008, 0), CHOKE_KNOB, choke, 'chokeKnob');
  const symbol = chokeSymbol(CHOKE_MARK);
  symbol.rotation.x = -Math.PI / 2;
  symbol.position.set(0, 0.0165, 0);
  choke.add(symbol);
  // The fuel tap under the tank on the left: a body with a lever the game turns, and the pipe down to the carb's bowl.
  const [tx, ty, tz] = AG_TAP.pos;
  rbox(0.034, 0.03, 0.03, 0.008, MAT.chrome, tx, ty, tz, root, 'fuelTapBody');
  const tap = new THREE.Group();
  tap.name = 'fuelTap';
  tap.userData.keep = true;
  tap.position.set(tx + 0.022, ty, tz);
  root.add(tap);
  const tapMat = new THREE.MeshStandardMaterial({ color: 0x26282a, roughness: 0.5 });
  mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.01, 14).rotateZ(Math.PI / 2), tapMat, tap);
  rbox(0.01, 0.007, 0.03, 0.002, tapMat, 0, 0, 0.019, tap);
  mesh(hoseGeometry([[tx, ty - 0.015, tz], [tx - 0.005, 0.68, 0.0], [C.x + 0.02, C.y - 0.03, C.z + 0.03]], 0.0045, { sag: 0.01, radial: 6, clamps: false }).hose, MAT.rubber, root, 'fuelHose');
  addExhaust(root, MAT);
  addKickStart(root, MAT);
}

function addExhaust(root, MAT) {
  const X = AG_EXHAUST;
  const curve = new THREE.CatmullRomCurve3(X.path.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const n = X.radii.length - 1;
  const radius = (t) => {
    const f = t * n;
    const i = Math.min(n - 1, Math.floor(f));
    return X.radii[i] + (X.radii[i + 1] - X.radii[i]) * (f - i);
  };
  mesh(sweepGeometry(curve.getPoints(40), radius, { radial: 12 }), MAT.exhaust, root, 'exhaustPipe');
  const [fx, fy, fz] = X.path[0];
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.014, 12).rotateX(Math.PI / 2 + 0.7).translate(fx, fy, fz + 0.004), MAT.steel, root, 'exhaustFlange');
  // The silencer: a tapered cylinder swept up towards the back, a chrome tip, a stay to the rack's leg.
  const a = new THREE.Vector3(...X.can.from);
  const b = new THREE.Vector3(...X.can.to);
  const dir = b.clone().sub(a);
  const len = dir.length();
  const can = new THREE.Group();
  can.position.copy(a).addScaledVector(dir, 0.5);
  can.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  root.add(can);
  mesh(new THREE.CylinderGeometry(X.can.r1, X.can.r0, len, 18), MAT.exhaust, can, 'silencer');
  mesh(new THREE.CylinderGeometry(X.can.r1 * 0.78, X.can.r1 * 0.78, 0.03, 16).translate(0, len / 2 + 0.012, 0), MAT.chrome, can, 'silencerTip');
  mesh(new THREE.CircleGeometry(X.can.r1 * 0.45, 12).rotateX(-Math.PI / 2).translate(0, len / 2 + 0.028, 0), MAT.hole, can);
  tube([-0.19, 0.66, -0.58], [-0.1, 0.7, -0.55], 0.0055, MAT.steel, root, 6);
  // The heat shield: a perforated plate over the pipe's run, in a bright metal with a row of holes, held off the pipe on two stand-offs.
  const S = X.shield;
  const sa = new THREE.Vector3(...S.from);
  const sb = new THREE.Vector3(...S.to);
  const sd = sb.clone().sub(sa);
  const shield = new THREE.Group();
  shield.position.copy(sa).addScaledVector(sd, 0.5);
  shield.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sd.clone().normalize());
  root.add(shield);
  mesh(new THREE.CylinderGeometry(0.03, 0.03, sd.length(), 14, 1, true, Math.PI * 0.65, Math.PI * 0.7).rotateY(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xa9acb0, roughness: 0.4, metalness: 0.8, side: THREE.DoubleSide }), shield, 'heatShield');
  for (let i = 0; i < 6; i++) mesh(new THREE.CircleGeometry(0.0065, 8).rotateY(-Math.PI / 2).translate(-0.0305, -sd.length() / 2 + 0.03 + i * (sd.length() - 0.06) / 5, 0), MAT.hole, shield);
  const tip = new THREE.Object3D();
  tip.name = 'exhaustTip';
  tip.position.copy(b).addScaledVector(dir.normalize(), 0.04);
  root.add(tip);
}

/** The foot rests: the rider's pair (rubbers on short bars through the frame), the passenger's pair behind them, the brake pedal (right) and gear lever (left). */
export function addAgPegs(root, MAT) {
  const P = AG_PEGS;
  for (const s of [-1, 1]) {
    tube([s * 0.07, P.y, P.z], [s * (P.x - 0.03), P.y, P.z], 0.011, MAT.steel, root, 6);
    rbox(0.085, 0.022, 0.034, 0.01, MAT.rubber, s * P.x, P.y, P.z, root, s > 0 ? 'pegLeft' : 'pegRight');
  }
  const Q = AG_PILLION_PEGS;
  for (const s of [-1, 1]) {
    tube([s * 0.07, Q.y, Q.z], [s * (Q.x - 0.03), Q.y, Q.z], 0.0095, MAT.steel, root, 6);
    rbox(0.07, 0.02, 0.03, 0.008, MAT.rubber, s * Q.x, Q.y, Q.z, root, s > 0 ? 'passengerPegLeft' : 'passengerPegRight');
  }
  pipe([[-0.075, 0.27, -0.2], [-0.14, 0.25, -0.1], [-0.17, 0.255, 0.0]], 0.0065, MAT.steel, root, { bend: 0.03, steps: 3 });
  rbox(0.05, 0.01, 0.028, 0.004, MAT.steel, -0.175, 0.258, 0.0, root);
  pipe([[0.08, 0.31, -0.18], [0.12, 0.33, -0.12], [0.16, 0.32, -0.06]], 0.006, MAT.steel, root, { bend: 0.03, steps: 3 });
  rbox(0.022, 0.014, 0.028, 0.004, MAT.rubber, 0.168, 0.32, -0.055, root);
}

// Handlebars ----------------------------------------------------------------

/**
 * The bars and the steering assembly's upper half, in the bars' frame (origin AG_BARS_AT): the bars with a crossbar, the grips (fixed points),
 * the levers with big hand guards, the twist-grip housing, the cables, the stanchions and yokes, the headlamp and the front rack over it. The
 * speedo (the dash) and the pod mount are the model's. Returns the lamp's place for the dash's.
 */
export function addAgBars(bars, MAT, paint, lensMat, rack) {
  const T = AG_BARS;
  const half = T.half;
  pipe([...half, ...half.slice().reverse().map(([x, y, z]) => [-x, y, z])], 0.0115, MAT.steel, bars, { bend: 0.03, steps: 4 });
  tube([-0.22, T.half[2][1], T.half[2][2]], [0.22, T.half[2][1], T.half[2][2]], 0.0095, MAT.steel, bars, 8); // the crossbar between the risers
  rbox(0.14, 0.05, 0.03, 0.012, MAT.rubber, 0, T.half[2][1] + 0.025, T.half[2][2] + 0.01, bars, 'crossbarPad');
  for (const s of [-1, 1]) {
    const grip = mesh(gripGeometry(T.gripLen, 0.0155), MAT.rubber, bars, s > 0 ? 'gripLeft' : 'gripRight');
    grip.position.set(s * T.grip[0], T.grip[1], T.grip[2]);
    grip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(s * T.gripDir[0], T.gripDir[1], T.gripDir[2]).normalize());
    // The perch and its lever (clutch left, brake right), with the hand guard: a big loop of plastic from the bar's end round over the lever.
    const px = 0.24;
    rbox(0.034, 0.024, 0.034, 0.008, MAT.steel, s * px, 0.065, -0.025, bars);
    const g = new THREE.Group();
    g.position.set(s * px, 0.065, -0.025);
    bars.add(g);
    pipe([[0, 0.004, 0.006], [s * 0.02, 0.012, 0.014], [s * 0.085, 0.014, -0.014], [s * 0.105, 0.012, -0.028]], 0.0055, MAT.steel, g, { bend: 0.02 });
    const guard = [[s * 0.15, 0.062, -0.05], [s * 0.135, 0.07, 0.03], [s * 0.12, 0.07, 0.07], [s * 0.05, 0.062, 0.075]];
    pipe(guard.map(([x, y, z]) => [x + s * 0.0, y, z]), 0.0075, MAT.plastic, bars, { bend: 0.025, steps: 3 });
    rbox(0.012, 0.045, 0.1, 0.005, MAT.plastic, s * 0.145, 0.075, 0.02, bars, 'handGuard');
  }
  rbox(0.04, 0.034, 0.034, 0.01, MAT.steel, -0.24, 0.066, -0.03, bars, 'throttleHousing');
  // The cables: clutch and throttle down to the head, the brake's out of the front perch, braided runs with sag.
  mesh(cableGeometry([[0.24, 0.065, -0.025], [0.15, -0.02, 0.0], [0.09, -0.1, 0.02], [0.04, -0.17, 0.0]], 0.0032, { sag: 0.03 }), MAT.rubber, bars, 'clutchCable');
  mesh(cableGeometry([[-0.24, 0.066, -0.03], [-0.18, -0.02, -0.01], [-0.1, -0.1, 0.02], [-0.045, -0.17, 0.0]], 0.0032, { sag: 0.03 }), MAT.rubber, bars, 'throttleCable');
  mesh(cableGeometry([[-0.24, 0.065, -0.025], [-0.16, -0.05, 0.01], [-0.12, -0.25, 0.02], [-0.09, -0.4, 0.01]], 0.0035, { sag: 0.04 }), MAT.rubber, bars, 'brakeCable');
  // The fork's top: stanchions from the lower legs up through two yokes, fork nuts on the top yoke, the lamp's brackets.
  const F = AG_FORK;
  const local = (x, y) => [x, y - AG_BARS_AT[1], forkZ(y) - AG_BARS_AT[2]];
  for (const s of [-1, 1]) {
    tube(local(s * F.x, F.lowerTop - 0.05), local(s * F.x, F.upperTop - 0.02), 0.0155, MAT.chrome, bars, 10);
    const [nx, ny, nz] = local(s * F.x, F.upperTop - 0.012);
    mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.016, 8).translate(nx, ny, nz), MAT.rubber, bars);
  }
  for (const y of [F.yoke, F.lowerYoke]) {
    const [, ly, lz] = local(0, y);
    rbox(0.21, 0.024, 0.05, 0.01, MAT.frame, 0, ly, lz, bars);
  }
  tube(local(0, F.lowerYoke), local(0, F.yoke + 0.012), 0.016, MAT.steel, bars, 8); // the steering stem
  // The headlamp: a small round plastic lamp on two brackets, a chrome rim, the glass the game lights.
  const L = AG_LAMP;
  const [, lampY, lampZ] = local(0, L.y);
  const lz = lampZ + L.ahead;
  const shell = mesh(new THREE.SphereGeometry(L.r, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62).rotateX(-Math.PI / 2).scale(1, 1, 1.1), MAT.plastic, bars, 'lampShell');
  shell.position.set(0, lampY, lz - L.r * 0.4);
  const rimZ = shell.position.z + 0.3681 * L.r * 1.1;
  const rimR = L.r * 0.9298;
  mesh(new THREE.TorusGeometry(rimR, 0.005, 6, 28).translate(0, lampY, rimZ), MAT.chrome, bars);
  mesh(new THREE.CylinderGeometry(rimR - 0.003, rimR - 0.003, 0.012, 28).rotateX(Math.PI / 2).translate(0, lampY, rimZ - 0.002), lensMat, bars, 'headlight');
  for (const s of [-1, 1]) tube([s * F.x, F.lowerYoke - AG_BARS_AT[1] + 0.02, forkZ(F.lowerYoke + 0.02) - AG_BARS_AT[2]], [s * (L.r - 0.012), lampY, lz - L.r * 0.3], 0.0055, MAT.steel, bars, 6);
  // The front rack over the lamp: a small tubular steel rack on two legs down to the yokes, a rail across the front and the back.
  const K = AG_FRONT_RACK;
  const hw = K.w / 2;
  const [, , yokeZ] = local(0, F.yoke);
  for (const s of [-1, 1]) {
    tube([s * hw, K.y, K.z0], [s * hw, K.y, K.z1], 0.0075, rack, bars, 6);
    tube([s * hw, K.y, K.z0], [s * F.x, local(0, F.yoke)[1] + 0.012, yokeZ], 0.0065, rack, bars, 6);
    tube([s * hw, K.y, K.z1], [s * (L.r - 0.012), lampY + L.r * 0.7, lz - L.r * 0.3], 0.0065, rack, bars, 6);
  }
  tube([-hw, K.y, K.z1], [hw, K.y, K.z1], 0.0075, rack, bars, 6);
  tube([-hw, K.y, K.z0], [hw, K.y, K.z0], 0.0075, rack, bars, 6);
  return { lampY, lampZ: lz };
}

// Stickers ---------------------------------------------------------------------

/** The maker's badge on each side of the tank, a millimetre off its panel. */
export function addAgDecals(root) {
  for (const s of [-1, 1]) {
    const badge = decalMesh('badge', { maker: MAKER_FOR.ag200, model: 'AG200' }, { width: 0.12, name: 'badge' });
    badge.position.set(s * 0.172, 0.89, 0.07);
    badge.rotation.y = s * (Math.PI / 2);
    root.add(badge);
  }
}
