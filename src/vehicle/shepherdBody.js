// After a Yamaha AG200.
// The farm bike's numbers (#75): the Ridgeback Shepherd 200, the shepherd's trail bike: a tall narrow frame, long-travel forks, a
// single rear shock, a long flat dual seat for two with a grab strap, tubular steel racks front and back, hand guards, a small air-cooled single
// with an upswept exhaust and a heat shield, spoked wheels with knobbly tyres, and a kickstart on the right as well as the button. From the photos
// in `.scratch/quads/shepherd/` (a side-on shot, the rear rack from above and the speedo from the front). Every point is in the model's own frame
// (ground at y 0, +z forward, +x the rider's left, so the right-hand side with the kickstart and exhaust is -x); the wheelbase is the real 1.33 m
// and the rest read off the side photo against it. Pure numbers, no materials, so a test can check them.

/** The wheels (the layout in shepherdModel.js has the same z): a 21 inch spoked front and an 18 inch rear, both knobbly, about 0.335 m out. */
export const AG_WHEELS = { radius: 0.335, frontZ: 0.68, rearZ: -0.65, width: 0.09, rim: 0.262, rimRear: 0.23 };

/** The forks lean back 24 degrees from the front axle (tan 0.45), so the fork's axis at height y is at z = forkZ(y). */
export const AG_RAKE = 0.45;
export const forkZ = (y) => AG_WHEELS.frontZ - AG_RAKE * (y - AG_WHEELS.radius);

/** The bars' group origin, which is also the steering axis the whole front end turns about (on the fork's axis). */
export const AG_BARS_AT = [0, 1.0, forkZ(1.0)];

/** The fork: long-travel, silver lower legs and chrome stanchions; where each part runs (heights). */
export const AG_FORK = { x: 0.09, lowerTop: 0.64, upperTop: 1.0, yoke: 0.96, lowerYoke: 0.8 };

/**
 * The bars (the bars' frame, +x the rider's left): wide and fairly high, a crossbar between the risers, the grips at the fixed points, and a
 * big hand guard over each lever.
 */
export const AG_BARS = {
  grip: [0.3, 0.06, -0.03],
  gripDir: [0.09, 0.012, -0.02],
  half: [[0.42, 0.075, -0.07], [0.3, 0.06, -0.03], [0.2, 0.05, 0.0], [0.12, 0.02, 0.02], [0.06, 0.0, 0.015]],
  gripLen: 0.1,
  cross: 0.062, // the crossbar's height above the bars' origin
};

/** The dual seat: long and flat for two, stations (z, half width, y0, y1) it lofts through; the grab strap is a loop across the back. */
export const AG_SEAT = [
  { z: 0.1, w: 0.07, y0: 0.76, y1: 0.795 },
  { z: 0.0, w: 0.12, y0: 0.745, y1: 0.8 },
  { z: -0.15, w: 0.16, y0: 0.74, y1: 0.805, e: 3 },
  { z: -0.4, w: 0.17, y0: 0.74, y1: 0.805, e: 3 },
  { z: -0.62, w: 0.15, y0: 0.745, y1: 0.8 },
  { z: -0.74, w: 0.1, y0: 0.755, y1: 0.78 },
];
export const AG_STRAP = { z: -0.4, y: 0.815, half: 0.1 };

/** The tank: a medium tank with a sculpted knee recess, between the head and the seat, in loft stations. */
export const AG_TANK = {
  stations: [
    { z: 0.34, w: 0.08, y0: 0.82, y1: 0.97 },
    { z: 0.25, w: 0.14, y0: 0.78, y1: 1.0 },
    { z: 0.08, w: 0.17, y0: 0.74, y1: 1.0 },
    { z: -0.08, w: 0.15, y0: 0.74, y1: 0.97 },
    { z: -0.2, w: 0.1, y0: 0.75, y1: 0.93 },
  ],
  cap: { y: 1.005, z: 0.18 },
};

/** The side panels under the seat either side, in the body paint (the plastics that are scuffed). */
export const AG_PANEL = { z0: -0.04, z1: -0.4, y0: 0.54, y1: 0.76, x: 0.115 };

/** The headlamp: a small round lamp on brackets at the fork's top. */
export const AG_LAMP = { y: 0.93, ahead: 0.1, r: 0.075 };

/** The front mudguard (high, long, sprung from the legs) and the rear one under the seat's tail, arcs in degrees about the axle (0 up, forward positive). */
export const AG_FRONT_FENDER = { r: 0.4, width: 0.12, flange: 0.0, from: -30, to: 78 };
export const AG_REAR_FENDER = { r: 0.38, width: 0.15, flange: 0.0, from: -95, to: -8 };

/** The frame: a steel cradle. Each run is a list of [z, y] per side (x is `x`). */
export const AG_FRAME = {
  x: 0.07,
  top: [[0.33, 0.9], [0.1, 0.78], [-0.1, 0.7]],
  seatRail: [[-0.1, 0.7], [-0.45, 0.72], [-0.76, 0.7]], // a rail each side, under the seat to the tail
  seatStay: [[-0.1, 0.7], [-0.4, 0.5], [-0.65, 0.335]], // to the rear axle
  downtube: [[0.34, 0.82], [0.26, 0.5], [0.2, 0.3]],
  cradle: [[0.2, 0.3], [0.12, 0.2], [-0.18, 0.2], [-0.3, 0.28]],
  head: [0.76, 0.93],
};

/** The swingarm: two boxes from the pivot (z, y) to the axle. */
export const AG_SWINGARM = { x: 0.085, w: 0.035, h: 0.05, pivot: [-0.32, 0.3], axle: [-0.65, 0.335] };

/** The single rear shock: from the swingarm's cross up and forward to the frame under the seat. */
export const AG_SHOCK = { bottom: [-0.48, 0.34], top: [-0.3, 0.64] };

/** The engine: a small air-cooled single, an upright finned barrel and head and a crankcase and gearbox below. */
export const AG_ENGINE = {
  case: { y: 0.37, z: -0.03, w: 0.16, h: 0.22, d: 0.34 },
  cylinder: { y: 0.6, z: 0.05, r: 0.055, h: 0.15, lean: 0.12 },
  clutch: { x: -0.095, y: 0.38, z: -0.08, r: 0.085 }, // the right-hand cover, with the kickstart's shaft behind it
  generator: { x: 0.095, y: 0.4, z: 0.03, r: 0.065 }, // the left-hand cover
  sprocket: { x: 0.07, y: 0.31, z: -0.2, r: 0.036 },
};

/** The carb behind the barrel, its choke plunger and the fuel tap under the tank on the left. */
export const AG_CARB = { x: 0.0, y: 0.62, z: -0.1, r: 0.026, len: 0.1 };
export const AG_TAP = { pos: [0.07, 0.74, 0.1] };

/** The exhaust: out of the front of the head, round to the right and up along the side to an upswept silencer under the rack, with a heat shield. */
export const AG_EXHAUST = {
  path: [[-0.03, 0.62, 0.11], [-0.11, 0.5, 0.16], [-0.16, 0.42, 0.04], [-0.18, 0.48, -0.2], [-0.19, 0.6, -0.5]],
  radii: [0.016, 0.019, 0.02, 0.02, 0.02],
  can: { from: [-0.19, 0.58, -0.4], to: [-0.2, 0.76, -0.86], r0: 0.036, r1: 0.05 },
  shield: { from: [-0.205, 0.5, -0.3], to: [-0.215, 0.62, -0.62], w: 0.06 }, // the perforated heat shield over the pipe
};

/** The kickstart pedal's crank on the right of the crankcase behind the clutch cover, a lever resting forward and down. */
export const AG_KICK = { x: -0.13, y: 0.3, z: -0.2, length: 0.2, restAngle: -0.5 };

/** The foot rests: the rider's (fixed points) and the passenger's pair behind them; the centre stand. */
export const AG_PEGS = { x: 0.2, y: 0.33, z: -0.06 };
export const AG_PILLION_PEGS = { x: 0.2, y: 0.36, z: -0.52 };
export const AG_STAND = { y: 0.04, z: -0.1, w: 0.24 };

/** The racks: a tubular steel rack over the back wheel from the seat's tail to past the lamp, and a small one on the front (in the bars' frame). */
export const AG_REAR_RACK = { y: 0.86, z0: -0.5, z1: -1.02, w: 0.19 };
export const AG_FRONT_RACK = { y: 0.14, z0: -0.04, z1: 0.18, w: 0.17 }; // above the bars' origin; in the bars' frame
export const AG_TAIL = { y: 0.57, z: -0.955 }; // the lamp's housing bedded in the mudguard's tail (the arc is at y 0.553, z -0.96 at 55 degrees round)

/** The rider's and the camera's places (the camera's eyes are 0.79 m above the seat's anchor, as on the other bikes), and the passenger's. */
export const AG_RIDER = { y: 0.835, z: -0.12, camera: 1.625 };
export const AG_PILLION = { y: 0.84, z: -0.55, camera: 1.63 };
