import * as THREE from 'three';
import { loftGeometry, mergeStatic, rod } from './quadGeometry.js';
import { treadTyre, wornTyre, outerRadius } from './detail/tread.js';
import { decalMesh } from './detail/decals.js';
import { buildLamp } from './detail/lamps.js';
import { buildMirror } from './detail/mirrors.js';
import { buildGrille, buildWiper, buildGrabHandle, buildDoorHandle } from './detail/fittings.js';
import { buildSeat } from './detail/seats.js';
import { buildSteeringWheel } from './detail/steeringWheel.js';
import { hoseGeometry } from './detail/cables.js';
import { boltsMesh, boltRow } from './detail/fixings.js';
import { plate } from './cabModel.js';

// After a 100 hp four-wheel-drive tractor of the 2000s with a front loader (no real make: the Dene 100 is Calder's).
// The neighbour's newer tractor (#926), parked in her yard as scenery: a blue and pale grey body with a sloped bonnet and a glazed cab, a front loader on two arms with
// a bucket, and a linkage and a PTO at the back. Nobody drives it and it is not in the fleet, so it has no spec, only a model; trafficView.js `MODELS` builds it
// (`loaderTractor`) and `setLoader(model, height)` lifts its bucket. +Z is forward and +X is the driver's left; y = 0 is the ground at rest.
//
//   quad
//   ├── bodyRoot                      sits at LOADER_TRACTOR_GROUND_OFFSET in the chassis, like the other tractor's
//   │   ├── bonnet, cab, guards, engine, linkage, hoses, lamps ...
//   │   └── loaderArm_l, loaderArm_r (bucket inside), loaderRam_*   the parts setLoader moves
//   └── wheel_fl / wheel_fr / wheel_rl / wheel_rr   (each with a 'spin' child)

export const LOADER_TRACTOR_GROUND_OFFSET = -0.8; // chassis origin to the ground at rest, metres
export const LT_WHEELS = {
  rearR: 0.76, frontR: 0.56, rearX: 0.95, frontX: 0.97, rearZ: -1.25, frontZ: 1.2,
  rearW: 0.5, frontW: 0.38, rearRim: 0.43, frontRim: 0.3,
};
export const LOADER_TRACTOR_LAYOUT = {
  wheels: [
    { name: 'wheel_fl', x: LT_WHEELS.frontX, z: LT_WHEELS.frontZ, front: true, radius: LT_WHEELS.frontR },
    { name: 'wheel_fr', x: -LT_WHEELS.frontX, z: LT_WHEELS.frontZ, front: true, radius: LT_WHEELS.frontR },
    { name: 'wheel_rl', x: LT_WHEELS.rearX, z: LT_WHEELS.rearZ, front: false, radius: LT_WHEELS.rearR },
    { name: 'wheel_rr', x: -LT_WHEELS.rearX, z: LT_WHEELS.rearZ, front: false, radius: LT_WHEELS.rearR },
  ],
};

/** The loader: each arm turns about a pivot on its mast, and the bucket hangs level from the arm's tip. Angles are the arm's turn about X (positive points the tip down). */
export const LOADER = {
  pivot: { x: 0.62, y: 1.55, z: 0.45 }, // each arm's (the left's x; the right's is its mirror)
  armLow: 0.408, armHigh: -0.55, // the arm's turn at the bottom and the top of its lift
  tip: { y: -0.25, z: 2.5 }, // where the bucket hangs, in the arm's own frame
  curl: 0.1, // the bucket's floor tipped forward and down from level, so the lip bites
  bucketW: 2.0,
};

// The paint's and the steel's surfaces, drawn on small tiling canvases once and shared: the paint with rain runs and a film of dirt, the steel with scratches and rust flecks. Both are
// multiplied by the material's colour, so every part keeps its own, and both ride on UVs (a box has them, the bonnet and the wings are given planar ones).
const textures = new Map();
function surface(kind) {
  if (textures.has(kind)) return textures.get(kind);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const random = rnd(kind === 'paint' ? 11 : 23);
  g.fillStyle = kind === 'paint' ? '#f4f4f2' : '#d8d8d6';
  g.fillRect(0, 0, 128, 128);
  if (kind === 'paint') {
    for (let i = 0; i < 26; i++) { // rain runs, down the panel
      g.fillStyle = `rgba(120,105,85,${0.05 + random() * 0.1})`;
      g.fillRect(random() * 128, random() * 60, 1 + random() * 2, 30 + random() * 60);
    }
    for (let i = 0; i < 90; i++) { // chips and grit
      g.fillStyle = `rgba(${random() < 0.5 ? '80,70,60' : '255,255,255'},${0.08 + random() * 0.15})`;
      g.fillRect(random() * 128, random() * 128, 1 + random() * 2, 1 + random() * 2);
    }
    const dirt = g.createLinearGradient(0, 0, 0, 128);
    dirt.addColorStop(0, 'rgba(90,75,55,0)');
    dirt.addColorStop(1, 'rgba(90,75,55,0.22)');
    g.fillStyle = dirt;
    g.fillRect(0, 0, 128, 128);
  } else {
    for (let i = 0; i < 70; i++) { // scratches
      g.strokeStyle = `rgba(${random() < 0.5 ? '255,255,255' : '40,40,40'},${0.1 + random() * 0.2})`;
      g.lineWidth = 0.5 + random();
      g.beginPath();
      const x = random() * 128;
      const y = random() * 128;
      g.moveTo(x, y);
      g.lineTo(x + (random() - 0.3) * 40, y + (random() - 0.5) * 8);
      g.stroke();
    }
    for (let i = 0; i < 40; i++) { // rust flecks and clay
      g.fillStyle = `rgba(${random() < 0.6 ? '140,70,30' : '95,80,55'},${0.12 + random() * 0.2})`;
      g.fillRect(random() * 128, random() * 128, 1 + random() * 3, 1 + random() * 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  textures.set(kind, tex);
  return tex;
}

/** Planar UVs for a geometry without any (a loft): across by x and along by z over y, a metre to a tile. */
function planarUV(geo) {
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i) + p.getZ(i);
    uv[i * 2 + 1] = p.getY(i);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

const std = (color, roughness = 0.6, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

const rnd = (seed) => {
  let n = (seed * 2654435761) % 2147483647 || 1;
  return () => ((n = (n * 16807) % 2147483647) / 2147483647);
};

function add(geo, mat, parent, name) {
  const m = new THREE.Mesh(geo, mat);
  if (name) m.name = name;
  parent.add(m);
  return m;
}

/** A plain box (no rounded corners, so no notch where two meet), centred at x, y, z. */
function box(w, h, d, mat, x, y, z, parent, name) {
  const m = add(new THREE.BoxGeometry(w, h, d), mat, parent, name);
  m.position.set(x, y, z);
  return m;
}

/** A cylinder along X, Y (default) or Z. */
function cyl(r, len, mat, x, y, z, parent, axis = 'y', segments = 14, name) {
  const g = new THREE.CylinderGeometry(r, r, len, segments);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  const m = add(g, mat, parent, name);
  m.position.set(x, y, z);
  return m;
}

const tube = (a, b, r, mat, parent, radial = 8) => add(rod(a, b, r, radial), mat, parent);

// Wheels ----------------------------------------------------------------------

const treadCache = new Map();
const tyreGeo = (rear) => {
  const key = rear ? 'rear' : 'front';
  if (!treadCache.has(key)) {
    const base = rear
      ? treadTyre('tractor', { radius: LT_WHEELS.rearR, width: LT_WHEELS.rearW, rimR: LT_WHEELS.rearRim, count: 24, segments: 56 })
      : treadTyre('tractor', { radius: LT_WHEELS.frontR, width: LT_WHEELS.frontW, rimR: LT_WHEELS.frontRim, count: 20, segments: 44 });
    // Some of the lugs worn down: the worn copy reaches a little less far than the new one, so it is scaled back up to the wheel's radius, or the tyre hovers over the ground.
    const worn = wornTyre(base, 1).clone();
    const R = rear ? LT_WHEELS.rearR : LT_WHEELS.frontR;
    const k = R / outerRadius(worn);
    worn.scale(1, k, k);
    treadCache.set(key, worn);
  }
  return treadCache.get(key);
};

/** One wheel: a worn lugged tyre with clay caked between the lugs, the rim and its dished disc in the pale grey, a hub and its nuts. */
function buildWheel(w, M) {
  const side = Math.sign(w.x);
  const rear = !w.front;
  const R = rear ? LT_WHEELS.rearR : LT_WHEELS.frontR;
  const W = rear ? LT_WHEELS.rearW : LT_WHEELS.frontW;
  const rimR = rear ? LT_WHEELS.rearRim : LT_WHEELS.frontRim;
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  spin.name = 'spin';
  spin.userData.keep = true;
  wheel.add(spin);
  add(tyreGeo(rear), M.rubber, spin);
  // The caked clay: a drum a little under the tread's roots, so it shows in the gaps between the lugs and not on their tops.
  add(new THREE.CylinderGeometry(R - (rear ? 0.06 : 0.045), R - (rear ? 0.06 : 0.045), W - 0.07, 40, 1, true).rotateZ(Math.PI / 2), M.clay, spin);
  const face = W / 2;
  const x = (d) => side * (face - d); // d metres in from the tyre's outer face
  const funnel = M.rim.clone();
  funnel.side = THREE.DoubleSide;
  add(new THREE.CylinderGeometry(rimR, rimR, W - 0.03, 40, 1, true).rotateZ(Math.PI / 2), funnel, spin, 'wheelRim');
  for (const f of [-1, 1]) add(new THREE.TorusGeometry(rimR * 1.02, 0.016, 6, 40).rotateY(Math.PI / 2), M.rim, spin).position.x = f * (face - 0.03);
  const depth = rear ? 0.09 : 0.06;
  const dish = add(new THREE.CylinderGeometry(rimR * 0.3, rimR * 0.97, depth, 40, 1, true).rotateZ(side * Math.PI / 2), funnel, spin, 'wheelDisc');
  dish.position.set(x(0.03 + depth / 2), 0, 0);
  const hubR = rear ? 0.12 : 0.08;
  cyl(hubR, depth + 0.012, M.cast, x(0.03 + depth / 2 - 0.006), 0, 0, spin, 'x', 20, 'wheelHub');
  const flangeR = rear ? 0.2 : 0.13;
  cyl(flangeR, 0.018, M.castLight, x(0.052), 0, 0, spin, 'x', 24, 'wheelFlange');
  const nuts = rear ? 8 : 6;
  const nutR = flangeR - 0.035;
  for (let i = 0; i < nuts; i++) {
    const a = ((i + 0.5) / nuts) * Math.PI * 2;
    cyl(rear ? 0.023 : 0.016, 0.028, M.chrome, x(0.034), Math.sin(a) * nutR, Math.cos(a) * nutR, spin, 'x', 6, 'wheelNut');
  }
  cyl(rear ? 0.06 : 0.04, 0.022, M.chrome, x(0.03), 0, 0, spin, 'x', 16, 'wheelCap');
  mergeStatic(wheel);
  return wheel;
}

// Mudguards ---------------------------------------------------------------------

/**
 * A wing over a wheel: a sheet arcing over its top from `phi` behind to `phi` in front (angles from straight up, about the axle), `w` wide, with a rolled lip down each
 * edge. `dent` is { z, y, r, depth }: a place on it pushed in (a bump from a gatepost), in the wing's own frame.
 */
function wingGeometry(R, w, phi, dent = null) {
  const cols = [[-w / 2, -0.045, 0], [-w / 2 + 0.035, 0, 0.012], [0, 0.012, 0], [w / 2 - 0.035, 0, 0.012], [w / 2, -0.045, 0]]; // [x, radius change, lip]
  const rows = 22;
  const pos = [];
  const uv = [];
  for (let i = 0; i <= rows; i++) {
    const a = -phi + (2 * phi * i) / rows;
    for (const [cx, dr] of cols) {
      const r = R + dr;
      pos.push(cx, Math.cos(a) * r, Math.sin(a) * r);
      uv.push(cx, a * R);
    }
  }
  if (dent) {
    for (let i = 0; i < pos.length; i += 3) {
      const d = Math.hypot(pos[i + 1] - dent.y, pos[i + 2] - dent.z, pos[i] - dent.x);
      if (d < dent.r) {
        const k = 0.5 + 0.5 * Math.cos((Math.PI * d) / dent.r);
        const len = Math.hypot(pos[i + 1], pos[i + 2]);
        pos[i + 1] -= (pos[i + 1] / len) * dent.depth * k; // toward the axle
        pos[i + 2] -= (pos[i + 2] / len) * dent.depth * k;
      }
    }
  }
  const index = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols.length - 1; j++) {
      const a = i * cols.length + j;
      index.push(a, a + cols.length, a + 1, a + 1, a + cols.length, a + cols.length + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

// The loader's bucket -------------------------------------------------------------

/** The bucket in its own frame: origin at the pivot pin, the floor running forward (+z) a little below it, the back standing up behind. */
function buildBucket(M) {
  const b = new THREE.Group();
  b.name = 'bucket';
  b.userData.keep = true; // setLoader moves it, so the body's merge leaves it alone
  const W = LOADER.bucketW;
  // The shell's section, as the polyline of its outside from the top of the back, round the heel, along the floor to the lip: swept across the width.
  const outer = [[-0.14, 0.82], [-0.14, 0.02], [-0.06, -0.12], [0.18, -0.21], [0.54, -0.25], [0.86, -0.22]];
  const t = 0.012;
  const inner = outer.map(([z, y], i) => [z + (i < 2 ? t : 0), y + (i < 2 ? 0 : t)]).reverse();
  const shape = new THREE.Shape([...outer, ...inner].map(([z, y]) => new THREE.Vector2(z, y)));
  const shell = new THREE.ExtrudeGeometry(shape, { depth: W - 0.02, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(W / 2 - 0.01, 0, 0);
  add(shell, M.steel, b, 'bucketShell');
  // The side plates: a taller profile at each end, scooped down to the lip.
  const side = new THREE.Shape([[-0.16, 0.86], [-0.16, -0.02], [-0.06, -0.15], [0.18, -0.24], [0.54, -0.28], [0.9, -0.25], [0.9, -0.12], [0.54, 0.05], [0.18, 0.2], [0.04, 0.55]].map(([z, y]) => new THREE.Vector2(z, y)));
  for (const s of [-1, 1]) {
    const g = new THREE.ExtrudeGeometry(side, { depth: 0.02, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(s > 0 ? W / 2 + 0.005 : -W / 2 + 0.015, 0, 0);
    add(g, M.steel, b, 'bucketSide');
  }
  // The cutting edge: a bolt-on blade along the lip, bright where the ground has worn it, with its row of bolts, and the black scuffs where a tyre has been over it.
  box(W - 0.02, 0.012, 0.22, M.bright, 0, -0.226, 0.87, b, 'bucketBlade');
  b.add(boltsMesh(boltRow([-W / 2 + 0.18, -0.22, 0.955], [W / 2 - 0.18, -0.22, 0.955], 14), [0, 1, 0], M.chrome, { size: 0.011, name: 'bladeBolts' }));
  const random = rnd(926);
  for (let i = 0; i < 7; i++) {
    const x = -0.8 + i * 0.27 + (random() - 0.5) * 0.1;
    const s = box(0.2 + random() * 0.08, 0.002, 0.04, M.scuff, x, -0.2185, 0.91 + (random() - 0.5) * 0.02, b, 'tyreScuff');
    s.rotation.y = (random() - 0.5) * 0.9;
  }
  // The back: ribs across and up it, the top rail, and the pins and brackets the arms and the tilt rams take hold of.
  for (const y of [0.2, 0.5, 0.82]) box(W - 0.06, 0.05, 0.04, M.steelDark, 0, y, -0.18, b);
  for (let i = -3; i <= 3; i++) box(0.045, 0.6, 0.03, M.steelDark, i * 0.3, 0.45, -0.17, b);
  for (const s of [-1, 1]) {
    box(0.07, 0.18, 0.2, M.steelDark, s * LOADER.pivot.x, 0.02, -0.02, b); // the arm's bracket on the back
    cyl(0.032, 0.22, M.bright, s * LOADER.pivot.x, 0, 0, b, 'x', 12, 'bucketPin');
    box(0.06, 0.16, 0.09, M.steelDark, s * 0.5, 0.72, -0.18, b); // the tilt ram's lug, up the back
  }
  mergeStatic(b);
  return b;
}

// The tractor ---------------------------------------------------------------------

export function buildLoaderTractorModel({ bodyColor = 0x23548f, reg = 'MK55 WRN', mud = 1 } = {}) {
  const M = {
    paint: std(bodyColor, 0.45, 0.1, { side: THREE.DoubleSide, map: surface('paint') }),
    roof: std(0xd2d5d1, 0.5, 0, { map: surface('paint') }), // the pale grey of the cab roof and the rims
    rim: std(0xc7cac6, 0.55, 0.2, { map: surface('paint') }),
    cast: std(0x34383b, 0.6, 0.35), // the engine, gearbox and axles, dark grey
    castLight: std(0x6a6f72, 0.55, 0.4),
    steel: std(0x8a9096, 0.5, 0.5, { map: surface('steel') }), // the loader's steel, painted grey and worn bright at the edges
    steelDark: std(0x24272a, 0.6, 0.4),
    bright: std(0xaeb3b6, 0.3, 0.8), // worn bare steel: the cutting edge, the rod of a ram
    chrome: std(0xd8dadc, 0.16, 1),
    rubber: std(0x2a2723, 0.95), // tyres gone brown-grey with clay and dust
    black: std(0x151515, 0.7),
    plastic: std(0x202224, 0.7), // the cab's black trim
    guard: std(0x202224, 0.7, 0, { side: THREE.DoubleSide }), // the PTO's shaft guard, a half-tube you see inside of
    glass: std(0x9fb4bd, 0.05, 0.1, { transparent: true, opacity: 0.3 }),
    clay: std(0x8a7650, 1), // the caked clay
    clayDark: std(0x50402c, 1),
    oil: std(0x100d08, 0.25, 0.1), // diesel and oil weeping from the engine
    scuff: std(0x080808, 0.95), // tyre rubber smeared on the bucket's lip
    amber: std(0xff9a1a, 0.2, 0, { transparent: true, opacity: 0.85 }),
    mirror: std(0xc8d2d8, 0.04, 1, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), // the glass sits a millimetre in front of its housing, so it is pulled forward in depth
    seat: std(0x2d2f31, 0.8),
    ramBarrel: std(0x2f3336, 0.5, 0.5),
    hoseRubber: std(0x161616, 0.8),
  };
  const quad = new THREE.Group();
  quad.name = 'quad';
  const body = new THREE.Group();
  body.name = 'body';
  quad.add(body);
  const root = new THREE.Group();
  root.name = 'bodyRoot';
  body.add(root);
  const random = rnd(7);

  // The driveline: the rear axle's housing, the gearbox casting between the axles, the engine under the bonnet, the front axle and its pivot.
  cyl(0.12, 1.75, M.cast, 0, LT_WHEELS.rearR, LT_WHEELS.rearZ, root, 'x', 16);
  box(0.62, 0.5, 1.75, M.cast, 0, 0.81, -0.75, root);
  box(0.5, 0.36, 1.2, M.cast, 0, 0.7, 0.85, root, 'engineBlock');
  box(0.34, 0.14, 0.55, M.castLight, 0, 0.45, 0.9, root); // the sump
  cyl(0.09, 1.7, M.cast, 0, LT_WHEELS.frontR, LT_WHEELS.frontZ, root, 'x', 14);
  box(0.28, 0.2, 0.46, M.cast, 0, 0.66, 1.18, root);
  for (const s of [-1, 1]) cyl(0.06, 0.1, M.castLight, s * 0.76, LT_WHEELS.frontR, LT_WHEELS.frontZ, root, 'x', 12); // the axle's ends
  // The engine's oil filter and the injection pump, on the left, where the weeps run from.
  cyl(0.055, 0.2, M.paint, 0.29, 0.72, 0.55, root, 'y', 14);
  cyl(0.04, 0.14, M.castLight, 0.28, 0.72, 1.1, root, 'y', 12);

  // The bonnet: sloping from the cab's screen down to a short, deep nose, lofted, with a grille and two headlamps on the nose.
  const bonnet = loftGeometry([
    { z: 0.3, w: 0.8, y0: 0.9, y1: 1.62 },
    { z: 0.7, w: 0.82, y0: 0.9, y1: 1.6 },
    { z: 1.3, w: 0.78, y0: 0.84, y1: 1.5 },
    { z: 1.76, w: 0.72, y0: 0.76, y1: 1.3 },
  ], { segments: 28, exponent: 3.2 });
  add(planarUV(bonnet), M.paint, root, 'bonnet');
  const grille = buildGrille({ w: 0.36, h: 0.36, kind: 'slats', n: 8, mats: { frame: M.chrome, bars: M.black } });
  grille.position.set(0, 0.97, 1.785);
  root.add(grille);
  for (const s of [-1, 1]) {
    const lamp = buildLamp('rect', { w: 0.13, h: 0.09 });
    lamp.position.set(s * 0.275, 1.1, 1.76);
    lamp.name = 'headlampNose';
    root.add(lamp);
  }
  // A bright badge across the nose, the bonnet's centre line and the catch.
  const badge = decalMesh('badge', { maker: 'calder', model: 'Dene 100' }, { width: 0.24 });
  badge.position.set(0, 1.235, 1.762);
  root.add(badge);
  // The exhaust, up the right of the screen and over, with a flap on its top, and the intake's pipe.
  tube([-0.5, 1.2, 0.5], [-0.5, 2.5, 0.5], 0.04, M.castLight, root, 10);
  cyl(0.052, 0.07, M.black, -0.5, 2.54, 0.5, root, 'y', 12);
  box(0.09, 0.012, 0.07, M.black, -0.5, 2.585, 0.5, root); // the rain cap
  for (const y of [1.45, 1.9]) cyl(0.052, 0.03, M.cast, -0.5, y, 0.5, root, 'y', 10); // its clamps
  box(0.04, 0.7, 0.12, M.castLight, -0.46, 1.1, 0.5, root); // its stay from the chassis rail

  // The cab: a floor, four posts, a pale roof with its glazing all round, a painted skirt each side below the windows, and the door on each side.
  const cabZ0 = -1.5;
  const cabZ1 = 0.32;
  const cabX = 0.66;
  box(2 * cabX - 0.02, 0.08, cabZ1 - cabZ0 + 0.1, M.cast, 0, 1.1, (cabZ0 + cabZ1) / 2 + 0.05, root);
  for (const px of [-1, 1]) for (const pz of [cabZ1 - 0.035, cabZ0 + 0.035]) box(0.07, 1.56, 0.07, M.paint, px * (cabX - 0.03), 1.92, pz, root, 'cabPost');
  for (const s of [-1, 1]) {
    box(0.04, 0.45, cabZ1 - cabZ0 - 0.1, M.paint, s * (cabX - 0.02), 1.36, (cabZ0 + cabZ1) / 2, root, 'cabSkirt'); // the painted lower panel of each side
    box(0.06, 0.06, cabZ1 - cabZ0 - 0.1, M.plastic, s * (cabX - 0.03), 1.62, (cabZ0 + cabZ1) / 2, root); // the window's sill
    box(0.05, 0.05, cabZ1 - cabZ0 - 0.1, M.plastic, s * (cabX - 0.025), 2.64, (cabZ0 + cabZ1) / 2, root); // and its head
    box(0.05, 1.0, 0.04, M.plastic, s * (cabX - 0.02), 2.13, -0.45, root); // the door's shut line, behind it
    box(0.012, 0.46, 0.012, M.black, s * (cabX + 0.001), 1.37, -0.45, root); // the door's seam in the skirt
    const glass = box(0.012, 1.0, cabZ1 - cabZ0 - 0.18, M.glass, s * (cabX - 0.02), 2.13, (cabZ0 + cabZ1) / 2, root, 'glass');
    glass.renderOrder = 1;
  }
  box(2 * cabX - 0.14, 1.0, 0.012, M.glass, 0, 2.13, cabZ1 - 0.035, root, 'glass'); // the screen
  box(2 * cabX - 0.14, 0.46, 0.04, M.paint, 0, 1.37, cabZ1 - 0.02, root, 'cabNose'); // the cab's front below the screen
  box(2 * cabX - 0.14, 0.46, 0.04, M.paint, 0, 1.37, cabZ0 + 0.02, root, 'cabBack'); // the rear panel under the back window
  box(2 * cabX - 0.14, 1.0, 0.012, M.glass, 0, 2.13, cabZ0 + 0.04, root, 'glass'); // the back window
  box(2 * cabX - 0.14, 0.05, 0.06, M.plastic, 0, 1.62, cabZ1 - 0.035, root); // the screen's sill
  box(2 * cabX - 0.14, 0.05, 0.06, M.plastic, 0, 2.64, cabZ1 - 0.035, root);
  box(2 * cabX + 0.12, 0.08, cabZ1 - cabZ0 + 0.28, M.roof, 0, 2.7, (cabZ0 + cabZ1) / 2 + 0.07, root, 'cabRoof'); // the roof, overhanging
  box(0.5, 0.025, 0.4, M.black, 0, 2.7425, -0.6, root); // the hatch in it
  // The roof's lamps: two headlamps at the front, two work lamps at the back, and an amber beacon on a magnetic base.
  for (const s of [-1, 1]) {
    const hl = buildLamp('rect', { w: 0.2, h: 0.09 });
    hl.position.set(s * 0.45, 2.7, 0.53);
    hl.name = 'headlampRoof';
    root.add(hl);
    const wl = buildLamp('work');
    wl.position.set(s * 0.45, 2.71, -1.57);
    wl.rotation.y = Math.PI;
    root.add(wl);
  }
  cyl(0.085, 0.05, M.black, 0.4, 2.765, -0.95, root, 'y', 16, 'beaconBase');
  cyl(0.065, 0.11, M.amber, 0.4, 2.845, -0.95, root, 'y', 16, 'beacon');
  add(new THREE.SphereGeometry(0.065, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.amber, root, 'beaconDome').position.set(0.4, 2.9, -0.95);
  // The wipers: one on the screen and one on the back window, parked.
  const wf = buildWiper({ len: 0.5 });
  wf.position.set(-0.2, 1.7, cabZ1 - 0.03);
  root.add(wf);
  const wb = buildWiper({ len: 0.4 });
  wb.position.set(0.2, 1.7, cabZ0 + 0.034);
  wb.rotation.y = Math.PI;
  root.add(wb);
  // The cab's inside: the seat, the steering wheel on its column, the dash, the joystick on the arm.
  const seat = buildSeat('single', { mats: { cover: M.seat } });
  seat.position.set(0, 1.36, -0.72);
  root.add(seat);
  box(0.9, 0.3, 0.3, M.plastic, 0, 1.3, 0.14, root, 'dash');
  const sw = buildSteeringWheel({ r: 0.19, style: 'flat' });
  sw.position.set(0, 1.66, -0.05);
  sw.rotation.x = -0.9;
  root.add(sw);
  tube([0, 1.3, 0.06], [0, 1.64, -0.04], 0.025, M.plastic, root);
  box(0.12, 0.08, 0.45, M.plastic, -0.3, 1.5, -0.7, root); // the armrest, right of the seat, with the loader's joystick
  cyl(0.014, 0.16, M.black, -0.3, 1.62, -0.55, root, 'y', 8);
  // Getting up: two steps and a grab handle on the left, a handle on the door, and a mirror each side on an arm.
  for (const y of [0.52, 0.86]) {
    box(0.4, 0.035, 0.34, M.castLight, cabX + 0.18, y, -0.1, root, 'step');
    box(0.38, 0.05, 0.03, M.cast, cabX + 0.18, y - 0.035, -0.26, root);
  }
  box(0.04, 0.66, 0.3, M.cast, cabX + 0.02, 0.83, -0.1, root); // the plate the steps are bolted to, up the side of the cab to its floor
  const grab = buildGrabHandle({ len: 0.6, stand: 0.05, r: 0.013, mats: { handle: M.black } });
  grab.rotation.set(0, Math.PI / 2, Math.PI / 2);
  grab.position.set(cabX, 1.5, 0.3);
  root.add(grab);
  const dh = buildDoorHandle('push');
  dh.rotation.y = Math.PI / 2;
  dh.position.set(cabX, 1.45, -0.35);
  root.add(dh);
  for (const s of [-1, 1]) {
    const m = buildMirror('arm', { side: s, w: 0.2, h: 0.28, mats: { mirror: M.mirror } });
    m.position.set(s * (cabX + 0.0), 2.05, 0.3);
    root.add(m);
  }

  // The wings: wide ones over the big rear wheels (the rear left dented), narrow ones over the front, each fixed to the body or the axle.
  for (const s of [-1, 1]) {
    const rear = wingGeometry(LT_WHEELS.rearR + 0.08, 0.6, 1.3, s > 0 ? { x: 0, y: 0.57, z: -0.6, r: 0.22, depth: 0.05 } : null);
    add(rear, M.paint, root, s > 0 ? 'wingRearLeft' : 'wingRearRight').position.set(s * LT_WHEELS.rearX, LT_WHEELS.rearR, LT_WHEELS.rearZ);
    const front = wingGeometry(LT_WHEELS.frontR + 0.06, 0.46, 1.15);
    add(front, M.paint, root, 'wingFront').position.set(s * LT_WHEELS.frontX, LT_WHEELS.frontR, LT_WHEELS.frontZ);
    tube([s * 0.66, 1.1, -0.5], [s * 0.82, 1.4, -0.7], 0.018, M.cast, root); // the rear wing's stays to the cab
    tube([s * 0.56, 0.75, 1.0], [s * 0.82, 1.1, 1.2], 0.018, M.cast, root); // and the front's to the frame
  }
  // Mud on the lower body and the chassis, thicker the lower it is.
  for (let i = 0; i < Math.round(34 * mud); i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.03 + random() * 0.06, 6, 4), i % 2 ? M.clay : M.clayDark);
    p.scale.set(1.4, 0.35, 1.4);
    p.position.set((random() - 0.5) * 1.1, 0.35 + random() * 0.5, -1.7 + random() * 3.4);
    p.rotation.set(random() * 3, random() * 3, random() * 3);
    root.add(p);
  }
  // Diesel and oil weeping down the engine's sides: dark runs from the joints, a wet patch on the sump and under the filter, and a drip off the front.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const h = 0.1 + random() * 0.14;
      box(0.012, h, 0.02 + random() * 0.025, M.oil, s * (0.25 + 0.0055), 0.82 - h / 2 - random() * 0.08, 0.5 + i * 0.17, root, 'oilWeep'); // each in its own place along the block, so no two overlap
    }
    box(0.02, 0.08, 0.3, M.oil, s * (0.25 + 0.0105), 0.6, 0.9, root, 'oilWeep'); // the wet band along the sump's seam, a little proud of the runs
  }
  box(0.2, 0.012, 0.3, M.oil, 0, 0.372, 0.95, root, 'oilWeep'); // and under the sump

  // The rear: the lift's arms and the links to the lower links, the top link, the drawbar on its pin, the PTO stub with its guard, the hoses and their couplers, the lamps and the plate.
  for (const s of [-1, 1]) {
    box(0.24, 0.12, 0.14, M.cast, s * 0.42, 0.7, -1.66, root); // the trunnion the lower link swings from
    tube([s * 0.5, 0.7, -1.62], [s * 0.47, 0.52, -2.3], 0.028, M.cast, root, 10); // the lower link
    add(new THREE.SphereGeometry(0.04, 10, 8), M.bright, root).position.set(s * 0.47, 0.52, -2.3); // its ball end
    box(0.08, 0.2, 0.14, M.castLight, s * 0.58, 1.12, -1.6, root); // the rockshaft's arm behind the cab
    tube([s * 0.58, 1.0, -1.6], [s * 0.49, 0.6, -2.0], 0.017, M.bright, root, 8); // the lift rod down to the lower link
  }
  tube([0, 1.5, -1.6], [0, 0.8, -2.15], 0.022, M.cast, root, 10); // the top link
  tube([0, 1.5 - 0.7 * 0.4, -1.6 - 0.55 * 0.4], [0, 1.5 - 0.7 * 0.6, -1.6 - 0.55 * 0.6], 0.036, M.bright, root, 10); // its turnbuckle
  box(0.2, 0.2, 0.2, M.cast, 0, 1.5, -1.6, root); // its mounting on the cab's back
  box(0.12, 0.04, 0.75, M.steelDark, 0, 0.46, -2.07, root, 'drawbar'); // the drawbar
  cyl(0.026, 0.14, M.bright, 0, 0.46, -2.36, root, 'y', 10, 'drawbarPin');
  box(0.3, 0.3, 0.2, M.cast, 0, 0.62, -1.72, root); // its hanger and the PTO's housing
  cyl(0.035, 0.26, M.bright, 0, 0.78, -2.0, root, 'z', 12, 'ptoStub'); // the PTO's splined stub
  const guard = add(new THREE.CylinderGeometry(0.075, 0.075, 0.26, 16, 1, true, 0.2 * Math.PI, 1.6 * Math.PI).rotateX(Math.PI / 2), M.guard, root, 'ptoGuard');
  guard.position.set(0, 0.78, -1.85); // the open side down, so the stub shows underneath
  cyl(0.085, 0.025, M.plastic, 0, 0.78, -1.98, root, 'z', 16); // its end ring
  // The hose bundle off the remote valves: four hoses from a block on the right, each ending in a quick-release coupler with a coloured cap.
  box(0.22, 0.1, 0.07, M.cast, -0.28, 0.96, -1.65, root, 'valveBlock');
  ['#c0392b', '#2f6db3', '#e0b020', '#2e8a4a'].forEach((colour, i) => {
    const x0 = -0.37 + i * 0.065;
    const a = [[x0, 0.94, -1.69], [x0 - 0.02, 0.8, -1.82], [x0 - 0.03, 0.62, -1.9], [x0 - 0.03, 0.5, -1.88]];
    const { hose, clamps } = hoseGeometry(a, 0.014, { sag: 0.02 });
    add(hose, M.hoseRubber, root);
    add(clamps, M.chrome, root);
    const end = a[a.length - 1];
    cyl(0.02, 0.06, M.chrome, end[0], end[1] - 0.03, end[2], root, 'y', 10, 'coupler');
    cyl(0.024, 0.02, std(colour, 0.6), end[0], end[1] - 0.07, end[2], root, 'y', 10, 'couplerCap');
  });
  for (const s of [-1, 1]) {
    const tail = buildLamp('tail', { w: 0.14, h: 0.09 });
    tail.position.set(s * 0.5, 1.37, cabZ0 - 0.004);
    tail.rotation.y = Math.PI;
    root.add(tail);
  }
  plate(reg, '#f2c200', root, { x: 0, y: 1.3, z: cabZ0 - 0.002, facing: -1 }); // the registration, made up
  const sticker = decalMesh('dealer', {}, { width: 0.2 });
  sticker.position.set(-0.36, 1.78, cabZ0 + 0.026);
  sticker.rotation.y = Math.PI;
  root.add(sticker);

  // The loader's mounting: a frame rail down each side of the engine with a cross-member, and on each rail a mast up to the arm's pivot, braced back to the cab.
  for (const s of [-1, 1]) {
    box(0.09, 0.14, 2.2, M.steelDark, s * 0.5, 0.78, 0.7, root, 'loaderRail');
    box(0.1, 0.92, 0.12, M.steelDark, s * 0.62, 1.16, 0.45, root, 'loaderMast');
    tube([s * 0.62, 1.1, 0.4], [s * 0.62, 1.4, 0.26], 0.025, M.steelDark, root);
    box(0.14, 0.2, 0.18, M.castLight, s * 0.62, 1.55, 0.45, root); // the boss the arm turns on
  }
  box(1.0, 0.1, 0.12, M.steelDark, 0, 0.75, 1.4, root); // the cross-member
  box(1.0, 0.1, 0.12, M.steelDark, 0, 0.75, -0.1, root);

  // The loader's two arms, each with its lift ram, and the bucket between them with its tilt rams. setLoader sets them.
  const arms = [];
  const rams = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.name = s > 0 ? 'loaderArm_l' : 'loaderArm_r';
    arm.userData.keep = true;
    arm.position.set(s * LOADER.pivot.x, LOADER.pivot.y, LOADER.pivot.z);
    box(0.11, 0.2, 1.42, M.steel, 0, 0, 0.7, arm); // the main beam
    const l2 = Math.hypot(LOADER.tip.z - 1.35, LOADER.tip.y);
    const down = box(0.11, 0.17, l2 + 0.05, M.steel, 0, LOADER.tip.y / 2, (1.35 + LOADER.tip.z) / 2, arm); // the lower reach, angled down
    down.rotation.x = Math.atan2(-LOADER.tip.y, LOADER.tip.z - 1.35);
    box(0.15, 0.3, 0.3, M.steelDark, 0, 0, 1.35, arm); // the knuckle between them
    box(0.14, 0.26, 0.2, M.steelDark, 0, LOADER.tip.y, LOADER.tip.z, arm); // the foot the bucket's pin goes through
    cyl(0.035, 0.18, M.bright, 0, 0, 0, arm, 'x', 12, 'armPivot');
    box(0.11, 0.14, 0.14, M.castLight, -s * 0.1, -0.14, 0.95, arm, 'liftLug'); // where the lift ram takes hold
    box(0.1, 0.12, 0.14, M.castLight, -s * 0.1, 0.16, 1.0, arm, 'tiltBase'); // and the tilt ram's base
    tube([0, 0.05, 0.2], [0, -0.08, 1.4], 0.018, M.black, arm, 6).position.x = -s * 0.075; // the hose line along the arm's inside
    mergeStatic(arm);
    root.add(arm);
    arms.push(arm);
    for (const kind of ['lift', 'tilt']) {
      const ram = new THREE.Group();
      ram.name = `loaderRam_${kind}_${s > 0 ? 'l' : 'r'}`;
      ram.userData.keep = true;
      const barrel = cyl(kind === 'lift' ? 0.05 : 0.042, 1, M.ramBarrel, 0, 0, 0.5, ram, 'z', 14, 'ramBarrel');
      const rodM = cyl(0.026, 1, M.bright, 0, 0, 0.5, ram, 'z', 10, 'ramRod');
      ram.userData = { keep: true, kind, barrel, rod: rodM, side: s, barrelLen: kind === 'lift' ? 0.62 : 0.5 };
      root.add(ram);
      rams.push(ram);
    }
  }
  const bucket = buildBucket(M); // hung between both arms, so it belongs to neither: it is in the body's frame and setLoader puts it at the arms' tips
  root.add(bucket);
  const model = quad;
  model.userData.loader = { arms, rams, bucket, root, height: 0 };

  // The wheels: where the layout puts them, outside the body.
  for (const w of LOADER_TRACTOR_LAYOUT.wheels) {
    const wheel = buildWheel(w, M);
    wheel.name = w.name;
    quad.add(wheel);
  }
  mergeStatic(root);
  setLoader(model, 0);
  return model;
}

/** Where a point at `local` on a part that turns about X at the arm's pivot is, in the body's frame, with the arm turned `a`. */
const turned = (pivot, a, y, z) => new THREE.Vector3(0, pivot.y + y * Math.cos(a) - z * Math.sin(a), pivot.z + y * Math.sin(a) + z * Math.cos(a));

/** Lays a ram's barrel and rod between two points: the barrel from `a`, the rod out of it to `b`. */
function placeRam(ram, a, b) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  ram.position.copy(a);
  ram.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
  const { barrel, rod: r } = ram.userData;
  const barrelLen = Math.min(ram.userData.barrelLen, len - 0.15); // a short ram's barrel is shorter than a long one's, so the rod always has some showing
  barrel.scale.z = barrelLen;
  barrel.position.z = barrelLen / 2;
  r.scale.z = Math.max(0.05, len - barrelLen + 0.1);
  r.position.z = barrelLen + (len - barrelLen) / 2 - 0.05;
}

/**
 * Raises or lowers the loader: `height` 0 is the bucket on the ground (how it is parked), 1 is as high as it lifts. The arms turn about their masts, the bucket hangs
 * level from the tips (curled a little at the bottom, so its lip is down), and each ram runs between its two fixed points. Returns the model.
 */
export function setLoader(model, height) {
  const { arms, rams, bucket } = model.userData.loader;
  const h = Math.min(1, Math.max(0, height));
  model.userData.loader.height = h;
  const a = LOADER.armLow + (LOADER.armHigh - LOADER.armLow) * h;
  for (const arm of arms) arm.rotation.x = a;
  const tip = turned(LOADER.pivot, a, LOADER.tip.y, LOADER.tip.z);
  bucket.position.set(0, tip.y, tip.z);
  const bucketTurn = LOADER.curl * (1 - 0.6 * h); // level, the floor tipped forward by the curl
  bucket.rotation.x = bucketTurn;
  const lift = turned(LOADER.pivot, a, -0.14, 0.95);
  const tiltBase = turned(LOADER.pivot, a, 0.16, 1.0);
  for (const ram of rams) {
    const s = ram.userData.side;
    const lug = new THREE.Vector3(s * 0.5, 0.72, -0.18).applyAxisAngle(new THREE.Vector3(1, 0, 0), bucketTurn).add(bucket.position); // the bucket's lug, up its back
    if (ram.userData.kind === 'lift') placeRam(ram, new THREE.Vector3(s * 0.5, 0.88, 0.5), new THREE.Vector3(s * 0.52, lift.y, lift.z));
    else placeRam(ram, new THREE.Vector3(s * 0.52, tiltBase.y, tiltBase.z), lug);
  }
  return model;
}
