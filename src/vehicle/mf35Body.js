// The tractor's numbers (TODO 98): a Massey-Ferguson-35-style three-cylinder diesel, the Hartley 35, after the photos in
// `.scratch/quads/tractor/` (a studio three-quarter, two side-ons, the front, the rear, and three from the seat looking down on the
// dash). Every point is in the model's own frame (ground at y 0, +z forward, +x the driver's left). Pure numbers, no materials, so a
// test can check them. Where the photos disagreed with the old model: the wheels are smaller (a 28 inch rear rim, a 16 inch front), the
// whole machine lower (the bonnet's ridge at 1.19 m, the steering wheel's centre at 1.2), the instruments set straight into the
// red metal of a sloping cowl, and the headlamps in red cups on the bonnet's sides, not on stalks.

/** The wheels: a big lugged 11.2-28 behind and a narrow ribbed 5.50-16 in front. */
export const MF_WHEELS = {
  rearR: 0.585, frontR: 0.355, rearX: 0.62, frontX: 0.58, frontZ: 0.915, rearZ: -0.915,
  rearW: 0.3, frontW: 0.14, rearRim: 0.356, frontRim: 0.2,
};

/** The sheet metal of the front: the bonnet's stations (z, width, bottom, top), the nose shell, and the face's grille. */
export const MF_BONNET = [
  { z: 0.36, w: 0.46, y0: 0.86, y1: 1.18 },
  { z: 0.7, w: 0.46, y0: 0.86, y1: 1.2 },
  { z: 1.05, w: 0.45, y0: 0.86, y1: 1.2 },
  { z: 1.18, w: 0.44, y0: 0.86, y1: 1.18 },
];
export const MF_NOSE = [
  { z: 1.1, w: 0.46, y0: 0.58, y1: 1.16 },
  { z: 1.28, w: 0.44, y0: 0.56, y1: 1.15 },
  { z: 1.4, w: 0.36, y0: 0.62, y1: 1.08 },
];
export const MF_GRILLE = { z: 1.402, y: 0.83, w: 0.3, h: 0.4, slats: 11 };
/** A round headlamp in a red cup on each side of the nose. */
export const MF_LAMP = { x: 0.262, y: 0.93, z: 1.3, r: 0.07, cup: 0.085 };

/** The cowl behind the bonnet, which is the fuel tank and the instrument panel: stations (z, width, bottom, top). The top slopes to the driver. */
export const MF_PANEL = { tilt: 1.2, at: [0, 1.13, 0.2], span: 0.34 }; // the panel's plane, as the dash group's tilt, a point on it and its length along z
export const panelY = (z) => MF_PANEL.at[1] + Math.tan(Math.PI / 2 - MF_PANEL.tilt) * (z - MF_PANEL.at[2]);
export const MF_COWL = [
  { z: 0.4, w: 0.34, y0: 0.88, y1: panelY(0.4) - 0.006 },
  { z: 0.3, w: 0.44, y0: 0.88, y1: panelY(0.3) - 0.006 },
  { z: 0.1, w: 0.5, y0: 0.88, y1: panelY(0.1) - 0.006 },
  { z: -0.06, w: 0.5, y0: 0.9, y1: 1.07 },
  { z: -0.14, w: 0.44, y0: 0.92, y1: 1.02 },
];

/** The steering wheel's centre (a fixed point), the column's rake and the wheel's radius. The column's foot is on the cowl behind the panel. */
export const MF_STEERING = { column: [0, 1.08, -0.02], rake: 0.75, length: 0.164, r: 0.22 };

/** The seat, its pan and cushion, at the rider's anchor (a fixed point). */
export const MF_SEAT = { x: 0, y: 1.12, z: -0.8, r: 0.22 };

/** The mudguards: radius over the tyre, width, how far round they go. */
export const MF_GUARD = { r: 0.585 + 0.1, w: 0.37, from: -0.1, to: Math.PI + 0.2 };

/** The footplates either side of the transmission, the pedals and the gear levers. */
export const MF_FOOT = { y: 0.66, x0: 0.2, x1: 0.52, z0: -0.7, z1: -0.1 };
export const MF_PEDALS = { clutch: [0.3, 0.64, -0.36], brakes: [[-0.27, 0.64, -0.36], [-0.38, 0.64, -0.36]] };
export const MF_LEVERS = { gear: [-0.09, 0.93, -0.44], range: [0.09, 0.93, -0.42], length: 0.27 };

/** The upright exhaust, outside the bonnet on the left, and the air cleaner's red stack on the right. */
export const MF_EXHAUST = { x: 0.262, z: 0.62, manifold: [0.2, 0.9, 0.72], top: 1.92 };
export const MF_AIR = { x: -0.17, z: 0.5, base: 1.2, top: 1.38 };
