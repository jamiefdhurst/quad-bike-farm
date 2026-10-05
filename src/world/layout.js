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

  // The barn (world/barn.js): a hollow shed with its big doors open on the +x side, facing the yard. halfX and halfZ are the outside
  // half-sizes, wall the thickness, wallHeight the eaves and ridge the top of the roof along its length (x). The door is centred on z.
  barn: { x: -64, z: 60, halfX: 5.2, halfZ: 4.6, wall: 0.2, wallHeight: 4.2, ridge: 6.3, door: { halfWidth: 2.3, height: 3.2 } },
  // Straw bales inside the barn, [x, z, yaw] (she sits facing yaw, climbing up from behind it): somewhere dry to sit out of the rain.
  barnBaleSpots: [
    [-66.4, 57.3, Math.PI / 2],
    [-66.4, 62.7, Math.PI / 2],
  ],
  // The hayloft over the west end of the barn (world/loft.js): planks `floor` m above the barn floor out to `edgeX`, an open edge with a rail
  // and a gap at the ladder, a hay door in the east gable, a stack of hay to hide behind and a bale at the edge where a girl sits.
  loft: {
    floor: 2.6,
    edgeX: -64.6,
    rail: 1,
    ladder: { z: 63.6, footX: -63.85, gap: 0.7, width: 0.55 },
    hayDoor: { halfWidth: 0.8, sill: 3.5 },
    hay: { x: -67.9, z: 57.3, halfX: 1.1, halfZ: 1.1, height: 1.15 }, // you duck into the hay behind this
    hideSpot: { x: -68.2, z: 58.6 },
    seat: { id: 'loft0', kind: 'loft', x: -65.35, z: 60.1, yaw: Math.PI / 2, seat: 2.6 + 0.53 }, // sat on a bale at the edge, facing the doors
  },
  // The workbench along the north wall: where the toolbox sits (its height is `lift`).
  bench: { x: -62.3, z: 56.1, length: 3.2, depth: 0.7, height: 0.92 },
  // The bay painted on the barn floor in front of the bench: park a quad here to work on it at the bench (workshop/bench.js).
  bay: { x: -62.3, z: 58.5, halfX: 1.5, halfZ: 1.1, yaw: 0 },
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
  // Bogs: deep mud a quad can get stuck in (src/vehicle/bog.js). Two on the track
  // (at these positions round the loop) and one in the low ground of the field.
  bogs: [
    { track: 0.2, radius: 4.5 },
    { track: 0.58, radius: 4 },
    { x: -30, z: -38, radius: 6 },
  ],
  bogDepth: 0.12, // metres the ground dips

  // Straw bales dotted about the farm as [x, z, yaw]; any too near the track are left out (props.js). The girls ask to be taken to them.
  strawBaleSpots: [
    [12, 14, 0.4],
    [14.2, 15.4, 0.5],
    [10.5, 16.8, 1.9],
    [42, -18, 1.2],
    [-22, -24, 2.6],
    [62, -66, 0.2],
    [64, -63.4, 0.25],
    [-70, -68, 0.9],
    [-50, 66, 0.1],
  ],

  // Places the girls sit or shelter (npc/places.js). yaw is the way she faces; seat is how high up she sits (none: she stands).
  // Straw bales are added from strawBaleSpots by the game. Fence seats are on the paddock rail, facing in from outside it.
  restSpots: [
    { id: 'fenceNorth', kind: 'fence', x: -62.5, z: 27, yaw: 0, seat: 1.05 },
    { id: 'fenceSouth', kind: 'fence', x: -69.5, z: 41, yaw: Math.PI, seat: 1.05 },
    { id: 'fenceEast', kind: 'fence', x: -59, z: 30.5, yaw: -Math.PI / 2, seat: 1.05 },
    { id: 'fenceWest', kind: 'fence', x: -73, z: 37.5, yaw: Math.PI / 2, seat: 1.05 },
  ],
  baleSeat: 1.52, // how high her hips sit above the ground on a straw bale (the top is at 1.44, and her hips want to be a little above it)

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
  // The toolbox for tinkering with the quads, on the workbench in the barn.
  toolbox: { x: -62.9, z: 56.1, yaw: 0.1, lift: 0.92 }, // on the barn workbench
  oilBottle: { x: -59.3, z: 52.9, yaw: 0.3 }, // two-stroke oil, by the petrol tank
  premixCan: { x: -58.9, z: 53.5, yaw: 1.1 }, // the pre-mix can starts here
  jumpLeads: { x: -59.6, z: 48.6, yaw: 0.6 }, // jump leads on the ground by the hose
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
      // A second, shorter row for the days there are more than five vehicles.
      { x: -40.2, z: 52.4, yaw: Math.PI * 0.62 },
      { x: -38.8, z: 55.6, yaw: Math.PI * 0.62 },
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
