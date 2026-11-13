// After a Vauxhall Corsa B.
// The Griffin's numbers (TODO 103): a 1993 Griffin B three-door, the Ashby Griffin (Jess's), after the photos in `.scratch/quads/griffin/` (a red, a
// blue, a purple, a green and a burgundy car from the front, side and rear, the dash and its cluster, the front and back seats). Every point is in
// the model's own frame (ground at y 0 under the wheels at rest, +z forward, +x the driver's left; the driver sits on the right, at -x), measured on
// the side photos with the wheelbase (2.443 m) as the rule. Pure numbers and a few pure functions, no materials, so a test can check them. The car used
// to be drawn at 1.15 times its size; this one is the real size.

export const GRIFFIN_R = 0.274; // 155/70 x 13 tyres
export const GRIFFIN_TYRE_W = 0.155;
export const GRIFFIN_RIDE_LIFT = 0.05; // the body sits this much higher than the arches' first cut
export const GRIFFIN_EYE_UP = 0.66; // your eyes over the hips

/** The side profile, the glasshouse and the seats (CARS.griffin in carModel.js is this). `upper` is the top of the body's side from the nose back, a smooth curve through the points. */
export const GRIFFIN_BODY = {
  R: GRIFFIN_R,
  wheelbase: 2.44,
  track: 1.39,
  width: 1.61,
  nose: 1.88,
  tail: -1.68,
  sill: 0.19,
  upper: [[1.88, 0.56], [1.86, 0.65], [1.78, 0.73], [1.55, 0.8], [0.8, 0.9], [-1.36, 1.0], [-1.5, 0.99], [-1.6, 0.93], [-1.68, 0.82]],
  round: true, // the upper line is a smooth curve through its points, not straight lines: the Griffin B is all curves
  screenBase: [0.8, 0.9],
  screenTop: [0.25, 1.33], // raked about 46 degrees; the roof stands 5 cm higher again on the ride lift (1.42 m tall as the real car)
  roofRear: [-1.2, 1.31],
  hatchBottom: [-1.56, 0.98],
  tumble: 0.26,
  bPillar: -0.62,
  wheelOut: 0.32, // the steering wheel along its column from the dash face
  columnY: 0.71, // and how high the column comes out of the face (the dials show through the top of Jess's small wheel, above its boss: a test measures it)
  seats: { driver: { x: -0.37, y: 0.5, z: -0.34 }, left: { x: 0.37, y: 0.5, z: -0.34 } },
  rear: { rearLeft: { x: 0.34, y: 0.52, z: -1.14, door: 'left' }, rearRight: { x: -0.34, y: 0.52, z: -1.14, door: 'driver' } },
  plate: 'L238 FKR', // an L, 1993 to 1994
};

/** The doors: hinged on their front edge at the A pillar's foot, `rear` is the back edge (a hand in front of the B pillar), `bottom` the lower edge above the sill. */
export const GRIFFIN_DOOR = { hinge: 0.78, rear: -0.59, bottom: 0.3, open: 1.1 };

/** The hatch: hinged along the roof's rear edge, `foot` the height of its lower edge (above the bumper), `open` how far it swings (radians, up and back). */
export const GRIFFIN_HATCH = { foot: 0.5, open: 1.3 };

/** The tail lamps, tall ovals in the hatch's lower corners (centre x, bottom y, top y, width): they lift with it. */
export const GRIFFIN_TAIL_LAMP = { x: 0.62, y0: 0.56, y1: 0.84, w: 0.15 };

/** The cargo floor behind the rear seat. */
export const GRIFFIN_BOOT = { floor: 0.52, front: -1.42 };

/** The bumpers: the black plastic's lower and upper edge at the nose and the tail. */
export const GRIFFIN_BUMPER = { low: 0.2, high: 0.52 };
