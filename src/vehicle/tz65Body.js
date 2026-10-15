// The mini moto's numbers (TODO 94): a Yamaha YZ65 small motocross bike, the Tamura TZ 65, after the photos in `.scratch/quads/tamura-bike/`
// (a studio three-quarter, the side-on shot, the bars from above). Every point is in the model's own frame (ground at y 0, +z forward, +x
// the rider's left), read off the side photo at 414 px to the metre (the wheelbase is 1.05 m, the photo's 435 px) and then kept to the fixed
// points the girls and the dash were already fitted to: the bars at (0, 0.84, 0.34), the grips, the rider's seat. Pure numbers, no
// materials, so a test can check them.

/** The wheels (the layout in miniMotoModel.js has the same z): a 14 inch front and a 12 inch rear, both knobbly. */
export const TZ_WHEELS = { radius: 0.22, frontZ: 0.58, rearZ: -0.47, front: 0.075, rear: 0.09, rimFront: 0.155, rimRear: 0.145 };

/** The forks lean back 24 degrees (tan 0.445) from the front axle, so the fork's axis at height y is at z = forkZ(y). */
export const TZ_RAKE = 0.445;
export const forkZ = (y) => TZ_WHEELS.frontZ - TZ_RAKE * (y - TZ_WHEELS.radius);

/** The bars' group origin, which is also the steering axis the whole front end turns about (a fixed point). */
export const TZ_BARS_AT = [0, 0.84, 0.34];

/** The fork: the legs' spread, the blue lower legs' top, the gold upper tubes' ends and the two clamps. */
export const TZ_FORK = { x: 0.07, lowerTop: 0.5, upperBottom: 0.4, upperTop: 0.79, lowerClamp: 0.7, upperClamp: 0.78 };

/** The front fender rides high on stays from the lower legs: as stations along z in the world (its tip is at 0.74), a thin shell. */
export const TZ_FRONT_FENDER = [
  { z: 0.29, w: 0.11, y0: 0.545, y1: 0.564 },
  { z: 0.42, w: 0.13, y0: 0.552, y1: 0.573 },
  { z: 0.56, w: 0.12, y0: 0.545, y1: 0.566 },
  { z: 0.66, w: 0.1, y0: 0.525, y1: 0.544 },
  { z: 0.745, w: 0.07, y0: 0.5, y1: 0.517 },
];

/** The front number plate on the forks' face: blank, a little ahead of the tubes, leaning back with them. */
export const TZ_PLATE = { w: 0.17, h: 0.21, d: 0.014, y: 0.72, ahead: 0.04 };

/**
 * The bars (the bars' frame, +x the rider's left): level grips (the fixed points are the grips' inner ends at (0.27, 0.057, -0.036)), a bend up
 * to the middle with a crossbar between the rises, and a pad over the crossbar.
 */
export const TZ_BARS = {
  grip: [0.27, 0.057, -0.036],
  gripDir: [0.098, 0.0046, -0.0235], // the grip's run, outwards and a little back
  half: [[0.352, 0.062, -0.058], [0.27, 0.057, -0.036], [0.17, 0.056, -0.01], [0.125, 0.073, 0.004], [0.05, 0.078, 0.008]],
  gripLen: 0.082,
  crossY: 0.078,
  crossX: 0.125,
  pad: { w: 0.17, h: 0.042, d: 0.034, y: 0.101, z: 0.014 },
};

/** The seat, a long flat foam seat that is narrow at the front, and the rear fender under it that flicks up behind. Loft stations (width w). */
export const TZ_SEAT = [
  { z: 0.1, w: 0.12, y0: 0.675, y1: 0.745 },
  { z: 0.0, w: 0.16, y0: 0.655, y1: 0.745 },
  { z: -0.2, w: 0.19, y0: 0.64, y1: 0.745, e: 3 },
  { z: -0.45, w: 0.19, y0: 0.64, y1: 0.74, e: 3 },
  { z: -0.62, w: 0.16, y0: 0.65, y1: 0.73 },
  { z: -0.66, w: 0.12, y0: 0.66, y1: 0.725 },
];
export const TZ_TAIL = [
  { z: -0.14, w: 0.17, y0: 0.58, y1: 0.69 },
  { z: -0.4, w: 0.17, y0: 0.6, y1: 0.7 },
  { z: -0.58, w: 0.15, y0: 0.64, y1: 0.715 },
  { z: -0.69, w: 0.11, y0: 0.7, y1: 0.745 },
  { z: -0.72, w: 0.08, y0: 0.72, y1: 0.75 },
];

/** The shrouds: a blue wing each side of the tank from the seat's front to the head, as loft stations each at x (mirrored). */
export const TZ_SHROUD = [
  { z: 0.11, w: 0.1, x: 0.072, y0: 0.6, y1: 0.77 },
  { z: 0.2, w: 0.1, x: 0.072, y0: 0.6, y1: 0.795 },
  { z: 0.3, w: 0.085, x: 0.06, y0: 0.62, y1: 0.79 },
  { z: 0.345, w: 0.06, x: 0.05, y0: 0.65, y1: 0.765 },
];

/** The black tank between them, and its cap. */
export const TZ_TANK = {
  stations: [
    { z: 0.12, w: 0.1, y0: 0.64, y1: 0.775 },
    { z: 0.2, w: 0.1, y0: 0.64, y1: 0.805 },
    { z: 0.3, w: 0.08, y0: 0.66, y1: 0.795 },
  ],
  cap: { y: 0.807, z: 0.17 },
};

/** The side number boards under the seat, as a polygon of [z, y] (the corner near the carb is cut away so the engine bay shows), at x 0.105. */
export const TZ_SIDE_BOARD = {
  x: 0.108,
  thick: 0.014,
  outline: [[-0.6, 0.665], [-0.62, 0.6], [-0.42, 0.565], [-0.26, 0.53], [-0.14, 0.52], [-0.12, 0.58], [-0.13, 0.69], [-0.3, 0.7], [-0.5, 0.7]],
};

/** The radiator covers, black plastic with louvres, either side of the cylinder. */
export const TZ_RADIATOR = { x: 0.115, y: 0.53, z: 0.2, w: 0.026, h: 0.12, d: 0.16 };

/**
 * The engine in the open: crankcase (the right-hand cover is the clutch's, the left the sprocket's with the recoil starter's cup over the
 * flywheel), the barrel leaning forward, a silver head, and the carb behind it on a rubber boot from the airbox.
 */
export const TZ_ENGINE = {
  case: { y: 0.36, z: -0.014, w: 0.15, h: 0.21, d: 0.23 },
  cylinder: { y: 0.52, z: 0.1, r: 0.048, h: 0.13, lean: 0.32 },
  head: { y: 0.6, z: 0.135 },
  recoil: { x: 0.105, y: 0.4, z: 0.005, r: 0.052 },
  sprocket: { x: 0.058, y: 0.3, z: -0.125, r: 0.03 },
};

/** The carb behind the cylinder: the choke plunger comes out of its left side and the tap's hose runs to its bowl. */
export const TZ_CARB = { x: 0, y: 0.555, z: -0.03, r: 0.027, len: 0.1, bowlY: 0.515, capY: 0.592, plungerZ: -0.05, airboxZ: -0.27 };

/** The fuel tap on the tank's left-hand lower edge, just above the carb's line, with a hose down to the bowl. */
export const TZ_TAP = { pos: [0.075, 0.62, 0.06] };

/**
 * The expansion chamber: out of the cylinder's front on the right, down in front of the engine, under it and up the right side, with a
 * silver silencer over the rear wheel. In the model's frame; the radii go with the swept path.
 */
export const TZ_EXHAUST = {
  // Out of the cylinder's front, one bend round the radiator and then a plain run back along the right (outboard of the side board) to the can.
  path: [[-0.02, 0.5, 0.13], [-0.06, 0.455, 0.225], [-0.13, 0.375, 0.24], [-0.15, 0.36, 0.1], [-0.15, 0.4, -0.1], [-0.165, 0.45, -0.27]],
  radii: [0.02, 0.03, 0.05, 0.05, 0.032, 0.03],
  can: { from: [-0.165, 0.45, -0.27], to: [-0.18, 0.62, -0.5], r: 0.04 },
  stay: [[-0.165, 0.45, -0.27], [-0.062, 0.4, -0.11]], // a tube from the pipe's end to the frame's rear leg, under the side board
};

/** The swingarm, a pair of silver boxes from the pivot to the rear axle, and the shock between the frame and the arm. */
export const TZ_SWINGARM = { x: 0.082, pivot: [-0.1, 0.285], axle: [-0.47, 0.22], w: 0.03, h: 0.05 };
export const TZ_SHOCK = { bottom: [-0.205, 0.37], top: [-0.06, 0.565] };

/** The frame, silver tube: per side, as [z, y] runs (x is `x`); the head tube is in the middle along the fork's axis. */
export const TZ_FRAME = {
  x: 0.062,
  spar: [[0.36, 0.71], [0.12, 0.635], [-0.12, 0.6]],
  seatRail: [[-0.12, 0.6], [-0.3, 0.62], [-0.52, 0.66]],
  rear: [[-0.12, 0.6], [-0.1, 0.285]],
  cradle: [[0.37, 0.66], [0.26, 0.3], [0.12, 0.19], [-0.08, 0.2], [-0.1, 0.285]],
  head: [0.66, 0.76], // the head tube from y to y along the fork's axis
};

/** The chain from the sprocket on the engine to the one on the rear wheel, on the left (the run's ends in the frame). */
export const TZ_CHAIN = { x: 0.058, rearR: 0.06 };

/** The foot pegs (fixed to where the old model had them) and the pedal and lever by them. */
export const TZ_PEGS = { x: 0.19, y: 0.26, z: -0.05 };
