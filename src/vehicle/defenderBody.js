// The 200TDi's numbers (TODO 100, second half): a 1991 Defender 90 station wagon, the Moorland 90 Tdi, after the photos in
// `.scratch/quads/landrover200/` (a side on, a three-quarter from the front, the front, the rear three-quarter, the dash from the seat, the
// instrument cluster and the back bench). Every point is in the model's own frame (ground at y 0, +z forward, +x the driver's left; the driver
// sits on the right, at -x). Pure numbers and a few pure functions, no materials, so a test can check them. Worked from the side photo with
// the wheelbase (2.36 m) as the rule: 3.85 m long with the spare on the back door (3.88 real), a flat-sided square body with the wheel arches
// in black flares, a white roof cap with a sloping side and an alpine light along each side of it, a rear door hinged on the offside that
// carries the spare, and two rows of seats behind a raked screen. The model used to be built 1.15 times its size; this one is the real size.

export const DEF_WHEELBASE = 2.36;
export const DEF_TRACK = 1.486;

/** The rear door's outer face when shut, and the spare wheel's cover standing out of it. */
export const DEF_END = -1.82;
export const DEF_SPARE = { y: 1.1, depth: 0.21, r: 0.4 };

/** The front: the bumper's face, the body's front (grille panel and wing faces). */
export const DEF_FRONT = { bumper: 1.82, panel: 1.7, wingFace: 1.72 };

/** The wings: flat top, the body side's outer face, the inner wall at the engine bay, where it ends at the scuttle, and its bottom edge. */
export const DEF_WING = { top: 1.06, outer: 0.82, inner: 0.4, scuttle: 0.62, bottom: 0.62 };

/** The bonnet (loft stations: z, width, bottom, top): a raised ridge down the middle, the sides sloping to the wing tops. */
export const DEF_BONNET = [
  { z: 0.62, w: 0.84, y0: 0.98, y1: 1.19 },
  { z: 1.1, w: 0.84, y0: 0.98, y1: 1.2 },
  { z: 1.72, w: 0.82, y0: 0.98, y1: 1.15 },
];
export const DEF_BONNET_E = 3;

/** The scuttle between the bonnet and the screen (top, from, to) with its two vent flaps. */
export const DEF_SCUTTLE = { top: 1.2, from: 0.58, to: 0.66 };

/** The windscreen's frame stands on the scuttle and rakes back (more than the Series'); its top meets the roof's front edge. */
export const DEF_SCREEN = { baseY: 1.27, baseZ: 0.58, rake: 0.36, topY: 1.74, half: 0.8 };
const screenH = (DEF_SCREEN.topY - DEF_SCREEN.baseY) / Math.cos(DEF_SCREEN.rake);
export const DEF_SCREEN_H = screenH;
export const DEF_SCREEN_TOP_Z = DEF_SCREEN.baseZ - screenH * Math.sin(DEF_SCREEN.rake);
/** Where the screen's raked edge is at height y (z). */
export const defScreenZ = (y) => DEF_SCREEN.baseZ - (y - DEF_SCREEN.baseY) * Math.tan(DEF_SCREEN.rake);

/** The doors: hinged on the front edge, swinging out `open` radians; a lower panel with the glass above it. */
export const DEF_DOOR = { hinge: 0.52, rear: -0.4, y0: 0.6, y1: 1.27, glassTop: 1.7, open: 1.25, x: 0.82 };

/** The cab: the body side's top (under the roof), and the roof cap's sill and top. */
export const DEF_CAB = { top: 1.74, rear: DEF_END + 0.04 };
export const DEF_ROOF = { z0: DEF_SCREEN_TOP_Z + 0.02, z1: DEF_END - 0.04, y0: DEF_CAB.top, y1: 1.95, w: 1.68 };

/** The side windows behind the door: the long window over the rear bench, its frame and the posts (z, from the B pillar back). */
export const DEF_SIDE_WINDOW = { z0: -0.55, z1: -1.66, y0: 1.27, y1: 1.7 };

/** The rear door: hinged on the offside edge (x -0.5), swinging out behind; y bottom and top, the window in it and the body panels either side. */
export const DEF_BACK_DOOR = { hingeX: -0.5, width: 1.0, y0: 0.7, y1: 1.76, window: { y0: 1.24, y1: 1.72, w: 0.8 }, open: 1.75 };

/** The tow jaw under the rear crossmember, a fixed point. */
export const DEF_HITCH = { x: 0, y: 0.56, z: -2.02 };

/**
 * The dash, after the photos: a deep moulded slab the width of the cab (its top at `top`, from the screen's foot back to `z1`), a hooded
 * binnacle in front of the driver with the pod set in it (the pod's origin and tilt are the old fixed point), the centre stack with the rockers,
 * the radio and the heater controls, and the passenger's glovebox. A moulded fascia runs down from the shelf to the closeout panel at `foot`.
 */
export const DEF_DASH = {
  top: 1.15, z0: 0.56, z1: 0.18, half: 0.78,
  pod: { x: -0.42, y: 1.21, z: 0.48, tilt: 0.55 },
  stack: { x: 0.12, w: 0.34 },
  glove: { x0: 0.3, x1: 0.76 },
  foot: 0.76,
};
