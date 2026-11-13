// After a Peugeot 309 GLD three-door.
// Your car's numbers (#229, was TODO 338): a 1987-style three-door, the Vauclair 39D, after the photos in `.scratch/quads/309/` (a
// silver side-on, a white one from the front three-quarter and the back three-quarter, a red front and a black rear, the dash and the front seats from the
// door, the cluster close up, the back bench). Every point is in the model's own frame (ground at y 0 under the wheels at rest, +z forward, +x the
// driver's left; the driver sits on the right, at -x), measured on the side photo with the wheelbase (2.469 m) as the rule. Pure numbers, no
// materials, so a test can check them. The same shape of car as the Finch (wing, door and quarter, a glass hatch over a deck and a tail panel), longer and
// lower, with the 309's bustle: the glass stops at a short flat deck above the tail rather than running down to the bumper.

export const VAUCLAIR_R = 0.28; // 165/70 R13 tyres
export const VAUCLAIR_TYRE_W = 0.165;
export const VAUCLAIR_REST = 0.16; // suspension rest length: the spec's suspensionRestLength
export const VAUCLAIR_RIDE_LIFT = 0.05; // the body sits this much higher than the arches' first cut
export const VAUCLAIR_EYE_UP = 0.66; // your eyes over the hips

/** The side profile, the glasshouse and the seats (CARS.vauclair in carModel.js is this). `upper` is the top of the body's side from the nose back. */
export const VAUCLAIR_BODY = {
  R: VAUCLAIR_R,
  wheelbase: 2.47,
  track: 1.38,
  width: 1.57,
  nose: 1.95,
  tail: -1.9,
  sill: 0.2,
  // The long sloping bonnet, the waist rising gently to the back, then the bustle's deck falling to the tail.
  upper: [[1.95, 0.7], [1.82, 0.76], [0.8, 0.89], [-1.45, 0.96], [-1.62, 0.96], [-1.84, 0.9], [-1.9, 0.84]],
  screenBase: [0.8, 0.89],
  screenTop: [0.26, 1.31], // raked: the glass about as far from your eye as the Land Rovers' (a test keeps it so)
  roofRear: [-1.28, 1.29],
  hatchBottom: [-1.62, 0.97], // where the glass meets the deck
  tumble: 0.16, // how far the glasshouse leans in, metres a metre up
  bPillar: -0.5,
  wheelOut: 0.3, // the steering wheel along its column from the dash face
  columnY: 0.68, // and how high the column comes out of the face
  rim: 0.19, // the wheel's rim radius (a big two-spoke wheel), and its boss's half height, for the sight line through it (carDashThroughWheel)
  boss: 0.03,
  seats: { driver: { x: -0.37, y: 0.46, z: -0.34 }, left: { x: 0.37, y: 0.46, z: -0.34 } },
  rear: { rearLeft: { x: 0.34, y: 0.48, z: -1.08, door: 'left' }, rearRight: { x: -0.34, y: 0.48, z: -1.08, door: 'driver' } },
  plate: 'E412 KTV', // an E, 1987 to 1988
};

/** The doors: hinged on their front edge at the A pillar's foot, `rear` is the back edge (a hand in front of the B pillar), `bottom` the lower edge above the sill. */
export const VAUCLAIR_DOOR = { hinge: 0.8, rear: -0.47, bottom: 0.28, open: 1.1 };

/** The hatch: hinged along the roof's rear edge, `foot` the height of its lower edge on the tail, `open` how far it swings (radians, up and back). */
export const VAUCLAIR_HATCH = { foot: 0.56, open: 1.25, inset: 0.05 };

/** The tail lamps either side of the tail panel (centre x, bottom y, top y, width): wide and shallow, red over amber over red. */
export const VAUCLAIR_TAIL_LAMP = { x: 0.53, y0: 0.62, y1: 0.8, w: 0.34 };

/** The cargo floor behind the rear seat. */
export const VAUCLAIR_BOOT = { floor: 0.52, front: -1.53 }; // full width only behind the rear tyres (their back edge is at z -1.515)

/** The parcel shelf: its height, front and back edges (z) and half width. Under the glass and the deck, behind the back seat's top, inside the belts. */
export const VAUCLAIR_SHELF = { y: 0.9, front: -1.4, back: -1.6, half: 0.62 };

/** The hatch struts' body end (x either side, y, z): low on the boot's side, well inboard of the C pillars. */
export const VAUCLAIR_STRUT = { x: 0.6, y: 0.98, z: -1.5 };

/** The rubbing strip along the sides, at about the bumpers' height: its middle and its height. */
export const VAUCLAIR_RUB = { y: 0.44, h: 0.05 };

/**
 * The dents and knocks it has picked up (Jamie: "some dents somewhere"): each on a side panel (`x` sign), at (z, y), its radius in metres and depth
 * 0 to 1. Drawn as a shallow bowl of paint shaded as if pushed in (vauclairModel.js), so they read without cutting the panel.
 */
export const VAUCLAIR_DENTS = [
  { side: -1, z: -0.92, y: 0.7, r: 0.08, depth: 0.6 }, // the driver's rear quarter, ahead of and above the arch: reversed into a gatepost
  { side: 1, z: 0.1, y: 0.56, r: 0.06, depth: 0.45 }, // the passenger's door: a car park's door ding
  { side: 1, z: -0.3, y: 0.66, r: 0.05, depth: 0.4 },
];
