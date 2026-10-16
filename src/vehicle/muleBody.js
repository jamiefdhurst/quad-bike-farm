// The UTV's numbers (TODO 99): a Kawasaki-Mule-4010-style farm side-by-side, the Ridgeback Yak 4010, after the photos in
// `.scratch/quads/utv/` (the front, a three-quarter from the rear, three-quarters from the front with and without a bed cover, the
// cluster, the switchgear and the dash). Every point is in the model's own frame (ground at y 0, +z forward, +x the driver's left; the
// driver sits on the right, at -x, as in Britain). Pure numbers and a few pure functions, no materials, so a test can check them.
// Where the photos disagreed with the old model: it was 3.34 m long and 1.70 wide (the real one is 3.0 by 1.55), 6 cm too tall,
// its bonnet one flat slab, its roof green (the real one is a flat grey panel), its bed black with the lamps on it (it is green steel with
// the lamps on a plate on the cab's back), its tyres a road pattern on yellow rims (a chunky ATV tyre on dark steel).

export const MULE_WHEELS = { x: 0.66, z: 0.98, radius: 0.34, front: 0.21, rear: 0.26, rim: 0.16 };

/** The green hood over the engine, and the low body either side of it that the fenders sit on: loft stations (z, width, bottom, top). */
export const MULE_BONNET = [
  { z: 0.6, w: 0.9, y0: 0.62, y1: 0.99 },
  { z: 1.0, w: 0.86, y0: 0.6, y1: 0.92 },
  { z: 1.38, w: 0.78, y0: 0.58, y1: 0.83 },
];
export const MULE_BODY = [
  { z: 0.58, w: 1.04, y0: 0.5, y1: 0.8 },
  { z: 1.0, w: 1.02, y0: 0.5, y1: 0.77 },
  { z: 1.27, w: 1.02, y0: 0.5, y1: 0.75 }, // up to the tyres' front, inside their inner face (0.535)
  { z: 1.3, w: 1.46, y0: 0.5, y1: 0.74 }, // then the nose widens out over them, to the lamps' outer ends
  { z: 1.4, w: 1.46, y0: 0.5, y1: 0.74 },
];
/** The dash's stations (the cab's front panel, behind the hood): z, width, bottom, top. */
export const MULE_DASH = [
  { z: 0.34, w: 1.3, y0: 0.62, y1: 1.02 },
  { z: 0.5, w: 1.26, y0: 0.6, y1: 1.06 },
  { z: 0.6, w: 1.2, y0: 0.6, y1: 1.0 },
];
export const MULE_HOOD_E = 4; // the loft's squareness, which the ribs have to follow to stand on it

/** The height of a loft's top at (x, z), between its stations (linear between them): so things standing on it stand on it. */
export function loftTop(stations, x, z, e = 4) {
  const ordered = stations.slice().sort((a, b) => a.z - b.z);
  let k = 0;
  let a = ordered[0];
  let b = ordered[ordered.length - 1];
  for (let i = 0; i < ordered.length - 1; i++) {
    if (z >= ordered[i].z && z <= ordered[i + 1].z) {
      a = ordered[i];
      b = ordered[i + 1];
      k = (z - a.z) / (b.z - a.z);
    }
  }
  const lerp = (p, q) => p + (q - p) * k;
  const w = lerp(a.w, b.w);
  const y0 = lerp(a.y0, b.y0);
  const y1 = lerp(a.y1, b.y1);
  const u = Math.min(1, Math.abs(x) / (w / 2)) ** e;
  return (y0 + y1) / 2 + ((y1 - y0) / 2) * (1 - u) ** (1 / e);
}

/** The black fender flares over the wheels: a profile [z, y] from the wheel's centre and where across they run (inner, outer x). */
export const MULE_FLARES = {
  front: { profile: [[0.42, 0.2], [0.38, 0.36], [0.24, 0.46], [0.0, 0.5], [-0.2, 0.48], [-0.34, 0.4], [-0.42, 0.26]], width: [0.5, 0.8] },
  rear: { profile: [[0.4, 0.22], [0.34, 0.36], [0.2, 0.46], [0.0, 0.5], [-0.2, 0.47], [-0.34, 0.38], [-0.4, 0.24]], width: [0.5, 0.8] },
};

/** The nose: the grille on the hood's face, the lamps in black housings at its corners with an amber indicator on the outer end. */
export const MULE_NOSE = { z: 1.4, grille: { w: 0.5, h: 0.17, y: 0.67 }, lamp: { x: 0.6, y: 0.64, z: 1.35, w: 0.2, h: 0.12, d: 0.08 } }; // sunk into the nose block (its face is at 1.4), the housing's top under the block's own top there

/** The cab: the windscreen's base and top (y, z), the cage's heights and the roof. */
export const MULE_CAB = {
  glass: { base: [1.06, 0.47], top: [1.8, 0.24], half: 0.57 }, // [y, z] of the glass's lower and upper edges, and its half width
  pillar: { x: 0.62, foot: [0.7, 0.58], head: [1.86, 0.22] }, // the A pillar's foot and head, [y, z]
  rear: { z: -0.58, x: 0.62, top: 1.86 }, // the rear hoop
  net: { y0: 1.02, y1: 1.8, half: 0.56 }, // the mesh behind the seat
};
export const MULE_ROOF = [
  { z: 0.4, w: 1.4, y0: 1.86, y1: 1.9 },
  { z: -0.14, w: 1.44, y0: 1.86, y1: 1.92 },
  { z: -0.74, w: 1.4, y0: 1.86, y1: 1.9 },
];

/** The door nets: a frame and a mesh between the cage's front post and rear hoop at each side, swinging out on the rear hoop. */
export const MULE_DOOR = { x: 0.64, y0: 0.84, y1: 1.3, front: 0.46, rear: -0.52, open: 1.35 };

/** The bed: its sides' outer face, the front wall, the tailgate (the hinge is behind it) and the floor height, all as in the model's frame. */
export const MULE_BED = { half: 0.73, front: -0.64, gate: -1.64, floorY: 0.72, hinge: { y: 0.66, z: -1.64 } };

/** The lamps on the plate at the cab's back (red, amber over reverse) and where the plate sits. */
export const MULE_TAIL = { y: 1.62, z: -0.655, x: 0.34, plateW: 0.98, housing: 0.28 };

/** The tow hitch under the tailgate: a receiver plate and a ball. */
export const MULE_HITCH = { y: 0.42, z: -1.6 };
