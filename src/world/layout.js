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

  // Petrol tank by the barn. The jerry can starts at one of these spots, picked at random.
  fuelTank: { x: -61, z: 52.3, yaw: Math.PI / 2 }, // labelled side facing the yard
  jerryCanSpots: [
    { x: -58.6, z: 51.6, yaw: 0.4, where: 'by the petrol tank' },
    { x: -57.6, z: 56.6, yaw: 1.2, where: 'by the barn doors' },
    { x: -58.4, z: 38.5, yaw: 2.1, where: 'by the paddock' },
    { x: -61.5, z: 67.8, yaw: -0.6, where: 'by the silage bales' },
    { x: -32.8, z: 77.6, yaw: 0.9, where: 'by the field gate' },
  ],
  jerryCanJitter: 0.8, // metres of extra random shift around the chosen spot
  // The toolbox for tinkering with the quads, on the ground at the far end of the petrol tank.
  toolbox: { x: -59.9, z: 54.4, yaw: 2.6 },
  hose: { x: -61.2, z: 49.4, yaw: 0.2 }, // hose reel at the south end of the petrol tank

  spawn: {
    player: { x: -47, z: 46, yaw: -2.68 }, // facing the quad
    // Parking slots in the yard. Each start the quads are shuffled between them and
    // nudged (quadJitter metres, quadYawJitter radians), and sometimes parked the
    // other way round (quadFlipChance).
    quadJitter: 2.5,
    quadYawJitter: 0.8,
    quadFlipChance: 0.25,
    quads: [
      { x: -44, z: 52, yaw: Math.PI * 0.62 },
      { x: -42.6, z: 55.2, yaw: Math.PI * 0.62 },
      { x: -41.2, z: 58.4, yaw: Math.PI * 0.62 },
      { x: -39.8, z: 61.6, yaw: Math.PI * 0.62 },
      { x: -38.4, z: 64.8, yaw: Math.PI * 0.62 },
    ],
    // Every quad but the one she's standing by has this chance of having been left
    // somewhere else on the farm instead, at any angle, within awayJitter metres of
    // one of these spots.
    awayChance: 0.4,
    awayJitter: 3,
    away: [
      { x: -27, z: 73, where: 'by the field gate' },
      { x: -53, z: 30, where: 'by the paddock' },
      { x: 18, z: 10, where: 'by the straw bales' },
      { x: 47, z: -12, where: 'out past the far bend' },
      { x: -46, z: -30, where: 'by the bottom of the track' },
      { x: 4, z: -32, where: 'in the middle of the field' },
      { x: -68, z: 8, where: 'by the west hedge' },
    ],
  },
};
