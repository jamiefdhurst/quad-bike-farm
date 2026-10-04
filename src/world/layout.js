// Where everything sits on the farm. Kept in one place so the map can be
// rearranged or extended without hunting through the builders.

export const LAYOUT = {
  // Physics terrain and the detailed visual terrain cover this square.
  terrainSize: 200,
  terrainSegments: 200,
  // A coarser visual ring extends out to this size for the horizon.
  outerSize: 800,
  outerSegments: 200,

  // The field is bounded by hedges on this square.
  fieldHalf: 80,
  hedgeThickness: 1.8,
  hedgeHeight: 2.4,

  barn: { x: -64, z: 60, rotY: Math.PI / 2, scale: 1.3 },
  yard: { x: -54, z: 58, radius: 20 },
  paddock: { x: -66, z: 34, half: 7 },
  gate: { x: -30, side: 'south', width: 4.2 },

  // Closed loop of control points for the dirt track (x, z).
  trackPoints: [
    [-30, 40],
    [0, 52],
    [30, 47],
    [55, 30],
    [62, 0],
    [56, -34],
    [26, -55],
    [-8, -48],
    [-38, -58],
    [-60, -36],
    [-58, -6],
    [-48, 20],
  ],
  trackHalfWidth: 2.3,
  trackDepth: 0.14,
  // Puddles sit at these positions along the track (0..1 around the loop).
  puddles: [0.12, 0.31, 0.47, 0.66, 0.9],
  puddleRadius: 1.7,
  puddleDepth: 0.2,

  spawn: {
    player: { x: -47, z: 46, yaw: -2.68 }, // facing the quad
    // One spawn per quad, in the order of QUAD_SPECS: parked side by side in the yard.
    quads: [
      { x: -44, z: 52, yaw: Math.PI * 0.62 },
      { x: -42.6, z: 55.2, yaw: Math.PI * 0.62 },
    ],
  },
};
