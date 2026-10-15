// The yellow quad's body (TODO 91), after three photos of a 1990s Yamaha YFS200 Blaster in `.scratch/quads/tamura-blaster/` (a front-on
// shot, a three-quarter and the brochure's rear three-quarter, plus a close-up of the left of the engine). What those photos say is
// that the wheels are the quad: the plastics are small, lie inside the tyres' outer edges and leave the engine, the carb and the frame
// in plain view. So these numbers keep every panel narrower than the tyre beside it, and give the engine bay its own parts: the carb
// with the choke plunger on its left side and the fuel tap beside it. Pure numbers, no materials, so a test can check them.

/** The wheel centres (quadPhysics.js `WHEELS`) and the tyres, as the model builds them, for what must stay inside what. */
export const BLASTER_WHEELS = { x: 0.48, zFront: 0.62, zRear: -0.62, front: 0.22, rear: 0.29, radius: 0.3, y: 0.3 };

/** The tyres' outer edges: the widest the quad is. */
export const TYRE_OUTER = { front: BLASTER_WHEELS.x + BLASTER_WHEELS.front / 2, rear: BLASTER_WHEELS.x + BLASTER_WHEELS.rear / 2 };

// The fenders are shells swept round each wheel (quadGeometry.js `shellGeometry`): a side profile [z, y] from the wheel centre, front to
// back, and where across they run from and to. The whole body is a wedge, low at the front and rising to the back as the real one does:
// the fronts are small low caps over the tyres, the rears short wings that peak behind the middle of the tyre and stop near its back.
export const BLASTER_FENDERS = {
  front: {
    profile: [[0.27, 0.26], [0.23, 0.34], [0.15, 0.4], [0.0, 0.43], [-0.15, 0.41], [-0.24, 0.355], [-0.27, 0.28]],
    width: [0.22, 0.585],
  },
  rear: {
    profile: [[0.24, 0.3], [0.19, 0.36], [0.1, 0.42], [0.0, 0.44], [-0.12, 0.46], [-0.22, 0.47], [-0.28, 0.43], [-0.31, 0.35]],
    width: [0.19, 0.56],
  },
};

/** Across a fender [t from the inner edge to the outer, how far down towards the wheel]: a crowned top and a shallow rolled-down outer lip (the deep one it had dropped into the tyre). */
export const BLASTER_SECTION = [[0, 0.05], [0.04, 0.01], [0.12, 0.0], [0.5, -0.012], [0.9, 0.0], [0.96, 0.02], [0.99, 0.04], [1.0, 0.055]];

/** The nose between the front fenders and the tail between the rear ones, as `loftGeometry` stations (full width w). */
export const BLASTER_NOSE = [
  { z: 0.34, w: 0.3, y0: 0.6, y1: 0.73 },
  { z: 0.55, w: 0.4, y0: 0.5, y1: 0.69 },
  { z: 0.8, w: 0.46, y0: 0.46, y1: 0.62 },
  { z: 0.93, w: 0.42, y0: 0.46, y1: 0.58 },
  { z: 0.975, w: 0.32, y0: 0.48, y1: 0.55 },
];
export const BLASTER_TAIL = [
  { z: -0.76, w: 0.3, y0: 0.7, y1: 0.8 },
  { z: -0.87, w: 0.38, y0: 0.71, y1: 0.83 },
  { z: -0.94, w: 0.36, y0: 0.72, y1: 0.84 },
  { z: -0.97, w: 0.22, y0: 0.74, y1: 0.82 },
];

/** The headlamp and the mesh vent on the nose's face (z is the face's plane at the lamp's height). */
export const BLASTER_FACE = { z: 0.962, ventY: 0.515, ventW: 0.15, ventH: 0.05 };

/**
 * The headlamp fitting, in the bars' frame: a black housing sitting straight on the clamp at the bars' middle (a small mounting block between
 * them), in front of the key's pod, and steering with the bars.
 */
export const BLASTER_LAMP = { y: -0.015, z: 0.045, w: 0.15, h: 0.1, d: 0.07 };

/**
 * The bars (the bars' frame, one side, +x to the rider's left), after the bar in `.scratch/quads/tamura-blaster/handlebars.jpg`: a level
 * run across the middle, then a steep rise (about 50 degrees) up to the grips' fixed point, the grips splaying on a little. A straight
 * crossbar joins the two arms across the lower part of the rise, level, and goes no higher than the arms do; there is no hoop over them.
 */
export const BLASTER_VBARS = {
  centreY: -0.07, // the level run's height (the clamp's top is just under it)
  run: 0.2, // the level run goes out to here, then the rise begins
  grip: [0.318, 0.0675, -0.042], // the grip's fixed point, where the rise ends
  end: [0.433, 0.1075, -0.055], // the grip's far end
  crossX: 0.25, // where the crossbar meets each arm
  perchX: 0.29, // the lever perch and the throttle housing: outboard of the crossbar, on the rise
  leverScale: 0.85, // the brake lever is a little shorter than the other quads', so its tip stays inside the grip's end
};

/** The arm's height and depth at `x` (0 to the grip) along the level run and the rise. */
export function barAt(x, V = BLASTER_VBARS) {
  const ax = Math.abs(x);
  if (ax <= V.run) return { y: V.centreY, z: -0.012 - (0.008 * ax) / V.run };
  const t = Math.min(1, (ax - V.run) / (V.grip[0] - V.run));
  return { y: V.centreY + (V.grip[1] - V.centreY) * t, z: -0.02 + (V.grip[2] + 0.02) * t };
}

/** The bar's path from the grip's far end in to the middle (one side), for the bent tube. */
export const blasterBarHalf = (V = BLASTER_VBARS) => [V.end, V.grip, [V.run, V.centreY, barAt(V.run).z], [0.1, V.centreY, barAt(0.1).z]];

/** The crossbar's height and depth, level across between the arms. */
export const blasterCross = (V = BLASTER_VBARS) => barAt(V.crossX, V);

/** The exhaust, in the body's frame: the belly out to the right, then in under the wing and the side plate (below it) to a can inside the frame, ending before the tail's cross-tube. */
export const BLASTER_EXHAUST = {
  path: [[-0.03, 0.66, 0.2], [-0.12, 0.55, 0.4], [-0.27, 0.46, 0.32], [-0.34, 0.47, 0.04], [-0.3, 0.48, -0.22], [-0.17, 0.47, -0.34], [-0.12, 0.5, -0.48], [-0.1, 0.575, -0.58]],
  can: { x: -0.1, y: 0.6, z: -0.73, length: 0.3, tilt: 0.1 },
  tip: [-0.1, 0.616, -0.885],
};

/** The footrests: a plate on a tubular frame out of the lower rail (x 0.2), either side, round each peg (a fixed point at x 0.29). */
export const BLASTER_FOOTREST = { x0: 0.2, x1: 0.5, y: 0.318, z0: -0.27, z1: 0.19, rail: { x: 0.2, y: 0.3 } };

/** The front bumper: a silver tube loop at the nose, tied back to the frame's lower rails, and the skid plate under the nose. */
export const BLASTER_BUMPER = { x: 0.32, y: 0.42, z: 1.0, rail: { x: 0.19, y: 0.36, z: 0.92 } };

/**
 * The engine bay's visible parts, in the body's frame. The cylinder is at (0, 0.56, 0.1) leaning forward 0.12 rad (buildEngine in
 * quadModel.js), so its intake port is about (0, 0.67, 0.02). The carb is behind it: a mixing chamber along z, the slide cap on top, the
 * float bowl under; the choke plunger comes out of its left side and the throttle cable goes into its cap. The fuel tap is on the
 * tank's left edge, with a hose back to the bowl.
 */
export const BLASTER_CARB = {
  x: 0,
  y: 0.665,
  z: -0.025, // so its front sits on the cylinder's rear face, at about z 0.03
  r: 0.03, // the mixing chamber's radius
  len: 0.11,
  bowlY: 0.622,
  capY: 0.708,
  plunger: { x: 0.05, y: 0.665, z: -0.02 }, // where its housing meets the carb's left side; the knob pulls out along +x
  airboxZ: -0.36,
};

/** The fuel tap on the tank's left-hand lower edge, just ahead of the cylinder's fins' end and beside the carb's line (quadModel's TAP_PLACE.carbLeft). */
export const BLASTER_TAP = { pos: [0.17, 0.74, 0.17] };

/** The throttle cable from the right grip down the right of the tank into the carb's cap, in the body's frame (the bars' part is theirs). */
export const BLASTER_THROTTLE = [[-0.05, 0.88, 0.46], [-0.14, 0.8, 0.38], [-0.15, 0.74, 0.2], [-0.08, 0.725, 0.02], [0, BLASTER_CARB.capY + 0.012, BLASTER_CARB.z]];
