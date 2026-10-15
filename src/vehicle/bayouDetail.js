import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bentTube, rod } from './quadGeometry.js';
import { boltsMesh } from './detail/fixings.js';
import { cableGeometry } from './detail/cables.js';
import { decalMesh, MAKER_FOR } from './detail/decals.js';
import { BAYOU_DECK, BAYOU_FACE, BAYOU_CAGE, BAYOU_RACKS, BAYOU_TAIL_X, cagePieces, rearFaceAt } from './bayouBody.js';

// The green quad's finer detail (TODO 90), from the shared kit and the photos in `.scratch/quads/ridgeback-quad/`: the grey nose cage
// round two square headlights, the slatted grille and its badge, the winch's housing and roller fairlead, the tail lamp panel, the tow
// hitch with its pin, the stickers, and the signs of age (a cracked mudguard held with cable ties, oil weeping from the engine cases).
// Each takes the quad's materials (`MAT`, as quadModel has them) and adds to the frame it is given. Nothing here moves a fixed point.

const mesh = (geo, mat, parent, name) => {
  const m = new THREE.Mesh(geo, mat);
  if (name) m.name = name;
  parent.add(m);
  return m;
};

const strip = (g) => {
  g.deleteAttribute('uv');
  return g;
};

const rbox = (w, h, d, r, mat, x, y, z, parent, name) => {
  const m = mesh(new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 2, h / 2, d / 2) * 0.999), mat, parent, name);
  m.position.set(x, y, z);
  return m;
};

const tube = (a, b, r, mat, parent, radial = 8) => mesh(rod(a, b, r, radial), mat, parent);

/** The cage's grey: powder-coated steel gone dull (metalness 0.2, so the wear layer fades and grimes it and does not rust every weld). */
export function cageMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0x6d7276, roughness: 0.58, metalness: 0.2 });
}

/**
 * The front: the grey cage (bars with a ball at each joint), two square lamps in black housings on the face, the slatted grille between
 * them with the maker's badge, and a skid plate. The lamps share the model's lens material, so the headlight code finds them.
 */
export function addBayouFront(root, MAT, lensMat, grey = cageMaterial()) {
  const face = BAYOU_FACE;
  const C = BAYOU_CAGE;
  // The cage: the outer loop (top rail, uprights and bottom rail) bent in one piece with rounded corners, a loop under and beside each lamp,
  // and straight struts back to the rack, the face and the frame (the same bars as `cagePieces`, which the tests check join up).
  const bar = 0.015;
  const mid = C.zTop + 0.005;
  mesh(bentTube([[-C.x, C.topY, C.zTop], [C.x, C.topY, C.zTop], [C.x, C.lowY, C.zLow], [-C.x, C.lowY, C.zLow]], bar, { bend: 0.05, steps: 5, closed: true }), grey, root, 'cageLoop');
  for (const s of [-1, 1]) mesh(bentTube([[s * C.inner, C.topY, C.zTop], [s * C.inner, C.midY, mid], [s * C.x, C.midY, mid]], 0.013, { bend: 0.025, steps: 4 }), grey, root, 'cageLampLoop');
  for (const p of cagePieces()) {
    if (['topRail', 'lowRail', 'upright', 'lampSill', 'lampPost'].includes(p.name)) continue;
    tube(p.pts[0], p.pts[1], 0.013, grey, root, 6).name = `cage_${p.name}`;
  }
  // Plates the cage's lower rail is bolted to, either end, and the bolts.
  for (const s of [-1, 1]) {
    rbox(0.07, 0.07, 0.014, 0.004, grey, s * C.x, C.lowY, C.zLow - 0.012, root, 'cagePlate');
    const bolts = boltsMesh([[s * C.x - 0.02, C.lowY + 0.02, 0], [s * C.x + 0.02, C.lowY - 0.02, 0]], [0, 0, 1], MAT.chrome, { size: 0.01, kind: 'hex', name: 'cageBolts' });
    bolts.position.z = C.zLow - 0.003;
    root.add(bolts);
  }
  rbox(0.36, 0.014, 0.2, 0.005, MAT.frame, 0, 0.35, 0.84, root, 'skidPlate'); // under the nose, between the cage's struts and the frame

  // The lamps: a black housing standing out of the face, a reflector and a square lens, one each side.
  for (const s of [-1, 1]) {
    const x = s * face.lampX;
    rbox(face.lampW + 0.03, face.lampH + 0.03, 0.05, 0.012, MAT.plastic, x, face.lampY, face.z + 0.005, root, 'lampHousing');
    rbox(face.lampW, face.lampH, 0.012, 0.006, MAT.reflector, x, face.lampY, face.z + 0.03, root, undefined);
    const lens = rbox(face.lampW, face.lampH, 0.012, 0.008, lensMat, x, face.lampY, face.z + 0.036, root, s > 0 ? 'headlightLeft' : 'headlightRight');
    lens.scale.z = 0.8;
    // Each lamp hangs from the cage by two short brackets, up to the sill under it and the top rail over it, and from the frame by a stay.
    for (const dx of [-0.045, 0.045]) {
      tube([x + dx, C.midY, C.zTop + 0.005], [x + dx, face.lampY - face.lampH / 2 - 0.012, face.z + 0.005], 0.007, grey, root, 6).name = 'lampBracket';
      tube([x + dx, C.topY, C.zTop], [x + dx, face.lampY + face.lampH / 2 + 0.012, face.z + 0.005], 0.007, grey, root, 6).name = 'lampBracket';
    }
    tube([x, face.lampY - 0.03, face.z - 0.02], [x * 0.9, C.frameY + 0.02, C.frameZ + 0.03], 0.009, MAT.frame, root, 6).name = 'lampStay';
  }

  // The grille: a dark back, a black frame and tall slats, standing out of the face between the lamps.
  const box = (w, h, d, x, y, z) => strip(new THREE.BoxGeometry(w, h, d)).translate(x, y, z);
  const g = new THREE.Group();
  g.name = 'grille';
  g.position.set(0, face.lampY, face.z - 0.004);
  root.add(g);
  const gw = face.grilleW;
  const gh = face.grilleH;
  mesh(mergeGeometries([box(gw, 0.012, 0.03, 0, gh / 2, 0.012), box(gw, 0.012, 0.03, 0, -gh / 2, 0.012), box(0.012, gh, 0.03, gw / 2, 0, 0.012), box(0.012, gh, 0.03, -gw / 2, 0, 0.012)]), MAT.plastic, g, 'grilleFrame');
  mesh(box(gw - 0.01, gh - 0.01, 0.004, 0, 0, -0.002), MAT.hole, g, 'grilleDark');
  const slats = [];
  const n = 13;
  for (let i = 0; i < n; i++) slats.push(box(0.0075, gh - 0.012, 0.022, -gw / 2 + 0.012 + ((gw - 0.024) * (i + 0.5)) / n, 0, 0.011));
  mesh(mergeGeometries(slats), MAT.plastic, g, 'grilleSlats');
  // The grille is a panel on its own frame: two rods from its top corners up to the cage's top rail, two stays back to the cradle, and a
  // black radiator shroud behind it, the only thing that stops you seeing straight through the nose.
  for (const s of [-1, 1]) {
    tube([s * gw / 2, face.lampY + gh / 2, face.z + 0.01], [s * gw / 2, C.topY, C.zTop], 0.007, grey, root, 6).name = 'grilleHanger';
    tube([s * gw / 2, face.lampY - gh / 2, face.z], [s * gw / 2 * 0.8, C.frameY + 0.02, C.frameZ + 0.03], 0.008, MAT.frame, root, 6).name = 'grilleStay';
  }
  rbox(0.24, 0.15, 0.012, 0.004, MAT.plastic, 0, face.lampY, face.z - 0.03, root, 'radiatorShroud');
  // The maker's name across the slats, where the real one's is, on a plain black strip so it reads.
  const badge = decalMesh('badge', { maker: MAKER_FOR.green }, { width: 0.1, name: 'badge' });
  badge.position.set(0, face.lampY, face.z + 0.0285);
  root.add(badge);
}

/**
 * The winch's housing: a steel cover over the drum and its rope (the open front shows the rope on the drum), two mounts down to the frame, and a roller fairlead where the rope goes out. The drum, rope, motor and hook are the model's own (`winch`), at
 * the fixed points; this only closes them in.
 */
export function addWinchHousing(root, MAT, x, y, z, fairleadZ) {
  const cover = [
    rbox(0.24, 0.012, 0.13, 0.004, MAT.frame, x, y + 0.06, z + 0.02, root, 'winchCover'), // over the drum
    rbox(0.012, 0.11, 0.15, 0.004, MAT.frame, x + 0.2, y, z + 0.02, root, 'winchSideRight'), // beyond the motor
    rbox(0.012, 0.11, 0.15, 0.004, MAT.frame, x - 0.17, y, z + 0.02, root, 'winchSideLeft'), // beyond the gearbox
  ];
  for (const c of cover) c.userData.keep = false;
  for (const s of [-1, 1]) tube([x + s * 0.2, y - 0.02, z + 0.02], [x + s * 0.2, 0.4, 0.8], 0.011, MAT.frame, root, 6).name = 'winchMount'; // the housing's sides stand on the frame
  // The roller fairlead: a plate with four rollers round the opening, in front of the cover.
  rbox(0.13, 0.07, 0.012, 0.004, MAT.frame, x, y - 0.01, fairleadZ + 0.012, root, 'fairleadPlate');
  const roller = (w, h, rx, ry) => {
    const g = new THREE.CylinderGeometry(0.0085, 0.0085, w > h ? w : h, 8);
    if (w > h) g.rotateZ(Math.PI / 2);
    return mesh(strip(g), MAT.steel, root, 'fairleadRoller').position.set(x + rx, y - 0.01 + ry, fairleadZ + 0.024);
  };
  roller(0.09, 0.0, 0, 0.026);
  roller(0.09, 0.0, 0, -0.026);
  roller(0.0, 0.05, 0.043, 0);
  roller(0.0, 0.05, -0.043, 0);
  const bolts = boltsMesh([[x - 0.05, y + 0.025, 0], [x + 0.05, y + 0.025, 0], [x - 0.05, y - 0.045, 0], [x + 0.05, y - 0.045, 0]], [0, 0, 1], MAT.chrome, { size: 0.009, kind: 'hex', name: 'fairleadBolts' });
  bolts.position.z = fairleadZ + 0.019;
  root.add(bolts);
}

/**
 * The rear: a black panel on the rear deck's face carrying the tail lamp and a reflector either side, a cross beam under it, and the
 * tow hitch: a plate bolted to the beam with a drawbar back from it, a hole through the drawbar and a pin dropped into the hole,
 * with a linch pin through the pin's end. The lamp lens is `MAT.tail`, which the tail light code finds.
 */
export function addBayouRear(root, MAT) {
  const z = BAYOU_DECK.rear.zf;
  const reflector = new THREE.MeshStandardMaterial({ color: 0x8a1410, roughness: 0.15, metalness: 0.3 });
  // Two tail lamps, one each side, lying on the leaning face: each a black housing with the red lens on it and a reflector under it.
  const lampY = 0.665;
  for (const s of [-1, 1]) {
    const f = rearFaceAt(lampY, BAYOU_TAIL_X);
    const g = new THREE.Group();
    g.name = 'tailLampGroup';
    g.position.set(s * BAYOU_TAIL_X, lampY, f.z);
    g.rotation.set(f.tilt, Math.PI, 0); // turned back, then up to lie on the face
    root.add(g);
    rbox(0.115, 0.075, 0.03, 0.012, MAT.plastic, 0, 0, 0.004, g, 'tailHousing');
    rbox(0.09, 0.05, 0.012, 0.008, MAT.tail, 0, 0, 0.022, g, 'tailLamp');
    rbox(0.04, 0.02, 0.008, 0.004, reflector, 0, -0.058, 0.01, g, 'tailReflector');
  }
  tube([-0.3, 0.5, z - 0.06], [0.3, 0.5, z - 0.06], 0.018, MAT.frame, root, 8).name = 'rearBeam';
  for (const s of [-1, 1]) tube([s * 0.3, 0.5, z - 0.06], [s * 0.3, 0.62, z + 0.0], 0.014, MAT.frame, root, 6);
  // The hitch: a plate down from the beam, braces up to the frame, a drawbar with its pin.
  rbox(0.14, 0.2, 0.016, 0.004, MAT.frame, 0, 0.38, z - 0.075, root, 'hitchPlate');
  for (const s of [-1, 1]) tube([s * 0.19, 0.62, z + 0.04], [s * 0.065, 0.46, z - 0.07], 0.011, MAT.frame, root, 6);
  const bar = rbox(0.06, 0.016, 0.11, 0.004, MAT.frame, 0, 0.3, z - 0.115, root, 'drawbar');
  bar.userData.keep = false;
  // The hole through the drawbar, and the pin standing in it with a head on top and a linch pin through its end below.
  rbox(0.022, 0.0165, 0.022, 0.004, MAT.hole, 0, 0.3, z - 0.15, root, 'drawbarHole').scale.y = 1.02;
  const pin = mesh(strip(new THREE.CylinderGeometry(0.0085, 0.0085, 0.075, 10)), MAT.chrome, root, 'hitchPin');
  pin.position.set(0, 0.315, z - 0.15);
  mesh(strip(new THREE.CylinderGeometry(0.0155, 0.0155, 0.007, 12)), MAT.chrome, root, 'hitchPinHead').position.set(0, 0.356, z - 0.15);
  mesh(strip(new THREE.TorusGeometry(0.011, 0.0017, 5, 12)), MAT.frame, root, 'linchPin').position.set(0, 0.272, z - 0.15);
  tube([0, 0.272, z - 0.15 - 0.011], [0, 0.272, z - 0.15 + 0.011], 0.0022, MAT.frame, root, 4);
}

/** The racks' foot blocks are the model's; this adds the front rack's two black cage mounts, a block each where the cage's braces meet its rail. */
export function addBayouRackBlocks(root, MAT) {
  const R = BAYOU_RACKS.front;
  for (const s of [-1, 1]) {
    rbox(0.07, 0.04, 0.07, 0.01, MAT.plastic, s * BAYOU_CAGE.x, R.y - 0.008, R.z1 - 0.02, root, 'rackBlock');
    const bolts = boltsMesh([[s * BAYOU_CAGE.x - 0.02, 0, R.z1 - 0.02], [s * BAYOU_CAGE.x + 0.02, 0, R.z1 - 0.02]], [0, 1, 0], MAT.chrome, { size: 0.01, kind: 'flange', name: 'rackBlockBolts' });
    bolts.position.y = R.y + 0.012;
    root.add(bolts);
  }
}

/**
 * The stickers, each flat on a square-edged face a millimetre proud: the maker's name and the model on the tank cover's sides ("Ridgeback
 * RB300"), the model's nickname in script on each side panel ("Farmhand"), "4x4" beside it, and a warning label on the rear fender's top.
 */
export function addBayouDecals(root) {
  for (const s of [-1, 1]) {
    const name = decalMesh('badge', { maker: MAKER_FOR.green, model: 'RB300' }, { width: 0.2, name: 'tankDecal' });
    name.position.set(s * 0.1935, 0.82, 0.3); // the tank cover's side, a millimetre proud
    name.rotation.y = s * (Math.PI / 2);
    root.add(name);
    const nick = decalMesh('stripes', { colours: [], text: 'Farmhand', ink: '#e8efe2' }, { width: 0.26, name: 'nickDecal' });
    nick.position.set(s * 0.2785, 0.69, 0.06);
    nick.rotation.y = s * (Math.PI / 2);
    root.add(nick);
    const four = decalMesh('stripes', { colours: [], text: '4x4', ink: '#b79cf0' }, { width: 0.14, name: 'fourDecal' });
    four.position.set(s * 0.2785, 0.69, -0.15);
    four.rotation.y = s * (Math.PI / 2);
    root.add(four);
    const warn = decalMesh('warning', {}, { width: 0.08, name: 'warningDecal' });
    warn.position.set(s * 0.43, BAYOU_DECK.rear.top - 0.03, -0.42); // flat on the rear fender's top beside the seat
    warn.rotation.x = -Math.PI / 2;
    warn.rotation.z = s > 0 ? 0 : Math.PI;
    root.add(warn);
  }
}

/**
 * Age: the front left mudguard has cracked across its flare and is held with three black cable ties (a dark crack along the flare, a tie
 * either side of it and one across), and oil weeps from the left case cover (a wet amber streak along its seam and three runs down from it).
 */
export function addBayouWear(root, MAT) {
  const crack = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const tieMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.6 });
  // On the left rear flare's outer face, where it hangs behind the wheel: a jagged crack running down from the top, with ties across it.
  const x = 0.5845; // the flare's outer face is at 0.583
  const z0 = -0.7;
  const pts = [[0.755, 0], [0.74, 0.012], [0.725, -0.008], [0.71, 0.01], [0.695, -0.006], [0.685, 0.004]];
  const crackGeo = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [y0, dz0] = pts[i];
    const [y1, dz1] = pts[i + 1];
    crackGeo.push(rod([x, y0, z0 + dz0], [x, y1, z0 + dz1], 0.0022, 4));
  }
  mesh(mergeGeometries(crackGeo), crack, root, 'mudguardCrack');
  for (const y of [0.742, 0.718, 0.693]) {
    const t = rbox(0.0045, 0.005, 0.07, 0.0015, tieMat, x, y, z0 + 0.001, root, 'cableTie'); // across the crack, flat on the flare
    t.rotation.x = 0.0;
    rbox(0.009, 0.009, 0.014, 0.003, tieMat, x + 0.002, y, z0 + 0.034, root, 'cableTieHead');
  }
  // Oil weeping on the left case: a wet dark streak low on the crankcase, running down.
  const oil = new THREE.MeshStandardMaterial({ color: 0x7a5420, roughness: 0.12, metalness: 0.3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  // The left case cover (the engine's dark loft at x 0.145 to 0.235) is what shows below the short side panel, so the weeping runs down its face.
  const streak = (y, z, h, w) => rbox(0.002, h, w, 0.0008, oil, 0.2365, y, z, root, 'oilWeep');
  streak(0.455, 0.0, 0.02, 0.2); // along the seam between the case halves
  streak(0.4, 0.06, 0.09, 0.016);
  streak(0.41, -0.04, 0.07, 0.014);
  streak(0.42, -0.1, 0.05, 0.012);
}

/**
 * The bars' own parts on the Bayou (bars frame, +Z ahead): the bracket the speedo stands on, a bolted block where the bar crosses the
 * stem, and the cables: the brake's and throttle's down the column, and the speedo's drive from its back. They run ahead of the pod
 * and down to the column's shroud, never through the pod.
 */
export function addBayouBarParts(bars, MAT) {
  mesh(bentTube([[0, -0.03, -0.012], [0, -0.005, 0.015], [0.0, 0.026, 0.056]], 0.0125, { bend: 0.03, steps: 5 }), MAT.frame, bars, 'speedoBracket');
  rbox(0.07, 0.034, 0.05, 0.01, MAT.frame, 0, -0.0345, -0.012, bars, 'barClamp');
  const cableGeo = (anchors, r) => cableGeometry(anchors, r, { sag: 0.05 });
  mesh(cableGeo([[0.262, 0.05, -0.012], [0.21, 0.045, 0.035], [0.1, 0.0, 0.06], [0.05, -0.05, 0.04], [0.04, -0.12, 0.01]], 0.0042), MAT.rubber, bars, 'brakeCable');
  mesh(cableGeo([[-0.25, 0.055, -0.04], [-0.15, 0.015, -0.04], [-0.07, -0.025, -0.025], [-0.04, -0.1, -0.01]], 0.0032), MAT.rubber, bars, 'throttleCable');
  mesh(cableGeo([[0.012, 0.035, 0.066], [0.02, -0.01, 0.07], [0.015, -0.06, 0.045], [0.0, -0.12, 0.015]], 0.0045), MAT.rubber, bars, 'speedoCable');
}
