// The old bike's numbers (#38, TODO 143): the Ashby Plover 125, after a 1949 BSA D1 Bantam: a rigid frame with a spring under the saddle, a
// 123 cc two-stroke single in a loop of tube, telescopic forks with rubber gaiters, a deep valanced fender at each end, a cream and green
// tank, a Smiths speedo in the headlamp shell and a kickstart on the right. From the photos in `.scratch/bantam/` (a side-on shot, two
// three-quarters and the speedo from above). Every point is in the model's own frame (ground at y 0, +z forward, +x the rider's left, so the
// right-hand side with the kickstart, exhaust and carb is -x); the wheelbase is the real 1.31 m and the rest read off the side photo against
// it. Pure numbers, no materials, so a test can check them.

/** The wheels (the layout in bantamModel.js has the same z): 19 inch spoked rims with 2.75 inch ribbed tyres, both ends. */
export const BANTAM_WHEELS = { radius: 0.31, frontZ: 0.655, rearZ: -0.655, width: 0.07, rim: 0.24 };

/** The forks lean back 27 degrees (tan 0.5) from the front axle, so the fork's axis at height y is at z = forkZ(y). */
export const BANTAM_RAKE = 0.5;
export const forkZ = (y) => BANTAM_WHEELS.frontZ - BANTAM_RAKE * (y - BANTAM_WHEELS.radius);

/** The bars' group origin, which is also the steering axis the whole front end turns about (on the fork's axis: forkZ(0.9) = 0.355). */
export const BANTAM_BARS_AT = [0, 0.9, 0.355];

/** The telescopic fork: leg spread, the lower legs' top, where the rubber gaiters run and the top yoke. */
export const BANTAM_FORK = { x: 0.085, lowerTop: 0.56, gaiter: [0.52, 0.78], upperTop: 0.86, yoke: 0.86, lowerYoke: 0.64 };

/**
 * The bars (the bars' frame, +x the rider's left): wide, swept back and up, with the grips at the fixed points. The levers are on the
 * left (clutch, and the advance-retard lever under the clutch's perch) and the right (front brake), the twist grip throttle on the right.
 */
export const BANTAM_BARS = {
  grip: [0.25, 0.052, -0.04], // the grip's inner end
  gripDir: [0.09, 0.012, -0.02], // its run, outwards and a little back
  half: [[0.31, 0.06, -0.06], [0.25, 0.052, -0.04], [0.18, 0.04, 0.0], [0.13, 0.032, 0.03], [0.08, 0.012, 0.02], [0.03, 0.0, 0.01]],
  gripLen: 0.095,
};

/** The saddle, a sprung black leather one with a thick coil under its tail, and the stations (z, half width, y0, y1) it lofts through. */
export const BANTAM_SEAT = [
  { z: 0.0, w: 0.07, y0: 0.7, y1: 0.745 },
  { z: -0.1, w: 0.14, y0: 0.69, y1: 0.76 },
  { z: -0.24, w: 0.17, y0: 0.69, y1: 0.765, e: 3 },
  { z: -0.38, w: 0.18, y0: 0.7, y1: 0.76, e: 3 },
  { z: -0.46, w: 0.16, y0: 0.71, y1: 0.745 },
  { z: -0.5, w: 0.11, y0: 0.715, y1: 0.735 },
];
export const BANTAM_SADDLE_SPRING = { x: 0.045, y0: 0.56, y1: 0.7, z: -0.4, r: 0.03 };

/** The tank: a long teardrop between the head and the saddle, in loft stations; the cream panel is on each side. */
export const BANTAM_TANK = {
  stations: [
    { z: 0.36, w: 0.07, y0: 0.76, y1: 0.89 },
    { z: 0.28, w: 0.13, y0: 0.7, y1: 0.915 },
    { z: 0.1, w: 0.17, y0: 0.66, y1: 0.93 },
    { z: -0.06, w: 0.16, y0: 0.66, y1: 0.915 },
    { z: -0.14, w: 0.11, y0: 0.7, y1: 0.89 },
    { z: -0.18, w: 0.07, y0: 0.74, y1: 0.86 },
  ],
  cap: { y: 0.935, z: 0.2 },
  panel: { z: 0.07, y: 0.795, w: 0.3, h: 0.14, x: 0.087 }, // the cream panel's centre and size on the side
};

/** The headlamp shell on the fork's brackets, its glass and the speedo cup on its top; the fork's top nuts either side. */
export const BANTAM_LAMP = { y: 0.85, ahead: 0.14, r: 0.1, depth: 0.13 };

/** The front fender: deep, valanced, riding on the lower legs, with a flick at the front; the arc runs `from` to `to` degrees about the axle (0 up, forward positive). */
export const BANTAM_FRONT_FENDER = { r: 0.35, width: 0.12, flange: 0.07, from: -42, to: 118 };
/** The rear fender: the same, from the saddle's tail round to behind the wheel, with the carrier on it. */
export const BANTAM_REAR_FENDER = { r: 0.35, width: 0.15, flange: 0.08, from: -125, to: 74 };

/** The frame: a single tube loop. Each run is a list of [z, y] per side (x is `x`), the head tube in the middle along the fork's axis. */
export const BANTAM_FRAME = {
  x: 0.06,
  top: [[0.34, 0.84], [0.1, 0.7], [-0.15, 0.66]], // the top tube from the head down to under the saddle
  seatStay: [[-0.15, 0.66], [-0.42, 0.62], [-0.655, 0.31]], // to the rear axle
  downtube: [[0.37, 0.8], [0.27, 0.5], [0.2, 0.3]], // the single front tube, to the cradle
  cradle: [[0.2, 0.3], [0.12, 0.2], [-0.18, 0.2], [-0.36, 0.26], [-0.655, 0.31]], // under the engine and back to the axle
  head: [0.74, 0.88], // the head tube, y to y along the fork's axis
};

/** The engine: an alloy crankcase and gearbox unit with a finned iron barrel leaning slightly forward, and the carb on the right of the barrel. */
export const BANTAM_ENGINE = {
  case: { y: 0.37, z: -0.05, w: 0.16, h: 0.22, d: 0.3 },
  cylinder: { y: 0.58, z: 0.02, r: 0.052, h: 0.17, lean: 0.12 },
  head: { y: 0.69, z: 0.04 },
  magneto: { x: 0.095, y: 0.38, z: 0.04, r: 0.07 }, // the left-hand cover over the flywheel magneto and its points
  primary: { x: -0.095, y: 0.38, z: -0.06, r: 0.085 }, // the right-hand cover, the clutch and the kickstart's shaft behind it
  sprocket: { x: 0.07, y: 0.3, z: -0.24, r: 0.035 },
};

/** The carb on the barrel's right (-x), with its tickler on top and the choke strangler on its air intake; the cable and the tap's pipe. */
export const BANTAM_CARB = { x: -0.075, y: 0.62, z: -0.06, r: 0.027, len: 0.1, tickler: [0, 0.035, 0], bowlY: 0.575 };

/** The fuel tap on the tank's underside, on the right, with a pipe down to the carb's bowl. */
export const BANTAM_TAP = { pos: [-0.075, 0.665, 0.12] };

/** The exhaust: out of the barrel's front on the right, down and back as one pipe to a long tapered silencer on the right. */
export const BANTAM_EXHAUST = {
  path: [[-0.04, 0.62, 0.09], [-0.1, 0.5, 0.2], [-0.16, 0.34, 0.14], [-0.17, 0.3, -0.05], [-0.17, 0.3, -0.35]],
  radii: [0.016, 0.019, 0.02, 0.02, 0.02],
  can: { from: [-0.17, 0.3, -0.3], to: [-0.18, 0.34, -0.75], r0: 0.032, r1: 0.052 }, // tapers up towards the back
};

/** The kickstart pedal's crank on the right of the crankcase behind the clutch cover, a long lever resting forward and down (a kick swings it down and back), with a rubber on it. */
export const BANTAM_KICK = { x: -0.13, y: 0.3, z: -0.18, length: 0.2, restAngle: -0.55, rubber: 0.04 };

/** The foot rests (rubbers on short bars through the frame), the brake pedal on the right and the gear lever on the left; the centre stand. */
export const BANTAM_PEGS = { x: 0.19, y: 0.29, z: -0.12 };
export const BANTAM_STAND = { y: 0.04, z: -0.12, w: 0.22 };

/** The carrier on the rear fender, the tail lamp and the plate. */
export const BANTAM_CARRIER = { y: 0.74, z0: -0.2, z1: -0.82, w: 0.16 };
export const BANTAM_TAIL = { y: 0.55, z: -0.98 };

/** The rider's and the camera's places (the camera's eyes are 0.79 m above the seat's anchor, as on the other bikes). */
export const BANTAM_RIDER = { y: 0.8, z: -0.24, camera: 1.59 };
