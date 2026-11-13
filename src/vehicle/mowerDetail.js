import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { loftGeometry, rod } from './quadGeometry.js';
import { cableGeometry } from './detail/cables.js';
import { treadTyre } from './detail/tread.js';
import { decalMesh, MAKER_FOR } from './detail/decals.js';
import { boltsMesh, boltRow } from './detail/fixings.js';
import { buildSteeringWheel } from './detail/steeringWheel.js';
import { buildGrille } from './detail/fittings.js';
import { buildLever } from './detail/cabControls.js';
import { chokeSymbol } from './hornetDetail.js';
import { mesh, rbox, tube, pipe, CHOKE_KNOB, CHOKE_MARK } from './tz65Detail.js';
import {
  MOWER_WHEELS as W, MOWER_FRAME, MOWER_BONNET, MOWER_GRILLE, MOWER_LAMP, MOWER_FRONT_WING, MOWER_TUB, MOWER_REAR_WING, MOWER_SEAT, MOWER_FOOT, MOWER_DASH,
  MOWER_STEER, MOWER_DECK, MOWER_BOX, MOWER_LEVERS, MOWER_ENGINE,
} from './mowerBody.js';

// The ride-on mower's parts (#76), after an old British garden tractor: ribbed little front tyres and fat turf-tread rears on plain pressed
// steel rims, a faded bonnet with a grille and a round lamp, a moulded seat with a back, a cutting deck slung underneath with grass caked
// under it, a box on the back, a steering wheel on a raked column, a height lever and a blade lever either side of the seat and a pull cord
// on the engine for when the battery is flat. The numbers are mowerBody.js's; each builder takes the quad's materials (`MAT`) and adds to the
// group it is given.

// Wheels ---------------------------------------------------------------------

const tyres = {};
const tyre = (front) => (tyres[front ? 'f' : 'r'] ??= treadTyre(front ? 'rib' : 'atv', {
  radius: front ? W.frontR : W.rearR,
  width: front ? W.frontW : W.rearW,
  rimR: front ? W.frontRim : W.rearRim,
  count: front ? 0 : 16,
  segments: 26,
}));

/** The tyre, a plain pressed-steel rim (a dished face with a few holes, a lip each side) and the hub. */
export function buildMowerSpin(spin, MAT, front, rimMat) {
  const width = front ? W.frontW : W.rearW;
  const rimR = front ? W.frontRim : W.rearRim;
  const half = width / 2;
  mesh(tyre(front), MAT.rubber, spin);
  mesh(new THREE.CylinderGeometry(rimR, rimR, width * 0.8, 24).rotateZ(Math.PI / 2), rimMat, spin);
  for (const s of [-1, 1]) {
    mesh(new THREE.TorusGeometry(rimR, 0.008, 6, 26).rotateY(Math.PI / 2).translate(s * (half - 0.016), 0, 0), rimMat, spin);
    mesh(new THREE.CylinderGeometry(rimR - 0.004, rimR - 0.004, 0.008, 26).rotateZ(Math.PI / 2).translate(s * (half - 0.04), 0, 0), rimMat, spin);
    mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.04, 12).rotateZ(Math.PI / 2).translate(s * (half - 0.028), 0, 0), MAT.steel, spin);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      mesh(new THREE.CircleGeometry(front ? 0.016 : 0.024, 10).rotateY(s * Math.PI / 2).translate(s * (half - 0.0355), Math.sin(a) * rimR * 0.6, Math.cos(a) * rimR * 0.6), MAT.hole, spin);
    }
  }
  mesh(new THREE.CylinderGeometry(0.012, 0.012, width * 0.9, 8).rotateZ(Math.PI / 2), MAT.engineDark, spin);
}

/** The stub axle's yoke on a front wheel, and the axle boss and brake drum cover on a rear one (they stay with the wheel, not the spin). */
export function buildMowerHub(wheel, MAT, front, side) {
  const x = side * ((front ? W.frontW : W.rearW) / 2 + 0.002);
  mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 10).rotateZ(Math.PI / 2).translate(x, 0, 0), MAT.chrome, wheel, 'hubCap');
  if (front) {
    tube([side * 0.02, 0, 0], [side * 0.02, 0.12, 0], 0.016, MAT.frame, wheel);
  } else {
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 14).rotateZ(Math.PI / 2).translate(-side * 0.06, 0, 0), MAT.engineDark, wheel);
  }
}

// Frame and axles ---------------------------------------------------------------

export function addMowerFrame(root, MAT) {
  const F = MOWER_FRAME;
  for (const s of [-1, 1]) {
    rbox(F.w, F.h, F.z0 - F.z1, 0.01, MAT.frame, s * F.x, F.y, (F.z0 + F.z1) / 2, root, 'rail');
  }
  for (const z of [0.7, 0.3, -0.05, -0.4, -0.78]) rbox(F.x * 2 + F.w, 0.05, 0.05, 0.008, MAT.frame, 0, F.y, z, root, 'crossMember');
  // The front axle beam and its pivot, and the rear axle housing with the transaxle's casing in the middle.
  tube([-W.frontX, 0.17, W.frontZ], [W.frontX, 0.17, W.frontZ], 0.03, MAT.frame, root, 10);
  tube([-W.rearX, W.rearR, W.rearZ], [W.rearX, W.rearR, W.rearZ], 0.034, MAT.frame, root, 10);
  rbox(0.3, 0.2, 0.28, 0.05, MAT.engineDark, 0, 0.3, W.rearZ, root, 'transaxle');
  for (const s of [-1, 1]) tube([s * 0.2, 0.25, W.rearZ], [s * 0.2, 0.4, -0.4], 0.016, MAT.frame, root, 6);
  // A drawbar plate at the back for a trailer or a roller.
  rbox(0.24, 0.012, 0.1, 0.004, MAT.steel, 0, 0.3, -0.93, root, 'drawbar');
  const hole = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.014, 10), MAT.hole, root);
  hole.position.set(0, 0.3, -0.95);
}

// Bodywork -----------------------------------------------------------------------

/** The seat: a moulded one-piece cushion with a dished top and a rolled edge, a high curved back, on a pressed steel pan and bracket over the tub. */
function addMowerSeat(root, MAT, seatMat) {
  const S = MOWER_SEAT;
  const seat = new THREE.Group();
  seat.name = 'seat';
  seat.position.set(0, S.top, S.z);
  root.add(seat);
  const w = S.width;
  const half = S.depth / 2;
  const cushion = [
    { z: half, w: w * 0.7, y0: -0.07, y1: -0.012 },
    { z: half * 0.6, w: w * 0.92, y0: -0.075, y1: -0.004 },
    { z: 0, w, y0: -0.08, y1: -0.018 }, // the dish in the middle
    { z: -half * 0.7, w: w * 0.98, y0: -0.075, y1: -0.006 },
    { z: -half, w: w * 0.9, y0: -0.065, y1: 0.0 },
  ];
  mesh(loftGeometry(cushion, { exponent: 3.4, segments: 24 }), seatMat, seat, 'seatCushion');
  const lean = 0.2;
  const back = loftGeometry([
    { z: 0, w: w * 0.92, y0: -0.03, y1: 0.03 },
    { z: S.back * 0.5, w: w * 0.94, y0: -0.03, y1: 0.034 },
    { z: S.back, w: w * 0.86, y0: -0.026, y1: 0.03 },
  ], { exponent: 3, segments: 20 }).rotateX(-(Math.PI / 2 + lean)).translate(0, -0.02, -half + 0.02);
  mesh(back, seatMat, seat, 'seatBack');
  // A pressed steel pan under the cushion with a rolled lip, and the bracket and slides it rides on.
  mesh(loftGeometry([{ z: half * 0.85, w: w * 0.8, y0: -0.1, y1: -0.07 }, { z: -half * 0.85, w: w * 0.86, y0: -0.1, y1: -0.07 }], { exponent: 4, segments: 16 }), MAT.frame, seat, 'seatPan');
  rbox(0.2, 0.02, 0.26, 0.006, MAT.steel, 0, -0.115, 0.02, seat, 'seatBracket');
  for (const s of [-1, 1]) tube([s * 0.08, -0.115, 0.1], [s * 0.1, -0.2, 0.04], 0.008, MAT.steel, seat, 6);
}

/** The bonnet with its grille and lamp, the wings, the tub under the seat, the seat, the footplates and the dash panel. */
export function addMowerBody(root, MAT, paint, lensMat, seatMat) {
  mesh(loftGeometry(MOWER_BONNET, { exponent: 5, segments: 32 }), paint, root, 'bonnet');
  // The bonnet's black centre stripe along the top, the panel line where it hinges, and the little breather slots at the sides.
  mesh(loftGeometry(MOWER_BONNET.map((st) => ({ ...st, w: st.w * 0.2, y0: st.y1 - 0.016, y1: st.y1 + 0.004 })), { exponent: 3, segments: 8 }), MAT.plastic, root, 'bonnetStripe');
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) rbox(0.004, 0.008, 0.07, 0.002, MAT.hole, s * 0.2525, 0.56 + i * 0.02, 0.34, root, 'bonnetSlot');
  }
  rbox(0.5, 0.01, 0.01, 0.003, MAT.hole, 0, 0.78, 0.17, root, 'bonnetSeam');
  // The grille: black bars in a chrome-edged opening in the nose, with the maker's badge above.
  const G = MOWER_GRILLE;
  const grille = buildGrille({ w: G.w, h: G.h, kind: 'bars', n: 9, mats: { frame: MAT.chrome, bars: MAT.chrome } });
  grille.position.set(0, G.y, G.z - 0.012);
  root.add(grille);
  const badge = decalMesh('badge', { maker: MAKER_FOR.clipper, model: 'Clipper 12' }, { width: 0.1, name: 'badge' });
  badge.position.set(0, G.y + 0.1, G.z - 0.045);
  badge.rotation.x = 0.35;
  root.add(badge);
  // The round headlamp: one in the nose above the grille, on a chrome bezel, its lens the one the light code looks for.
  const L = MOWER_LAMP;
  const lamp = new THREE.Group();
  lamp.position.set(0, L.y, L.z);
  mesh(new THREE.CylinderGeometry(L.r * 1.25, L.r * 1.3, 0.03, 18).rotateX(Math.PI / 2), MAT.chrome, lamp, 'lampBezel');
  mesh(new THREE.SphereGeometry(L.r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).translate(0, 0, 0.012), lensMat, lamp, 'lens');
  root.add(lamp);

  // The front wings over each front wheel.
  for (const s of [-1, 1]) {
    mesh(loftGeometry(MOWER_FRONT_WING.map((st) => ({ ...st, x: s * W.frontX })), { exponent: 3, segments: 16 }), paint, root, 'frontWing');
    for (const z of [0.5, 0.7]) tube([s * (W.frontX - 0.08), MOWER_FRONT_WING[1].y0, z], [s * 0.22, 0.34, z], 0.008, MAT.frame, root, 6);
  }
  // The tub under the seat and the fenders over the rear tyres.
  mesh(loftGeometry(MOWER_TUB, { exponent: 3.2, segments: 28 }), paint, root, 'tub');
  for (const s of [-1, 1]) {
    mesh(loftGeometry(MOWER_REAR_WING.map((st) => ({ ...st, x: s * W.rearX })), { exponent: 3, segments: 16 }), paint, root, 'rearWing');
    rbox(0.02, 0.1, 0.5, 0.006, MAT.plastic, s * (W.rearX - 0.095), 0.49, W.rearZ, root, 'fenderLip'); // the inner skirt, down to the tub
  }
  addMowerSeat(root, MAT, seatMat);
  // The footplates, ribbed rubber mats on a steel plate either side of the bonnet's tail.
  const P = MOWER_FOOT;
  for (const s of [-1, 1]) {
    rbox(P.w, 0.018, P.z0 - P.z1 + 0.1, 0.006, MAT.frame, s * P.x, P.y, (P.z0 + P.z1) / 2, root, 'footplate');
    for (let i = 0; i < 9; i++) rbox(P.w - 0.02, 0.006, 0.012, 0.003, MAT.rubber, s * P.x, P.y + 0.011, P.z0 - 0.02 - i * 0.028, root, 'footRib');
    rbox(P.w, 0.05, 0.018, 0.006, MAT.frame, s * P.x, P.y + 0.02, P.z0 + 0.06, root, 'footLip');
  }
  // The dash panel: a black moulding across the top of the bonnet's tail that carries the dash, the key and the choke.
  const D = MOWER_DASH;
  rbox(D.w, D.h, D.d, 0.02, MAT.plastic, 0, D.y, D.z, root, 'dashPanel');
  // The tank cap on the bonnet's top, a black screw cap with a vent.
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.016, 16).translate(0.12, 0.79, 0.34), MAT.plastic, root, 'tankCap');
  mesh(new THREE.TorusGeometry(0.03, 0.004, 5, 16).rotateX(Math.PI / 2).translate(0.12, 0.797, 0.34), MAT.steel, root);
  // A bumper bar across the nose under the grille, with two bolts.
  rbox(0.34, 0.035, 0.03, 0.01, MAT.chrome, 0, 0.36, 0.855, root, 'bumper');
  root.add(boltsMesh(boltRow([-0.1, 0.375, 0.872], [0.1, 0.375, 0.872], 2), [0, 0, 1], MAT.steel, { size: 0.008, name: 'bumperBolts' }));
}

// The deck -------------------------------------------------------------------------

/** The cutting deck under the middle: a pressed steel pan with a belt cover on top, a chute on the right, anti-scalp wheels, and grass caked under it. */
export function addMowerDeck(root, MAT, deckMat, grassMat) {
  const D = MOWER_DECK;
  const pan = new THREE.Group();
  pan.name = 'deck';
  pan.position.set(0, 0, D.z);
  root.add(pan);
  mesh(new RoundedBoxGeometry(D.hw * 2, D.y1 - D.y0, D.hd * 2, 3, 0.03), deckMat, pan, 'deckPan').position.y = (D.y0 + D.y1) / 2;
  // The skirt's lip round the edge, the belt cover on top and its bolts.
  mesh(new RoundedBoxGeometry(D.hw * 2 + 0.02, 0.02, D.hd * 2 + 0.02, 2, 0.008), deckMat, pan, 'deckLip').position.y = D.y0 + 0.01;
  rbox(0.6, 0.03, 0.34, 0.012, MAT.plastic, 0, D.y1 + 0.012, -0.02, pan, 'beltCover');
  pan.add(boltsMesh([[-0.2, D.y1 + 0.03, -0.12], [0.2, D.y1 + 0.03, -0.12], [-0.2, D.y1 + 0.03, 0.08], [0.2, D.y1 + 0.03, 0.08]], [0, 1, 0], MAT.steel, { size: 0.01, name: 'deckBolts' }));
  // The chute on the right, a hinged flap over the discharge, and a stub of the box's feed at the back.
  const chute = rbox(0.16, 0.1, 0.22, 0.02, deckMat, D.chuteX - 0.06, D.y1 - 0.04, -0.05, pan, 'chute');
  chute.rotation.z = 0.12;
  rbox(0.02, 0.1, 0.2, 0.006, MAT.rubber, D.chuteX - 0.15, D.y1 - 0.06, -0.05, pan, 'chuteFlap');
  // The anti-scalp wheels at the front corners, small and grey on a stalk.
  for (const s of [-1, 1]) {
    tube([s * 0.38, D.y0 + 0.03, D.hd - 0.02], [s * 0.38, D.y0 + 0.03, D.hd + 0.06], 0.008, MAT.steel, pan, 6);
    mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.016, 12).rotateZ(Math.PI / 2).translate(s * 0.38, D.y0 + 0.03, D.hd + 0.07), MAT.plastic, pan, 'scalpWheel');
  }
  // The links to the lift: two bars from the deck's corners up to the frame.
  for (const s of [-1, 1]) tube([s * 0.4, D.y1 + 0.03, 0.2], [s * 0.2, 0.26, 0.4], 0.01, MAT.steel, pan, 6);
  // Grass clippings caked under the deck's lip and along its right-hand edge, in clumps.
  const rng = (i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
  for (let i = 0; i < 26; i++) {
    const a = rng(i + 1);
    const b = rng(i + 40);
    const onFront = i % 2 === 0;
    const x = (a * 2 - 1) * D.hw * 0.95;
    const z = onFront ? D.hd - 0.01 : -D.hd + 0.01;
    mesh(new THREE.SphereGeometry(0.02 + b * 0.025, 6, 4).scale(1.5, 0.6, 0.8), grassMat, pan, 'clippings').position.set(x, D.y0 + 0.005, z + (b - 0.5) * 0.03);
  }
  for (let i = 0; i < 12; i++) {
    const b = rng(i + 90);
    mesh(new THREE.SphereGeometry(0.025 + b * 0.02, 6, 4).scale(0.8, 0.8, 1.4), grassMat, pan, 'clippings').position.set(D.chuteX - 0.1 - b * 0.03, D.y1 - 0.1 + b * 0.05, -0.15 + rng(i + 3) * 0.2);
  }
  mesh(new THREE.BoxGeometry(D.hw * 1.9, 0.02, 0.05), grassMat, pan, 'clippingsMat').position.set(0, D.y0 + 0.002, D.hd - 0.01);
}

/** The grass box behind the seat: a black plastic hopper on a steel frame, a mesh top with a handle, and the chute from the deck feeding it. */
export function addMowerBox(root, MAT, grassMat, boxMat, lidMat) {
  const B = MOWER_BOX;
  const mid = (B.z0 + B.z1) / 2;
  // A tapering hopper, wider at the top, with a sloping back, and a lighter lid with a lip and a carrying handle.
  mesh(loftGeometry([
    { z: B.z0, w: B.w * 1.7, y0: B.y0 + 0.04, y1: B.y1 - 0.04 },
    { z: mid, w: B.w * 2, y0: B.y0, y1: B.y1 - 0.03 },
    { z: B.z1, w: B.w * 1.9, y0: B.y0 + 0.1, y1: B.y1 - 0.07 },
  ], { exponent: 5, segments: 28 }), boxMat, root, 'box');
  mesh(loftGeometry([
    { z: B.z0 + 0.01, w: B.w * 2 + 0.02, y0: B.y1 - 0.06, y1: B.y1 + 0.01 },
    { z: B.z1 - 0.01, w: B.w * 1.9 + 0.02, y0: B.y1 - 0.09, y1: B.y1 - 0.02 },
  ], { exponent: 5, segments: 24 }), lidMat, root, 'boxLid');
  pipe([[-0.1, B.y1 - 0.03, mid + 0.03], [-0.1, B.y1 + 0.04, mid + 0.03], [0.1, B.y1 + 0.04, mid + 0.03], [0.1, B.y1 - 0.03, mid + 0.03]], 0.009, boxMat, root, { bend: 0.03, steps: 3 });
  for (let i = 0; i < 6; i++) rbox(B.w * 1.4, 0.006, 0.008, 0.002, MAT.hole, 0, B.y1 - 0.14 - i * 0.03, B.z0 - 0.002, root, 'boxVent');
  // The steel frame it hangs on, and the feed from the deck's chute in at the front right.
  for (const s of [-1, 1]) tube([s * (B.w + 0.01), 0.3, B.z0 + 0.02], [s * (B.w + 0.01), B.y1 - 0.15, B.z0 + 0.02], 0.01, MAT.steel, root, 6);
  tube([-B.w - 0.01, 0.42, B.z0 + 0.02], [B.w + 0.01, 0.42, B.z0 + 0.02], 0.008, MAT.steel, root, 6);
  rbox(0.12, 0.1, 0.2, 0.02, boxMat, -0.16, 0.42, B.z0 + 0.04, root, 'boxFeed');
  tube([-0.17, 0.3, -0.4], [-0.17, 0.4, B.z0 + 0.04], 0.02, boxMat, root, 8);
  // Clippings stuck on the front of the box where it has been wet, and a tail lamp each side of it.
  for (let i = 0; i < 7; i++) mesh(new THREE.SphereGeometry(0.02, 6, 4).scale(1.4, 0.6, 1), grassMat, root, 'clippings').position.set(-0.2 + i * 0.065, B.y0 + 0.05 + (i % 3) * 0.01, B.z0 - 0.005);
  for (const s of [-1, 1]) rbox(0.08, 0.04, 0.012, 0.006, MAT.tail, s * 0.2, 0.52, B.z1 - 0.012, root, 'tailLight');
}

// Controls ---------------------------------------------------------------------------

/**
 * The steering column (tilted back towards the rider) with its wheel, built in the group it turns in: `column` is tilted, `bars` (the
 * `handlebars` the quad turns about the column's own axis) is inside it. The wheel is a plain black three-spoke, worn where the hands go.
 */
export function addMowerSteering(root, MAT, paint) {
  const S = MOWER_STEER;
  const column = new THREE.Group();
  column.name = 'steerColumn';
  column.position.set(...S.base);
  column.rotation.x = -S.tilt; // the top leans back, towards the rider (-z)
  root.add(column);
  mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.1, 14).translate(0, 0.02, 0), MAT.plastic, column, 'columnBoot'); // the boot where it meets the dash
  const bars = new THREE.Group();
  bars.name = 'handlebars';
  bars.userData.keep = true;
  bars.position.set(0, 0.05, 0);
  column.add(bars);
  mesh(rod([0, 0, 0], [0, S.length, 0], 0.016, 10), MAT.steel, bars, 'steerShaft');
  mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.04, 14).translate(0, S.length, 0), MAT.plastic, bars, 'steerHub');
  const wheel = buildSteeringWheel({ r: S.wheelR, style: 'utility', worn: true });
  wheel.position.set(0, S.length + 0.02, 0);
  bars.add(wheel);
  const hands = new THREE.Object3D();
  hands.name = 'riderHands';
  hands.position.set(0, S.length + 0.02, 0);
  bars.add(hands);
  void paint;
  return bars;
}

/** The little levers by the seat: the blade lever on the left (a red-knobbed engage lever the game poses) and the height lever on the right on its notched quadrant. */
export function addMowerLevers(root, MAT) {
  const H = MOWER_LEVERS.height;
  // The height lever: a black-knobbed lever on a notched plate with the heights numbered, on the tub's right.
  rbox(0.014, 0.1, 0.12, 0.004, MAT.steel, H[0] + 0.03, H[1] - 0.03, H[2], root, 'heightQuadrant');
  for (let i = 0; i < 5; i++) rbox(0.016, 0.006, 0.01, 0.002, MAT.hole, H[0] + 0.03, H[1] - 0.05 + i * 0.018, H[2] + 0.04, root, 'heightNotch');
  const height = buildLever({ length: 0.18, crank: 0.02, knob: 'ball', knobSize: 0.032, gaiter: 0 });
  height.group.position.set(H[0], H[1] - 0.05, H[2]);
  height.group.rotation.x = -0.25;
  height.group.name = 'heightLever';
  root.add(height.group);

  const B = MOWER_LEVERS.blade;
  rbox(0.014, 0.1, 0.1, 0.004, MAT.steel, B[0] - 0.03, B[1] - 0.03, B[2], root, 'bladeGate');
  const redKnob = new THREE.MeshStandardMaterial({ color: 0xb8231a, roughness: 0.5 });
  const blade = buildLever({ length: 0.18, knob: 'ball', knobSize: 0.034, gaiter: 0, mats: { knob: redKnob } });
  blade.group.name = 'bladeLever';
  blade.group.userData.keep = true;
  blade.group.position.set(B[0], B[1] - 0.05, B[2]);
  blade.group.userData.restAngle = 0.5; // leaning back (off); the game swings it forward to engage
  blade.group.rotation.x = 0.5;
  root.add(blade.group);
}

/** The engine under the bonnet's pull cord (a T-handle on the right of the nose), the choke knob on the dash, the fuel tap and the silencer. */
export function addMowerEngine(root, MAT) {
  const E = MOWER_ENGINE;
  // The pull cord: out of a fairlead in the bonnet's right side, hanging in a loop with a T-handle, the starter's cup behind the panel.
  const [cx, cy, cz] = E.cord;
  mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.014, 10).rotateZ(Math.PI / 2), MAT.chrome, root, 'cordFairlead').position.set(-0.252, cy, cz - 0.06);
  mesh(cableGeometry([[-0.255, cy, cz - 0.06], [-0.3, cy - 0.04, cz - 0.07], [-0.32, cy - 0.1, cz - 0.05], [-0.31, cy - 0.12, cz - 0.04]], 0.0035, { sag: 0.02 }), MAT.rubber, root, 'pullCord');
  rbox(0.07, 0.02, 0.022, 0.008, new THREE.MeshStandardMaterial({ color: 0xc02a1c, roughness: 0.6 }), -0.31, cy - 0.135, cz - 0.04, root, 'pullHandle');
  // The choke: a pull knob on the dash panel's left, which the game slides out as the choke is applied.
  const mount = new THREE.Group();
  mount.userData.keep = true;
  mount.position.set(0.08, MOWER_DASH.y - 0.05, MOWER_DASH.z - MOWER_DASH.d / 2 - 0.004);
  mount.rotation.x = -Math.PI / 2; // its +y runs towards the rider's face, so pulling down is pulling out
  root.add(mount);
  const choke = new THREE.Group();
  choke.name = 'chokeLever';
  choke.userData.keep = true;
  choke.userData.baseY = 0;
  choke.userData.travel = 0.05;
  mount.add(choke);
  mesh(rod([0, 0, 0], [0, 0.04, 0], 0.004, 8), MAT.chrome, choke);
  mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.016, 14).translate(0, -0.008, 0), CHOKE_KNOB, choke, 'chokeKnob');
  const symbol = chokeSymbol(CHOKE_MARK);
  symbol.rotation.x = Math.PI / 2;
  symbol.scale.setScalar(0.8);
  symbol.position.set(0, -0.0165, 0);
  choke.add(symbol);
  // The fuel tap, on the bonnet's left under the tank, a black lever on a brass body.
  const tap = new THREE.Group();
  tap.name = 'fuelTap';
  tap.userData.keep = true;
  tap.position.set(0.262, 0.58, 0.34);
  root.add(tap);
  const brass = new THREE.MeshStandardMaterial({ color: 0xa08840, roughness: 0.4, metalness: 0.7 });
  mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.024, 12).rotateZ(Math.PI / 2), brass, tap);
  rbox(0.01, 0.006, 0.03, 0.002, CHOKE_KNOB, 0.014, 0, 0.012, tap);
  // The silencer low at the right-hand back, a rusty can with a heat shield, and its tip.
  const [sx, sy, sz] = E.silencer;
  const rust = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.9, metalness: 0.5 });
  mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 14).rotateX(Math.PI / 2).translate(sx, sy, sz), rust, root, 'silencer');
  pipe([[sx + 0.1, sy + 0.06, 0.1], [sx + 0.1, sy + 0.04, sz + 0.2], [sx, sy, sz + 0.1]], 0.015, rust, root, { bend: 0.05, steps: 3 });
  const tip = new THREE.Object3D();
  tip.name = 'exhaustTip';
  tip.position.set(sx, sy, sz - 0.1);
  root.add(tip);
  rbox(0.06, 0.003, 0.14, 0.001, MAT.engineDark, sx, sy + 0.045, sz, root, 'heatShield');
}

/** Faded decals: the maker's name on the bonnet's sides, a 12 on the flank and a sticker on the box. */
export function addMowerDecals(root) {
  for (const s of [-1, 1]) {
    const name = decalMesh('badge', { maker: MAKER_FOR.clipper, model: 'Clipper 12' }, { width: 0.14, name: 'sideBadge' });
    name.position.set(s * 0.2525, 0.64, 0.5);
    name.rotation.y = s * (Math.PI / 2);
    root.add(name);
    const stripe = decalMesh('stripes', { colours: ['#e9e4cf', '#2f5a34'], text: '12 HP' }, { width: 0.2, name: 'sideStripe' });
    stripe.position.set(s * 0.2525, 0.5, 0.44);
    stripe.rotation.y = s * (Math.PI / 2);
    root.add(stripe);
  }
  const warn = decalMesh('warning', {}, { width: 0.1, name: 'warning' });
  warn.position.set(MOWER_BOX.w + 0.0015, 0.58, (MOWER_BOX.z0 + MOWER_BOX.z1) / 2);
  warn.rotation.y = Math.PI / 2;
  root.add(warn);
}
