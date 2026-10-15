// The old three-wheeler's numbers (TODO 95): a Honda-ATC185S-style trike, the Kestrel T185, after the photos in `.scratch/quads/atc/` (a
// side-on shot, two three-quarters, the engine close up and the rear). Every point is in the model's own frame (ground at y 0, +z forward,
// +x the rider's left) and kept to the fixed points the girls and the dash were already fitted to: the bars at (0, 1.0, 0.36), the grips,
// the rider's seat. Pure numbers, no materials, so a test can check them.

/** The wheels (the layout in atcModel.js has the same numbers): 22 inch balloons on 10 inch (front) and 8 inch (rear) steel rims. */
export const ATC_WHEELS = { radius: 0.3, frontZ: 0.62, rearZ: -0.55, halfTrack: 0.39, front: 0.21, rear: 0.25, rimFront: 0.127, rimRear: 0.1 };

/** The front end leans back from the axle to the bars' clamp: the fork's axis at height y is at z = forkZ(y), and it is what the front end turns about. */
export const ATC_BARS_AT = [0, 1.0, 0.36];
export const ATC_RAKE = (ATC_WHEELS.frontZ - ATC_BARS_AT[2]) / (ATC_BARS_AT[1] - ATC_WHEELS.radius);
export const forkZ = (y) => ATC_WHEELS.frontZ - ATC_RAKE * (y - ATC_WHEELS.radius);

/** The fork: chrome legs (x) with black boots between boot and crown, the red steering columns above, and the heights they change at. */
export const ATC_FORK = { legX: 0.13, columnX: 0.11, bootBottom: 0.5, bootTop: 0.63, crown: 0.66, clamp: 0.97, crossbar: 0.76 };

/** The front fender, a wide flat wing over the wheel on the fork's legs: stations along z (width w, underside y0, top y1). */
export const ATC_FRONT_FENDER = [
  { z: 0.34, w: 0.3, y0: 0.62, y1: 0.665 },
  { z: 0.46, w: 0.36, y0: 0.66, y1: 0.71 },
  { z: 0.6, w: 0.34, y0: 0.66, y1: 0.715 },
  { z: 0.72, w: 0.28, y0: 0.6, y1: 0.65 },
  { z: 0.82, w: 0.2, y0: 0.55, y1: 0.6 },
];
/** The black rubber flap behind the front wheel, hung from the fender's back: its z, width, top and bottom. */
export const ATC_FRONT_FLAP = { z: 0.31, w: 0.2, top: 0.64, bottom: 0.38 };

/** The headlamp, a rectangular one in a chrome rim, between the steering columns: centre height, the housing, and its lens. */
export const ATC_LAMP = { y: 0.87, w: 0.17, h: 0.125, d: 0.075, ahead: 0.05 };

/**
 * The bars (in the bars' frame, +x the rider's left): wide and swept back, the grips at the fixed points (their inner ends), a crossbar with a pad
 * between the rises and a clamp block over the steering columns.
 */
export const ATC_BARS = {
  grip: [0.318, 0.0675, -0.042],
  gripDir: [0.115, 0.005, -0.028], // the grip's run, outwards and a little back
  gripLen: 0.115,
  half: [[0.435, 0.073, -0.07], [0.318, 0.0675, -0.042], [0.2, 0.05, -0.012], [0.12, 0.04, 0.0], [0.05, 0.03, 0.0]],
  crossX: 0.2,
  crossY: 0.06,
};

/** The tank (stations, width w) with its cap, and the long flat seat over the rear body. */
export const ATC_TANK = {
  stations: [
    { z: 0.32, w: 0.14, y0: 0.74, y1: 0.86 },
    { z: 0.22, w: 0.26, y0: 0.72, y1: 0.91 },
    { z: 0.06, w: 0.28, y0: 0.72, y1: 0.915 },
    { z: -0.06, w: 0.24, y0: 0.74, y1: 0.89 },
  ],
  cap: { y: 0.918, z: 0.2 },
};
export const ATC_SEAT = [
  { z: -0.04, w: 0.15, y0: 0.775, y1: 0.855 },
  { z: -0.12, w: 0.22, y0: 0.77, y1: 0.865, e: 3 },
  { z: -0.3, w: 0.27, y0: 0.775, y1: 0.87, e: 3 },
  { z: -0.5, w: 0.27, y0: 0.775, y1: 0.865, e: 3 },
  { z: -0.62, w: 0.2, y0: 0.78, y1: 0.84 },
];

/** The rear body: one wide red moulding over both tyres (the seat sits on it), as loft stations. Each underside clears the tyre below it. */
export const ATC_REAR_BODY = [
  { z: -0.12, w: 0.4, y0: 0.52, y1: 0.74 },
  { z: -0.22, w: 0.64, y0: 0.6, y1: 0.78 },
  { z: -0.4, w: 0.88, y0: 0.63, y1: 0.785 },
  { z: -0.55, w: 0.92, y0: 0.63, y1: 0.785 },
  { z: -0.7, w: 0.88, y0: 0.6, y1: 0.74 },
  { z: -0.8, w: 0.7, y0: 0.57, y1: 0.68 },
];
/** The black rubber flares outboard of each tyre's top, as loft stations (centre x, width w) to the back. */
export const ATC_FLARE = [
  { z: -0.28, w: 0.028, x: 0.525, y0: 0.52, y1: 0.64 },
  { z: -0.45, w: 0.028, x: 0.53, y0: 0.47, y1: 0.65 },
  { z: -0.65, w: 0.028, x: 0.53, y0: 0.45, y1: 0.63 },
  { z: -0.82, w: 0.028, x: 0.525, y0: 0.44, y1: 0.55 },
];
/** The rear rack's grab rail (a loop over the back of the body) and the bumper bar under its tail. */
export const ATC_RACK = { x: 0.16, top: 0.85, front: -0.58, back: -0.82, base: 0.76 };
export const ATC_BUMPER = { x: 0.22, y: 0.52, z: -0.86 };
export const ATC_TAIL = { y: 0.62, z: -0.8 };

/** The engine, a four-stroke look: crankcase with its round covers, a finned barrel standing up and a head, the carb behind. */
export const ATC_ENGINE = {
  case: { y: 0.36, z: 0.03, w: 0.2, h: 0.2, d: 0.3 },
  cylinder: { y: 0.57, z: 0.1, r: 0.055, h: 0.2, lean: 0.14 },
  recoil: { x: 0.125, y: 0.4, z: 0.04, r: 0.062 },
  cover: { x: 0.118, y: 0.34, z: 0.02, r: 0.1 },
  sprocket: { x: 0.15, y: 0.3, z: -0.13, r: 0.03 },
};
/** The carb behind the cylinder (the choke plunger comes out of its left) and the airbox under the rear body's front edge. */
export const ATC_CARB = { x: 0, y: 0.6, z: -0.04, r: 0.03, len: 0.1, bowlY: 0.555, capY: 0.64, plungerZ: -0.05, airboxZ: -0.22 };
export const ATC_TAP = { pos: [0.1, 0.72, 0.08] };

/** The exhaust: out of the cylinder's front, one bend round the right and then a plain run back to the can between the tyres. */
export const ATC_EXHAUST = {
  path: [[-0.01, 0.62, 0.16], [-0.06, 0.52, 0.22], [-0.15, 0.4, 0.2], [-0.17, 0.38, 0.0], [-0.17, 0.4, -0.18]],
  radii: [0.02, 0.024, 0.026, 0.026, 0.028],
  can: { from: [-0.17, 0.4, -0.18], to: [-0.17, 0.42, -0.5], r: 0.05 },
};

/** The frame, black tube, per side as [z, y] runs at x: the cradle round the engine, the spine under the tank and the rear legs to the axle. */
export const ATC_FRAME = {
  x: 0.11,
  cradle: [[0.4, 0.7], [0.26, 0.5], [0.18, 0.28], [0.02, 0.2], [-0.2, 0.24], [-0.45, 0.3], [-0.55, 0.3]],
  spine: [[0.4, 0.76], [0.2, 0.67], [-0.1, 0.62], [-0.3, 0.6]],
  rear: [[-0.3, 0.6], [-0.45, 0.45], [-0.55, 0.3]],
};

/** The chain on the left from the engine's sprocket to the rear axle's, and the foot rests (fixed to where the old model had them). */
export const ATC_CHAIN = { x: 0.15, rearR: 0.075 };
export const ATC_PEGS = { x: 0.26, y: 0.25, z: -0.02 };
