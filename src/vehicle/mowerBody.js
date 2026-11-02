// The ride-on mower's numbers (#76): the Ridgeback Clipper 12, after an old British garden tractor of the Westwood or Countax kind. A low
// four-wheeled machine with small front wheels and fat turf-tread rears, a bonnet over a single-cylinder engine with a grille and a
// headlamp, a moulded seat with a back over the rear wheels, a cutting deck slung under the middle with a chute on the right and a height
// lever beside the seat, a grass box behind, a steering wheel and a little dash with the key, the choke and the blade lever, and a pull cord on
// the engine for when the battery is flat. No photos: built from the issue's Looks like list and the proportions of a 42 inch garden tractor
// (about 2.1 m long with the box, 0.95 m across the wheels, 1.1 m to the top of the steering wheel). Every point is in the model's own frame
// (ground at y 0, +z forward, +x the rider's left, so the chute on the right is -x). Pure numbers, no materials, so a test can check them.

/** The wheels (the layout in mowerModel.js has the same numbers): small ribbed fronts and fat turf-tread rears. */
export const MOWER_WHEELS = {
  frontR: 0.17, frontW: 0.13, frontRim: 0.1, frontX: 0.36, frontZ: 0.62,
  rearR: 0.24, rearW: 0.22, rearRim: 0.135, rearX: 0.39, rearZ: -0.5,
};

/** The chassis: two steel rails from the front axle's bracket to the back, with cross members. */
export const MOWER_FRAME = { x: 0.2, y: 0.26, z0: 0.74, z1: -0.82, h: 0.07, w: 0.04 };

/** The bonnet: stations (z, width, y0, y1) from the nose back to the dash. A long flat-topped moulding that slopes down at the nose. */
export const MOWER_BONNET = [
  { z: 0.85, w: 0.34, y0: 0.4, y1: 0.62 },
  { z: 0.8, w: 0.4, y0: 0.37, y1: 0.68 },
  { z: 0.62, w: 0.46, y0: 0.36, y1: 0.74 },
  { z: 0.4, w: 0.5, y0: 0.36, y1: 0.77 },
  { z: 0.2, w: 0.5, y0: 0.36, y1: 0.78 },
  { z: 0.14, w: 0.48, y0: 0.38, y1: 0.77 },
];

/** The grille in the bonnet's nose and the headlamp above it: centre, size and how far they stand proud of the nose. */
export const MOWER_GRILLE = { z: 0.856, y: 0.5, w: 0.26, h: 0.14 };
export const MOWER_LAMP = { y: 0.655, z: 0.82, x: 0.11, r: 0.05 };

/** The front wings: a flat mudguard over each front wheel, in stations along z (half width w about the wheel's x, underside y0, top y1). */
export const MOWER_FRONT_WING = [
  { z: 0.46, w: 0.17, y0: 0.33, y1: 0.355 },
  { z: 0.56, w: 0.19, y0: 0.37, y1: 0.395 },
  { z: 0.68, w: 0.19, y0: 0.37, y1: 0.395 },
  { z: 0.78, w: 0.15, y0: 0.31, y1: 0.335 },
];

/** The rear body: a tub under the seat between the rear wheels with a fender over each wheel; stations along z, x is the wheel's. */
export const MOWER_TUB = [
  { z: 0.1, w: 0.4, y0: 0.4, y1: 0.5 },
  { z: -0.1, w: 0.5, y0: 0.38, y1: 0.55 },
  { z: -0.4, w: 0.52, y0: 0.38, y1: 0.55 },
  { z: -0.7, w: 0.44, y0: 0.4, y1: 0.53 },
];
export const MOWER_REAR_WING = [
  { z: -0.2, w: 0.25, y0: 0.5, y1: 0.535 },
  { z: -0.35, w: 0.27, y0: 0.53, y1: 0.565 },
  { z: -0.5, w: 0.27, y0: 0.53, y1: 0.565 },
  { z: -0.66, w: 0.24, y0: 0.5, y1: 0.535 },
  { z: -0.76, w: 0.18, y0: 0.42, y1: 0.45 },
];

/** The seat: a moulded pan with a high back, over the tub. The cushion's top is at `top`; the rider sits `sit` back of its front edge. */
export const MOWER_SEAT = { z: -0.25, top: 0.64, width: 0.44, depth: 0.4, back: 0.3 };

/** The footplates either side of the bonnet's tail and the dash panel across the front of the seat. */
export const MOWER_FOOT = { x: 0.35, y: 0.3, z0: 0.14, z1: -0.1, w: 0.24 };
export const MOWER_DASH = { z: 0.1, y: 0.8, w: 0.3, h: 0.14, d: 0.1 };

/** The steering column: from the foot well up and back towards the rider, tilted this far from upright, and the wheel at its top. */
export const MOWER_STEER = { base: [0, 0.76, 0.04], tilt: 0.55, length: 0.27, wheelR: 0.17 };

/** The cutting deck: slung under the middle between the axles, with a chute on the right and anti-scalp wheels. */
export const MOWER_DECK = { z: 0.1, y0: 0.07, y1: 0.19, hw: 0.5, hd: 0.32, chuteX: -0.5 };

/** The grass box behind the seat on a frame, with its handle, and the chute that feeds it from the deck. */
export const MOWER_BOX = { z0: -0.8, z1: -1.16, y0: 0.4, y1: 0.78, w: 0.26 };

/** Where the rider sits and the camera, after the other vehicles (eyes 0.76 m above the seat's top, as on the tractor). */
export const MOWER_RIDER = { y: 0.64, z: -0.22, camera: 1.4 };

/** The height lever on the right of the seat, the blade lever on the left. */
export const MOWER_LEVERS = { height: [-0.3, 0.44, -0.08], blade: [0.3, 0.44, -0.05] };

/** The engine under the bonnet: a single-cylinder with its recoil starter at the front on the right, and a silencer at the back right. */
export const MOWER_ENGINE = { x: 0, y: 0.5, z: 0.42, cord: [-0.2, 0.48, 0.72], silencer: [-0.3, 0.34, -0.4] };
