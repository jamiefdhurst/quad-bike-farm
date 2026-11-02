import * as THREE from 'three';
import { loftGeometry, shellGeometry, sweepGeometry } from './quadGeometry.js';
import { treadTyre } from './detail/tread.js';
import { decalMesh, MAKER_FOR } from './detail/decals.js';
import { buildGrille } from './detail/fittings.js';
import { buildMirror } from './detail/mirrors.js';
import { merge } from './detail/parts.js';
import { markWiper, addRainGlassBetween } from './wiperModel.js';
import { mesh, rbox, tube } from './tz65Detail.js';
import {
  MULE_WHEELS, MULE_BONNET, MULE_BODY, MULE_HOOD_E, MULE_FLARES, MULE_NOSE, MULE_CAB, MULE_ROOF, MULE_DOOR, MULE_BED, MULE_TAIL, MULE_HITCH, loftTop, MULE_DASH,
} from './muleBody.js';

// The UTV's parts (TODO 99), after a Mule 4010: a ribbed green hood over a mesh grille, black flares round the wheels, rectangular lamps in
// black housings at the nose's corners, a flat grey roof on a black cage with the windscreen between its front posts, a mesh behind the
// seat, door nets that swing out on the rear hoop, a green steel bed with pressed beads and a chained tailgate, the lamps on a plate on the cab's
// back, and dished black wheels. The numbers are muleBody.js's; each builder takes the model's materials (`MAT`) and adds to the group it is given.

const R = MULE_WHEELS.radius;

// Wheels ---------------------------------------------------------------------

const tyres = {};
const tyre = (front) => (tyres[front ? 'f' : 'r'] ??= treadTyre('atv', { radius: R, width: front ? MULE_WHEELS.front : MULE_WHEELS.rear, rimR: MULE_WHEELS.rim, count: 12, segments: 22 }));

const axle = (r, len, mat, x, parent, name) => {
  const m = mesh(new THREE.CylinderGeometry(r, r, len, 22).rotateZ(Math.PI / 2), mat, parent, name);
  m.position.x = x;
  return m;
};

/**
 * A dished black steel wheel in its tyre, all of it inboard of the tyre's outer face: an open rim barrel with rings for its flanges, a funnel
 * of a disc dishing in to a hub, four big wheel nuts on the hub's flange standing proud of it, and a cap on the axle. In the wheel's `spin` group.
 */
export function buildMuleSpin(spin, MAT, front, side) {
  const W = front ? MULE_WHEELS.front : MULE_WHEELS.rear;
  const rimR = MULE_WHEELS.rim;
  const face = W / 2;
  const x = (d) => side * (face - d);
  mesh(tyre(front), MAT.rubber, spin);
  const dark = MAT.rim.clone();
  dark.side = THREE.DoubleSide;
  mesh(new THREE.CylinderGeometry(rimR, rimR, W - 0.03, 20, 1, true).rotateZ(Math.PI / 2), dark, spin, 'wheelRim');
  for (const f of [-1, 1]) {
    const ring = mesh(new THREE.TorusGeometry(rimR * 1.03, 0.011, 5, 20).rotateY(Math.PI / 2), MAT.rim, spin);
    ring.position.x = f * (face - 0.03);
  }
  const depth = 0.055;
  const dish = mesh(new THREE.CylinderGeometry(rimR * 0.34, rimR * 0.97, depth, 20, 1, true).rotateZ(side * Math.PI / 2), dark, spin, 'wheelDisc');
  dish.position.x = x(0.03 + depth / 2);
  axle(0.052, depth + 0.012, MAT.cast, x(0.03 + depth / 2 - 0.006), spin, 'wheelHub');
  axle(0.075, 0.014, MAT.rim, x(0.05), spin, 'wheelFlange');
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const n = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.024, 6).rotateZ(Math.PI / 2), MAT.chrome, spin, 'wheelNut');
    n.position.set(x(0.05 - 0.016), Math.sin(a) * 0.056, Math.cos(a) * 0.056);
  }
  axle(0.026, 0.016, MAT.chrome, x(0.036), spin, 'wheelCap');
}

// The front -------------------------------------------------------------------

/** The loft's end at its front, drawn as a face: a plane at z for the grille to stand on (not used; the grille is its own part). */
export function addMuleFront(root, MAT, paint, lensMat) {
  mesh(loftGeometry(MULE_BONNET, { exponent: MULE_HOOD_E }), paint, root, 'bonnet');
  mesh(loftGeometry(MULE_BODY, { exponent: 4 }), paint, root, 'frontBody');
  // The hood's four pressed ribs, standing on its top and following its slope.
  for (const x of [-0.27, -0.09, 0.09, 0.27]) {
    const z0 = 0.84 + Math.abs(x) * 0.5;
    const z1 = z0 + 0.32 - Math.abs(x) * 0.25;
    const y0 = loftTop(MULE_BONNET, x, z0, MULE_HOOD_E);
    const y1 = loftTop(MULE_BONNET, x, z1, MULE_HOOD_E);
    const len = Math.hypot(z1 - z0, y1 - y0);
    const rib = rbox(0.024, 0.014, len, 0.006, paint, x, (y0 + y1) / 2 + 0.002, (z0 + z1) / 2, root, 'hoodRib');
    rib.rotation.x = Math.atan2(y0 - y1, z1 - z0);
  }
  // The hood's side vents, low at the front corners.
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) rbox(0.008, 0.01, 0.07, 0.003, MAT.grille, s * 0.395, 0.72 + i * 0.018, 1.2, root, 'hoodVent');
  // The grille: a diamond mesh in a black frame on the hood's face under a green lip, with the maker's badge in the middle of its top bar.
  const N = MULE_NOSE;
  const grille = buildGrille({ w: N.grille.w, h: N.grille.h, kind: 'mesh', mats: { frame: MAT.grille, bars: MAT.steel } });
  grille.position.set(0, N.grille.y, N.z); // on the nose block's face
  root.add(grille);
  rbox(N.grille.w + 0.08, 0.03, 0.05, 0.012, paint, 0, N.grille.y + N.grille.h / 2 + 0.03, N.z - 0.01, root, 'grilleLip');
  const badge = decalMesh('badge', { maker: MAKER_FOR.utv }, { width: 0.13, name: 'badge' });
  badge.position.set(0, N.grille.y + N.grille.h / 2 + 0.03, N.z + 0.0155); // on the lip's face
  root.add(badge);
  // The lamps: a rectangular housing at each corner of the nose in black plastic, a clear lens and reflector in it, an amber indicator on its
  // outer end, all sitting on the green body's front corner.
  const L = N.lamp;
  for (const s of [-1, 1]) {
    rbox(L.w, L.h, L.d, 0.02, MAT.plastic, s * L.x, L.y, L.z, root, 'lampHousing');
    rbox(L.w - 0.034, L.h - 0.03, 0.012, 0.012, MAT.reflector, s * (L.x - 0.01), L.y, L.z + L.d / 2 - 0.004, root);
    rbox(L.w - 0.04, L.h - 0.036, 0.014, 0.012, lensMat, s * (L.x - 0.01), L.y, L.z + L.d / 2 + 0.002, root, 'headlamp');
    rbox(0.036, L.h - 0.02, 0.07, 0.012, MAT.indicator, s * (L.x + L.w / 2 - 0.014), L.y, L.z + 0.005, root, 'indicator');
  }
  // The bumper: a wide black moulding with a step along its top, a lower skid and the tow loops, tied back to the chassis.
  rbox(1.38, 0.15, 0.15, 0.05, MAT.bumper, 0, 0.47, 1.45, root, 'bumper');
  rbox(1.12, 0.035, 0.12, 0.02, MAT.bumper, 0, 0.555, 1.42, root);
  rbox(0.9, 0.03, 0.2, 0.012, MAT.bumper, 0, 0.37, 1.36, root, 'skidPlate');
  // Its moulding: two ribs along the face, a recess each end for the lamp it would carry, bolts through its top lip and the number plate's flat.
  for (const y of [0.44, 0.5]) rbox(1.26, 0.014, 0.012, 0.005, MAT.plastic, 0, y, 1.5305, root, 'bumperRib');
  rbox(0.34, 0.1, 0.012, 0.01, MAT.floor, 0, 0.47, 1.5265, root, 'bumperPlateFlat');
  for (const s of [-1, 1]) {
    rbox(0.16, 0.07, 0.012, 0.01, MAT.floor, s * 0.5, 0.47, 1.5265, root, 'bumperPocket');
  }
  for (const x of [-0.46, -0.3, 0.3, 0.46]) mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.008, 6), MAT.chrome, root).position.set(x, 0.575, 1.42); // the bolts through the top lip
  for (const s of [-1, 1]) {
    rbox(0.08, 0.1, 0.5, 0.02, MAT.frame, s * 0.38, 0.43, 1.2, root); // the arm back to the rail
    const loop = mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12), MAT.steel, root, 'towLoop');
    loop.position.set(s * 0.3, 0.37, 1.53);
  }
  // The black flares over the wheels, moulded: a shell round each, in front and behind.
  const flare = MAT.flare;
  for (const which of ['front', 'rear']) {
    const F = MULE_FLARES[which];
    for (const s of [-1, 1]) {
      const z = which === 'front' ? MULE_WHEELS.z : -MULE_WHEELS.z;
      const geo = shellGeometry(F.profile, [[0, 0.05], [0.5, -0.01], [0.9, 0.0], [1.0, 0.06]], s * F.width[0], s * F.width[1], { samples: 28 });
      mesh(geo, flare, root, `flare_${which}`).position.set(0, R, z);
    }
  }
}

// The cab ---------------------------------------------------------------------

/** A square mesh of thin wires `w` by `h` in a frame, in the XY plane facing +Z, its middle at the origin. */
export function netGeometry(w, h, pitch = 0.06, r = 0.0036) {
  const bars = [];
  for (let x = -w / 2 + pitch / 2; x < w / 2; x += pitch) bars.push(new THREE.BoxGeometry(r * 2, h, r * 2).translate(x, 0, 0));
  for (let y = -h / 2 + pitch / 2; y < h / 2; y += pitch) bars.push(new THREE.BoxGeometry(w, r * 2, r * 2).translate(0, y, 0));
  return merge(bars);
}

/**
 * The cab's cage and glass: the windscreen in its frame with a wiper, the roof, the rear hoop with its net behind the seat, the roof rails,
 * the mirrors on the front posts, and the lamps on their plate at the back. Returns nothing; the door nets are `addMuleDoors`.
 */
export function addMuleCab(root, MAT, paint) {
  const C = MULE_CAB;
  const P = C.pillar;
  for (const s of [-1, 1]) {
    tube([s * P.x, P.foot[0], P.foot[1]], [s * (P.x - 0.04), P.head[0], P.head[1]], 0.03, MAT.frame, root, 10); // the front post, leaning back
    tube([s * C.rear.x, 0.5, C.rear.z], [s * (C.rear.x - 0.03), C.rear.top, C.rear.z], 0.03, MAT.frame, root, 10); // the rear hoop's post
    tube([s * (P.x - 0.04), P.head[0], P.head[1]], [s * (C.rear.x - 0.03), C.rear.top, C.rear.z], 0.028, MAT.frame, root, 8); // the roof rail between them
    tube([s * C.rear.x, 0.5, C.rear.z], [s * P.x, 0.62, 0.44], 0.026, MAT.frame, root, 8); // the lower rail under the door, front post to rear hoop
  }
  tube([-(P.x - 0.04), P.head[0], P.head[1]], [P.x - 0.04, P.head[0], P.head[1]], 0.028, MAT.frame, root, 8); // the front header
  tube([-(C.rear.x - 0.03), C.rear.top, C.rear.z], [C.rear.x - 0.03, C.rear.top, C.rear.z], 0.028, MAT.frame, root, 8); // and the rear one
  // The roof: a flat grey panel with a slight crown, a lip all round and a drip rail along its front.
  mesh(loftGeometry(MULE_ROOF, { exponent: 3.4 }), MAT.roof, root, 'roof');
  rbox(1.36, 0.03, 0.05, 0.012, MAT.roof, 0, 1.87, 0.4, root);
  // The windscreen: clear glass in a black frame between the front posts, leaning back, with a wiper parked at its foot.
  const G = C.glass;
  const dy = G.top[0] - G.base[0];
  const dz = G.top[1] - G.base[1];
  const len = Math.hypot(dy, dz);
  const mid = [(G.base[0] + G.top[0]) / 2, (G.base[1] + G.top[1]) / 2];
  const lean = Math.atan2(dz, dy);
  const glass = mesh(new THREE.PlaneGeometry(G.half * 2, len), MAT.glass, root, 'windscreen');
  glass.position.set(0, mid[0], mid[1]);
  glass.rotation.x = lean;
  const onGlass = (t, x) => [x, G.base[0] + dy * t, G.base[1] + dz * t];
  for (const s of [-1, 1]) tube(onGlass(0, s * G.half), onGlass(1, s * G.half), 0.016, MAT.frame, root, 6);
  tube(onGlass(0, -G.half), onGlass(0, G.half), 0.02, MAT.frame, root, 6);
  tube(onGlass(1, -G.half), onGlass(1, G.half), 0.018, MAT.frame, root, 6);
  // The wiper: a pivot on the dash's top at the glass's foot (the spindle through the cowl), a short arm up the glass and a long blade lying
  // along its foot.
  const piv = onGlass(0.0, -0.2); // on the driver's side, so the blade clears the glass in front of the driver
  mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.03, 10), MAT.plastic, root, 'wiperPivot').position.set(piv[0], piv[1] - 0.005, piv[2] + 0.0);
  const arm = tube([piv[0], piv[1] + 0.004, piv[2] - 0.004], onGlass(0.06, -0.14), 0.0045, MAT.frame, root, 5);
  arm.name = 'wiperArm';
  const blade = tube(onGlass(0.06, -0.14), onGlass(0.12, 0.36), 0.0065, MAT.frame, root, 5);
  blade.name = 'wiperBlade';
  // The arm and blade in a group on the spindle, lying in the glass, so it turns across it (#103): built where they are, then moved in.
  const wiper = new THREE.Group();
  wiper.name = 'wiper';
  wiper.position.set(piv[0], piv[1], piv[2]);
  wiper.rotation.x = lean;
  root.add(wiper);
  root.updateMatrixWorld(true);
  wiper.attach(arm);
  wiper.attach(blade);
  markWiper(wiper, 2.2); // from lying along the foot, up past upright and over towards the driver's pillar
  addRainGlassBetween(root, { foot: G.base.slice().reverse(), top: G.top.slice().reverse(), halfFoot: G.half, halfTop: G.half });
  // The rear hoop's net behind the seat: a mesh in a frame of three bars, from the seat back's height to the roof.
  const N = C.net;
  const nz = C.rear.z - 0.004;
  const net = mesh(netGeometry(N.half * 2, N.y1 - N.y0), MAT.net, root, 'rearNet');
  net.position.set(0, (N.y0 + N.y1) / 2, nz);
  for (const x of [-N.half, -N.half / 3, N.half / 3, N.half]) tube([x, N.y0, nz], [x, N.y1, nz], 0.013, MAT.frame, root, 6);
  for (const y of [N.y0, N.y1]) tube([-N.half, y, nz], [N.half, y, nz], 0.013, MAT.frame, root, 6);
  tube([-C.rear.x, 1.45, C.rear.z], [C.rear.x, 1.45, C.rear.z], 0.02, MAT.frame, root, 8); // the bar the seat belts hang from
  // The mirrors on the front posts, round and black on short arms.
  for (const s of [-1, 1]) {
    const m = buildMirror('arm', { side: s, w: 0.1, h: 0.075 });
    m.scale.setScalar(0.5); // a small mirror on a short arm, its foot on the front post
    const k = (1.42 - P.foot[0]) / (P.head[0] - P.foot[0]);
    m.position.set(s * (P.x - 0.04 * k), 1.42, P.foot[1] + (P.head[1] - P.foot[1]) * k);
    root.add(m);
  }
  // The lamps on their plate across the back of the roof: at each end a row of three, outer to inner the indicator, the brake and tail lamp
  // and the reverse lamp, in a black housing on a narrow black plate (rusty once the wear layer has been at it) bolted to the rear hoop.
  const T = MULE_TAIL;
  rbox(T.plateW, 0.15, 0.012, 0.004, MAT.frame, 0, T.y, T.z + 0.012, root, 'tailPlate');
  for (const s of [-1, 1]) {
    for (const dy of [-0.045, 0.045]) tube([s * 0.56, T.y + dy, C.rear.z], [s * (T.plateW / 2 - 0.01), T.y + dy, T.z + 0.012], 0.01, MAT.steel, root, 6); // bolted back to the rear hoop's post
    rbox(T.housing, 0.1, 0.05, 0.015, MAT.plastic, s * T.x, T.y, T.z, root, 'tailHousing');
    const lens = (name, mat, off) => rbox(0.068, 0.07, 0.014, 0.008, mat, s * (T.x + off), T.y, T.z - 0.026, root, name);
    lens('tailIndicator', MAT.indicator, 0.085); // outer
    lens('tailLens', MAT.tail, 0); // brake and tail, in the middle
    lens('tailReverse', MAT.reverse, -0.085); // inner
  }
}

/**
 * The door nets: at each side a frame with a mesh in it, hinged on the front post and swinging out to the side with its free, latched end
 * at the back (`doorNetLeft`, `doorNetRight`, posed by `poseUtvDoors`). Returns the two groups.
 */
export function addMuleDoors(root, MAT) {
  const D = MULE_DOOR;
  const length = D.front - D.rear;
  const h = D.y1 - D.y0;
  const out = {};
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    g.name = s > 0 ? 'doorNetLeft' : 'doorNetRight';
    g.userData.keep = true;
    g.position.set(s * D.x, D.y0, D.front);
    // Built in the door's own frame: -z along the door from its hinge at the front, +y up, flat in x = 0.
    const net = mesh(netGeometry(length - 0.04, h - 0.04).rotateY(Math.PI / 2), MAT.net, g, 'doorNetMesh');
    net.position.set(0, h / 2, -length / 2);
    const frame = [];
    for (const [a, b] of [[[0, 0, 0], [0, 0, -length]], [[0, h, 0], [0, h, -length]], [[0, 0, 0], [0, h, 0]], [[0, 0, -length], [0, h, -length]]]) frame.push(sweepGeometry([a, b], 0.013, { radial: 6 }));
    mesh(merge(frame), MAT.frame, g, 'doorNetFrame');
    rbox(0.03, 0.05, 0.04, 0.01, MAT.steel, 0, h * 0.55, -length + 0.01, g, 'doorLatch');
    for (const y of [0.1, h - 0.1]) rbox(0.034, 0.04, 0.04, 0.01, MAT.steel, 0, y, 0.0, g, 'doorHinge'); // the two hinges on the front post
    root.add(g);
    out[s > 0 ? 'left' : 'right'] = g;
  }
  return out;
}

// The bed -----------------------------------------------------------------------

/**
 * The bed's pressed steel, in the bed's own frame (x across, y up from the hinge, z forward from the hinge: `yc` and `zc` take the world's):
 * a floor in dark chequer plate, sides with a pressed bead and a rolled top, a front wall, the wheel wells in black plastic, tie-down hooks.
 */
export function addMuleBed(bed, MAT, paint, yc, zc) {
  const B = MULE_BED;
  const mid = (B.front + B.gate) / 2;
  const depth = B.front - B.gate;
  rbox(B.half * 2 - 0.04, 0.05, depth, 0.012, MAT.floor, 0, yc(B.floorY), zc(mid), bed, 'bedFloor');
  for (let i = -2; i <= 2; i++) rbox(0.04, 0.012, depth - 0.06, 0.004, MAT.bed, i * 0.3, yc(B.floorY + 0.028), zc(mid), bed); // the chequer plate's ribs
  rbox(B.half * 2, 0.36, 0.05, 0.02, paint, 0, yc(B.floorY + 0.2), zc(B.front), bed, 'bedFront'); // the front wall, a little higher than the sides
  rbox(B.half * 2 + 0.02, 0.05, 0.07, 0.02, paint, 0, yc(B.floorY + 0.4), zc(B.front), bed);
  for (const s of [-1, 1]) {
    rbox(0.05, 0.3, depth, 0.02, paint, s * B.half, yc(B.floorY + 0.15), zc(mid), bed, 'bedSide');
    rbox(0.08, 0.045, depth, 0.02, paint, s * B.half, yc(B.floorY + 0.31), zc(mid), bed); // the rolled top edge
    rbox(0.012, 0.014, depth - 0.14, 0.005, paint, s * (B.half + 0.03), yc(B.floorY + 0.17), zc(mid), bed); // the pressed bead along the side
    rbox(0.012, 0.014, depth - 0.14, 0.005, paint, s * (B.half + 0.03), yc(B.floorY + 0.07), zc(mid), bed);
    rbox(0.27, 0.24, 0.64, 0.05, MAT.plastic, s * (B.half - 0.17), yc(B.floorY + 0.15), zc(-0.98), bed, 'wheelWell');
    for (const z of [-0.8, -1.5]) mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 10), MAT.steel, bed).position.set(s * (B.half - 0.02), yc(B.floorY + 0.28), zc(z)); // tie-downs
    // The side's corner post at the back, with the tailgate's hinge lug on it.
    rbox(0.06, 0.34, 0.05, 0.015, paint, s * B.half, yc(B.floorY + 0.17), zc(B.gate + 0.03), bed);
  }
}

/** The tailgate: green pressed steel with a bead, two chains each side, two latch rods, a hinge pin along its foot and the maker's name on it. */
export function addMuleGate(gate, MAT, paint) {
  const B = MULE_BED;
  const w = B.half * 2;
  rbox(w, 0.34, 0.04, 0.015, paint, 0, 0.17, 0, gate, 'gateSkin');
  rbox(w - 0.1, 0.014, 0.012, 0.005, paint, 0, 0.07, 0.025, gate); // its pressed beads
  rbox(w - 0.1, 0.014, 0.012, 0.005, paint, 0, 0.2, 0.025, gate);
  rbox(w, 0.03, 0.055, 0.012, paint, 0, 0.33, 0, gate); // the rolled top
  rbox(w + 0.02, 0.03, 0.045, 0.01, MAT.steel, 0, 0.0, 0.0, gate, 'gateHinge'); // the hinge pin along its foot
  for (const s of [-1, 1]) {
    rbox(0.018, 0.2, 0.014, 0.006, MAT.steel, s * (w / 2 - 0.1), 0.2, -0.026, gate, 'gateLatch'); // the latch rod and its handle
    rbox(0.04, 0.016, 0.026, 0.006, MAT.steel, s * (w / 2 - 0.1), 0.095, -0.03, gate);
    tube([s * (w / 2 - 0.01), 0.26, 0.0], [s * (w / 2 + 0.005), 0.02, 0.15], 0.005, MAT.steel, gate, 4); // the check chain
  }
  const name = decalMesh('badge', { maker: MAKER_FOR.utv }, { width: 0.3, name: 'gateBadge' });
  name.position.set(0, 0.17, -0.0215); // in the middle of the gate
  name.rotation.y = Math.PI;
  gate.add(name);
}

/** The hitch under the tailgate: a plate bolted to the frame, a drawbar and a ball with its safety-chain loop. */
export function addMuleHitch(root, MAT) {
  const H = MULE_HITCH;
  rbox(0.2, 0.1, 0.05, 0.01, MAT.frame, 0, H.y, H.z + 0.12, root, 'hitchPlate');
  rbox(0.07, 0.04, 0.2, 0.012, MAT.frame, 0, H.y - 0.01, H.z, root, 'drawbar');
  tube([0, H.y - 0.01, H.z - 0.04], [0, H.y + 0.04, H.z - 0.04], 0.012, MAT.steel, root, 8);
  mesh(new THREE.SphereGeometry(0.026, 12, 10), MAT.chrome, root, 'hitchBall').position.set(0, H.y + 0.065, H.z - 0.04);
  mesh(new THREE.TorusGeometry(0.02, 0.005, 6, 12), MAT.steel, root).position.set(0.07, H.y, H.z + 0.12);
}

// Bed cover and splashes ------------------------------------------------------------

/**
 * The bed's canvas cover, as in the photo of the Mule with its hood on: three steel hoops stood on the bed's sides carrying a taut grey canvas
 * sheet that falls over the sides to the rim, open at the back (the tailgate end) so the tailgate still opens and a girl can sit on it. In the
 * bed's own frame (it tips with the bed).
 */
export function addMuleCover(bed, MAT, yc, zc) {
  const B = MULE_BED;
  const rim = B.floorY + 0.33;
  const top = rim + 0.5;
  const front = B.front + 0.02;
  const back = B.gate + 0.12;
  const hoopAt = (z) => [[-B.half + 0.02, yc(rim), zc(z)], [-B.half + 0.06, yc(rim + 0.32), zc(z)], [-0.3, yc(top - 0.04), zc(z)], [0.3, yc(top - 0.04), zc(z)], [B.half - 0.06, yc(rim + 0.32), zc(z)], [B.half - 0.02, yc(rim), zc(z)]];
  const hoops = [front, (front + back) / 2, back].map((z) => sweepGeometry(new THREE.CatmullRomCurve3(hoopAt(z).map((p) => new THREE.Vector3(...p))).getPoints(8).map((p) => [p.x, p.y, p.z]), 0.012, { radial: 5 }));
  mesh(merge(hoops), MAT.steel, bed, 'coverHoops');
  // The sheet: a lofted arch over the hoops, a little proud of them, drooping at its back edge.
  const sheet = loftGeometry([
    { z: zc(front), w: B.half * 2 + 0.04, y0: yc(rim - 0.02), y1: yc(top), e: 2.6 },
    { z: zc((front + back) / 2), w: B.half * 2 + 0.05, y0: yc(rim - 0.02), y1: yc(top + 0.015), e: 2.6 },
    { z: zc(back), w: B.half * 2 + 0.04, y0: yc(rim - 0.02), y1: yc(top - 0.01), e: 2.6 },
  ].sort((a, b) => a.z - b.z), { exponent: 2.6, bottom: 8 });
  mesh(sheet, MAT.canvas, bed, 'bedCover');
  // The straps over it, two across and their buckles, and the tie ropes down each side.
  for (const z of [front * 0.72 + back * 0.28, front * 0.28 + back * 0.72]) rbox(B.half * 2 + 0.06, 0.012, 0.05, 0.004, MAT.strap, 0, yc(top + 0.014), zc(z), bed, 'coverStrap');
}

let splash = null;
/** A dried mud splash texture: a band of brown splats thickest at its foot and thinning up, on a clear ground. */
function splashMaterial() {
  if (!splash) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const g = c.getContext('2d');
    let seed = 5;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 420; i++) {
      const y = 128 * Math.pow(rand(), 0.55); // more towards the foot (the bottom of the picture)
      const r = 1.2 + rand() * (4 - y / 40);
      g.fillStyle = `rgba(${70 + rand() * 30},${50 + rand() * 20},${30 + rand() * 12},${0.35 + rand() * 0.5})`;
      g.beginPath();
      g.ellipse(rand() * 256, 128 - y, r * (0.7 + rand()), r * (0.8 + rand() * 1.2), rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 18; i++) { // drips run up from the splats
      const x = rand() * 256;
      g.fillStyle = 'rgba(78,56,34,0.5)';
      g.fillRect(x, 128 - 30 - rand() * 40, 1.4, 20 + rand() * 30);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    splash = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  }
  return splash;
}

/**
 * Mud flung up the sides: splash bands standing on the flat flanks, a millimetre off them: the bed's two sides and its tailgate (in their own
 * frames, so they tip and swing with them), and the rocker panels and the body's flanks (in the body's).
 */
export function addMuleSplashes(root, bed, gate, yc, zc) {
  const B = MULE_BED;
  const band = (w, h, parent, x, y, z, ry, name) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), splashMaterial());
    m.name = name;
    m.position.set(x, y, z);
    m.rotation.y = ry;
    parent.add(m);
    return m;
  };
  const mid = (B.front + B.gate) / 2;
  for (const s of [-1, 1]) {
    band(Math.abs(B.front - B.gate) - 0.2, 0.28, bed, s * (B.half + 0.0265), yc(B.floorY + 0.13), zc(mid), s * Math.PI / 2, 'mudBedSide');
    band(0.9, 0.3, root, s * 0.5325, 0.5, 0.18, s * Math.PI / 2, 'mudBody');
  }
  band(B.half * 2 - 0.1, 0.2, gate, 0, 0.1, 0.0215, 0, 'mudGate'); // on the tailgate's outer face (its foot)
}
