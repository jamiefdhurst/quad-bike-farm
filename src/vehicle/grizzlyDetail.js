import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { bentTube, rod } from './quadGeometry.js';
import { boltsMesh } from './detail/fixings.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { decalMesh, MAKER_FOR } from './detail/decals.js';
import { discGeometry, caliperGeometry } from './detail/brakes.js';
import { GRIZZLY_DECK, GRIZZLY_RACKS, GRIZZLY_BUMPER, bumperPoints } from './grizzlyBody.js';

// The blue quad's finer detail (TODO 89), from the shared kit: the steel front bumper in its black end blocks, the black mounts on the
// front rack, the grille with vertical bars and mesh either side, the tail lamp panel and the rear cross beam, the stickers, and the
// front discs and calipers. Each takes the quad's materials (`MAT`, as quadModel has them) and adds to the frame it is given. Nothing
// here moves a fixed point.

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

/** The face of the front deck: where the grille and lamps go. z is the face, y the middle of its height at the middle of the quad. */
export const GRIZZLY_FACE = { z: GRIZZLY_DECK.front.zf, grilleY: 0.545, lampX: 0.355, lampY: 0.58 };

/**
 * The front: a steel bumper (a cross bar, two uprights from the rack's front rail, wings back to the fender faces) in black plastic
 * end blocks bolted to the faces, a skid plate under the nose, the grille between the lamps and the maker's badge on it. The lamps
 * themselves are the model's (they share its lens material).
 */
export function addGrizzlyFront(root, MAT, paint) {
  const B = GRIZZLY_BUMPER;
  const P = bumperPoints(B);
  for (const side of [P.left, P.right]) {
    mesh(bentTube([side.upper, side.knee, side.lower], 0.016, { bend: 0.05, steps: 5 }), MAT.alloy, root, 'bumperUpright');
    mesh(bentTube([side.wing, side.end], 0.016, { bend: 0.03 }), MAT.alloy, root, 'bumperWing');
  }
  tube([P.right.end[0], B.y, B.z - 0.04], [P.left.end[0], B.y, B.z - 0.04], 0.017, MAT.alloy, root).name = 'bumperBar';
  tube([P.right.lower[0], B.y, B.z - 0.04], [P.left.lower[0], B.y, B.z - 0.04], 0.012, MAT.alloy, root); // a second bar low behind the first, the way the real one braces
  // The end blocks, reaching back into the fender faces (the face is at GRIZZLY_FACE.z), and the bolts through them.
  for (const s of [-1, 1]) {
    rbox(0.075, 0.06, 0.15, 0.014, MAT.plastic, s * (B.endX + 0.03), B.y, GRIZZLY_FACE.z + 0.055, root, 'bumperBlock'); // its top is below the lamps' surrounds
    const bolts = boltsMesh([[s * (B.endX + 0.03), B.y + 0.02, 0], [s * (B.endX + 0.03), B.y - 0.02, 0]], [0, 0, 1], MAT.chrome, { size: 0.011, kind: 'hex', name: 'bumperBolts' });
    bolts.position.z = GRIZZLY_FACE.z + 0.13;
    root.add(bolts);
  }
  rbox(0.54, 0.018, 0.3, 0.006, MAT.plastic, 0, 0.445, 0.76, root, 'skidPlate'); // under the nose, from the face back under the radiator

  // The grille, in plain boxes (the kit's rounded grille costs 3,000 triangles a quad for what shows from two metres): a dark back, a
  // frame, three vertical bars in the middle and a fine run of fins either side where the real one has mesh.
  const box = (w, h, d, x, y, z) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.deleteAttribute('uv');
    return g.translate(x, y, z);
  };
  const g = new THREE.Group();
  g.name = 'grille';
  g.position.set(0, GRIZZLY_FACE.grilleY, GRIZZLY_FACE.z - 0.004);
  root.add(g);
  const frame = [box(0.3, 0.012, 0.03, 0, 0.0725, 0.01), box(0.3, 0.012, 0.03, 0, -0.0725, 0.01), box(0.012, 0.145, 0.03, 0.144, 0, 0.01), box(0.012, 0.145, 0.03, -0.144, 0, 0.01)];
  for (const x of [-0.07, 0.07]) frame.push(box(0.01, 0.133, 0.024, x, 0, 0.007));
  mesh(mergeGeometries(frame), MAT.plastic, g, 'grilleFrame');
  mesh(box(0.28, 0.134, 0.004, 0, 0, -0.002), MAT.hole, g, 'grilleDark');
  const bars = [-0.03, 0, 0.03].map((x) => box(0.016, 0.134, 0.022, x, 0, 0.009));
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) bars.push(box(0.065, 0.004, 0.012, s * 0.108, -0.055 + i * 0.022, 0.004));
  mesh(mergeGeometries(bars), MAT.engineDark, g, 'grilleBars');
  const badge = decalMesh('badge', { maker: MAKER_FOR.blue }, { width: 0.05, name: 'badge' });
  badge.position.set(0, GRIZZLY_FACE.grilleY, GRIZZLY_FACE.z + 0.0155); // on the middle bar's front face, a millimetre off it
  root.add(badge);
}

/**
 * The two black mounts on the front rack's front rail, a block each with its bolts, which the bumper's uprights hang from. They stand
 * on the rail and are bolted through it.
 */
export function addGrizzlyRackBlocks(root, MAT) {
  const R = GRIZZLY_RACKS.front;
  for (const s of [-1, 1]) {
    rbox(0.12, 0.04, 0.1, 0.012, MAT.plastic, s * GRIZZLY_BUMPER.upright, R.y - 0.008, R.z1 - 0.02, root, 'rackBlock');
    const bolts = boltsMesh([[s * GRIZZLY_BUMPER.upright - 0.035, 0, R.z1 - 0.02], [s * GRIZZLY_BUMPER.upright + 0.035, 0, R.z1 - 0.02]], [0, 1, 0], MAT.chrome, { size: 0.011, kind: 'flange', name: 'rackBlockBolts' });
    bolts.position.y = R.y + 0.012;
    root.add(bolts);
  }
}

/**
 * The rear: a black panel on the rear deck's face carrying the tail lamp and a reflector either side, and a cross beam under it with
 * the hitch plate (the hitch is the model's). The lamp lens is `MAT.tail`, which the tail light code finds.
 */
export function addGrizzlyRear(root, MAT) {
  const z = GRIZZLY_DECK.rear.zf;
  rbox(0.3, 0.1, 0.06, 0.014, MAT.plastic, 0, 0.64, z - 0.02, root, 'tailPanel');
  rbox(0.16, 0.05, 0.016, 0.008, MAT.tail, 0, 0.645, z - 0.056, root, 'tailLamp');
  const reflector = new THREE.MeshStandardMaterial({ color: 0x8a1410, roughness: 0.15, metalness: 0.3 });
  for (const s of [-1, 1]) rbox(0.05, 0.026, 0.01, 0.005, reflector, s * 0.105, 0.67, z - 0.05, root, 'tailReflector');
  tube([-0.3, 0.46, z - 0.06], [0.3, 0.46, z - 0.06], 0.018, MAT.frame, root, 8).name = 'rearBeam';
  for (const s of [-1, 1]) tube([s * 0.3, 0.46, z - 0.06], [s * 0.3, 0.6, z + 0.0], 0.014, MAT.frame, root, 6); // up into the deck's face either side
}

/** The stickers: the model name along each side of the tank cover, and a warning label on each side of the rear fender beside the seat. */
export function addGrizzlyDecals(root) {
  for (const s of [-1, 1]) {
    const name = decalMesh('stripes', { colours: ['#d9dcdf'], text: 'Bruin 660', ink: '#0f1d3a' }, { width: 0.26, name: 'tankDecal' });
    name.position.set(s * 0.193, 0.79, 0.3); // the tank cover's side, a millimetre proud
    name.rotation.y = s * (Math.PI / 2);
    root.add(name);
    const warn = decalMesh('warning', {}, { width: 0.08, name: 'warningDecal' });
    warn.position.set(s * 0.445, 0.7625, -0.42); // flat on the rear fender's top beside the seat
    warn.rotation.x = -Math.PI / 2;
    warn.rotation.z = s > 0 ? 0 : Math.PI;
    root.add(warn);
  }
}

/** A front disc (add to the wheel's `spin`) and its caliper (add to the wheel). */
export function addFrontBrake(wheel, spin, s) {
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.7 });
  const { disc, dark } = discGeometry({ r: 0.1, holes: 10 });
  disc.translate(-s * 0.065, 0, 0);
  mesh(disc, mat(0x9a9da0), spin, 'brakeDisc');
  if (dark) mesh(dark.translate(-s * 0.065, 0, 0), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 }), spin);
  mesh(caliperGeometry({ r: 0.1, angle: 0.6, side: s }).translate(-s * 0.065, 0, 0), mat(0x2a2c2f), wheel, 'brakeCaliper');
}
