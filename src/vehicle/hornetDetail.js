import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { bentTube, loftGeometry, rod } from './quadGeometry.js';
import { cableGeometry, hoseGeometry } from './detail/cables.js';
import { decalMesh, MAKER_FOR } from './detail/decals.js';
import { HORNET_NOSE, HORNET_TAIL, HORNET_FACE, HORNET_LAMP, HORNET_VBARS, barAt, hornetCross, HORNET_FOOTREST, HORNET_BUMPER, HORNET_CARB, HORNET_TAP, HORNET_THROTTLE } from './hornetBody.js';

// The yellow quad's finer parts (TODO 91): the small nose with its lamp and mesh vent, the tail, the footrests, the bumper, and the
// engine bay that shows (carb, intake, airbox, the choke plunger's housing, the fuel hose, the throttle cable). Each takes the quad's
// materials (`MAT`, as quadModel has them) and adds to the frame it is given. The pegs, grips, seat and anchors are not here: they are
// fixed points and quadModel keeps them where they were.

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

/** The frame's silver: bare steel tube with a clear coat, as in all three photos (metalness 0.5 so the wear layer dulls it rather than rusting it). */
export function silverMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0xb4b8bb, roughness: 0.4, metalness: 0.5 });
}

/** The nose between the front fenders, sloping down to its face, with the mesh vent on it (the lamp is on the bars: addHornetBars). */
export function addHornetNose(root, MAT, paint) {
  mesh(loftGeometry(HORNET_NOSE, { exponent: 3.5 }), paint, root, 'nose');
  const F = HORNET_FACE;
  // The vent: a dark pocket with three slats across it.
  rbox(F.ventW, F.ventH, 0.02, 0.008, MAT.hole, 0, F.ventY, F.z - 0.002, root);
  for (let i = 0; i < 3; i++) rbox(F.ventW - 0.02, 0.005, 0.012, 0.002, MAT.plastic, 0, F.ventY - 0.014 + i * 0.014, F.z + 0.008, root);
}

/** The tail between the rear fenders, with its lamp and a short rubber flap under it. */
export function addHornetTail(root, MAT, paint) {
  mesh(loftGeometry(HORNET_TAIL, { exponent: 3.5 }), paint, root, 'tail');
  rbox(0.1, 0.035, 0.015, 0.008, MAT.tail, 0, 0.752, -0.973, root);
    for (const s of [-1, 1]) rbox(0.025, 0.12, 0.36, 0.008, paint, s * 0.17, 0.6, -0.42, root, 'sidePlate'); // top at 0.66, under the wing and below the frame's upper rail
}

/** A footrest each side: a plate on a tubular frame out of the lower rail, the peg (a fixed point) standing on it. */
export function addHornetFootrests(root, MAT, silver) {
  const R = HORNET_FOOTREST;
  const xm = (R.x0 + R.x1) / 2;
  for (const s of [-1, 1]) {
    pipe(mx(s, [[R.x0, R.y + 0.006, R.z1], [R.x1, R.y + 0.006, R.z1 - 0.02], [R.x1 + 0.01, R.y + 0.006, R.z0 + 0.02], [R.x0, R.y + 0.006, R.z0]]), 0.012, silver, root, { bend: 0.05, steps: 4 });
    for (const z of [R.z0 + 0.1, 0.05]) tube([s * R.x0, R.y + 0.006, z], [s * (R.x1 - 0.005), R.y + 0.006, z], 0.008, silver, root, 6);
    rbox(R.x1 - R.x0 - 0.02, 0.01, R.z1 - R.z0 - 0.02, 0.003, MAT.alloy, s * xm, R.y, (R.z0 + R.z1) / 2, root, 'footPlate');
    // The heel guard at the back: an upright loop.
    pipe(mx(s, [[R.x0, R.y + 0.006, R.z0], [R.x0 + 0.02, R.y + 0.1, R.z0 - 0.01], [R.x1 - 0.1, R.y + 0.11, R.z0]]), 0.009, silver, root, { bend: 0.03, steps: 3 });
  }
}

/** The bumper: a silver tube loop across the nose tied back to each lower rail, and the skid plate under it. */
export function addHornetBumper(root, MAT, silver) {
  const B = HORNET_BUMPER;
  pipe([[-B.rail.x, B.rail.y, B.rail.z], [-B.x, B.y, B.z], [B.x, B.y, B.z], [B.rail.x, B.rail.y, B.rail.z]], 0.016, silver, root, { bend: 0.09, steps: 5 });
  tube([-B.x * 0.62, B.y, B.z], [-B.rail.x * 0.9, 0.5, 0.85], 0.011, silver, root, 6);
  tube([B.x * 0.62, B.y, B.z], [B.rail.x * 0.9, 0.5, 0.85], 0.011, silver, root, 6);
  rbox(0.34, 0.012, 0.24, 0.004, MAT.alloy, 0, 0.405, 0.92, root, 'skidPlate');
}

/**
 * The engine bay: the carb behind the cylinder (a mixing chamber, a slide cap, a float bowl and the housing the choke plunger comes out
 * of on its left), the rubber intake to the airbox under the seat, the fuel hose from the tap, the throttle cable into the cap, and the
 * recoil starter on the right of the crankcase.
 */
export function addHornetEngine(root, MAT) {
  const C = HORNET_CARB;
  const chamber = mesh(new THREE.CylinderGeometry(C.r, C.r, C.len, 16).rotateX(Math.PI / 2), MAT.engine, root, 'carb');
  chamber.position.set(C.x, C.y, C.z);
  rbox(0.07, 0.07, 0.02, 0.01, MAT.engine, C.x, C.y, C.z + C.len / 2 - 0.004, root); // the flange on the cylinder
  rbox(0.05, 0.036, 0.07, 0.01, MAT.engineDark, C.x, C.bowlY, C.z, root); // the float bowl
  tube([C.x, C.bowlY - 0.018, C.z], [C.x, C.bowlY - 0.03, C.z], 0.006, MAT.chrome, root, 6); // its drain screw
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 14), MAT.engine, root).position.set(C.x, C.capY - 0.01, C.z); // the slide cap
  mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.012, 12), MAT.chrome, root).position.set(C.x, C.capY + 0.012, C.z);
  // The choke plunger's housing on the carb's left side: a short barrel with a hex nut, the plunger (quadModel) pulls out of it.
  const p = C.plunger;
  mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 12).rotateZ(Math.PI / 2), MAT.engine, root).position.set(p.x - 0.005, p.y, p.z);
  mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.008, 6).rotateZ(Math.PI / 2), MAT.chrome, root).position.set(p.x + 0.012, p.y, p.z);
  // The intake boot back to the airbox, clamped each end, and the airbox.
  const boot = hoseGeometry([[C.x, C.y, C.z - C.len / 2], [C.x, C.y + 0.003, -0.16], [C.x, C.y, C.airboxZ + 0.11]], 0.029, { sag: 0 });
  mesh(boot.hose, MAT.rubber, root, 'intakeBoot');
  mesh(boot.clamps, MAT.steel, root);
  rbox(0.2, 0.14, 0.22, 0.03, MAT.plastic, 0, 0.66, C.airboxZ, root, 'airbox');
  // The fuel hose from the bowl under the tap, round the cylinder's left.
  const hose = hoseGeometry([[HORNET_TAP.pos[0], 0.68, HORNET_TAP.pos[2]], [0.16, 0.65, 0.1], [0.12, 0.63, 0.0], [0.06, 0.625, -0.03], [0.035, C.bowlY + 0.003, C.z]], 0.0045, { sag: 0.01, radial: 6, clamps: false });
  mesh(hose.hose, MAT.rubber, root, 'fuelHose');
  // The throttle cable down the right of the tank into the slide cap (its other end is in the bars' frame).
  mesh(cableGeometry(HORNET_THROTTLE, 0.0035, { sag: 0.02 }), MAT.rubber, root, 'throttleCableLower');
  // The brake cable from the column's foot on the left, over the tank's front and into the nose to the front brakes.
  mesh(cableGeometry([[0.04, 0.88, 0.47], [0.07, 0.8, 0.55], [0.1, 0.72, 0.63], [0.1, 0.63, 0.72]], 0.0042, { sag: 0.02 }), MAT.rubber, root, 'brakeCableLower');
  // The recoil starter's round housing on the right of the crankcase, with its handle.
  const recoil = mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.04, 20).rotateZ(Math.PI / 2), MAT.plastic, root, 'recoilCover');
  recoil.position.set(-0.165, 0.43, 0.04);
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 12).rotateZ(Math.PI / 2), MAT.chrome, root).position.set(-0.19, 0.43, 0.04);
}

/**
 * What the Hornet's handlebars carry besides the V itself (buildHandlebars draws that): the clamp block the bar sits in, a straight level
 * crossbar between the arms (no hoop over them), the headlamp standing straight on the clamp at the middle, and both cables' upper parts
 * (brake on the left, throttle on the right) down to where the column meets the body. The key's small housing is the dash, on the clamp
 * block too (`DASH_PLACE.hornet`). All in the bars' frame; the lamp lens is named `headlight` so the beams find it, and steers with the bars.
 */
export function addHornetBars(bars, MAT, lensMat, { lamp = true, lights = true } = {}) {
  // (the kids' quad has neither a lamp nor a lights switch: `lamp` and `lights` false)
  const V = HORNET_VBARS;
  const c = hornetCross();
  tube([-V.crossX, c.y, c.z], [V.crossX, c.y, c.z], 0.0105, MAT.alloy, bars).name = 'crossbar';
  rbox(0.1, 0.03, 0.045, 0.01, MAT.engineDark, 0, V.centreY + 0.012, -0.012, bars, 'clampBlock');
  // The lamp: a black housing on a small block off the clamp, a reflector and a lens on its face.
  const L = HORNET_LAMP;
  if (lamp) {
    rbox(0.05, 0.03, 0.03, 0.008, MAT.engineDark, 0, V.centreY + 0.015, 0.0, bars, 'lampMount');
    rbox(L.w, L.h, L.d, 0.025, MAT.plastic, 0, L.y, L.z, bars, 'headlightHousing');
    rbox(L.w - 0.025, L.h - 0.025, 0.012, 0.01, MAT.reflector, 0, L.y, L.z + L.d / 2 - 0.004, bars);
    const lens = rbox(L.w - 0.025, L.h - 0.025, 0.012, 0.012, lensMat, 0, L.y, L.z + L.d / 2 + 0.003, bars, 'headlight');
    lens.scale.z = 0.8;
  }
  // The lights switch: a small housing clamped on the left of the level run, with a rocker on it (the quad's own pose finds it by name): top
  // pressed in for off, the bottom for on.
  const sx = 0.13;
  const sy = V.centreY + 0.018;
  if (lights) {
    rbox(0.036, 0.024, 0.034, 0.007, MAT.plastic, sx, sy, barAt(sx).z - 0.003, bars, 'lightsSwitchHousing');
    const rocker = new THREE.Group();
    rocker.name = 'lightsRocker';
    rocker.userData.keep = true;
    rocker.position.set(sx, sy + 0.012, barAt(sx).z - 0.003);
    bars.add(rocker);
    rbox(0.024, 0.007, 0.026, 0.003, new THREE.MeshStandardMaterial({ color: 0x25272a, roughness: 0.6 }), 0, 0.002, 0, rocker, 'lightsRockerCap');
  }
  // The cables: the brake's on the left from the lever perch, the throttle's on the right from its housing, both down to the column's foot.
  const py = barAt(V.perchX).y;
  mesh(cableGeometry([[V.perchX, py + 0.012, -0.02], [0.22, -0.03, 0.02], [0.12, -0.07, 0.04], [0.06, -0.1, 0.03], [0.04, -0.14, 0.01]], 0.0042, { sag: 0.03 }), MAT.rubber, bars, 'brakeCable');
  mesh(cableGeometry([[-V.perchX - 0.01, py + 0.02, -0.035], [-0.2, -0.04, -0.04], [-0.1, -0.08, -0.03], [-0.05, -0.14, 0.0]], 0.0035, { sag: 0.03 }), MAT.rubber, bars, 'throttleCable');
}

/** The choke's symbol on its knob's face: a ring with a bar across it (the usual choke picture, as geometry so it takes no texture). */
export function chokeSymbol(material) {
  const g = new THREE.Group();
  mesh(new THREE.RingGeometry(0.005, 0.0072, 14), material, g);
  const bar = mesh(new THREE.PlaneGeometry(0.018, 0.0022), material, g);
  bar.rotation.z = Math.PI / 4;
  return g;
}

/** The maker's badge on each side plate's outer face, a millimetre off the surface. */
export function addHornetDecals(root) {
  for (const s of [-1, 1]) {
    const badge = decalMesh('badge', { maker: MAKER_FOR.hornet, model: 'Hornet 200' }, { width: 0.2, name: 'badge' });
    badge.position.set(s * 0.1835, 0.6, -0.42);
    badge.rotation.y = s * (Math.PI / 2);
    root.add(badge);
  }
}
