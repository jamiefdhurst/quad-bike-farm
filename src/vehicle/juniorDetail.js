import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { loftGeometry } from './quadGeometry.js';
import { decalMesh, MAKER_FOR } from './detail/decals.js';
import { JUNIOR_FRONT, JUNIOR_TAIL, JUNIOR_SIDE_PLATE, JUNIOR_FLAP, JUNIOR_SEAT, juniorHalf, juniorRearFenderY } from './juniorBody.js';

// The kids' quad's finer parts (TODO 93): the bulky front body, the tail, the plates under the fenders, the mud flaps and the stickers. The
// bars, the footrests and the engine bay are the yellow's (hornetDetail.js); the fenders are made by hornetFenders with juniorBody.js's
// numbers. Each takes the quad's materials (`MAT`, as quadModel has them) and adds to the frame it is given.

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

/** The faded blue of the seat. */
export function juniorSeatMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0x6b83b4, roughness: 0.62 });
}

/** The front body (tank and nose in one), the tail, the plates under the fenders and the black flaps behind the rear tyres. */
export function addJuniorBody(root, MAT, paint) {
  mesh(loftGeometry(JUNIOR_FRONT, { exponent: 4 }), paint, root, 'frontBody');
  mesh(loftGeometry(JUNIOR_TAIL, { exponent: 4 }), paint, root, 'tail');
  const P = JUNIOR_SIDE_PLATE;
  for (const s of [-1, 1]) rbox(0.025, P.h, P.len, 0.008, paint, s * P.x, P.y, P.z, root, 'sidePlate');
  // The flaps: black rubber hanging just behind each rear tyre, the top edge cut to follow the fender's underside there (it slopes across).
  const F = JUNIOR_FLAP;
  for (const s of [-1, 1]) {
    const inner = juniorRearFenderY(F.x - F.w / 2, F.z) - 0.003;
    const outer = juniorRearFenderY(F.x + F.w / 2, F.z) - 0.003;
    const shape = new THREE.Shape([new THREE.Vector2(-F.w / 2, F.bottom), new THREE.Vector2(F.w / 2, F.bottom), new THREE.Vector2(F.w / 2, outer), new THREE.Vector2(-F.w / 2, inner)]);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: F.d, bevelEnabled: false });
    geo.translate(0, 0, -F.d / 2);
    const flap = mesh(geo, MAT.rubber, root, 'mudFlap');
    flap.position.set(s * F.x, 0, F.z);
    if (s < 0) flap.scale.x = -1; // so the higher side is inboard on both
  }
}

/** Stands a decal on the front body's side at `z`, `y`, turned to lie on it (the body widens towards the front, so its side is not square-on). */
function onFront(decal, s, z, y) {
  const slope = (juniorHalf(z + 0.05) - juniorHalf(z - 0.05)) / 0.1;
  decal.position.set(s * (juniorHalf(z) + 0.002), y, z);
  decal.rotation.y = s * (Math.PI / 2 + Math.atan(slope));
}

/**
 * The stickers: the maker's badge on each side of the seat, a "50" panel on each side of the front body, a warning label lower on it, and
 * a stripe with the model's name on each side plate. Each a millimetre off the surface it is on, which is flat there.
 */
export function addJuniorDecals(root) {
  const seat = JUNIOR_SEAT.find((st) => st.z === -0.45); // the widest part of the seat, straight to the next station
  for (const s of [-1, 1]) {
    const badge = decalMesh('badge', { maker: MAKER_FOR.asp }, { width: 0.2, name: 'badge' });
    badge.position.set(s * (seat.w / 2 + 0.002), (seat.y0 + seat.y1) / 2 - 0.005, -0.55);
    badge.rotation.y = s * (Math.PI / 2);
    root.add(badge);
    const number = decalMesh('number', { text: '50', ground: '#f1e6ea', ink: '#c8202a' }, { width: 0.1, name: 'number50' });
    onFront(number, s, 0.2, 0.78);
    root.add(number);
    const warning = decalMesh('warning', {}, { width: 0.1, name: 'warning' });
    onFront(warning, s, 0.5, 0.68);
    root.add(warning);
    const stripe = decalMesh('stripes', { colours: ['#2b4a9a', '#e9c21b'], text: 'Asp 50' }, { width: 0.3, name: 'stripe' });
    stripe.position.set(s * (JUNIOR_SIDE_PLATE.x + 0.0125 + 0.001), JUNIOR_SIDE_PLATE.y, JUNIOR_SIDE_PLATE.z);
    stripe.rotation.y = s * (Math.PI / 2);
    root.add(stripe);
  }
}
