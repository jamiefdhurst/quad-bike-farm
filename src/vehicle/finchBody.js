// After a Ford Fiesta Mk1.
// The Finch's numbers (TODO 102): a 1979-style three-door hatchback, the Thorne Finch (Amy's), after the photos in
// `.scratch/quads/finch/` (a side-on, three-quarters from the front, front and rear views, the dash and its cluster, the front and back seats, the
// boot and the hatch open). Every point is in the model's own frame (ground at y 0 under the wheels at rest, +z forward, +x the driver's left; the
// driver sits on the right, at -x), measured on the side photo with the wheelbase (2.286 m) as the rule. Pure numbers and a few pure functions, no
// materials, so a test can check them. The car used to be drawn at 1.15 times its size to look right beside the girls; this one is the real size.

export const FINCH_R = 0.27; // 145 x 12 tyres
export const FINCH_TYRE_W = 0.145;
export const FINCH_REST = 0.16; // suspension rest length: the spec's suspensionRestLength
export const FINCH_RIDE_LIFT = 0.05; // the body sits this much higher than the arches' first cut
export const FINCH_EYE_UP = 0.66; // your eyes over the hips

/** The side profile, the glasshouse and the seats (CARS.finch in carModel.js is this). `upper` is the top of the body's side from the nose back. */
export const FINCH_BODY = {
  R: FINCH_R,
  wheelbase: 2.29,
  track: 1.33,
  width: 1.57,
  nose: 1.8,
  tail: -1.64,
  sill: 0.2,
  upper: [[1.8, 0.7], [1.66, 0.75], [0.7, 0.86], [-1.38, 0.92], [-1.52, 0.92], [-1.64, 0.84]],
  screenBase: [0.7, 0.88],
  screenTop: [0.22, 1.36], // raked 45 degrees: the glass about as far from your eye as the Tor's and Crag's (a test keeps it so)
  roofRear: [-1.08, 1.36],
  hatchBottom: [-1.5, 0.93],
  tumble: 0.16, // how far the glasshouse leans in, metres a metre up
  bPillar: -0.58,
  wheelOut: 0.28, // the steering wheel along its column from the dash face
  columnY: 0.71, // and how high the column comes out of the face
  seats: { driver: { x: -0.36, y: 0.5, z: -0.4 }, left: { x: 0.36, y: 0.5, z: -0.4 } },
  rear: { rearLeft: { x: 0.33, y: 0.52, z: -1.1, door: 'left' }, rearRight: { x: -0.33, y: 0.52, z: -1.1, door: 'driver' } },
  plate: 'KPB 412V', // a V, 1979 to 1980
};

/** The doors: hinged on their front edge at the A pillar's foot, `rear` is the back edge (a hand in front of the B pillar), `bottom` the lower edge above the sill moulding. */
export const FINCH_DOOR = { hinge: 0.7, rear: -0.55, bottom: 0.3, open: 1.1 };

/** The hatch: hinged along the roof's rear edge, `foot` the height of its lower edge on the tail, `open` how far it swings (radians, up and back). */
export const FINCH_HATCH = { foot: 0.5, open: 1.3, inset: 0.05 }; // `inset`: how far in from each side it stops (the quarters' inner faces are at 0.7475)

/** The tail lamps in the body's corners either side of the hatch (centre x, bottom y, top y, width). */
export const FINCH_TAIL_LAMP = { x: 0.6, y0: 0.57, y1: 0.77, w: 0.22 }; // small, in the hatch's lower corners, all inside its width (0.49 to 0.71)

/** The cargo floor behind the rear seat, and the parcel shelf over it. */
export const FINCH_BOOT = { floor: 0.5, shelf: 0.93, front: -1.4 };

/** The dash: where the binnacle, the centre stack and the tray are (all from `face`, the dash face's z, in `finchModel.js`). */
export const FINCH_DASH = { stackW: 0.3, radioY: 0.62, rockerY: 0.5 };
