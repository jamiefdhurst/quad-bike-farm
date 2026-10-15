import { DECK, deckRows, deckY } from './foremanDeck.js';

// The green quad's body (TODO 90), after photos of a 1990s Kawasaki KLF300 Bayou in `.scratch/quads/ridgeback-quad/`. It takes the red's
// deck machinery (foremanDeck.js) with the Bayou's own numbers: a flatter, squarer front fender whose face is black plastic carrying a
// slatted grille between two square headlights, black rubber flares over the wheels, a tall rear fender, and a grey tubular cage round
// the nose. Pure numbers and points, no materials, so a test can check that every bar of the racks and the cage ends on something.

export const BAYOU_DECK = {
  ...DECK,
  front: { z0: 0.3, zf: 0.89, top: 0.74, crown: 0.022, dip: 0.02, faceH: 0.1 }, // the body stops high: the lamps and grille are not on it but on a frame
  rear: { z0: -0.3, zf: -0.88, top: 0.8, crown: 0.025, dip: 0, faceH: 0.2, lean: 0.09 }, // the back leans: out at the bottom, in at the top
  half: 0.57,
  rTop: 0.08,
  cornerR: 0.09,
  tailR: 0.12,
  edgeR: 0.09,
  edgeDrop: 0.045,
  flareW: 0.1, // the black rubber strip along the top of each edge
};

/** How far out from the middle each tail lamp sits: at the back's outer edges. */
export const BAYOU_TAIL_X = 0.43;

/** The racks as the model has them: { z0, z1, y, slats, raised } (the front one's y and the rear one's are the fixed rackAnchor and mug heights). */
export const BAYOU_RACKS = {
  front: { z0: 0.46, z1: 0.96, y: 0.84, slats: 6, raised: 0.045 },
  rear: { z0: -0.8, z1: -1.0, y: 0.93, slats: 4, raised: 0.05 },
};

/** The lamps' and grille's frame, 11 cm out from the body's face: z is its plane, y the middle of the lamps' and grille's row. */
export const BAYOU_FACE = { z: 1.0, lampX: 0.215, lampY: 0.585, lampW: 0.13, lampH: 0.075, grilleW: 0.2, grilleH: 0.12 };

/** The nose cage's numbers: a grey steel loop standing 17 cm out from the face, round the lamps. */
export const BAYOU_CAGE = {
  x: 0.3, // the outer uprights
  inner: 0.135, // the lamp loops' inner uprights
  topY: 0.665, // the top rail
  midY: 0.535, // the rail under the lamps
  lowY: 0.4, // the bottom rail
  zTop: 1.07, // the top rail's distance forward
  zLow: 1.1, // the bottom rail's
  rackY: 0.84, // where the braces start on the front rack's rail
  rackZ: BAYOU_RACKS.front.z1,
  frameY: 0.36, // the bottom rail's rear struts end on the frame cradle
  frameZ: 0.8,
  lipY: 0.645, // where the struts to the body end: the lower lip of the front face
};

/**
 * The cage as a list of pieces, each { name, pts } (a straight bar through its points), mirrored for both sides. Every bar ends on
 * another bar, on the rack's front rail, on the deck's face or on the frame, which `tests/bayouBody.test.js` checks.
 */
export function cagePieces(C = BAYOU_CAGE, face = BAYOU_DECK.front.zf) {
  const pieces = [
    { name: 'topRail', pts: [[-C.x, C.topY, C.zTop], [C.x, C.topY, C.zTop]] },
    { name: 'lowRail', pts: [[-C.x, C.lowY, C.zLow], [C.x, C.lowY, C.zLow]] },
  ];
  for (const s of [-1, 1]) {
    pieces.push({ name: 'upright', pts: [[s * C.x, C.topY, C.zTop], [s * C.x, C.lowY, C.zLow]] });
    pieces.push({ name: 'lampSill', pts: [[s * C.inner, C.midY, C.zTop + 0.005], [s * C.x, C.midY, C.zTop + 0.005]] });
    pieces.push({ name: 'lampPost', pts: [[s * C.inner, C.topY, C.zTop], [s * C.inner, C.midY, C.zTop + 0.005]] });
    pieces.push({ name: 'rackBrace', pts: [[s * C.x, C.rackY, C.rackZ], [s * C.x, C.topY, C.zTop]] });
    pieces.push({ name: 'faceStrut', pts: [[s * C.x, C.topY, C.zTop], [s * C.x, C.lipY, face - 0.02]] });
    pieces.push({ name: 'sillStrut', pts: [[s * C.inner, C.midY, C.zTop + 0.005], [s * C.inner, C.lipY, face - 0.02]] });
    pieces.push({ name: 'frameStrut', pts: [[s * C.x, C.lowY, C.zLow], [s * (C.x - 0.03), C.frameY, C.frameZ]] });
  }
  return pieces;
}

/**
 * Where the rear face is at height y, `x` out from the middle: { z, tilt }. The face leans (out at the bottom, in at the top), so the
 * tail lamps stand on it at `z` and are turned back and up by `tilt` radians to lie on it. Read off the deck's own rows, so it is exact.
 */
export function rearFaceAt(y, x = 0.2, D = BAYOU_DECK) {
  const spec = D.rear;
  const pts = deckRows(D, spec)
    .filter((r) => r.g > 0.3)
    .map((r) => ({ y: deckY(D, spec, r, x), z: r.z }));
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    if (y <= a.y && y >= b.y) {
      const k = (a.y - y) / (a.y - b.y || 1);
      return { z: a.z + (b.z - a.z) * k, tilt: Math.atan2(Math.abs(b.z - a.z), a.y - b.y) };
    }
  }
  const last = pts[pts.length - 1];
  return { z: last.z, tilt: 0 };
}
