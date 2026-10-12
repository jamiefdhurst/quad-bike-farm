// Where everything sits on the farm. Kept in one place so the map can be
// rearranged or extended without hunting through the builders.

export const LAYOUT = {
  // Physics terrain and the detailed visual terrain cover this square, centred: the farm, and the ground through the south gate.
  terrainSize: 420,
  terrainSegments: 420,
  // A coarser visual ring extends out to this size for the horizon.
  outerSize: 1000,
  outerSegments: 250,

  // The grass field (the track, the yard and the barn are in it) is bounded by hedges on this square.
  fieldHalf: 80,
  // The whole farm inside its outer hedges: the grass field and, to the east, two stubble fields either side of the farm road (world/fields.js).
  farm: { minX: -80, maxX: 200, minZ: -80, maxZ: 80 },
  // The tarmac farm road: from just inside the grass field's east gateway, straight east along `z` to a round hardstanding (`pad`) at the far end.
  // `hedgeTo` is where the hedges either side of it stop, `verge` the grass between the tarmac and those hedges, `gaps` the open gateways in them
  // into the stubble fields (x of each, `gapWidth` wide), north side then south. The tarmac runs on across the hardstanding to a big double
  // gate (`gate`, `width` m across) in the farm's east hedge, closed. The cattle grid (`grid`) fills the grass field's gateway: `length` m along
  // the road, bars `pitch` m apart, `margin` m of pit beyond the tarmac each side (world/cattleGrid.js). A steel gate shuts the whole
  // corridor, hedge to hedge, `gateOffset` m east of the grid's middle, so it has to be opened before you can cross.
  road: { z: 2, fromX: 78, toX: 199.5, halfWidth: 2.3, verge: 2.8, hedgeTo: 176, pad: { x: 188, radius: 8 }, gaps: { north: [112, 152], south: [128, 166] }, gapWidth: 6, gate: { width: 7 }, grid: { length: 3.2, pitch: 0.16, margin: 0.3, gateOffset: 2.4 } },
  // The public lane outside the farm's east hedge, running north to south past the big gate (world/traffic.js): its middle `x`, `halfWidth`,
  // and the `minZ` to `maxZ` that is drawn and driven on. Vehicles go by on it and visitors turn in at the gate.
  publicLane: { x: 206.4, halfWidth: 2.3, minZ: -205, maxZ: 205 },
  // How each stubble field looks and lies (world/fields.js, groundTexture.js, props.js). `rows` is the way it was drilled (rows along x or z,
  // half a metre apart), `tramlines` the metres between the sprayer's wheel lines, `ground` the straw's colour on the ground, `stalk` the
  // stalks' tip and base colours, `stalkHeight` their cut height range and `density` how thick they stand (1 is the wheat's). The north field,
  // barley, sits in a shallow hollow (`hollow`, an ellipse `depth` m deep in the middle) that holds the wet; the south, wheat, rises `rise` m
  // towards its far hedge.
  stubbleFields: {
    north: {
      crop: 'barley', rows: 'z', tramlines: 20, ground: '#a7a07c', stalk: [[0.72, 0.68, 0.52], [0.45, 0.42, 0.3]], stalkHeight: [0.05, 0.1], density: 1.6,
      hollow: { x: 140, z: -44, rx: 26, rz: 16, depth: 1.3 },
    },
    south: { crop: 'wheat', rows: 'x', tramlines: 24, ground: '#b3a06a', stalk: [[0.8, 0.66, 0.38], [0.5, 0.4, 0.22]], stalkHeight: [0.08, 0.16], density: 1, rise: 4 },
  },
  // The hill through the south gate (world/hill.js): a green lane sunk between tall hedges (`lane`: its bed `halfWidth` m either side of x,
  // falling to the valley floor and `sink` m deeper along its middle, the hedges `hedgeOff` m out on top of its banks and `hedgeHeight`
  // tall) runs south from the gate to `toZ`, where it opens into a rough hill pasture (`pasture`, hedged all round). Across the bottom runs
  // a shallow stream (`stream`: its line wanders `wander` m either side of z, `halfWidth` across, `depth` deep with `water` m of water in
  // it), crossed at the lane by a wider, shallower ford. The ground falls `valley` m from the gate to the stream, then climbs in banks, each
  // `rise` m over `width` m, centred `at` m up from the stream's far edge (wandering with x); towards the east end every bank spreads out to
  // `gentle` times as wide, the easy way up. A small wood on the west flank (`wood`), gorse on the banks and bracken in the rough. The
  // girls' drives stop at the `foot`.
  hill: {
    lane: { x: -30, toZ: 134, halfWidth: 2.1, sink: 1, hedgeOff: 4.6, hedgeHeight: 3.3 },
    pasture: { minX: -96, maxX: 34, minZ: 134, maxZ: 203 },
    stream: { z: 140, wander: 2.5, halfWidth: 1.6, depth: 0.75, water: 0.32, ford: { halfWidth: 3.4, depth: 0.42, reach: 6 } },
    valley: 2.5,
    banks: [
      { at: 6, rise: 1.2, width: 9 },
      { at: 16, rise: 5, width: 11 },
      { at: 25, rise: 1.5, width: 8 },
      { at: 35, rise: 5.5, width: 12 },
      { at: 44, rise: 2, width: 8 },
      { at: 51, rise: 3, width: 9 },
    ],
    gentle: { fromX: -12, toX: 24, factor: 2.4 },
    wood: { minX: -94, maxX: -66, minZ: 150, maxZ: 201 },
    // The two fields either side of the lane, through gateways in its hedges (world/hill.js, hillProps.js): each runs from the grass field's
    // south hedge to the pasture's north one, the lane's hedge on one side and `minX` / `maxX` (the pasture's own edge) on the other.
    // A gateway is `gate.z` along the lane and `gate.width` across, and the lane's bank is eased down to it over `ramp` m.
    // West, the wet meadow: a pond (an ellipse `rx` by `rz` m, `depth` m cut with `water` m standing in it), the muddy way in from the gateway to it
    // (`track`: points, as far as the water), trees (oaks) round the pond and reeds along its edge.
    // East, the sheep field: rolling ground (`knolls`: a hump `r` m across, `rise` m high), a drystone wall across it with a gap in it
    // (`wall`: along z, from x `from` to `to`, `height` high, the `gap` at x `at` and `half` wide), and thorn bushes in clumps (`thorns`).
    paddocks: {
      ramp: 10,
      west: {
        minX: -96,
        gate: { z: 104, width: 4.8 },
        pond: { x: -66, z: 110, rx: 11, rz: 8, depth: 1.1, water: 0.6 },
        track: [[-38, 104], [-45, 106], [-52, 106.5]],
        trees: [[-76, 107], [-74, 116], [-62, 120], [-55, 114], [-57, 101], [-68, 100], [-77, 98]],
      },
      east: {
        maxX: 34,
        gate: { z: 112, width: 4.8 },
        knolls: [{ x: 6, z: 103, r: 19, rise: 3 }, { x: 24, z: 123, r: 11, rise: 1.4 }],
        wall: { z: 92, from: -25.4, to: 34, height: 1, gap: { at: -4, half: 2.6 } },
        thorns: [[-8, 118], [-6, 120], [14, 96], [17, 94], [28, 108], [-14, 98], [30, 86]],
      },
    },
    // The electric fence across the pasture (world/electricFence.js): along x at `z` from `fromX` to `toX` (the energiser stands on the east hedge),
    // two strands of tape, with a gap `half` m either side of `gap.at` where the climb's line goes through.
    fence: { z: 176, fromX: -66, toX: 33.4, gap: { at: 14, half: 3.5 } },
    foot: 7, // metres past the stream's far edge: the bottom of the pasture, where the girls stop driving
    // The flat rock at the top of the pasture, on the level ground by the far hedge, looking back north over the farm (npc/flask.js): a girl sits on it
    // (yaw is the way she faces, `height` how high the top is) and the flask and mugs go on the ground beside it.
    viewpoint: { x: -22, z: 198.5, yaw: Math.PI, height: 0.45 },
    // The hill climb (npc/hillClimb.js): cones mark a gate at each of `points` ([x, z]: the start just past the stream, two on the way up, the
    // finish near the top), each `gateHalf` m either side of the point and across the way to the next (cones stand just outside). The line between them is yours; the points
    // run up the gentler ground in the east of the pasture, where the banks spread out, so the girls can drive it too.
    climb: { points: [[8, 152], [16, 168], [12, 182], [-2, 196]], gateHalf: 4.5 },
  },
  hedgeThickness: 1.8,
  hedgeHeight: 2.4,

  // Out in the east fields (world/outbuildings.js, outbuildingProps.js). The Dutch barn stands at the far end of the road, in the barley
  // field's corner by the hardstanding: open along its front (+z, facing the hardstanding) and its west end, clad at the back and the east
  // end, a curved tin roof on steel stanchions `bays` bays long, `eaves` m up to the eaves and `rise` m more to the top of the curve. Round
  // bales are stacked `layers` high in the east bays, leaving the west bay (`openBays`) clear to park in. The stone field shed is in the
  // barley field's far corner by the grass field, its doorway (`door`, `halfWidth` m either side of x) in its south wall. The muck heap
  // is in the wheat field by its first gateway, a long heap `halfX` by `halfZ` and `height` high, and the water trough by the barley
  // field's second gateway, along the hedge.
  dutchBarn: { x: 186, z: -14, halfX: 7.5, halfZ: 4.5, bays: 3, eaves: 5.4, rise: 1.6, overhang: 0.4, openBays: 1, layers: 3 },
  fieldShed: { x: 89, z: -73, halfX: 3.2, halfZ: 2.2, wall: 0.5, wallHeight: 2.3, ridge: 3.5, door: { halfWidth: 0.9, height: 1.9 } },
  muckHeap: { x: 118, z: 15.2, halfX: 3.6, halfZ: 2.3, height: 1.5 },
  trough: { x: 146.8, z: -5.5, length: 2.4, width: 0.65, height: 0.6 },

  // The barn (world/barn.js): a hollow shed with its big doors open on the +x side, facing the yard. halfX and halfZ are the outside
  // half-sizes, wall the thickness, wallHeight the eaves and ridge the top of the roof along its length (x). The door is centred on z.
  barn: { x: -64, z: 60, halfX: 5.2, halfZ: 4.6, wall: 0.2, wallHeight: 4.2, ridge: 6.3, door: { halfWidth: 2.3, height: 3.2 } },
  // The bell on its post just north of the barn's north door leaf, arm out towards the yard (world/bellBuild.js): ring it to call the girls back.
  bell: { x: -58.1, z: 65.5, yaw: 0 },
  // Straw bales inside the barn, [x, z, yaw] (she sits facing yaw, climbing up from behind it): somewhere dry to sit out of the rain.
  barnBaleSpots: [
    [-66.4, 57.3, Math.PI / 2],
    [-66.4, 62.7, Math.PI / 2],
  ],
  // The hayloft over the front of the barn, above the big doors (world/loft.js): planks `floor` m above the barn floor (clear of the doorway's
  // 3.2 m and its header) from the end wall back to `edgeX`, an open edge with a rail and a gap at the ladder, and a hay door in the end wall
  // at head height (from `sill` to `top` above the barn floor). The roof comes down at the sides, so you can only walk `band` m either side of
  // the centre line; hay is stacked outside that, the north stack (`hay`) being the one you hide in. A girl sits on a bale at the open edge.
  loft: {
    floor: 3.5,
    edgeX: -62.5,
    band: 1.9,
    rail: 1,
    ladder: { z: 61.3, footX: -63.4, gap: 0.7, width: 0.55 },
    hayDoor: { halfWidth: 0.8, sill: 4.1, top: 5.5 },
    hay: { x: -60.75, z: 56.85, halfX: 1.75, halfZ: 1.25, height: 1.3 },
    hideSpot: { x: -60.75, z: 56.85 },
    seat: { id: 'loft0', kind: 'loft', x: -62.0, z: 59.2, yaw: -Math.PI / 2, seat: 3.5 + 0.53 }, // sat on a bale at the edge, facing out over the barn
    strawDx: -0.4, // Jess tips her straw from this far towards the edge
  },
  // The workbench along the north wall: where the toolbox sits (its height is `lift`).
  // (4.2 long: the east end, with the vice, is where it was; the extra metre at the west end holds the battery charger.)
  bench: { x: -62.8, z: 56.1, length: 4.2, depth: 0.7, height: 0.92 },
  // The trickle charger at the west end of the workbench (workshop/chargerModel.js): faces the bay, the way you stand at the bench.
  benchCharger: { x: -64.5, z: 56.2 },
  // The clock and weather station (world/weatherStation.js) on the north wall past the door end of the bench, at eye height above the floor.
  weatherStation: { x: -59.85, y: 1.65 },
  // The freestanding clothes rack by the barn's south wall where the two jumpers hang (npc/jumpers.js): its bar runs along x at height `y`, `length`
  // long, so they hang edge-on to the wall. A girl stands at `stand`, at the end of the rack, to take one down or hang it up, going in and out by the doorway (`door`).
  jumperRail: { x: -61.2, z: 63.2, y: 1.7, length: 1.3, stand: { x: -60.0, z: 63.2 }, door: { in: [{ x: -56.5, z: 60 }, { x: -59.8, z: 60 }], out: { x: -56.5, z: 60 } } },
  // The bay painted on the barn floor in front of the bench: park a quad here to work on it at the bench (workshop/bench.js).
  bay: { x: -62.3, z: 58.5, halfX: 1.5, halfZ: 1.1, yaw: 0 },
  // Where the barn find stands under its tarp (vehicle/barnFind.js), at the back of the barn: clear of the bay, the bales and the ladder.
  rusty: { x: -66.7, z: 59.9, yaw: 0.15 },
  yard: { x: -54, z: 58, radius: 20 },
  // Where the girls' cars park (game.js): on the tarmac pad at the end of the farm road, in front of the Dutch barn's open side, side by side
  // and nosed in towards it. 5.2 m apart, so there's room for a girl to walk between them. The pad is flat, so nothing needs laying.
  cars: {
    fiesta: { x: 185.4, z: -2.4, yaw: Math.PI, where: 'by the Dutch barn' },
    corsa: { x: 190.6, z: -2.4, yaw: Math.PI, where: 'by the Dutch barn' },
  },
  paddock: { x: -66, z: 34, half: 7 },
  gate: { x: -30, side: 'south', width: 4.2, open: true }, // swung back into the field and tied, onto the lane to the hill

  // The jump (world/jumpRamp.js): a plank ramp in the flat middle of the field. x, z is the foot of the slope, yaw the way you ride up it (the
  // same sense as a quad's yaw), then it rises `height` m over `length` m to a square lip, `width` wide. The ground for the 22 m run-up
  // behind it and the landing ahead is level to within about 40 cm (a test checks), clear of the track, the bogs and the puddles.
  jumpRamp: { x: 16, z: -8, yaw: 2.36, length: 7, width: 3.2, height: 1.2 },

  // The drag strip (world/dragStrip.js, npc/drag.js): a level gravel straight in the middle of the field, inside the track (that is as long as the room between the track, the bogs, the bales and the ramp allows). x, z is the start line's
  // middle, yaw the way you ride along it (the same sense as a quad's yaw), `length` metres to the finish line and `runOff` more beyond it to pull
  // up, `width` across. The ground is levelled under it (terrainHeight.js); a test checks it is clear of the track, the bogs, the bales and the ramp.
  dragStrip: { x: -30, z: 19, yaw: Math.PI / 2 - 0.2, length: 56, runOff: 8, width: 10 },

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
    [173.2, -13.4, 1.4], // two out of the stack, beside the Dutch barn
    [174.6, -16.2, 1.1],
  ],

  // Places the girls sit or shelter (npc/places.js). yaw is the way she faces; seat is how high up she sits (none: she stands).
  // Straw bales are added from strawBaleSpots by the game. Fence seats are on the paddock rail, facing in from outside it.
  restSpots: [
    { id: 'fenceNorth', kind: 'fence', x: -62.5, z: 27, yaw: 0, seat: 1.05 },
    { id: 'fenceSouth', kind: 'fence', x: -69.5, z: 41, yaw: Math.PI, seat: 1.05 },
    { id: 'fenceEast', kind: 'fence', x: -59, z: 30.5, yaw: -Math.PI / 2, seat: 1.05 },
    { id: 'fenceWest', kind: 'fence', x: -73, z: 37.5, yaw: Math.PI / 2, seat: 1.05 },
    // Out of the rain in the east fields. Under the Dutch barn, sat on the two round bales on the ground at the front, facing out, going in between
    // them (`door`) to climb up from behind. In the field shed, stood just inside the doorway, going in through it.
    { id: 'dutchBarn0', kind: 'shelter', x: 184.8, z: -11.4, yaw: 0, seat: 1.52, door: { x: 186.7, z: -12.6 } },
    { id: 'dutchBarn1', kind: 'shelter', x: 188.6, z: -11.4, yaw: 0, seat: 1.52, door: { x: 186.7, z: -12.6 } },
    { id: 'fieldShed0', kind: 'shelter', x: 88.1, z: -72.2, yaw: 0.15, door: { x: 89, z: -69.4 } },
    { id: 'fieldShed1', kind: 'shelter', x: 90.4, z: -72.9, yaw: -0.3, door: { x: 89, z: -69.4 } },
  ],
  baleSeat: 1.52, // how high her hips sit above the ground on a straw bale (the top is at 1.44, and her hips want to be a little above it)

  // Petrol tank by the barn. Each of the three jerry cans (petrol, pre-mix, diesel) starts at a different one of these spots, picked at random.
  fuelTank: { x: -61, z: 52.3, yaw: Math.PI / 2 }, // labelled side facing the yard
  jerryCanSpots: [
    { x: -58.6, z: 51.6, yaw: 0.4, where: 'by the petrol tank' },
    { x: -57.6, z: 56.6, yaw: 1.2, where: 'by the barn doors' },
    { x: -58.4, z: 38.5, yaw: 2.1, where: 'by the paddock' },
    { x: -61.5, z: 67.8, yaw: -0.6, where: 'by the silage bales' },
    { x: -35.2, z: 77.4, yaw: 0.9, where: 'by the field gate' }, // clear of the gate, swung open into the field
    { x: 177.2, z: -8.6, yaw: 2.4, where: 'by the Dutch barn' }, // by its front corner stanchion, under the eaves
    { x: 92.9, z: -69.6, yaw: -0.5, where: 'by the field shed' }, // against its wall, beside the doorway
  ],
  // The tractor, UTV and Land Rover have no spot of their own: each game they're dealt a parking slot or an open spot like the quads (spawn, below).
  trailer: { x: -42.5, z: 72.5, yaw: 2.7 }, // the bale trailer's axle, in the open towards the field gate with its drawbar to the yard, 7 m clear of the north hedge (it was in it). The tractor is wherever the game put it
  tipTrailer: { x: -49, z: 33.5, yaw: 0.2 }, // the little tipping trailer's axle, in the clear by the paddock with its tongue towards the yard, for a quad to back up to
  dieselBowser: { x: -61, z: 45.6, yaw: Math.PI / 2 }, // red diesel for the tractor, south of the petrol tank (and the hose)
  jerryCanJitter: 0.8, // metres of extra random shift around the chosen spot
  // The toolbox for tinkering with the quads, on the workbench in the barn.
  toolbox: { x: -62.9, z: 56.1, yaw: 0.1, lift: 0.92 }, // on the barn workbench
  benchOil: { x: -62.05, z: 56.1, yaw: 0.2 }, // the oil bottle's place on the workbench
  oilBottle: { x: -59.3, z: 52.9, yaw: 0.3 }, // two-stroke oil, by the petrol tank
  plugAdditive: { x: -59.75, z: 53.2, yaw: -0.3 }, // plug-saver, a little way from the oil bottle
  benchLeads: { x: -63.55, z: 56.1, yaw: 0.4 }, // where the jump leads lie on the workbench, at the start and when you put them back (the toolbox's place is `toolbox`)
  hose: { x: -61.2, z: 49.4, yaw: 0.2 }, // hose reel at the south end of the petrol tank

  spawn: {
    player: { x: -47, z: 46, yaw: -2.68 }, // facing the quad
    // Parking slots in the yard. Each start the quads are shuffled between them and
    // nudged (quadJitter metres, quadYawJitter radians), and sometimes parked the
    // other way round (quadFlipChance). No more than `yardMax` start in the yard (hers
    // among them) and never the tractor, UTV or a Land Rover: the rest are out on the farm.
    quadJitter: 1.4,
    quadYawJitter: 0.8,
    quadFlipChance: 0.25,
    yardMax: 4,
    // Spread round the yard, 8 to 12 m apart, so a girl can get one out without a jam. Each is clear of the trailers, the tank, the bowser,
    // the barn and its doorway, the bales and the track by its jitter (spawnKeepOut, a test checks).
    quads: [
      { x: -46, z: 48, yaw: Math.PI * 0.62 },
      { x: -34, z: 52, yaw: Math.PI * 0.62 },
      { x: -38, z: 62, yaw: Math.PI * 0.62 },
      { x: -52, z: 42, yaw: Math.PI * 0.62 },
      { x: -24, z: 58, yaw: Math.PI * 0.62 },
      { x: -44, z: 56, yaw: Math.PI * 0.62 },
      { x: -30, z: 68, yaw: Math.PI * 0.62 },
      { x: -53, z: 72, yaw: Math.PI * 0.62 },
    ],
    // Every quad but the one she's standing by has this chance of having been left
    // somewhere else on the farm instead, at any angle, within awayJitter metres of
    // one of these spots. The tractor, UTV and Land Rovers always are.
    awayChance: 0.4,
    awayJitter: 3,
    away: [
      { x: -27, z: 73, where: 'by the field gate' },
      { x: -14, z: 64, where: 'out from the yard' },
      { x: 8, z: 70, where: 'by the south hedge' },
      { x: 28, z: 14, where: 'by the straw bales' },
      { x: 47, z: -12, where: 'out past the far bend' },
      { x: 70, z: 40, where: 'by the east hedge' },
      { x: -46, z: -30, where: 'by the bottom of the track' },
      { x: 4, z: -32, where: 'in the middle of the field' },
      { x: 30, z: -70, where: 'by the north hedge' },
      { x: -68, z: -50, where: 'in the far corner' },
      { x: -72, z: -22, where: 'down the west hedge' },
      { x: -68, z: 8, where: 'by the west hedge' },
    // Out in the east fields. A spot's own `jitter` (metres) is for a tight one: the Dutch barn's open bay. `tight` keeps the tractor, UTV and Land Rover out.
      { x: 181, z: -13.6, jitter: 0.8, tight: true, where: 'in the Dutch barn' },
      { x: 104, z: 2, jitter: 1, tight: true, where: 'along the road' },
      { x: 112, z: -40, where: 'out in the barley field' },
      { x: 150, z: 44, where: 'out in the wheat field' },
      { x: 95, z: -65, jitter: 2, where: 'by the field shed' },
    ],
  },
};

/**
 * Where (x, z) is on the drag strip: `along` metres from the start line (negative behind it) and `across` metres from its middle line, positive to the
 * side the same way the girls' race lanes count it (to the left of the way you ride, seen from above with z towards you).
 */
export function stripFrame(strip, x, z) {
  const dx = x - strip.x;
  const dz = z - strip.z;
  const sin = Math.sin(strip.yaw);
  const cos = Math.cos(strip.yaw);
  return { along: dx * sin + dz * cos, across: -dx * cos + dz * sin };
}

/** The point `along` and `across` the drag strip, the inverse of stripFrame. */
export function stripPoint(strip, along, across) {
  const sin = Math.sin(strip.yaw);
  const cos = Math.cos(strip.yaw);
  return { x: strip.x + along * sin - across * cos, z: strip.z + along * cos + across * sin };
}
