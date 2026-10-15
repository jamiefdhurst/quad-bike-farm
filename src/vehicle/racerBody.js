// The orange quad's body (TODO 92), after photos of a 1980s Suzuki LT250R Quadracer in `.scratch/quads/viper-250/` (a brochure side view,
// front and rear three-quarters, two from above and the left switch housing). What sets it apart from the other quads is the wedge: seen
// from above it is a triangle, a narrow nose and tank shroud widening through the seat to a broad duck-tail; from the side the shroud
// stands high behind the bars, the seat dips low in front of the tail and the tail's wings kick up behind it; the flanks are big flat
// triangles; the front fenders are flat blades over the tyres. Pure numbers, no materials, so a test can check them.

import { BLASTER_WHEELS, TYRE_OUTER } from './blasterBody.js';

export const RACER_WHEELS = BLASTER_WHEELS;
export { TYRE_OUTER };

// Shells swept round each wheel, as the yellow's (quadGeometry.js `shellGeometry`): a side profile [z, y] from the wheel centre, front to
// back, and where across they run from and to. Both are flat plates with a shallow turned-down edge: the fronts are blades over the tyres
// and the rears are wings that rise towards the back, a duck-tail's corners.
export const RACER_FENDERS = {
  front: {
    profile: [[0.27, 0.27], [0.2, 0.36], [0.05, 0.42], [-0.1, 0.42], [-0.2, 0.38], [-0.27, 0.29]],
    width: [0.2, 0.585],
  },
  rear: {
    profile: [[0.25, 0.3], [0.19, 0.37], [0.08, 0.43], [-0.05, 0.47], [-0.18, 0.52], [-0.27, 0.555], [-0.3, 0.565]],
    width: [0.19, 0.55],
  },
};

/** Across a fender: dead flat, with a shallow turned-down edge (the section's drops are towards the wheel). */
export const RACER_SECTION = [[0, 0.04], [0.04, 0.006], [0.1, 0], [0.9, -0.004], [0.96, 0.012], [0.99, 0.03], [1, 0.045]];

/** The nose and tank shroud, as `loftGeometry` stations (full width w): high behind the bars, sloping to a low blunt front. */
export const RACER_SHROUD = [
  { z: 0.0, w: 0.28, y0: 0.72, y1: 0.9 },
  { z: 0.22, w: 0.36, y0: 0.66, y1: 0.92 },
  { z: 0.5, w: 0.38, y0: 0.58, y1: 0.88 },
  { z: 0.78, w: 0.34, y0: 0.52, y1: 0.76 },
  { z: 0.98, w: 0.26, y0: 0.5, y1: 0.62 },
];

/** The shroud's top at `z` (between its stations), for what stands on it: the louvres, the cap. */
export function shroudTop(z, S = RACER_SHROUD) {
  for (let i = 0; i < S.length - 1; i++) if (z >= S[i].z && z <= S[i + 1].z) return S[i].y1 + ((S[i + 1].y1 - S[i].y1) * (z - S[i].z)) / (S[i + 1].z - S[i].z);
  return null;
}

/** The three louvres on the shroud's sloping top, front of the radiator: z of each. */
export const RACER_LOUVRES = [0.56, 0.66, 0.76];

/** The grille at the shroud's blunt front, over the radiator. */
export const RACER_GRILLE = { z: 0.97, y: 0.555, w: 0.2, h: 0.08 };

/** The seat narrows to the front and widens to the back, ending before the tail, which carries on from it. */
export const RACER_SEAT = [
  { z: 0.17, w: 0.1, y0: 0.79, y1: 0.83 },
  { z: 0.11, w: 0.2, y0: 0.78, y1: 0.86 },
  { z: -0.04, w: 0.24, y0: 0.77, y1: 0.875, e: 3 },
  { z: -0.45, w: 0.28, y0: 0.775, y1: 0.88, e: 3 },
  { z: -0.75, w: 0.34, y0: 0.785, y1: 0.885, e: 3 },
  { z: -0.84, w: 0.3, y0: 0.8, y1: 0.875 },
  { z: -0.88, w: 0.18, y0: 0.81, y1: 0.86 },
];

/** The tail between the rear wings: the duck-tail's middle, rising towards the back, as wide as the gap between the wings. */
export const RACER_TAIL = [
  { z: -0.8, w: 0.3, y0: 0.74, y1: 0.86 },
  { z: -0.88, w: 0.36, y0: 0.78, y1: 0.9 },
  { z: -0.94, w: 0.36, y0: 0.8, y1: 0.93 },
  { z: -0.97, w: 0.24, y0: 0.84, y1: 0.915 },
];

/** The flank triangles either side under the seat: [z, y] corners (the front top meets the shroud, the rear top the seat, the apex hangs low). */
export const RACER_FLANK = { x: 0.2, corners: [[0.3, 0.88], [-0.34, 0.8], [-0.05, 0.55]] };

/** The plate under each wing behind the flank, closing the side between it and the tail (tucked in under the wing). */
export const RACER_SIDE_PLATE = { x: 0.16, y: 0.6, h: 0.1, z: -0.6, len: 0.4 };

/** The bars' lamp guard is the yellow's: the V, the clamp and the crossbar are shared (blasterBody.js `BLASTER_VBARS`). The pod on the level run: where each thing sits along it. */
export const RACER_POD = { x0: 0.09, x1: 0.21, rockerX: 0.11, chokeX: 0.155, dashX: 0.195, z: -0.075, depth: 0.1 };
// (everything on the pod stands on its rear half, behind the crossbar, which passes over the pod's front: a lever up there would go through it)

/**
 * The exhaust, in the body's frame: the belly out to the right, then in under the flank and the wing to a short silver can inside the frame
 * under the tail (the real one's silencer is short, with its tip at the back).
 */
export const RACER_EXHAUST = {
  path: [[-0.03, 0.66, 0.2], [-0.12, 0.55, 0.4], [-0.27, 0.46, 0.32], [-0.34, 0.47, 0.04], [-0.3, 0.48, -0.22], [-0.2, 0.47, -0.4], [-0.16, 0.54, -0.54], [-0.13, 0.585, -0.62]],
  can: { x: -0.13, y: 0.6, z: -0.79, length: 0.34, tilt: 0.1 },
  tip: [-0.13, 0.618, -0.955],
};
