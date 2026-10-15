import { DECK } from './foremanDeck.js';

// The blue quad's body (TODO 89), after photos of a 2000s Yamaha Grizzly 660 in `.scratch/quads/tamura-660/`. It reuses the red's deck
// machinery (foremanDeck.js: crowned decks, rolled edges, rounded corners, skirts to the wheel arches, walls at the decks' ends) with
// the Grizzly's own numbers: a taller, blunter front face that carries the headlights at its corners and the grille between them, a
// rear fender that stands higher, and fenders painted all over (the red has black flares). Pure numbers and points, no materials, so
// a test can check that every bar of the racks and the bumper ends on something.

export const GRIZZLY_DECK = {
  ...DECK,
  front: { z0: 0.3, zf: 0.885, top: 0.735, crown: 0.035, dip: 0.03, faceH: 0.27 },
  rear: { z0: -0.3, zf: -0.9, top: 0.78, crown: 0.03, dip: 0, faceH: 0.2 },
  half: 0.575,
  rTop: 0.09,
  cornerR: 0.1,
  tailR: 0.12,
  edgeR: 0.09,
  edgeDrop: 0.04,
  flareW: 0.03, // painted, so only a crease along the top of the edge
};

/** The racks as the model has them: { z0, z1, y, slats, raised } (the front one's y and the rear one's are the fixed rackAnchor and mug heights). */
export const GRIZZLY_RACKS = {
  front: { z0: 0.46, z1: 0.99, y: 0.84, slats: 6, raised: 0.05 },
  rear: { z0: -0.78, z1: -1.04, y: 0.93, slats: 4, raised: 0.06 },
};

/** The front bumper: a steel cross bar, uprights from the rack's front rail down to it, and wings back to the fenders. */
export const GRIZZLY_BUMPER = {
  y: 0.5, // the cross bar's height
  z: 1.03, // and how far forward it stands
  upright: 0.21, // the uprights' x, under the rack's two black mounting blocks
  endX: 0.4, // where the cross bar ends, in the black end blocks
  rackTop: 0.835, // the rack's front rail, where the uprights begin
  rackZ: 0.985,
};

/** The bumper's points for each side: where an upright starts, bends and meets the bar, and where the wing goes back to the fender. */
export function bumperPoints(B = GRIZZLY_BUMPER) {
  const side = (s) => ({
    upper: [s * B.upright, B.rackTop, B.rackZ],
    knee: [s * B.upright, B.y + 0.12, B.z - 0.005],
    lower: [s * B.upright, B.y, B.z],
    end: [s * B.endX, B.y, B.z - 0.04],
    wing: [s * (B.endX + 0.06), B.y + 0.02, B.z - 0.16],
  });
  return { left: side(1), right: side(-1) };
}

/**
 * The headlight surround's control points on the face, as [u, v] from the lens's middle (u outwards, v up), after the real one: an
 * almond lying on its side, rounded and close round the lens at the inner end, the top arching over it and sweeping down to a long
 * point out towards the fender's corner, the bottom running back under the lens in a gentler curve. Taken round as a closed spline.
 */
export function grizzlyLampOutline() {
  return [[-0.05, 0.0], [-0.04, 0.026], [-0.005, 0.042], [0.045, 0.038], [0.1, 0.018], [0.15, -0.015], [0.168, -0.04], [0.12, -0.05], [0.05, -0.052], [-0.015, -0.047], [-0.045, -0.026]];
}
