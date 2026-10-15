import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { bentTube, loftGeometry, rod } from './quadGeometry.js';
import { cableGeometry } from './detail/cables.js';
import { decalMesh, MAKER_FOR } from './detail/decals.js';
import { BLASTER_VBARS, BLASTER_LAMP, barAt, blasterCross } from './blasterBody.js';
import { RACER_SHROUD, RACER_LOUVRES, RACER_GRILLE, RACER_TAIL, RACER_FLANK, RACER_SIDE_PLATE, RACER_POD, shroudTop } from './racerBody.js';

// The orange quad's finer parts (TODO 92): the shroud with its louvres and radiator grille, the flanks, the tail, the bars with a pad
// and a square lamp in a guard, and the pod on the left bar (lights rocker, choke lever, the kill switch's panel on it). Each takes the
// quad's materials (`MAT`, as quadModel has them) and adds to the frame it is given. Nothing here moves a fixed point except the dash
// (the kill switch panel, which stands on the pod now: quadModel's DASH_PLACE).

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

/** The frame's blue: powder-coated steel tube (metalness 0.4, so the wear layer dulls and chips it rather than rusting every weld). */
export function racerBlue() {
  return new THREE.MeshStandardMaterial({ color: 0x1d46a8, roughness: 0.42, metalness: 0.4 });
}

/** The seat's blue: vinyl. */
export function racerSeatBlue() {
  return new THREE.MeshStandardMaterial({ color: 0x1f4aa0, roughness: 0.5 });
}

/** A flat shape in (z, y), `t` thick across x and centred on x = 0 (place it at x = s * outer): the flanks. */
function slab(points, t, bevel = 0.004) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y))), { depth: t, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 1 });
  g.translate(0, 0, -t / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}

/**
 * The body between the fenders: the shroud over tank and nose with three louvres on its top and the radiator's grille on its front, the
 * flank triangles and the plates behind them, the tail with its lamp, and the silver grab bar round it.
 */
export function addRacerBody(root, MAT, paint) {
  mesh(loftGeometry(RACER_SHROUD, { exponent: 5 }), paint, root, 'shroud');
  // The louvres: dark slots lying on the sloping top, a little sunk into it so they do not fight it.
  const front = RACER_SHROUD[3];
  const back = RACER_SHROUD[2];
  const slope = Math.atan2(back.y1 - front.y1, front.z - back.z);
  for (const z of RACER_LOUVRES) {
    const slot = rbox(0.2, 0.014, 0.05, 0.005, MAT.hole, 0, shroudTop(z) - 0.002, z, root, 'louvre');
    slot.rotation.x = slope; // the front (+z) end lower
  }
  // The grille over the radiator on the blunt front: a dark pocket and slats.
  const G = RACER_GRILLE;
  rbox(G.w, G.h, 0.02, 0.008, MAT.hole, 0, G.y, G.z, root);
  for (let i = 0; i < 4; i++) rbox(G.w - 0.02, 0.005, 0.012, 0.002, MAT.plastic, 0, G.y - 0.025 + i * 0.017, G.z + 0.008, root);
  // The flank triangles, one each side.
  for (const s of [-1, 1]) mesh(slab(RACER_FLANK.corners, 0.02, 0.005), paint, root, 'flank').position.set(s * RACER_FLANK.x, 0, 0);
  const P = RACER_SIDE_PLATE;
  for (const s of [-1, 1]) rbox(0.025, P.h, P.len, 0.008, paint, s * P.x, P.y, P.z, root, 'sidePlate');
  // The tail, its lamp and the silver grab bar round the back (it ends on the tail's sides, not in the air).
  mesh(loftGeometry(RACER_TAIL, { exponent: 4 }), paint, root, 'tail');
  rbox(0.1, 0.03, 0.015, 0.008, MAT.tail, 0, 0.885, -0.972, root);
  pipe([[0.13, 0.86, -0.92], [0.17, 0.83, -1.02], [-0.17, 0.83, -1.02], [-0.13, 0.86, -0.92]], 0.012, MAT.chrome, root, { bend: 0.06, steps: 4 });
}

/**
 * The bars' parts besides the V (buildHandlebars draws that, shared with the yellow's): the clamp block, the level crossbar with its pad,
 * the square lamp on a mount at the middle inside a wire guard, the pod on the left of the level run (a housing with the lights rocker and
 * the choke lever's place on it; the dash's kill switch panel stands on it too), and the cables. Bars' frame; the lens is `headlight`.
 */
export function addRacerBars(bars, MAT, lensMat) {
  const V = BLASTER_VBARS;
  const c = blasterCross();
  tube([-V.crossX, c.y, c.z], [V.crossX, c.y, c.z], 0.0105, MAT.alloy, bars).name = 'crossbar';
  mesh(new THREE.CapsuleGeometry(0.02, 0.13, 4, 10).rotateZ(Math.PI / 2), MAT.plastic, bars, 'barPad').position.set(0, c.y, c.z);
  rbox(0.1, 0.03, 0.045, 0.01, MAT.engineDark, 0, V.centreY + 0.012, -0.012, bars, 'clampBlock');
  // The lamp: a square black housing on a block off the clamp, a reflector and a lens, with a wire guard round it.
  const L = BLASTER_LAMP;
  rbox(0.05, 0.03, 0.03, 0.008, MAT.engineDark, 0, V.centreY + 0.015, 0.0, bars, 'lampMount');
  rbox(L.w, L.h, L.d, 0.012, MAT.plastic, 0, L.y, L.z, bars, 'headlightHousing');
  rbox(L.w - 0.025, L.h - 0.025, 0.012, 0.006, MAT.reflector, 0, L.y, L.z + L.d / 2 - 0.004, bars);
  const lens = rbox(L.w - 0.025, L.h - 0.025, 0.012, 0.008, lensMat, 0, L.y, L.z + L.d / 2 + 0.003, bars, 'headlight');
  lens.scale.z = 0.8;
  const gz = L.z + L.d / 2 + 0.012;
  const gx = L.w / 2 + 0.008;
  pipe([[-gx, L.y - L.h / 2 - 0.005, L.z], [-gx, L.y + L.h / 2 + 0.012, gz], [gx, L.y + L.h / 2 + 0.012, gz], [gx, L.y - L.h / 2 - 0.005, L.z]], 0.0045, MAT.chrome, bars, { bend: 0.012, steps: 3 });
  tube([-gx, L.y + L.h / 2 + 0.012, gz], [-gx, L.y + L.h / 2 + 0.01, L.z], 0.0045, MAT.chrome, bars, 5);
  tube([gx, L.y + L.h / 2 + 0.012, gz], [gx, L.y + L.h / 2 + 0.01, L.z], 0.0045, MAT.chrome, bars, 5);
  // The pod: a black housing on the level run, the lights rocker on it (yellow, as in the photo) and the red kill button's housing ahead.
  const P = RACER_POD;
  const w = P.x1 - P.x0;
  const py = V.centreY + 0.02;
  rbox(w, 0.032, 0.05, 0.008, MAT.plastic, (P.x0 + P.x1) / 2, py, -0.025, bars, 'controlPod');
  const rocker = new THREE.Group();
  rocker.name = 'lightsRocker';
  rocker.userData.keep = true;
  rocker.position.set(P.rockerX, py + 0.016, -0.025);
  bars.add(rocker);
  rbox(0.024, 0.007, 0.03, 0.003, new THREE.MeshStandardMaterial({ color: 0xe8c21b, roughness: 0.55 }), 0, 0.002, 0, rocker, 'lightsRockerCap');
  // The cables: the brake's on the left from the lever perch, the throttle's on the right from its housing, both down to the column's foot.
  const pY = barAt(V.perchX).y;
  mesh(cableGeometry([[V.perchX, pY + 0.012, -0.02], [0.22, -0.03, 0.02], [0.12, -0.07, 0.04], [0.06, -0.1, 0.03], [0.04, -0.14, 0.01]], 0.0042, { sag: 0.03 }), MAT.rubber, bars, 'brakeCable');
  mesh(cableGeometry([[-V.perchX - 0.01, pY + 0.02, -0.035], [-0.2, -0.04, -0.04], [-0.1, -0.08, -0.03], [-0.05, -0.14, 0.0]], 0.0035, { sag: 0.03 }), MAT.rubber, bars, 'throttleCable');
}

/** Where the choke lever stands on the pod (the bars' frame): the pod's top at the lever's place. */
export function racerChokeAt() {
  return [RACER_POD.chokeX, BLASTER_VBARS.centreY + 0.036, -0.025];
}

/** The maker's badge on each flank's outer face, a millimetre off the surface. */
export function addRacerDecals(root) {
  for (const s of [-1, 1]) {
    const badge = decalMesh('badge', { maker: MAKER_FOR.orange, model: 'Adder 250' }, { width: 0.2, name: 'badge' });
    badge.position.set(s * (RACER_FLANK.x + 0.01 + 0.006 + 0.001), 0.74, -0.08);
    badge.rotation.y = s * (Math.PI / 2);
    root.add(badge);
  }
}
