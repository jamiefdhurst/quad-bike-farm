// After a Suzuki LT50.
// The kids' quad's body (TODO 93), after three photos in `.scratch/quads/viper-50/` (a brochure three-quarter, a yellow
// and blue one from the side and one in white and blue on grass). It is bulky: one big front body from the bars down to the fenders,
// sweeping front fenders and broad rear ones, a thick flat seat, and the small engine in the open between them, on balloon tyres with
// square blocks. Built at the other quads' size and scaled to 0.65 with its physics (quadSpecs.js), so these numbers are in the same
// units as the others'. Pure numbers, no materials, so a test can check them.

import { HORNET_WHEELS } from './hornetBody.js';

/** The tyres: fat balloons, nearly as wide at the front as at the back (the other sport quads are 0.22 and 0.29). */
export const JUNIOR_TYRES = { front: 0.25, rear: 0.27 };
export const JUNIOR_WHEELS = { ...HORNET_WHEELS, ...JUNIOR_TYRES };

/** The tyres' outer edges: nothing is wider than these. */
export const JUNIOR_TYRE_OUTER = { front: JUNIOR_WHEELS.x + JUNIOR_TYRES.front / 2, rear: JUNIOR_WHEELS.x + JUNIOR_TYRES.rear / 2 };

// Fender shells swept round each wheel (quadGeometry.js `shellGeometry`), as the yellow's: a side profile [z, y] from the wheel centre, front
// to back, and where across they run from and to. Big and deep, with a thick rolled edge, and reaching well down behind the tyre.
export const JUNIOR_FENDERS = {
  front: {
    profile: [[0.34, 0.24], [0.28, 0.36], [0.15, 0.44], [0.0, 0.48], [-0.15, 0.47], [-0.27, 0.42], [-0.34, 0.32], [-0.37, 0.22]],
    width: [0.2, 0.6],
  },
  rear: {
    profile: [[0.32, 0.24], [0.26, 0.36], [0.12, 0.44], [-0.05, 0.48], [-0.2, 0.47], [-0.32, 0.4], [-0.36, 0.32]],
    width: [0.17, 0.61],
  },
};

/** Across a fender: crowned, with a thick rolled-down edge. */
export const JUNIOR_SECTION = [[0, 0.07], [0.04, 0.015], [0.12, 0], [0.5, -0.015], [0.88, 0], [0.95, 0.03], [0.99, 0.06], [1, 0.075]];

/** The front body (tank and nose in one), as `loftGeometry` stations (full width w): tall behind the bars, wide, sloping to a blunt front. */
export const JUNIOR_FRONT = [
  { z: 0.0, w: 0.34, y0: 0.68, y1: 0.88 },
  { z: 0.2, w: 0.4, y0: 0.58, y1: 0.97 },
  { z: 0.46, w: 0.42, y0: 0.5, y1: 0.93 },
  { z: 0.78, w: 0.44, y0: 0.45, y1: 0.78 },
  { z: 0.96, w: 0.4, y0: 0.45, y1: 0.64 },
];

/** The front body's top at `z` (between stations), for what stands on it: the cap. */
export function juniorTop(z, S = JUNIOR_FRONT) {
  for (let i = 0; i < S.length - 1; i++) if (z >= S[i].z && z <= S[i + 1].z) return S[i].y1 + ((S[i + 1].y1 - S[i].y1) * (z - S[i].z)) / (S[i + 1].z - S[i].z);
  return null;
}

/** Half the front body's width at `z`, for what is stuck to its side. */
export function juniorHalf(z, S = JUNIOR_FRONT) {
  for (let i = 0; i < S.length - 1; i++) if (z >= S[i].z && z <= S[i + 1].z) return (S[i].w + ((S[i + 1].w - S[i].w) * (z - S[i].z)) / (S[i + 1].z - S[i].z)) / 2;
  return null;
}

/** A thick, flat, wide seat (the rider's anchor is at z -0.18, y 0.9: the seat's top there is 0.91). */
export const JUNIOR_SEAT = [
  { z: 0.06, w: 0.16, y0: 0.79, y1: 0.86 },
  { z: -0.02, w: 0.26, y0: 0.78, y1: 0.9, e: 3 },
  { z: -0.2, w: 0.31, y0: 0.775, y1: 0.91, e: 3 },
  { z: -0.45, w: 0.33, y0: 0.78, y1: 0.91, e: 3 },
  { z: -0.65, w: 0.33, y0: 0.78, y1: 0.91, e: 3 }, // (straight between these two, for the badge)
  { z: -0.8, w: 0.31, y0: 0.79, y1: 0.9, e: 3 },
  { z: -0.9, w: 0.24, y0: 0.8, y1: 0.88 },
  { z: -0.94, w: 0.14, y0: 0.81, y1: 0.86 },
];

/** The small tail between the rear fenders. */
export const JUNIOR_TAIL = [
  { z: -0.86, w: 0.34, y0: 0.7, y1: 0.8 },
  { z: -0.95, w: 0.34, y0: 0.7, y1: 0.82 },
  { z: -0.99, w: 0.2, y0: 0.72, y1: 0.8 },
];

/** The plates under each rear fender between the engine and the tail (tucked in under the wing), and the black flaps behind the rear tyres. */
export const JUNIOR_SIDE_PLATE = { x: 0.165, y: 0.6, h: 0.12, z: -0.62, len: 0.44 };
export const JUNIOR_FLAP = { x: 0.48, w: 0.24, bottom: 0.5, z: -0.945, d: 0.014 }; // hangs just behind the tyre; its top edge follows the fender's underside

const lerpAt = (pts, k) => {
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    if ((k - a[0]) * (k - b[0]) <= 0) return a[1] + ((b[1] - a[1]) * (k - a[0])) / (b[0] - a[0] || 1);
  }
  return pts.at(-1)[1];
};

/** The rear fender's surface height at world `x` (outboard positive) and `z`: the profile's height over the wheel, less the section's drop across it. */
export function juniorRearFenderY(x, z, F = JUNIOR_FENDERS.rear, S = JUNIOR_SECTION) {
  const prof = [...F.profile].sort((a, b) => a[0] - b[0]);
  const t = (Math.abs(x) - F.width[0]) / (F.width[1] - F.width[0]);
  return JUNIOR_WHEELS.y + lerpAt(prof, z - -0.62) - lerpAt(S, t);
}

/**
 * The small exhaust, in the body's frame: a short pipe round the right of the engine to a small can outboard of the side plate, in the open gap between the
 * wings so it shows from the side, its tip ending under the rear wing's front.
 */
export const JUNIOR_EXHAUST = {
  path: [[-0.03, 0.64, 0.2], [-0.12, 0.56, 0.32], [-0.25, 0.5, 0.14], [-0.28, 0.5, 0.0], [-0.28, 0.5, -0.07]],
  can: { x: -0.28, y: 0.5, z: -0.2, length: 0.26, tilt: 0.04 },
  tip: [-0.28, 0.51, -0.335],
};
