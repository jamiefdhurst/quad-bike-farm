// The Series III's numbers (TODO 100): a Land Rover Series III 88-inch hard-top pick-up, after the photos in `.scratch/quads/series/` (a side
// on, three-quarters from the front, the tub and cab from behind, and the cab's inside). Every point is in the model's own frame (ground at
// y 0, +z forward, +x the driver's left; the driver sits on the right, at -x). Pure numbers and a few pure functions, no materials, so a test
// can check them. Worked from the side photo with the wheelbase (2.235 m) as the rule: the cab is further back than the old model had it
// (the door's front edge is 0.7 m behind the front axle, not 0.54, and the bonnet 1.2 m long), the wing tops are lower than the bonnet's
// ridge, the tub is short (1.04 m) with its sides level with the bottom of the door glass, and the whole truck is 3.64 m long, not 3.9.
// The old model was also built at 1.15 times its size; this one is the real size.

/** The back of the tub (the tailgate's outer face when it is shut) and the rear panel under it. */
export const SERIES_END = -1.78;

/** The front: the bumper's face, the grille panel's, and the wings. */
export const SERIES_FRONT = { bumper: 1.8, panel: 1.6, wingFace: 1.66 };

/** The wings: the flat top and where it stands, the body side's outer face, the inner wall against the engine bay, and where the wing stops at the scuttle. */
export const SERIES_WING = { top: 1.12, outer: 0.83, inner: 0.36, rear: 0.43, scuttle: 0.68, bottom: 0.7 };

/** The bonnet (loft stations: z, width, bottom, top): a gentle crown, narrower than the gap between the wings so a lip shows either side. */
export const SERIES_BONNET = [
  { z: 0.68, w: 0.76, y0: 0.98, y1: 1.2 },
  { z: 1.1, w: 0.76, y0: 0.98, y1: 1.22 },
  { z: 1.6, w: 0.74, y0: 0.98, y1: 1.17 },
];
export const SERIES_BONNET_E = 6;

/** The scuttle's top (behind the bonnet, in front of the screen) and the spare wheel lying on the bonnet. */
export const SERIES_SCUTTLE = { top: 1.2, from: 0.43, to: 0.68 };
export const SERIES_SPARE = { z: 1.03, y: 1.33 };

/** The windscreen's frame stands on the scuttle and rakes back; its top is where the roof's front edge meets it. */
export const SERIES_SCREEN = { baseY: 1.22, baseZ: 0.45, rake: 0.27, topY: 1.9, half: 0.82 };
const screenH = (SERIES_SCREEN.topY - SERIES_SCREEN.baseY) / Math.cos(SERIES_SCREEN.rake);
export const SERIES_SCREEN_H = screenH;
export const SERIES_SCREEN_TOP_Z = SERIES_SCREEN.baseZ - screenH * Math.sin(SERIES_SCREEN.rake);
/** Where the screen's raked edge is at height y (z), for the door glass that fits against it. */
export const screenZ = (y) => SERIES_SCREEN.baseZ - (y - SERIES_SCREEN.baseY) * Math.tan(SERIES_SCREEN.rake);

/** The doors: hinged on the front edge, swinging out `open` radians; their lower panel and the glass above it. */
export const SERIES_DOOR = { hinge: 0.4, rear: -0.5, y0: 0.62, y1: 1.26, glassTop: 1.82, open: 1.25, x: 0.83 };

/** The cab behind the doors: the rear panel, the roof (z from, z to, bottom, thickness). */
export const SERIES_CAB = { rear: -0.74, quarterRear: -0.72, top: 1.86 };
export const SERIES_ROOF = { z0: 0.22, z1: -0.78, y: 1.885, w: 1.68 };

/** The tub: its floor, the sides' top (level with the bottom of the door glass), the tailgate and its chains' pins. */
export const SERIES_TUB = { floor: 0.92, top: 1.27, front: SERIES_CAB.rear, side: 0.82 };
export const SERIES_GATE = { hingeY: SERIES_TUB.floor + 0.02, height: SERIES_TUB.top - SERIES_TUB.floor - 0.02, pinY: SERIES_TUB.top - 0.1 };

/** Where cargo stands in the tub (two rows of three between the wheel humps) and the box to look at to put something in. */
export const SERIES_TUB_SPOTS = [-0.25, 0.25].flatMap((x) => [-0.95, -1.25, -1.55].map((z) => ({ x, z })));
export const SERIES_TUB_PROXY = { w: 1.4, h: 0.5, d: 1.0, y: SERIES_TUB.floor + 0.27, z: (SERIES_CAB.rear + SERIES_END) / 2 };

/** The tow jaw under the tail, a fixed point: a little behind the tub's end. */
export const SERIES_HITCH = { x: 0, y: 0.56, z: SERIES_END - 0.06 };

/**
 * The dash, after the photos: a straight olive shelf the width of the cab (`deck`, from the bulkhead to its front edge, with a lip under
 * the edge), the instrument panel under it in front of the driver (angled by `tilt` about its centre (y, z), `w` wide), and a big open gap
 * under the rest down to the bulkhead, with the radio's housing hung under the shelf and a felt tray below it. The choke comes out of the
 * bulkhead at the driver's end and the hand throttle at the tray's, each at `knobY`, their faces at `knobZ`.
 */
export const SERIES_DASH = {
  y: 1.0, z: 0.285, tilt: 0.45, panel: { x0: -0.76, x1: -0.08, y0: 0.0, y1: 0.25 },
  deck: { y: 1.195, t: 0.03, z0: 0.31, z1: 0.46, half: 0.78 }, lip: { x0: -0.08, h: 0.07 },
  radio: { x: 0.28, w: 0.3, h: 0.1, y: 1.03, z0: 0.27, z1: 0.46 }, tray: { x0: 0.12, x1: 0.78, y: 0.84, z0: 0.3, z1: 0.45 },
  knobX: [-0.66, 0.6], knobY: 0.97, knobZ: 0.3,
};
