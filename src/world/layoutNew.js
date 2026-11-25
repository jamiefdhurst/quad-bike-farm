// The farm (docs/farm-plan.md), the one everybody plays since #692. It starts from the base numbers in layout.js (`RAW`) and replaces what the plan moves
// (`REPLACED`) or has no use for (`REMOVED`); `NOT_MOVED_YET` is empty, with a test, so no piece reaches a player at the old numbers. Each of the plan's
// pieces came in behind `?layout=2` first, one issue at a time (#681 onward), and docs/decisions/world.md says how each was decided.
//
// Positions here are written in the plan's own metres, as the map in docs/farm-plan.svg has them (x east, z south, from its north-west
// corner), so they can be checked against it by eye. The game's (0, 0) is the middle of the yard, so a game position is the plan position
// less `PLAN_ORIGIN`. Pure: no Three.js.

import { resolveLayout, at } from './layoutAnchors.js';
import { MOOR_FEATURES_PLAN, moorLayout } from './moor.js';
import { resolveWithBarnLocal } from './layoutBarn.js';
import { barnRaw } from './barnPlan.js';
import { STONE_TRACKS_PLAN, FARM_BRIDGE_PLAN, BOUNDARY_TRACK_PLAN, HEADLAND_WIDTH, boundaryTrackPoints, trackGateways, headlandRing, densify } from './farmTracks.js';
import { JOB_FIELDS, fieldWorkPlaces } from './jobFields.js';
import { createBrook } from './brook.js';
import { intersectPolygons, polygonArea, polygonBounds, clockwise, edgeBetween, insetPolygon, pointInPolygon, distanceToEdges, polygonEdges, pointAlong } from './polygons.js';

/** Where the game's (0, 0) is on the plan: the middle of the yard. */
export const PLAN_ORIGIN = [520, 365];

/** A plan position as a game position. */
export const fromPlan = ([x, z]) => [x - PLAN_ORIGIN[0], z - PLAN_ORIGIN[1]];

/** The rectangle of ground with physics, drawn in tiles (#665): the farm, Back Lane round it, the far side of the lane and the Moor up to its ridge wall, in plan metres. */
const GROUND_PLAN = { minX: -345, maxX: 1350, minZ: -70, maxZ: 970 };

/** The farm's outer boundary, clockwise from the north-west, plan metres. The east side is straight along the lane. */
export const OUTLINE_PLAN = [
  [50, 70], [120, 42], [215, 38], [310, 18], [412, 30], [500, 12], [600, 24], [720, 26], [800, 14], [885, 20], [885, 806], [800, 826], [700, 810],
  [600, 840], [500, 824], [420, 846], [330, 828], [230, 852], [140, 830], [60, 842], [34, 760], [46, 660], [28, 560], [42, 470], [30, 365],
  [44, 300], [30, 215], [42, 150],
];

/** The corners the fields share, plan metres. Those outside the outline are cut back to it. */
export const CORNERS_PLAN = {
  o0: [-10, -10], o1: [215, -10], o2: [412, -10], o3: [720, -10], o4: [885, -10],
  m0: [-10, 215], m1: [200, 225], m2: [412, 235], m3: [618, 228], m4: [720, 195], m5: [885, 200],
  s0: [618, 335], e1: [885, 335], s1: [618, 355], e2: [885, 355],
  q0: [-10, 365], q1: [195, 370],
  p1: [195, 440], pe: [204.2, 440], p2: [412, 440], p3: [618, 440],
  r0: [-10, 565], r1: [195, 565], re: [204.2, 565], r2: [420, 545], r3: [640, 525], e3: [885, 520],
  l4: [640, 660], e4: [885, 650],
  b0: [-10, 880], b2: [420, 880], b3: [640, 880], b4: [885, 880],
};

/**
 * Every field: its key (the plan map's id for the place, which the game's code names it by), the plan's name for it (an example: #814 deals
 * each farm its own), its kind (fieldPlan.js `FIELD_KINDS`) and its corners, clockwise. The order is the one a point is looked for in them.
 */
export const FIELDS_PLAN = [
  { name: 'wood', label: 'Hollow Wood', kind: 'wood', corners: 'o0 o1 m1 m0' },
  { name: 'north', label: 'North Field', kind: 'arable', corners: 'o1 o2 m2 m1' },
  { name: 'top', label: 'Top Field', kind: 'arable', corners: 'o2 o3 m4 m3 m2' },
  { name: 'pit', label: 'The Old Pit', kind: 'rough', corners: 'o3 o4 m5 m4' },
  { name: 'wet', label: 'Wet Meadow', kind: 'pasture', corners: 'm0 m1 q1 q0' },
  { name: 'home', label: 'Home Ground', kind: 'grass', corners: 'm1 m2 p2 pe p1 q1' },
  { name: 'farmstead', label: 'The farmstead', kind: 'yard', corners: 'm2 m3 s0 s1 p3 p2' },
  { name: 'lanefield', label: 'Lane Field', kind: 'arable', corners: 'm3 m4 m5 e1 s0' },
  { name: 'drive', label: 'The drive', kind: 'lane', corners: 's0 e1 e2 s1' },
  { name: 'longpiece', label: 'Long Piece', kind: 'arable', corners: 's1 e2 e3 r3 p3' },
  { name: 'far', label: 'Far Field', kind: 'arable', corners: 'q0 q1 p1 r1 r0' },
  { name: 'lane', label: 'The green lane', kind: 'lane', corners: 'p1 pe re r1' },
  { name: 'sheep', label: 'Sheep Field', kind: 'pasture', corners: 'pe p2 r2 re' },
  { name: 'hay', label: 'Hay Meadow', kind: 'hay', corners: 'p2 p3 r3 r2' },
  { name: 'hill', label: 'Hill Pasture', kind: 'rough', corners: 'r0 r1 re r2 b2 b0' },
  { name: 'brook', label: 'Brook Meadow', kind: 'pasture', corners: 'r2 r3 l4 b3 b2' },
  { name: 'ley', label: 'Low Ley', kind: 'ley', corners: 'r3 e3 e4 l4' },
  { name: 'south', label: 'South Field', kind: 'arable', corners: 'l4 e4 b4 b3' },
];

/** The fields walled in drystone (#696 sets every edge's real kind); every other edge is a hedge for now. */
const WALLED = ['sheep', 'hill'];

/** The field fenced in post and wire (#685): every side of the Old Pit, whatever is beyond it. */
const FENCED = ['pit'];

/** The lines railed, post and rail (#682): Home Ground's side to the yard, where the paddock's fences were. */
const RAILED = ['farmstead|home'];

/** The lines with nothing on them (#568): the drive is open to the fields either side and to the yard, so the crops come up to its verge. */
const OPEN_LINES = ['drive|lanefield', 'drive|longpiece', 'drive|farmstead', 'hill|lane'];

/**
 * The gateways, plan metres: from field `a` to `b` (or 'out', off the farm), at the point on the line between them nearest `at`, `half` m
 * either side. A point nearer a corner than its half and a metre is moved along to clear it. Open gaps for now; gates by kind are #696's.
 */
export const GATEWAYS_PLAN = [
  { a: 'wood', b: 'wet', at: [130, 215], why: 'the wood\'s gate (the wood touches Home Ground only at a corner)' },
  { a: 'wood', b: 'out', at: [38, 130], why: 'the wood\'s gate onto Back Lane on its west side (#686 lays the lane)' },
  { a: 'home', b: 'farmstead', at: [412, 368], why: 'Home Ground from the yard' },
  { a: 'home', b: 'lane', at: [199.6, 440], half: 2.45, gate: true, id: 'south', why: 'the head of the green lane, which runs down between Far Field and the sheep field (#684)' },
  { a: 'home', b: 'sheep', at: [240, 440], why: 'Home Ground to the sheep field, on the plan\'s map' },
  { a: 'farmstead', b: 'hay', at: [420, 440], why: 'the stone track south out of the yard into Hay Meadow' },
  { a: 'hay', b: 'sheep', at: [413, 455], why: 'the sheep field from the stone track just inside Hay Meadow (it touches the farmstead only at a corner)' },
  { a: 'far', b: 'lane', at: [195, 500], why: 'Far Field\'s gate onto the green lane (#684, #674\'s review)' },
  { a: 'lane', b: 'sheep', at: [204.2, 500], why: 'the sheep field\'s gate onto the green lane (#684, #674\'s review)' },
  { a: 'lane', b: 'hill', at: [199.6, 565], half: 3.5, why: 'the ford: the green lane opens into the hill pasture over the stream (#684)' },
  { a: 'hay', b: 'brook', at: [420, 545], why: 'the stone track on south to the river' },
  { a: 'farmstead', b: 'top', at: [546, 232], why: 'Top Field from the stone track north' },
  { a: 'top', b: 'pit', at: [720, 150], half: 2.45, gate: true, id: 'quarry', why: 'the farm gate into the pit\'s field from the stone track north: the way in, tied open (#685)' },
  { a: 'pit', b: 'out', at: [885, 110], half: 2.45, gate: true, id: 'pitlane', shut: true, why: 'the lane gate the lorries used: shut, chained and solid, no way through (#685)' },
  { a: 'north', b: 'out', at: [380, 30], why: 'North Field onto Back Lane (#686)' },
  { a: 'far', b: 'out', at: [40, 440], why: 'Far Field onto Back Lane on its west side (#686)' },
  { a: 'hill', b: 'out', at: [36, 640], why: 'Hill Pasture onto Back Lane, short of the moor gate (#686)' },
  { a: 'hill', b: 'out', at: [38, 700], half: 2.45, gate: true, id: 'moor', why: 'the moor gate: Hill Pasture onto Back Lane and the common beyond, where the flock goes up in summer (#713)' },
  { a: 'home', b: 'north', at: [306, 230], why: 'North Field from Home Ground: its only other way in is Back Lane' },
  { a: 'home', b: 'wet', at: [197, 296], why: 'Wet Meadow from Home Ground, level with the pond (#684)' },
  { a: 'drive', b: 'out', at: [885, 345], half: 4.5, why: 'the drive onto the lane: the cattle grid fills it (#568)' },
  { a: 'drive', b: 'out', at: [885, 351.8], half: 2.05, gate: true, id: 'bypass', shut: true, why: 'the field gate beside the grid, for stock and horses (#568)' },
  { a: 'farmstead', b: 'drive', at: [618, 345], half: 4, why: 'the drive into the yard' },
  { a: 'drive', b: 'lanefield', at: [700, 335], why: 'Lane Field from the drive' },
  { a: 'drive', b: 'longpiece', at: [700, 355], why: 'Long Piece from the drive' },
  { a: 'brook', b: 'hill', at: [420, 640], why: 'Hill Pasture from the stone track, past the river' },
  { a: 'brook', b: 'ley', at: [640, 580], why: 'Low Ley from Brook Meadow, north of the river' },
  { a: 'brook', b: 'south', at: [640, 720], why: 'South Field from the end of the stone track' },
  // Where the river crosses a boundary: a gap wide enough for the water and its banks, shut with a river gate (hung boards, #565). No way through for you or the girls.
  { a: 'hill', b: 'brook', at: [420, 572], half: 7, shut: true, river: true, why: 'the river leaves Hill Pasture under its wall (the stream\'s end, the farm bridge\'s place)' },
  { a: 'brook', b: 'ley', at: [640, 606], half: 8, shut: true, river: true, why: 'the river leaves Brook Meadow for Low Ley' },
  { a: 'ley', b: 'out', at: [885, 647], half: 3.5, shut: true, river: true, why: 'the brook leaves the farm for the lane\'s verge' },
];

/**
 * The drive (#568), plan metres: the road from the lane at (905, 345) west to the yard at (612, 345), 6 m of tarmac with 7 m of verge each side
 * (the drive's field is 20 m across), open to Lane Field and Long Piece. The cattle grid is at the lane end, inside the boundary at x 885, with a
 * five-bar field gate beside it on the south side for stock and horses (the big gate onto the lane is gone). `signSpot` is on the north verge by
 * the grid, where #570's farm sign stands; `reflectors` are the white posts at the lane end; `potholes` hold water; `washes` are where the mud and
 * straw from the fields' gateways lie on the tarmac. `patches` is how many squares of repair the tarmac has.
 */
export const DRIVE_PLAN = {
  z: 345, fromX: 612, toX: 905, halfWidth: 3, verge: 7,
  bellmouth: 12, // m: the radius the drive's two corners at the lane are rounded with, so a 16.5 m lorry can turn in off the lane (#816, `LORRY_PLAN`)
  grid: { x: 881.7, length: 3.6, pitch: 0.16, margin: 0.3 },
  signSpot: [877, 338.2],
  reflectors: [[889, 341.4], [889, 348.6], [897, 341.4], [897, 348.6]],
  potholes: [[798, 343.6, 0.55], [736, 346.4, 0.4], [716, 343.2, 0.6], [851, 347.2, 0.35]], // (the one at 716 was at 668, on the drag run, #616)
  washes: [[703.5, 341.6], [703.5, 348.4], [790, 341.8]], // the two by the field gateways at 700 are carried a little east of the run's end, #616
  // The drag races (#616, npc/drag.js): the 56 m run from the start line at `fromX` east along the middle of the tarmac, then the run-off, `width` m across
  // (the cones stand at the verges, `width / 2 + 0.4` out). The yard's gateway is at x 618 and the field gateways at 700, so the girls' staging point
  // 11 m behind the line (621) is on the drive and the run-off ends (696) short of the gateways' aprons (697.5).
  dragStrip: { fromX: 632, length: 56, runOff: 8, width: 10 },
  patches: 70,
};

/**
 * The lane (#568, #687), plan metres: from the A-road's junction in the north (1291, -30) east to west along z -31, round the bend through (936, -26) and
 * (905, -2) (where Back Lane leaves it), then straight at plan x 905 south for the length of the ground. Two lanes 5.2 m wide with a worn dashed centre
 * line, not single track (Jamie, 19 November 2026: it has to read as a real road, and differ from Back Lane). The control points down the straight are
 * 80 m apart so the curve through them does not overshoot. The lane ends at z 970, where the ground does, and runs on into the far landscape (#708).
 */
export const LANE_PLAN = {
  x: 905, halfWidth: 2.6, minZ: -70, maxZ: 970, ridden: [245, 445],
  north: [[1291, -30], [1210, -31], [1130, -31], [1050, -31], [990, -30], [936, -26], [905, -2], [905, 40]],
  southStep: 80, // m between control points on the straight, from z 40 to maxZ
};

/**
 * The A-road (#687), plan metres: one main road down the valley east of the village, from the map's north edge to its south, curving. Two lanes with a
 * white centre line and edge lines, 7.3 m of carriageway (the width of a rural single carriageway, wider again than the lane's 5.2), verges and the
 * neighbour's hedge along its west side. It runs 150 m past the plan's map edge at each end (z -70 and 970, #1025), so what leaves by it goes out of sight 190 m from a junction, not 41. The lane joins it at (1291, -30) and the village street at (1292, 718), so those are control points.
 * `drawn` is what the far landscape (#708) carries on from.
 */
export const A_ROAD_PLAN = {
  points: [[1330, -215], [1314, -140], [1300, -70], [1291, -30], [1290, 60], [1292, 150], [1294, 250], [1298, 400], [1296, 560], [1292, 718], [1300, 800], [1305, 880], [1296, 970], [1289, 1045], [1281, 1120]],
  halfWidth: 3.65, verge: 2.4, camber: 0.05, dash: [4, 8], eyes: 18,
  layBy: { z: 640, length: 30, width: 3.2, side: 1 }, // on the east side (side 1 reads east on a road that runs south), with the bus stop flag at its south end
};

/** How far from the A-road's middle a side road's give-way line is, in metres: clear of its 3.65 m half width (#1022), so a line across it is crossed before the A-road's tarmac. */
export const GIVE_WAY_AT = 5.2;

/**
 * The village street's end at the A-road (#687): a stub of the street from the junction at (1292, 718), 60 m west, with a give-way line and the signs.
 * #688 runs the village street across from the lane to the stub's start (`VILLAGE_PLAN.street`), so the stub is the street's last 60 m, drawn as a road of the network.
 */
export const STREET_STUB_PLAN = { to: [1292, 718], from: [1232, 717], halfWidth: 3 };

/**
 * The ladder stile in the ridge wall turns you round too (#713): a line across the way up to it, 1.2 m short of the wall at the stile and 3 m either side of it (so walking along the wall's face to the ladder crosses it too), so climbing it is
 * crossing the line. It is free of any road: you are put back along your way (world/turnRound.js).
 */
const MOOR_STILE_LINE = { id: 'moor-stile', free: true, reach: 3, short: 1.2 };

/**
 * `TURN_ROUND_PLAN` with the moor's stile lines laid across the stile, in game metres: the line across the way up to it and, at each end of it, a short line from
 * its end to the wall, so walking to the wall 4 m off and along its face to the ladder crosses one of them (#1035). All three are `moor-stile`.
 */
function turnRoundLayout() {
  const [x, z] = fromPlan(MOOR_FEATURES_PLAN.stile.at);
  const { reach, short, ...line } = MOOR_STILE_LINE;
  const home = { x: 1, z: 0 };
  const across = { ...line, a: { x: x + short, z: z - reach }, b: { x: x + short, z: z + reach }, home };
  const caps = [-1, 1].map((side) => ({ ...line, a: { x: x + short, z: z + side * reach }, b: { x: x - 0.3, z: z + side * reach }, home }));
  return { lines: [...TURN_ROUND_PLAN.lines, across, ...caps] };
}

/**
 * The junctions (#687), plan metres: where a minor road gives way to the A-road, with the fingerpost's place names and miles, and the lane's southern
 * fingerpost (at Back Lane's south junction, pointing on down the lane). `side` is the side of the minor road the signs stand on, looking out to the A-road.
 */
export const JUNCTIONS_PLAN = [
  { id: 'north', road: 'lane', end: 'start', onto: 'aRoad', lines: ['Kelby 4'] },
  { id: 'village', road: 'streetEnd', end: 'end', onto: 'aRoad', lines: ['Ashwell 3'] },
];

/** The fingerpost at Back Lane's south junction, pointing on down the lane (#687). */
export const SOUTH_FINGERPOST_PLAN = { at: [911, 880], lines: ['Haddon 6', 'Back Lane'] };

/**
 * Where you are turned round (#687): `s` metres from the `end` of a road, across it. The give-way line of each junction, and the lane's southern line at plan
 * z 955 (just before the built ground gives way to far landscape, and `wide`, across the whole ground, so there is no way round it). How far back you are
 * put is the tunable `back` (world/turnRound.js).
 */
export const TURN_ROUND_PLAN = {
  lines: [
    { id: 'lane-north', road: 'lane', end: 'start', s: GIVE_WAY_AT },
    { id: 'village', road: 'streetEnd', end: 'end', s: GIVE_WAY_AT },
    { id: 'lane-south', road: 'lane', end: 'end', s: 15, wide: true }, // z 955 on a lane that ends at 970
  ],
};

/**
 * What makes the lane a lane other people use (#687), plan metres: the pair of cottages on its east side, two more field gateways in her hedge, the grit
 * bins at the bends (one at the northern bend, one at the junction), the postbox on its post and the bin stand at the end of our drive (the drive meets
 * the lane at z 345, and these stand on its north verge on the lane's west side). The lane's west side at x 905 is the farm boundary at x 885.
 */
export const LANE_FITTINGS_PLAN = {
  cottages: { rect: [920, 418, 944, 442], yaw: Math.PI / 2, gardenDepth: 12 }, // a pair, semi-detached, their fronts to the lane
  gateways: [{ at: [912, 205], width: 4.5 }, { at: [912, 459.5], width: 4.5 }], // the second is the small farm's track mouth (#819)
  gritBins: [[906, -5]], // by the bend, on its outside, beside Back Lane's mouth (at (905, -2) it stood on the edge of Back Lane's tarmac, #1187); the junctions have their own
  postbox: [900.8, 338], // west verge, north of the drive's mouth
  binStand: [900.8, 353], // and south of it
};

/**
 * The neighbour's yard (#569), plan metres: a walled yard across the lane, her gateway in its west wall at plan z 292 (our drive meets the lane at
 * 345, so the two make no crossroads) and a short track out to the lane at x 905, her farmhouse at its south with its door facing in, her barn at the
 * north-west with its big door in the east wall facing the yard (the plan's footprint, 26 by 17 m), three of her vehicles parked about clear of the
 * way in, and where she stands by her door. Her ground is levelled to the lie at x 946, just before her gate (the land falls 3 m across the yard, so the far side is built up), and eases out over 16 m so no bank is steeper than 25 degrees.
 * The plan's parlour, collecting yard, bulk tank room and slurry store are the dairy's (the second half of #569).
 */
export const NEIGHBOUR_PLAN = {
  anchor: [997.5, 292.5], // the yard's middle, in plan metres: everything below is an offset from it (x east, z south), so the yard moves as one (#972)
  track: { halfWidth: 2, from: [905, 292] }, // from the lane, plan metres: it runs to her gate
  yard: { minX: -47.5, maxX: 47.5, minZ: -42.5, maxZ: 42.5, wall: 0.5, wallHeight: 1.3 }, // plan (950 to 1045, 250 to 335)
  gateway: { x: -47.5, z: -0.5, width: 8, side: 'west' }, // plan z 292
  // Her farmhouse (#910): an upland house, a long low main range of 15 m with its front to the yard and a door off to one side, a lower later wing at the west end, a catslide
  // over a scullery at the back with its own door, and a small walled garden in front of the door with its gate in line with it.
  house: {
    x: 13.5, z: 25.5, halfX: 7.5, halfZ: 4.2, wallHeight: 5, ridge: 7.9, door: { x: 11, z: 21.3, halfWidth: 0.55, height: 2.05 }, // plan (1011, 318)
    wing: { x: 3.5, z: 25.5, halfX: 2.5, halfZ: 3.4, wallHeight: 3.8, ridge: 5.9 },
    leanTo: { x: 16, z: 31.3, halfX: 3.6, halfZ: 1.6, wallHeight: 2.8, backDoor: { x: 14.5, z: 32.9, halfWidth: 0.45, height: 2 } },
    garden: { minX: 7.4, maxX: 14.6, minZ: 16.4, maxZ: 21.3, gate: { x: 11, z: 16.4, halfWidth: 0.6 } },
  },
  barn: { x: -26.5, z: -26, halfX: 13, halfZ: 8.5, wallHeight: 4.8, ridge: 7.6, door: { x: -13.5, z: -26, halfWidth: 2.6, height: 3.6 } }, // plan (971, 266.5)
  // Her Tor, the one she drives to the farm (traffic.js `VISITOR_KINDS.neighbour`), her UTV and her old tractor: none in the way in or the tanker's way.
  parked: [
    { kind: 'tor', x: 30.5, z: 13.5, yaw: 1.2, colour: 0x5d6d4a, reg: 'K412 PBW' }, // plan (1028, 306)
    { kind: 'utv', x: 40.5, z: 29.5, yaw: 0.35, colour: 0x7a2a22 }, // plan (1038, 322)
    { kind: 'tractor', x: -10.5, z: 9.5, yaw: 3.0, colour: 0xb02a20 }, // plan (987, 302)
    // Her farm quad by the collecting yard's gap, along its fence on the side the herd comes in, and the tipper beside the barn's door, its drawbar to the south on its jockey
    // wheel (#925): both outside the 3 m ways to the barn door and the gap (tests/neighbourYard.test.js). `x`, `z` are the vehicle's middle, not its origin.
    { kind: 'quad', x: 0.4, z: -18.6, yaw: 0.12, colour: 0x4c6a3c }, // plan (998, 274)
    { kind: 'tipTrailer', x: -10.6, z: -20.8, yaw: -0.08, colour: 0x8a9092 }, // plan (987, 272)
    // Her newer tractor with the front loader (#926), parked south of the barn with its bucket down, nose to the east: clear of the feed passage, the bale feeder and the ways across the yard (tests/neighbourYard.test.js).
    { kind: 'loaderTractor', x: -20, z: -11, yaw: 1.45, colour: 0x23548f }, // plan (977.5, 281.5)
  ],
  stand: { x: 11.3, z: 18.1, yaw: Math.PI }, // plan (1008.8, 310.6)
  // The dairy, at the map's places: the parlour (plan 1000 to 1030, 256 to 269) with the collecting yard in front of it (1000 to 1030, 271 to 289, open on its
  // west side for the herd), the bulk tank's room at (1036, 262) against the parlour's east end with its door to the south, where the tanker comes in
  // through her gateway, across the yard and up the strip between the collecting yard and the east wall, and the slurry store, round, at (970, 318).
  parlour: { x: 17.5, z: -30, halfX: 15, halfZ: 6.5, wallHeight: 3.3, ridge: 4.5 },
  collecting: { minX: 2.5, maxX: 32.5, minZ: -21.5, maxZ: -3.5, gap: { z: -12.5, width: 6 } },
  tankRoom: { x: 38.5, z: -30.5, halfX: 2.5, halfZ: 1.75, wallHeight: 2.9 },
  slurry: { x: -27.5, z: 25.5, r: 9, height: 3.6 },
  floor: { at: { x: -51.5, z: 0 }, reach: 16 }, // levelled to the lie at plan (946, 292.5)
  // What stands about the yard (#911; neighbourYard.js `YARD_KINDS` gives each its size), as offsets from her anchor: the feed passage along the barn's south wall, the
  // west strip between the barn and the wall, the gateway's churn and name board, the door's kennel, the muck heap at the south wall and the light's pole.
  // The way from the gateway to the barn door, the collecting yard's gap and the tank room's strip is kept clear (tests/neighbourYard.test.js).
  furniture: [
    { kind: 'silageTrough', x: -27.5, z: -17.08 }, // plan (970, 275.5)
    { kind: 'mineralTub', x: -20.2, z: -16.95 },
    { kind: 'waterTrough', x: -17.4, z: -17.15 },
    { kind: 'hoseHook', x: -15.6, z: -17.3 },
    { kind: 'yardTap', x: -14.7, z: -17.2 },
    { kind: 'balefeeder', x: -27.5, z: -11.2 },
    { kind: 'wrappedBale', x: -34.8, z: -12.6 },
    { kind: 'wrappedBale', x: -33.2, z: -12.5 },
    { kind: 'leaningTools', x: -13.1, z: -30.4 },
    { kind: 'barrow', x: -12.3, z: -32.6 },
    { kind: 'scrapeBlade', x: -8, z: -37.5 },
    { kind: 'henCoop', x: -43.5, z: -38 },
    { kind: 'palletStack', x: -44.8, z: -31.8 },
    { kind: 'ibcTank', x: -44.5, z: -27.5 },
    { kind: 'limeBags', x: -45.5, z: -22.3 },
    { kind: 'feedSacks', x: -43.6, z: -22.5 },
    { kind: 'tyreStack', x: -44.6, z: -18.5 },
    { kind: 'catOnWall', x: -47.25, z: -10 },
    { kind: 'churnStand', x: -45.5, z: -7 },
    { kind: 'nameBoard', x: -45.4, z: 6.8 },
    { kind: 'kennel', x: 19.4, z: 19.2 },
    { kind: 'dogBowl', x: 18.2, z: 18.9 },
    { kind: 'bootsAtDoor', x: 14.1, z: 33.15 }, // on the scullery's back door step,
    { kind: 'muckHeap', x: -6, z: 38.8 },
    { kind: 'yardLight', x: 1.5, z: 0.5 },
  ],
  slab: { minX: -47, maxX: 47, minZ: -42, maxZ: 21.3 },
};

/**
 * The neighbour's land (#569), plan metres: her fields east of the lane as the plan's map has them, a block from the lane's hedge (x 912) to x 1290
 * and from z -18 to 560 (#687 cut it back from the map's -60 and 1290), cut by hedges at z 150, x 1110, x 1230 (below z 150) and z 420. Drawn at far-ground detail: each field's own grass tone in
 * the ground and the outer ring, her hedges as plain strips (hedgeFar.js) with a collider each, no leaves, and her 22 dairy cows on the plan's map
 * as scenery in the two north fields. `lines` run along x (`x`: a hedge at that x from `from` to `to` in z) or along z (`z`), with `gaps` open
 * where a gate or a way through will be (the lane's hedge has her track's and her north field gate's). The north field gate is in the lane's hedge
 * at plan z 130 (the map ends the herd's walk, `M912 286 V130 H930`, there: #714 walks them). The village's field (z 560 on) is #688's.
 */
export const NEIGHBOUR_LAND_PLAN = {
  fields: [
    { name: 'northWest', rect: [912, -18, 1110, 150], tone: [0.4, 0.53, 0.25] },
    { name: 'northEast', rect: [1110, -18, 1282, 150], tone: [0.36, 0.48, 0.22] },
    { name: 'yardField', rect: [912, 150, 1110, 420], tone: [0.44, 0.56, 0.27] },
    { name: 'middle', rect: [1110, 150, 1230, 560], tone: [0.38, 0.5, 0.24] },
    { name: 'east', rect: [1230, 150, 1282, 560], tone: [0.52, 0.54, 0.28] },
    { name: 'south', rect: [912, 420, 1110, 560], tone: [0.42, 0.54, 0.26] },
  ],
  // #687 cut her land back where the roads go through it: the north edge is z -18 (the lane runs along z -31 and bends down at x 905 to 936, so the
  // hedges start where the bend is past: x 912 from z 8, the north hedge from x 950), the east hedge is at x 1282, clear of the A-road's verge (its
  // edge is at 1287 at the nearest), and the cottages' plot (plan 912 to 960, 405 to 450) is not hedged across: the lane hedge and the z 420 hedge leave it.
  lines: [
    { x: 912, from: 8, to: 560, gaps: [[289, 295], [127.5, 132.5], [202.75, 207.25], [405, 555]] }, // open from z 405 to 555: the village's approach (#819), the small farm's track and the lane's houses with their own hedges
    { x: 1110, from: -18, to: 560, gaps: [[98, 103], [290, 295]] },
    { x: 1230, from: 150, to: 560, gaps: [[300, 305]] },
    { x: 1282, from: -18, to: 560, gaps: [] },
    { z: -18, from: 950, to: 1282, gaps: [] },
    { z: 150, from: 912, to: 1282, gaps: [[1000, 1005], [1170, 1175]] },
    { z: 420, from: 962, to: 1110, gaps: [[1000, 1005]] },
    { z: 560, from: 912, to: 1282, gaps: [] },
  ],
  northGate: { at: [912, 130], width: 5 },
  hedge: { width: 1.6, height: 2.2 },
  // The map's own 22 dairy cows, from its drawing code.
  cows: [
    [1073.5, 124.1], [1123.4, 126.9], [1052.1, 117.8], [1143.6, 111.5], [1052.2, 11.8], [1024.7, 24.5], [1056.3, 71.2], [1179.1, 122.2], [1084.3, 10.1],
    [1078.3, 43], [1170.8, 18.1], [1097.6, 114.5], [1076.1, 67.1], [1093.9, 99.6], [1131.3, 17.9], [1116.6, 63.5], [1015.3, 46.7], [1052, 120.1],
    [1066.3, 72], [1001.4, 19.3], [1126.4, 101.3], [1192, 12.8],
  ],
};

/** How wide a gateway is either side of its middle when it doesn't say: a five-metre mouth, a field gate and its posts. */
const GATEWAY_HALF = 2.5;

/**
 * The lie of the land (#813): metres above the valley floor at each plan x, the heights the farm's rolling rides on (landform.js joins them
 * smoothly, level at both ends). The land falls east to the valley floor, where the river, the village and the A-road run (flat from the A-road
 * out); it rises west through the farm and the hill pasture and over Back Lane to the moor's ridge wall, 100 m above the floor, where the crest
 * levels off and #708 carries the far land on. About 3 degrees across the farm and up to 10 on the moor: nothing near the hill's banks (38).
 */
export const LANDFORM_PLAN = [[-330, 100], [-150, 84], [30, 56], [300, 40], [520, 26], [885, 7], [1000, 0]];

/**
 * How each arable field's stubble looks until the crop year (#697): today's barley and wheat in turn, the barley's hollow (26 by 16 m, 1.3 m
 * deep) in North Field. Plan metres for the hollow. The wheat's rise was today's landform's; the land's lie is `LANDFORM_PLAN`'s now.
 */
const BARLEY = { crop: 'barley', rows: 'z', tramlines: 20, ground: '#a7a07c', stalk: [[0.72, 0.68, 0.52], [0.45, 0.42, 0.3]], stalkHeight: [0.05, 0.1], density: 1.6 };
const WHEAT = { crop: 'wheat', rows: 'x', tramlines: 24, ground: '#b3a06a', stalk: [[0.8, 0.66, 0.38], [0.5, 0.4, 0.22]], stalkHeight: [0.08, 0.16], density: 1 };
/** How many clumps of straw the six stubble fields share (today's two share 60,000: props.js `buildStubble`). */
const STUBBLE_CLUMPS = 150000;
const NORTH_HOLLOW_PLAN = { at: [300, 120], rx: 26, rz: 16, depth: 1.3 };

/** Every place in today's layout still at today's numbers on the new farm, by key: none (#692). A test keeps it empty. */
export const NOT_MOVED_YET = {};

/** What today's layout had that the new farm has no use for: the grass field's limit and rectangle of farm (the fields are polygons now) and the water trough. */
export const REMOVED = ['fieldHalf', 'farm', 'trough'];

/** What in today's layout is a setting rather than a place, so it never moves. */
export const SETTINGS = [
  'outerMargin', 'outerSize', 'budgetSpots', 'hedgeThickness', 'hedgeHeight', 'trackHalfWidth', 'trackName', 'trackDepth', 'puddleRadius',
  'puddleDepth', 'bogDepth', 'baleSeat', 'jerryCanJitter',
];

/** What the new farm puts in place of today's, by key. */
export const REPLACED = [
  'ground', 'stubbleFields', 'road', 'publicLane', 'roads', 'anchors.neighbour', 'neighbourFarm', 'barnLocal',
  // The farmstead (#682): the barn and the yard with all that stands in them, the stackyard and its Dutch barn, the cars, the muck heap, and Home Ground's play things.
  'anchors.barn', 'anchors.yard', 'anchors.bonfire', 'barn', 'bell', 'silage', 'barnBaleSpots', 'clock', 'desk', 'bench', 'benchCharger', 'generator', 'weatherStation',
  'jumperRail', 'helmetHooks', 'bay', 'bay2', 'moneyTin', 'shed', 'jack', 'axleStands', 'rusty', 'plover', 'yard', 'cars', 'paddock', 'lawns', 'farmAnimals',
  'fuelTank', 'jerryCanSpots', 'trailer', 'tipTrailer', 'sprayer', 'harrows', 'dieselBowser', 'toolbox', 'benchOil', 'oilBottle', 'coolantBottle',
  'antiGelBottle', 'plugAdditive', 'benchLeads', 'benchPack', 'hose', 'dutchBarn', 'jumpRamp', 'lineUp', 'coneCourse', 'trackPoints', 'puddles', 'bogs',
  'bonfire', 'brushwood', 'strawBaleSpots', 'restSpots', 'spawn', 'muckHeap', 'fieldShed',
  // The drag races run along the drive (#616).
  'dragStrip',
  // The jobs' fields (#691): each is its field's polygon, with the bounds the job's grid is laid over.
  'hayMeadow', 'sprayField', 'harrowField',
  // Hollow Wood and its log yard (#683).
  'woods', 'anchors.logYard', 'logYard',
  // The hill side (#684): the hill with its lane, stream, pasture, sheep field and meadow, the shepherd's hut's anchor and the gate at the lane's head.
  'hill', 'anchors.hut', 'gate',
  // The Old Pit (#685): its field, gates and the anchor the pit is dealt about.
  'quarry', 'anchors.pit',
  // Nether Thornby (#688): across the lane, its street east to the A-road.
  'anchors.village', 'village',
  // The places the girls name where they are (#690).
  'namedSpots',
];

const cornersOf = (f) => f.corners.split(' ').map((k) => {
  if (!CORNERS_PLAN[k]) throw new Error(`field ${f.name}: no corner ${k}`);
  return CORNERS_PLAN[k];
});

const TOL = 1e-6;
const same = (p, q, tol = 1e-4) => Math.abs(p[0] - q[0]) <= tol && Math.abs(p[1] - q[1]) <= tol;

/**
 * The fields cut back to the outline, plan metres: { name, label, kind, points }. Throws if a field is cut in two or falls outside.
 */
export function clippedFields(outline = OUTLINE_PLAN, fields = FIELDS_PLAN) {
  return fields.map((f) => {
    const parts = intersectPolygons(outline, cornersOf(f), TOL);
    if (parts.length !== 1) throw new Error(`field ${f.name}: ${parts.length} pieces inside the outline, not one`);
    return { name: f.name, label: f.label, kind: f.kind, points: parts[0] };
  });
}

/**
 * The lines between the fields and round the outside, from the fields' own sides: a side two fields share is one line between them, a side
 * only one has is on the outline (`b` is 'out'). Each line is a run of points with `a`, `b` and its kind. Sides are split where another
 * field's corner lies along them first, so a side drawn as one on one field and two on the other still pairs up.
 */
export function boundariesOf(fields) {
  const corners = fields.flatMap((f) => f.points);
  const sides = [];
  for (const f of fields) {
    const pts = f.points;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const e = edgeBetween(a[0], a[1], b[0], b[1]);
      const cuts = corners
        .map((q) => ({ q, s: (q[0] - a[0]) * e.dx + (q[1] - a[1]) * e.dz, off: Math.abs((q[0] - a[0]) * e.dz - (q[1] - a[1]) * e.dx) }))
        .filter(({ s, off }) => off < 1e-4 && s > 1e-4 && s < e.length - 1e-4)
        .sort((u, v) => u.s - v.s);
      let from = a;
      for (const { q } of cuts) {
        if (!same(from, q)) sides.push({ from, to: q, field: f.name });
        from = q;
      }
      if (!same(from, b)) sides.push({ from, to: b, field: f.name });
    }
  }
  // Pair each side with the other field's, which runs the other way.
  const lines = [];
  const used = new Set();
  sides.forEach((s, i) => {
    if (used.has(i)) return;
    used.add(i);
    const j = sides.findIndex((t, k) => !used.has(k) && same(t.from, s.to) && same(t.to, s.from));
    if (j >= 0) used.add(j);
    lines.push({ a: s.field, b: j >= 0 ? sides[j].field : 'out', from: s.from, to: s.to });
  });
  // Join the pieces of one pair's line that meet end to end into one run of points.
  const runs = [];
  const left = [...lines];
  while (left.length) {
    const first = left.shift();
    const run = { a: first.a, b: first.b, points: [first.from, first.to] };
    for (let grew = true; grew; ) {
      grew = false;
      for (let k = 0; k < left.length; k++) {
        const l = left[k];
        if (!((l.a === run.a && l.b === run.b) || (l.a === run.b && l.b === run.a))) continue;
        const [p, q] = l.a === run.a ? [l.from, l.to] : [l.to, l.from];
        if (same(p, run.points[run.points.length - 1])) run.points.push(q);
        else if (same(q, run.points[0])) run.points.unshift(p);
        else continue;
        left.splice(k, 1);
        grew = true;
        break;
      }
    }
    const open = OPEN_LINES.includes([run.a, run.b].sort().join('|'));
    const fenced = FENCED.includes(run.a) || FENCED.includes(run.b);
    runs.push({ ...run, kind: open ? 'none' : RAILED.includes([run.a, run.b].sort().join('|')) ? 'rail' : fenced ? 'fence' : WALLED.includes(run.a) || WALLED.includes(run.b) ? 'wall' : 'hedge' });
  }
  return runs;
}

/** Metres along a run of points to the point on it nearest p, and how far p is from it. */
function alongRun(points, p) {
  let best = { s: 0, d: Infinity, length: 0 };
  let from = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const e = edgeBetween(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
    const t = Math.max(0, Math.min(e.length, (p[0] - e.x1) * e.dx + (p[1] - e.z1) * e.dz));
    const d = Math.hypot(p[0] - (e.x1 + e.dx * t), p[1] - (e.z1 + e.dz * t));
    if (d < best.d) best = { s: from + t, d };
    from += e.length;
  }
  return { ...best, length: from };
}

/** Each gateway on the line between its two fields: { a, b, boundary (its index), at (metres along it), half }. Throws if they don't meet. */
export function placeGateways(runs, gateways = GATEWAYS_PLAN) {
  return gateways.map((g) => {
    let best = null;
    runs.forEach((r, i) => {
      if (!((r.a === g.a && r.b === g.b) || (r.a === g.b && r.b === g.a))) return;
      const hit = alongRun(r.points, g.at);
      if (!best || hit.d < best.d) best = { ...hit, boundary: i };
    });
    if (!best) throw new Error(`gateway ${g.a} to ${g.b}: they share no line`);
    const half = g.half ?? GATEWAY_HALF;
    const at = Math.min(Math.max(best.s, half + 1), best.length - half - 1);
    return { a: g.a, b: g.b, boundary: best.boundary, at, half, moved: Math.abs(at - best.s) + best.d, ...(g.gate && { gate: true, id: g.id, shut: !!g.shut }), ...(!g.gate && g.shut && { shut: true }) };
  });
}

// The grass track round the boundary (#689) crosses every line between two fields once: each crossing is a gateway, an open gap, added here so the
// plan's own list above stays the places the plan names.
GATEWAYS_PLAN.push(...trackGateways(boundaryTrackPoints(OUTLINE_PLAN), boundariesOf(clippedFields()), GATEWAYS_PLAN));

const movePoints = (pts) => pts.map(fromPlan);

/** The landform as the game reads it: game x and the height above the yard's ground, so the yard keeps the height it has today. */
export function landformPoints(plan = LANDFORM_PLAN) {
  const yard = plan.find(([x]) => x === PLAN_ORIGIN[0]);
  if (!yard) throw new Error('the landform has no height at the yard');
  return plan.map(([x, h]) => [x - PLAN_ORIGIN[0], h - yard[1]]);
}

/**
 * The fields whose names stay as the plan has them (#814): Hollow Wood and the Old Pit are places the game already names, Home Ground is the girls'
 * and your own, and the farmstead and the drive are the yard and the road. Every other field is dealt a name per farm (fieldNames.js).
 */
export const FIXED_NAMES = ['wood', 'pit', 'home', 'farmstead', 'drive', 'lane'];

/** What the plan knows about a field that its shape and height don't say (fieldNames.js `FIELD_TRAITS`), by the field's key. */
const HAND_TRAITS = {
  water: ['wet', 'brook', 'ley'], // beside the pond, the river or its meadow
  pond: ['wet'],
  wood: ['north', 'wet'], // touching Hollow Wood's side
  pit: ['top'], // touching the gravel pit's field
  lane: ['lanefield', 'longpiece', 'north'], // beside the drive or Back Lane
  sheep: ['sheep'], // the sheep field itself
};

/** The land's height above the valley floor at plan x (the straight line between `LANDFORM_PLAN`'s heights: near enough for what stands on it). */
export function landformHeightAt(x, plan = LANDFORM_PLAN) {
  if (x <= plan[0][0]) return plan[0][1];
  for (let i = 1; i < plan.length; i++) {
    if (x <= plan[i][0]) {
      const [x0, h0] = plan[i - 1];
      const [x1, h1] = plan[i];
      return h0 + ((h1 - h0) * (x - x0)) / (x1 - x0);
    }
  }
  return plan[plan.length - 1][1];
}

/** What a field is for the name it can be given: how it lies, how it is shaped and what it is beside, in plan metres (fieldNames.js `FIELD_TRAITS`). */
export function traitsOf(f) {
  const b = polygonBounds(f.points);
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  const away = Math.hypot(cx - PLAN_ORIGIN[0], cz - PLAN_ORIGIN[1]);
  const h = landformHeightAt(cx);
  const along = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / Math.min(b.maxX - b.minX, b.maxZ - b.minZ);
  const traits = [];
  if (cz < 300) traits.push('north');
  if (cz > 500) traits.push('south');
  if (away > 300) traits.push('far');
  if (away < 180) traits.push('near');
  if (along >= 1.5) traits.push('long');
  if (h > 42) traits.push('high');
  if (h < 20) traits.push('low');
  for (const [t, keys] of Object.entries(HAND_TRAITS)) if (keys.includes(f.name)) traits.push(t);
  return traits;
}

/**
 * The stewardship strips on the arable, placed now (their look through the year is #697), in plan metres: `margin` m of grass round each arable
 * field (the headlands), a wildflower strip along Long Piece beside the drive, a beetle bank across the middle of Top Field and a skylark plot in
 * each of Top Field and Far Field. Every other measure is the issue's, or the usual one for the kind of strip.
 */
export const STEWARDSHIP_PLAN = {
  margin: 6,
  wildflower: { field: 'longpiece', beside: 'drive', width: 6 }, // just inside the headland, the drive's side of the field, 6 m wide (a usual strip)
  beetleBank: { field: 'top', width: 2, height: 0.4 }, // across the field's long way, headland to headland; 2 m wide and 40 cm high is a usual bank
  skylarkPlots: [{ field: 'top', clearOfBank: 25 }, { field: 'far' }], // about 4 m square, in the field's roomiest place
  plotSize: 4,
};

/** The point inside `points` furthest from its sides that `ok` allows, found on a grid: where there is most room. */
function roomiestPoint(points, ok = () => true) {
  const edges = polygonEdges(points);
  const b = polygonBounds(points);
  const step = Math.max(1, Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 80);
  let best = null;
  for (let x = b.minX + step / 2; x < b.maxX; x += step) {
    for (let z = b.minZ + step / 2; z < b.maxZ; z += step) {
      if (!pointInPolygon(points, x, z, 0, edges) || !ok(x, z)) continue;
      const d = distanceToEdges(edges, x, z);
      if (!best || d > best.d) best = { x, z, d };
    }
  }
  return best && [best.x, best.z];
}

/** The lowest and highest z the polygon has at x, where a vertical line crosses its sides. */
function acrossAt(points, x) {
  const zs = [];
  points.forEach((a, i) => {
    const c = points[(i + 1) % points.length];
    if ((a[0] <= x && x <= c[0]) || (c[0] <= x && x <= a[0])) zs.push(a[0] === c[0] ? a[1] : a[1] + ((c[1] - a[1]) * (x - a[0])) / (c[0] - a[0]));
  });
  return [Math.min(...zs), Math.max(...zs)];
}

/**
 * A field's corners with the tiny sides folded away: a side shorter than `min` metres (where the outline cuts a field's corner, 3 m long) becomes one
 * point in its middle, so the margin's inner line doesn't fold back on itself there.
 */
function withoutShortSides(points, min) {
  let pts = points;
  for (let i = 0; i < pts.length && pts.length > 3; ) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) >= min) {
      i++;
      continue;
    }
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    pts = pts.filter((_, k) => k !== i && k !== (i + 1) % pts.length);
    pts.splice(Math.min(i, pts.length), 0, mid);
    i = 0;
  }
  return pts;
}

/** The strips as the plan has them, from the fields (clippedFields) and the lines between them (boundariesOf): plan metres. */
export function stewardshipPlan(fields = clippedFields(), runs = boundariesOf(fields), S = STEWARDSHIP_PLAN) {
  const byName = Object.fromEntries(fields.map((f) => [f.name, f]));
  const margins = fields.filter((f) => f.kind === 'arable').map((f) => ({ field: f.name, width: S.margin, outer: f.points, inner: insetPolygon(clockwise(withoutShortSides(f.points, S.margin * 2)), S.margin) }));
  const inner = (name) => margins.find((m) => m.field === name).inner;

  // The wildflower strip: along the line Long Piece shares with the drive, S.width m wide, the headland's width in from it and kept off the headland at each end.
  const w = S.wildflower;
  const run = runs.find((r) => (r.a === w.field && r.b === w.beside) || (r.a === w.beside && r.b === w.field));
  if (!run) throw new Error(`${w.field} and ${w.beside} share no line for the wildflower strip`);
  const [p, q] = [run.points[0], run.points[run.points.length - 1]];
  const e = edgeBetween(p[0], p[1], q[0], q[1]);
  const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const inward = pointInPolygon(byName[w.field].points, mid[0] - e.dz * 0.5, mid[1] + e.dx * 0.5) ? 1 : -1;
  const nx = -e.dz * inward;
  const nz = e.dx * inward;
  const endGap = S.margin + 1;
  const at = (s, d) => [p[0] + e.dx * s + nx * d, p[1] + e.dz * s + nz * d];
  const wildflower = { field: w.field, width: w.width, points: clockwise([at(endGap, S.margin + 0.5), at(e.length - endGap, S.margin + 0.5), at(e.length - endGap, S.margin + 0.5 + w.width), at(endGap, S.margin + 0.5 + w.width)]) };

  // The beetle bank: a line across Top Field's long way (north to south here) through the middle, from one headland to the other.
  const bb = S.beetleBank;
  const top = polygonBounds(inner(bb.field));
  const bankX = (top.minX + top.maxX) / 2;
  const [z0, z1] = acrossAt(inner(bb.field), bankX);
  const beetleBank = { field: bb.field, width: bb.width, height: bb.height, points: [[bankX, z0], [bankX, z1]] };

  // The skylark plots: each in the roomiest place of its field, clear of the bank in Top Field.
  const skylarkPlots = S.skylarkPlots.map((sp) => {
    const clear = (x) => sp.clearOfBank === undefined || (sp.field === bb.field && Math.abs(x - bankX) >= sp.clearOfBank);
    const [x, z] = roomiestPoint(inner(sp.field), (px) => clear(px));
    return { field: sp.field, at: [x, z], size: S.plotSize };
  });
  return { margin: S.margin, margins, wildflower, beetleBank, skylarkPlots };
}

/** The strips in game metres, as the layout has them. */
function stewardshipLayout(plan = stewardshipPlan()) {
  return {
    margin: plan.margin,
    margins: plan.margins.map((m) => ({ field: m.field, width: m.width, outer: movePoints(m.outer), inner: movePoints(m.inner) })),
    wildflower: { ...plan.wildflower, points: movePoints(plan.wildflower.points) },
    beetleBank: { ...plan.beetleBank, points: movePoints(plan.beetleBank.points) },
    skylarkPlots: plan.skylarkPlots.map((sp) => ({ ...sp, at: fromPlan(sp.at) })),
  };
}

/**
 * Things the later items put on the farm, given their places now so nothing else is built over them (#709, #713, #710, #711), plan metres. The routes
 * are the curves on the plan's own map (docs/farm-plan.svg): M a new run, L a line, C a cubic curve, S one that carries on smoothly from the last.
 */
export const RESERVED_PLAN = {
  // The public footpath, the village bridge west along the river to the stone track's bridge, then over the hill pasture, Back Lane and the moor to the ladder stile in the ridge wall.
  footpath: 'M905 640 C840 634 740 624 680 604 S560 574 470 580 L432 572 M412 586 C360 640 260 700 160 740 S60 780 10 790 C-40 770 -120 720 -200 690 S-300 640 -334 612',
  // The bridleway, Back Lane in the north down the wood's east edge, between the Wet Meadow and Home Ground, then west along the Wet Meadow's south hedge to Back Lane.
  bridleway: 'M222 18 C212 80 206 160 200 225 C198 300 196 340 195 368 C140 370 80 366 14 364',
  crossings: [
    { route: 'footpath', at: [885, 638] }, { route: 'footpath', at: [640, 600] }, { route: 'footpath', at: [420, 590] }, { route: 'footpath', at: [196, 726] },
    { route: 'footpath', at: [46, 778] }, { route: 'bridleway', at: [205, 215] }, { route: 'bridleway', at: [196, 365] }, { route: 'bridleway', at: [36, 365] },
  ],
  moorGate: { at: [38, 700], field: 'hill' }, // in the hill pasture's wall, onto Back Lane and the moor
  troughs: [
    { field: 'hill', at: [150, 700] }, { field: 'sheep', at: [300, 500] }, { field: 'brook', at: [520, 640] }, { field: 'hay', at: [560, 520] }, { field: 'wet', at: [140, 330] },
  ],
  // The 11 kV line: a pole on the lane, then across the fields to the last pole by the farmhouse, which carries the transformer.
  powerLine: { poles: [[905, 168], [848, 186], [790, 204], [732, 222], [674, 240], [616, 258], [566, 274]], transformerPole: 6 },
};

/** A path of M, L, C and S commands as runs of points, `steps` points on each curve. */
export function flattenPath(d, steps = 24) {
  const tokens = d.match(/[MLCS]|-?\d+(?:\.\d+)?/g);
  const runs = [];
  let cur = null;
  let pen = null;
  let ctrl = null;
  for (let i = 0; i < tokens.length; ) {
    const c = tokens[i++];
    const num = (k) => tokens.slice(i, i + k).map(Number);
    if (c === 'M') {
      [pen] = [num(2)];
      i += 2;
      cur = [pen];
      runs.push(cur);
      ctrl = null;
    } else if (c === 'L') {
      pen = num(2);
      i += 2;
      cur.push(pen);
      ctrl = null;
    } else {
      let c1;
      let c2;
      let end;
      if (c === 'C') {
        const v = num(6);
        c1 = [v[0], v[1]];
        c2 = [v[2], v[3]];
        end = [v[4], v[5]];
        i += 6;
      } else {
        const v = num(4);
        c1 = ctrl ? [2 * pen[0] - ctrl[0], 2 * pen[1] - ctrl[1]] : pen;
        c2 = [v[0], v[1]];
        end = [v[2], v[3]];
        i += 4;
      }
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        const u = 1 - t;
        cur.push([0, 1].map((a) => u * u * u * pen[a] + 3 * u * u * t * c1[a] + 3 * u * t * t * c2[a] + t * t * t * end[a]));
      }
      ctrl = c2;
      pen = end;
    }
  }
  return runs;
}

/** The reserved places in game metres: the routes as runs of points, the crossings, the moor gate, the troughs and the power line's poles. */
function reservedLayout(R = RESERVED_PLAN) {
  return {
    footpath: flattenPath(R.footpath).map(movePoints),
    bridleway: flattenPath(R.bridleway).map(movePoints),
    crossings: R.crossings.map((c) => ({ route: c.route, at: fromPlan(c.at) })),
    moorGate: { ...R.moorGate, at: fromPlan(R.moorGate.at) },
    troughs: R.troughs.map((t) => ({ field: t.field, at: fromPlan(t.at) })),
    powerLine: { poles: movePoints(R.powerLine.poles), transformerPole: R.powerLine.transformerPole },
  };
}

/**
 * The landmarks in game metres: each with its `at`, and `trees`/`willows` points where it has several. A brook route is dealt out into the points the
 * alders stand at, `bank` m to one side of the curve.
 */
export function fieldLandmarksLayout(plan = FIELD_LANDMARKS_PLAN) {
  return plan.map((l) => {
    const out = { ...l };
    if (l.at) out.at = fromPlan(l.at);
    if (l.willows) out.willows = l.willows.map(fromPlan);
    if (l.trees) out.trees = l.trees.map(fromPlan);
    if (out.trees && !out.at) out.at = out.trees[0];
    if (l.route) {
      const run = flattenPath(l.route)[0];
      const pts = run.slice(1);
      out.trees = Array.from({ length: l.count }, (_, i) => {
        const t = l.along[0] + ((l.along[1] - l.along[0]) * i) / (l.count - 1);
        const k = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)));
        const f = t * (pts.length - 1) - k;
        const [x0, z0] = pts[k];
        const [x1, z1] = pts[k + 1];
        const dx = x1 - x0;
        const dz = z1 - z0;
        const len = Math.hypot(dx, dz) || 1;
        return fromPlan([x0 + dx * f - (dz / len) * l.bank, z0 + dz * f + (dx / len) * l.bank]);
      });
      delete out.route;
      out.at = out.trees[Math.floor(l.count / 2)];
    }
    return out;
  });
}

/**
 * The tall things seen from across the farm: the church tower (#715), the Dutch barn's roof (#682's stackyard), the trig pillar on the moor's ridge
 * (#713) and the 11 kV line's last pole (#711). Plan metres and the metres each stands above the ground under it.
 */
export const LANDMARKS_PLAN = [
  { name: 'church tower', at: [1240, 763], height: 18 },
  { name: 'Dutch barn roof', at: [446, 268], height: 7 },
  { name: 'trig pillar', at: [-330, 480], height: 1.2 },
  { name: 'last pole', at: [566, 274], height: 9.5 },
];

/** The Moor, beyond Back Lane up to the ridge wall (#713), plan metres: not a field of the plan's own, so it has no polygon. */
export const MOOR_PLAN = { minX: -330, maxX: 30, minZ: 40, maxZ: 920 };

/**
 * One thing in each field that is its own and can be seen from its gate (#815), plan metres: its `field` (a key of `FIELDS_PLAN`, or 'moor'), its `kind`
 * and `at`. The place is written here once and a move reads it from here: #624 the field barn, #684 the hut and the flask rock, #713 the trig
 * pillar, #711 the line (its poles are `RESERVED_PLAN.powerLine`'s). The others are built from it (world/landmarkProps.js). `builtBy` names who builds
 * a piece this issue only places. The farm plan says each field has one (docs/farm-plan.md, "Every field has a landmark").
 */
export const FIELD_LANDMARKS_PLAN = [
  // A lone oak in mid-field, east of the barley's hollow (300, 120), which is 26 by 16 m.
  { field: 'north', kind: 'loneOak', at: [352, 150] },
  // Two old gateposts 3 m apart, where a hedge across the field was grubbed out, the old line running east to west.
  { field: 'top', kind: 'oldGateposts', at: [480, 150], yaw: 0, gap: 3 },
  // The 11 kV line's third pole from the lane, in Lane Field: three of its poles stand there.
  { field: 'lanefield', kind: 'powerLine', at: RESERVED_PLAN.powerLine.poles[3], builtBy: '#711' },
  // A dead elm in the hedge along Long Piece's south side.
  { field: 'longpiece', kind: 'deadElm', at: [760, 520.5] },
  // A small pond in Far Field's low east side with two willows, clear of the green lane, the stream and the skylark plot.
  { field: 'far', kind: 'farPond', at: [160, 530], rx: 9, rz: 7.5, willows: [[151, 525], [168.2, 535]] },
  // An old roller left in the corner nearest the stone track's end.
  { field: 'south', kind: 'castRoller', at: [650, 672], yaw: 0.6 },
  // A lone ash in the middle of Hay Meadow, well clear of the stone track and the trough.
  { field: 'hay', kind: 'loneAsh', at: [520, 488] },
  // Alders on the brook's north bank through Low Ley (the plan map's own curve, flattened), `count` of them from `along` of its run, `bank` m off it.
  { field: 'ley', kind: 'brookAlders', route: 'M650 600 C700 632 790 648 885 650', along: [0.05, 0.78], count: 6, bank: -4 }, // the first was in the river at 0.08 (#1187)
  // Big old oaks scattered over the meadow south of the river.
  { field: 'brook', kind: 'bigOaks', trees: [[480, 670], [560, 700], [590, 640], [500, 775]] },
  // The Wet Meadow's veteran oak on the pond's west bank (the pond is at (112, 292)), its low limb pointing east over the water (#881).
  { field: 'wet', kind: 'pollardOak', at: [98, 291], limbYaw: 0 },
  // The field barn at the top tread of the sheep field (#684's spot).
  { field: 'sheep', kind: 'fieldBarn', at: [378, 451], builtBy: '#624' },
  // The shepherd's hut and the flask rock, as the plan has them.
  { field: 'hill', kind: 'hut', at: [95, 802], builtBy: '#684' },
  { field: 'hill', kind: 'flaskRock', at: [262, 814], builtBy: '#684' },
  // The trig pillar on the moor's ridge, where `LANDMARKS_PLAN` has it.
  { field: 'moor', kind: 'trigPillar', at: LANDMARKS_PLAN.find((l) => l.name === 'trig pillar').at, builtBy: '#713' },
];

/** How far the farm's views are taken to reach: the draw distance on a clear day (#708). */
const VIEW_DISTANCE = 1500;

/**
 * Whether you standing at `from` (an eye 1.7 m up) can see the top of a landmark, by the lie of the land alone: the ground between, from
 * `LANDFORM_PLAN`, must stay under the line of sight. Hedges and trees aren't counted, which a tall thing clears from a gateway's gap.
 */
export function canSee(from, landmark, plan = LANDFORM_PLAN) {
  const d = Math.hypot(landmark.at[0] - from[0], landmark.at[1] - from[1]);
  if (d > VIEW_DISTANCE) return false;
  const eye = landformHeightAt(from[0], plan) + 1.7;
  const top = landformHeightAt(landmark.at[0], plan) + landmark.height;
  const steps = Math.max(2, Math.ceil(d / 10));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (landformHeightAt(from[0] + (landmark.at[0] - from[0]) * t, plan) > eye + (top - eye) * t) return false;
  }
  return true;
}

/** The fields, boundaries, gateways and outline in game metres, as fieldPlan.js `planFromData` reads them. */
export function newFields() {
  const fields = clippedFields();
  const runs = boundariesOf(fields);
  const gateways = placeGateways(runs);
  return {
    outline: movePoints(clockwise(OUTLINE_PLAN)),
    fields: fields.map((f) => ({ name: f.name, label: f.label, kind: f.kind, points: movePoints(f.points), traits: traitsOf(f), fixed: FIXED_NAMES.includes(f.name) })),
    boundaries: runs.map((r) => ({ points: movePoints(r.points), kind: r.kind, between: [r.a, r.b] })),
    gateways: gateways.map(({ a, b, boundary, at, half, gate, id, shut }) => ({ a, b, boundary, at, half, ...(gate && { gate, id }), ...(shut && { shut }) })),
  };
}

/** Square metres of each field and of the outline, for the tests and the decisions record. */
export function areasOf(fields = clippedFields()) {
  return { outline: polygonArea(clockwise(OUTLINE_PLAN)), fields: Object.fromEntries(fields.map((f) => [f.name, polygonArea(f.points)])) };
}

/** The drive's two bellmouth corners at the lane (#816), game metres: where its edges meet the lane's, rounded with `D.bellmouth`. */
function driveFillets(D, L) {
  const [cornerX, z] = fromPlan([D.toX - L.halfWidth, D.z]);
  return [-1, 1].map((side) => ({ x: cornerX, z: z + side * D.halfWidth, ux: -1, uz: 0, vx: 0, vz: side, r: D.bellmouth }));
}

/** The drive and the lane in game metres (#568): `road` as every reader of the farm road has it, `publicLane`, and the road network's two roads. */
export function driveLayout(D = DRIVE_PLAN, L = LANE_PLAN) {
  const [fromX, z] = fromPlan([D.fromX, D.z]);
  const [toX] = fromPlan([D.toX, D.z]);
  const [gridX] = fromPlan([D.grid.x, D.z]);
  const bypass = GATEWAYS_PLAN.find((g) => g.id === 'bypass');
  const [bx, bz] = fromPlan(bypass.at);
  const mouth = GATEWAYS_PLAN.find((g) => g.a === 'drive' && g.b === 'out' && !g.id);
  const at = (p) => fromPlan(p);
  const road = {
    z, fromX, toX, halfWidth: D.halfWidth, verge: D.verge,
    grid: { x: gridX, length: D.grid.length, pitch: D.grid.pitch, margin: D.grid.margin, mouth: mouth.half, wingX: fromPlan(mouth.at)[0] }, // the wings close the mouth in the boundary
    bypass: { x: bx, z: bz, width: 2 * bypass.half - 0.7 }, // the gate between its posts: the gap less the posts' own room
    signSpot: at(D.signSpot),
    bellmouth: D.bellmouth,
    reflectors: D.reflectors.map(at),
    potholes: D.potholes.map(([x, pz, r]) => ({ x: x - PLAN_ORIGIN[0], z: pz - PLAN_ORIGIN[1], r })),
    washes: D.washes.map(at),
    patches: D.patches,
  };
  const [dragX] = fromPlan([D.dragStrip.fromX, D.z]);
  const dragStrip = { x: dragX, z, yaw: Math.PI / 2, length: D.dragStrip.length, runOff: D.dragStrip.runOff, width: D.dragStrip.width, onDrive: true };
  const [laneX, laneMin] = fromPlan([L.x, L.minZ]);
  const [, laneMax] = fromPlan([L.x, L.maxZ]);
  const [, rideMin] = fromPlan([L.x, L.ridden[0]]);
  const [, rideMax] = fromPlan([L.x, L.ridden[1]]);
  const lanePoints = [...L.north, ...Array.from({ length: Math.floor((L.maxZ - 40) / L.southStep) }, (_, i) => [L.x, 40 + (i + 1) * L.southStep]), [L.x, L.maxZ]].map(fromPlan);
  const publicLane = { x: laneX, halfWidth: L.halfWidth, minZ: laneMin, maxZ: laneMax, open: { minZ: rideMin, maxZ: rideMax } };
  const roads = [
    { id: 'lane', name: 'the lane', surface: 'tarmac', halfWidth: L.halfWidth, points: lanePoints, junction: { end: 'start', onto: 'aRoad' }, markings: { centre: 'dashed', giveWay: 'start', giveWayAt: GIVE_WAY_AT }, verge: 1, hedged: false, draw: 'mesh', lift: 0.076, camber: 0.03, bellmouth: { width: 2.2, length: 8 } },
    {
      id: 'farm', name: 'the drive', surface: 'tarmac', halfWidth: D.halfWidth, points: [[fromX, z], [toX, z]], junction: { end: 'end', onto: 'lane' }, fillets: driveFillets(D, L),
      markings: { centre: 'none' }, verge: D.verge, hedged: false, draw: 'ground', level: { shoulder: 3, lead: [2, 0] }, edge: 'gravel', patches: D.patches,
      potholes: road.potholes.map(({ x, z, r }) => ({ x, z, r })), washes: road.washes,
    },
  ];
  return { road, publicLane, roads, dragStrip };
}

/** The A-road as a road of the network, in game metres (#687): two lanes, a dashed white centre line, white edge lines, a crown and cat's eyes. */
export function aRoadLayout(A = A_ROAD_PLAN) {
  return {
    id: 'aRoad', name: 'the A-road', surface: 'tarmac', halfWidth: A.halfWidth, points: A.points.map(fromPlan), markings: { centre: 'dashed', edge: true },
    dash: A.dash, lineWidth: 0.12, verge: A.verge, hedged: false, draw: 'mesh', lift: 0.07, camber: A.camber, eyes: A.eyes, texture: { patches: 3, bands: 5, crumble: 0.02 },
  };
}

/** The village street's end at the A-road, in game metres (#687): the stub #688 replaces. */
export function streetStubLayout(S = STREET_STUB_PLAN) {
  return {
    id: 'streetEnd', name: 'the village street', surface: 'tarmac', halfWidth: S.halfWidth, points: [S.from, S.to].map(fromPlan), junction: { end: 'end', onto: 'aRoad' },
    markings: { centre: 'dashed', giveWay: 'end', giveWayAt: GIVE_WAY_AT }, verge: 2, hedged: false, draw: 'mesh', lift: 0.076, camber: 0.03, bellmouth: { width: 2.2, length: 8 },
  };
}

/**
 * Back Lane (#686), plan metres: the old single-track road over the hill, leaving the lane at the north, west round the farm, down its west side
 * through the ford (the stream at about z 572), over the hill's shoulder in two hairpins, east along the south and back to the lane below the village.
 * About 3 km, outside the farm's outline everywhere (`tests/backLane.test.js`). `passing` is a widening every `spacing` m (12 to 20 round the loop);
 * `strip` is the stretches (plan z along the west side, plan x along the south) with a grass strip down the middle; `hairpins` and `ford` are where
 * their signs and boards go. The line is the issue's, smoothed by the road network.
 */
export const BACK_LANE_PLAN = {
  points: [
    [905, -2], [800, 0], [700, 6], [580, 2], [480, -6], [360, 4], [230, 16], [110, 24], [22, 70], [14, 160], [10, 250], [12, 340], [14, 470], [11, 545],
    [10, 572], [10, 700], [2, 792], [-30, 840], [60, 874], [300, 880], [560, 878], [820, 880], [905, 886],
  ],
  halfWidth: 1.6,
  passing: { spacing: 190, length: 10, bay: 1.7 },
  strip: { half: 0.35, rects: [[-20, 90, 60, 800], [60, 850, 880, 900]] }, // the grass down the middle, on the west and south stretches only: plan rectangles [minX, minZ, maxX, maxZ] (settled 13 November)
  verge: 2.6,
  level: { shoulder: 2.5, lead: [2, 2], blend: 10, natural: true },
  cuttings: [[1548, 1633], [1723, 2168]], // m along (7 m less since the point before the ford moved north out of a loop in the road, #1187): where the lane runs in a hollow way into the hill's shoulder (up to 2.6 m, as a sunken old road does), flagged so `cuttings()` accepts it
  ditch: { centre: 1.9, half: 0.55, depth: 0.45 }, // along the low side, at the hedge's foot: m out from the tarmac's edge, half its width, how deep
  ford: { at: [10, 572], reach: 14, west: -200 }, // the stream runs on west from the pasture's hedge to the ford, and to plan x `west`: its spring on the moor (#713)
  hairpins: [[-30, 840], [60, 874]],
  farViewSpot: [13, 100], // the far view's spot (frameBudget `viewBackLane`, #820): on the lane's middle just after it turns south at the map's north edge, looking down it (the corner's curve puts the middle 6 m west of the straight line between its points)
  budgetSpot: [-8, 860], // the frame budget's spot (tools/frameBudget.mjs `hairpins`): on the lane between the two hairpins, looking along it, the most hedge and verge in one view
  footpath: { at: [2, 792], to: [-60, 760] }, // off the road's west side, up the hill: the stile in the hedge at `at`, the path on to `to` (plan metres)
  upperThornby: [-460, 745], // the hamlet the footpath climbs to, over the Moor's ridge wall on the plateau beyond (plan metres): seen from the ridge, never reached (#1037; it stood on the common at -215)
  // The gates in the lane's own hedge, each across from the farm's gateway onto the strip between (plan metres), with the lane's gravel track to it.
  gates: [{ id: 'north', farm: [380, 30] }, { id: 'wood', farm: [38, 130] }, { id: 'far', farm: [40, 440] }, { id: 'hill', farm: [36, 640] }, { id: 'moor', farm: [38, 700] }],
};

/** Back Lane as a road of the network, in game metres, joined to the lane at both ends. */
export function backLaneLayout(B = BACK_LANE_PLAN) {
  return {
    id: 'backLane', name: 'Back Lane', surface: 'tarmac', halfWidth: B.halfWidth, points: B.points.map(fromPlan),
    junction: [{ end: 'start', onto: 'lane' }, { end: 'end', onto: 'lane' }], passing: { ...B.passing },
    markings: { centre: 'none', giveWay: true }, verge: B.verge, hedged: true, draw: 'mesh', lift: 0.05, level: { ...B.level }, camber: 0.04,
    cuttings: B.cuttings.map(([from, to]) => ({ from, to })),
    ditch: { ...B.ditch },
    strip: { half: B.strip.half, rects: B.strip.rects.map(([x0, z0, x1, z1]) => [...fromPlan([x0, z0]), ...fromPlan([x1, z1])]) },
    texture: { patches: 6, bands: 9, crumble: 0.07 },
    gates: B.gates.map((g) => ({ id: g.id, farm: fromPlan(g.farm) })),
    ford: { at: fromPlan(B.ford.at), reach: B.ford.reach },
    moor: { grids: MOOR_FEATURES_PLAN.grids.map((g) => ({ id: g.id, near: fromPlan(g.near) })) }, // where it crosses the common: unhedged on its moor side between the two cattle grids (#713)
    hairpins: B.hairpins.map(fromPlan),
    footpath: { at: fromPlan(B.footpath.at), to: fromPlan(B.footpath.to) },
  };
}

/**
 * The neighbour's yard, her anchor and the track to her gate in game metres (#569): `neighbourFarm` as the yard's shape reads it. The yard's contents are
 * `at('neighbour', ...)` offsets from her anchor and are resolved with the anchors' own resolver (layoutAnchors.js), so moving `anchor` moves the lot (#972).
 * The anchor does not turn (`yaw` 0, not `turnable`): the yard was written with its gateway in the west wall, not turned.
 */
export function neighbourLayout(N = NEIGHBOUR_PLAN) {
  const [ax, az] = fromPlan(N.anchor);
  const { anchor, track: trackPlan, ...local } = N;
  const { neighbourFarm } = resolveLayout({ anchors: { neighbour: { x: ax, z: az, yaw: 0 } }, neighbourFarm: at('neighbour', local) });
  const g = neighbourFarm.gateway;
  const [tx0, tz0] = fromPlan(trackPlan.from);
  const track = {
    id: 'neighbour', name: 'her track', surface: 'tarmac', halfWidth: trackPlan.halfWidth, points: [[tx0, tz0], [neighbourFarm.yard.minX, g.z]], junction: { end: 'start', onto: 'lane' },
    markings: { centre: 'none' }, verge: 1.5, hedged: false, draw: 'ground', level: { shoulder: 3, lead: [0, 2] }, edge: 'gravel',
  };
  return { anchor: { x: ax, z: az, yaw: 0 }, neighbourFarm, track };
}

/** What makes the lane one other people use, in game metres (#687): see `LANE_FITTINGS_PLAN`. */
export function laneFittingsLayout(F = LANE_FITTINGS_PLAN) {
  const [x0, z0, x1, z1] = F.cottages.rect;
  const [cx0, cz0] = fromPlan([x0, z0]);
  const [cx1, cz1] = fromPlan([x1, z1]);
  return {
    cottages: { minX: cx0, minZ: cz0, maxX: cx1, maxZ: cz1, yaw: F.cottages.yaw, gardenDepth: F.cottages.gardenDepth },
    gateways: F.gateways.map((g) => ({ x: fromPlan(g.at)[0], z: fromPlan(g.at)[1], width: g.width })),
    gritBins: F.gritBins.map(fromPlan).map(([x, z]) => ({ x, z })),
    postbox: (([x, z]) => ({ x, z }))(fromPlan(F.postbox)),
    binStand: (([x, z]) => ({ x, z }))(fromPlan(F.binStand)),
    southFingerpost: (([x, z]) => ({ x, z, lines: SOUTH_FINGERPOST_PLAN.lines }))(fromPlan(SOUTH_FINGERPOST_PLAN.at)),
  };
}

/** Her land in game metres (#569): the fields with their tones, each line as `{ axis, at, from, to, gaps }` (`axis` 'x' runs along z), the gate and the cows. */
export function neighbourLandLayout(L = NEIGHBOUR_LAND_PLAN) {
  const px = (x) => x - PLAN_ORIGIN[0];
  const pz = (z) => z - PLAN_ORIGIN[1];
  const golden = 2.399963; // the cows face every way, and the same way every game
  return {
    fields: L.fields.map((f) => ({ name: f.name, minX: px(f.rect[0]), minZ: pz(f.rect[1]), maxX: px(f.rect[2]), maxZ: pz(f.rect[3]), tone: f.tone })),
    lines: L.lines.map((l) => (l.x !== undefined
      ? { axis: 'x', at: px(l.x), from: pz(l.from), to: pz(l.to), gaps: l.gaps.map(([a, b]) => [pz(a), pz(b)]) }
      : { axis: 'z', at: pz(l.z), from: px(l.from), to: px(l.to), gaps: l.gaps.map(([a, b]) => [px(a), px(b)]) })),
    gate: { x: px(L.northGate.at[0]), z: pz(L.northGate.at[1]), width: L.northGate.width },
    hedge: { ...L.hedge },
    cows: L.cows.map(([x, z], i) => ({ x: px(x), z: pz(z), yaw: (i * golden) % (2 * Math.PI) })),
  };
}

/**
 * The farmstead (#682), plan metres: the middle of the farm at the head of the drive, laid out as a real farmstead (docs/farm-plan.md). Rectangles are
 * [minX, minZ, maxX, maxZ]. The barn is today's barn as it is (#613 rebuilds it in place), turned a quarter left so its doors face south onto the yard, and
 * the yard's anchor sits 10 m out of those doors and 2 m along, as today's does from today's barn, so everything in the yard keeps its place beside the barn.
 * `home` is where today's grass field's middle falls on Home Ground, so the Home Loop, the cones, the jump and the line-up keep today's shape in it.
 */
export const FARMSTEAD_PLAN = {
  fieldShed: [378, 451], // the stone shed, at the Sheep Field's field-barn spot until #624 builds the barn there
  barn: { at: [511, 328], yaw: -Math.PI / 2 }, // the building's middle: one building filling the plan's 498 to 524 by 319 to 337, its doors in the south wall at z 337 (#818, barnPlan.js)
  yard: { at: [517.6, 347], yaw: -Math.PI / 2 }, // 10 m out of the doors, where it was from the first barn's
  tanksMove: [2.9, -5.5], // the petrol tank and what stands by it, from where the yard's frame put them to against the barn's east end (north of the drive, clear of the way to the doors)
  home: { at: [332, 360] },
  bonfire: { at: [400, 424] }, // Home Ground's south-east corner
  dutch: { at: [446, 268] }, // the Dutch barn's middle, at the stackyard's north, its open front facing south
  slab: [425, 317, 615, 415], // the yard, concrete
  stackyard: [420, 253, 472, 309],
  orchard: [478, 250, 538, 310],
  garden: { rect: [552, 250, 615, 312], gate: { x: 583, width: 3.6 } }, // lawn behind a stone wall, its gate on the yard side
  cars: { z: 326, xs: [578, 583.2, 588.4], yaw: Math.PI }, // beside the garden, nosed in towards its wall (plan 572 to 612 by 319 to 333)
  muck: [486, 416],
  // What the yard is dressed with (#817), plan metres. The barn's door wall is the plane z 335 (x 501.8 to 520.2), its doors' leaves covering most of it, so `wall` is the gear on
  // the east end wall and the pallets and tyres stand at the door wall's west corner. `gates` are the yard's ways out that are gateways (`layout.gateways`), `along` the way the rail or hedge runs there.
  yardKit: {
    drain: { x: 517.6, z0: 385, z1: 347 }, // stops at the cattle shed's rectangle (#694), as the paths and the mud stop short of the kept-clear places // the channel along the yard's middle, falling north to the gully
    paths: [
      { points: [[615, 345], [540, 345], [524, 343.5], [511, 338]], width: 1.7 }, // on to the barn's doors, at plan x 511
      { points: [[517.6, 343.9], [517.6, 360], [517.6, 380]], width: 1.7 },
      { points: [[517.6, 352], [480, 356], [446, 360]], width: 1.7 }, // on towards Home Ground's gate; the rest waits for the machinery shed and scrap corner (#617, #712)
    ],
    mud: [{ at: [613, 345], d: [-1, 0], radius: 5 }, { at: [420, 436], d: [0, -1], radius: 4 }],
    muckLines: [[498, 337.7, 524, 337.7], [524.7, 319, 524.7, 337]],
    puddles: [[516, 378, 1.6, 1.0], [549, 353, 2.0, 1.3], [468, 372, 1.5, 1.0], [506, 347, 1.1, 0.8], [586, 392, 1.8, 1.1]],
    gully: [517.6, 347],
    wall: { at: [524, 329.4], yaw: Math.PI / 2 }, // the barn's east end wall, clear of the tanks, the doors' leaves and the bell: the gear's own frame has x along the wall (north) and z out
    pallets: { at: [496.9, 338.4], yaw: 0.12 },
    tyres: { at: [500.2, 338.4] },
    gates: [{ at: [412, 368], along: 'z' }, { at: [420, 440], along: 'x' }, { at: [545.9, 230.4], along: 'x', inward: 1 }], // the drive's 8 m mouth stays open for the lorry (#816)
    stack: { at: [440.6, 265.0] }, // square bales under the Dutch barn's west bay, beside its round ones (the stanchion at 443.5 and the first round bale at 444.2 are clear)
    round: [[436, 279], [437.7, 282.6]], // two out on the hardcore
    spike: [455.5, 276],
    straw: [[444, 275], [452, 278], [446, 272.5]],
    stackyardTrack: [[446, 285, 4], [440, 296, 3]],
  },
  harrows: { at: [548, 372], yaw: -Math.PI / 2 },
  // The trailers, off the visitors' lane (the drive's line, z 345, and the loop south of the barn's doors to z 353) and clear of the kept-clear places and the spawns.
  trailers: { trailer: { at: [572, 398], yaw: 2.7 }, tipTrailer: { at: [588, 394], yaw: 0.2 }, sprayer: { at: [560, 380], yaw: 0.3 } }, // (the tipping trailer stood at (562, 366), in the lorry's way to the grain store: #816)
  silage: [700, 545], // the wrapped silage's stack's north-west corner, out in Low Ley (#691), 60 m in from its gateway from Brook Meadow and clear of the river
  jerryCan: [508, 316.5], // the can that stood by the silage, behind the barn's back wall (z 319), the orchard's fence at 310
  animals: { pen: [486, 270, 492.5, 277], sty: [500, 270, 504.5, 275], bin: [496.5, 266, 0], bucket: [498, 266.4, 0.4] }, // in the orchard
  fenceSeats: [340, 352, 384, 396], // on Home Ground's rail, at plan z, facing out over the field
  frontage: [317, 415], // the stretch of Home Ground's rail the yard fronts: where the girls' seats are (the rail itself runs the whole side)
  // What the later items build, held clear now: no placeholder, plain yard or grass.
  keptClear: [
    { name: 'machinery shed', by: '#617', rect: [428, 325, 442, 373] },
    { name: 'grain store', by: '#699', rect: [582, 355, 612, 381] },
    { name: 'cattle shed and clamp', by: '#694', rect: [470, 385, 558, 407] },
    { name: 'sheep pens', by: '#695', rect: [432, 383, 462, 409] },
    { name: 'scrap corner', by: '#712', rect: [412.5, 325, 424, 371] }, // behind the machinery shed, from Home Ground's rail (plan x 412.45, where the girls' seats are) in
    { name: '11 kV pole', by: '#711', rect: [564.5, 272.5, 567.5, 275.5] }, // the last pole of the line, by the farmhouse
    { name: 'lorry turning circle', by: '#816', rect: [465.5, 342.9, 490.5, 367.9] }, // the square round `LORRY_PLAN.circle`, which the lorry's turn needs clear
  ],
};

/**
 * The articulated lorry the farm is laid out for (#816), plan metres: 16.5 m long (`LORRY`, `lorryPath.js`), carrying the livestock wagon, the grain lorry, the feed
 * lorry and the fuel tanker (#707, #699, #122). It comes up the lane from the south in the west carriageway (`lane`: its middle) and turns left onto the drive
 * (`turnIn`: the radius its rear axle turns on, which with the drive's 12 m bellmouth keeps its wheels within 1.5 m of the tarmac), along the drive and into the yard to
 * `circle`, a clear disc 25 m across where it turns round (the drive's line is its north side), and backs to the sheep pens' ramp (`sheep.tail`: where the trailer's
 * tail meets the ramp's foot, the lorry facing north) or the grain store's door (`grain.tail`, facing west; it stands `run` m short of the circle to back in).
 * The ramp and the door are #695's and #699's to place, on those faces. `bend`, `settle`, `straighten`, `leaveR` and `leaveRun` shape the legs between (see `lorryJourneys`).
 */
export const LORRY_PLAN = {
  lane: 903.7, turnIn: 11,
  circle: { at: [478, 355.4], diameter: 25 },
  sheep: { tail: [460, 383] },
  grain: { tail: [582, 367], run: 28 },
  bend: 11, settle: 30, straighten: 20, leaveR: 40, leaveRun: 120,
};

const rectOf = ([x0, z0, x1, z1]) => {
  const [minX, minZ] = fromPlan([x0, z0]);
  const [maxX, maxZ] = fromPlan([x1, z1]);
  return { minX, minZ, maxX, maxZ };
};

/** Today's grass field's things that go with Home Ground, and which of today's straw bales stood in it (the rest were at the Dutch barn). */
const inGrassField = (p) => {
  const [x, z] = Array.isArray(p) ? p : [p.x, p.z];
  return Math.abs(x) <= 80 && Math.abs(z) <= 80;
};

/**
 * Today's layout with the farmstead put in place (#682), in game metres: `anchors` for the barn, yard, bonfire, Home Ground and the Dutch barn, everything
 * written from them resolved again from `raw` (with the barn's own things in its own frame, `barnLocal`), and the places that were not written from one.
 * Everything here is what `NOT_MOVED_YET` named '#682'.
 */
export function farmsteadLayout(today, raw) {
  const P = FARMSTEAD_PLAN;
  const tanks = (o) => o && { ...o, x: o.x + P.tanksMove[0], z: o.z + P.tanksMove[1] };
  const anchor = (p, yaw = 0, turnable = false) => ({ x: fromPlan(p.at)[0], z: fromPlan(p.at)[1], yaw, ...(turnable && { turnable: true }) });
  const anchors = {
    ...raw.anchors,
    barn: anchor(P.barn, P.barn.yaw, true),
    yard: anchor(P.yard, P.yard.yaw, true),
    bonfire: anchor(P.bonfire),
    home: anchor(P.home),
    dutch: anchor(P.dutch),
  };
  const [gx, gz] = fromPlan(P.garden.rect.slice(0, 2));
  const slab = rectOf(P.slab);
  // Resolved against the new anchors: all of today's that is written from `barn`, `yard` and `bonfire`, and Home Ground's and the Dutch barn's pieces.
  const homeBales = today.strawBaleSpots.filter(inGrassField);
  const dutchBales = today.strawBaleSpots.filter((b) => !inGrassField(b)).map(([x, z, yaw]) => [x - today.dutchBarn.x, z - today.dutchBarn.z, yaw]);
  const dutchSeats = today.restSpots.filter((r) => r.id.startsWith('dutchBarn')).map((r) => ({ ...r, x: r.x - today.dutchBarn.x, z: r.z - today.dutchBarn.z, door: { x: r.door.x - today.dutchBarn.x, z: r.door.z - today.dutchBarn.z } }));
  const away = today.spawn.away;
  const shedAt = fromPlan(P.fieldShed);
  const onShed = (o) => ({ ...o, x: o.x - today.fieldShed.x + shedAt[0], z: o.z - today.fieldShed.z + shedAt[1], ...(o.door && { door: { x: o.door.x - today.fieldShed.x + shedAt[0], z: o.door.z - today.fieldShed.z + shedAt[1] } }) });
  const homeAway = away.filter(inGrassField);
  const dutchAway = away.filter((a) => a.where === 'in the Dutch barn').map((a) => ({ ...a, x: a.x - today.dutchBarn.x, z: a.z - today.dutchBarn.z }));
  const jerry = today.jerryCanSpots.find((j) => j.where === 'by the Dutch barn');
  const placed = {
    track: at('home', today.trackPoints), bogs: at('home', today.bogs), jumpRamp: at('home', today.jumpRamp), coneCourse: at('home', today.coneCourse),
    brushwood: at('home', today.brushwood), lineUp: at('home', { ...today.lineUp }), homeBales: at('home', homeBales), dutchBales: at('dutch', dutchBales),
    dutchBarn: at('dutch', { ...today.dutchBarn, x: 0, z: 0 }), dutchSeats: at('dutch', dutchSeats), homeAway: at('home', homeAway), dutchAway: at('dutch', dutchAway),
    dutchCan: at('dutch', { ...jerry, x: jerry.x - today.dutchBarn.x, z: jerry.z - today.dutchBarn.z }),
  };
  const again = resolveLayout({ anchors, ...placed });
  const base = resolveWithBarnLocal({ ...raw, ...barnRaw() }, anchors);
  const pt = (p) => fromPlan(p);
  const bin = fromPlan(P.animals.bin);
  const bucket = fromPlan(P.animals.bucket);
  const fences = P.fenceSeats.map((z, i) => ({ id: ['fenceNorth', 'fenceSouth', 'fenceEast', 'fenceWest'][i], kind: 'fence', x: fromPlan([412.45, z])[0], z: fromPlan([412.45, z])[1], yaw: -Math.PI / 2, seat: 1.05 }));
  const cars = Object.fromEntries(Object.keys(today.cars).map((k, i) => [k, { x: fromPlan([P.cars.xs[i], P.cars.z])[0], z: fromPlan([P.cars.xs[i], P.cars.z])[1], yaw: P.cars.yaw, where: 'by the garden' }]));
  const moved = Object.fromEntries(['fuelTank', 'dieselBowser', 'oilBottle', 'coolantBottle', 'antiGelBottle', 'plugAdditive', 'hose'].map((k) => [k, tanks(base[k])]));
  return {
    ...base,
    ...moved,
    farmstead: {
      slab, stackyard: rectOf(P.stackyard), orchard: rectOf(P.orchard),
      garden: { ...rectOf(P.garden.rect), gate: { x: fromPlan([P.garden.gate.x, 0])[0], width: P.garden.gate.width } },
      keptClear: P.keptClear.map(({ name, by, rect }) => ({ name, by, ...rectOf(rect) })),
      yard: yardKitLayout(P.yardKit),
    },
    trackPoints: again.track,
    bogs: again.bogs,
    jumpRamp: again.jumpRamp,
    coneCourse: again.coneCourse,
    brushwood: again.brushwood,
    lineUp: again.lineUp,
    dutchBarn: again.dutchBarn,
    strawBaleSpots: [...again.homeBales, ...again.dutchBales],
    cars,
    harrows: { x: pt(P.harrows.at)[0], z: pt(P.harrows.at)[1], yaw: P.harrows.yaw },
    ...Object.fromEntries(Object.entries(P.trailers).map(([k, t]) => [k, { x: pt(t.at)[0], z: pt(t.at)[1], yaw: t.yaw }])),
    silage: { x: pt(P.silage)[0], z: pt(P.silage)[1] },
    muckHeap: { ...today.muckHeap, x: pt(P.muck)[0], z: pt(P.muck)[1] },
    paddock: undefined, // the paddock's fences are Home Ground's rails now
    lawns: { garden: { ...rectOf([P.garden.rect[0] + 2, P.garden.rect[1] + 2, P.garden.rect[2] - 2, P.garden.rect[3] - 2]) } },
    farmAnimals: {
      pen: rectOf(P.animals.pen), sty: rectOf(P.animals.sty),
      bin: { x: bin[0], z: bin[1], yaw: P.animals.bin[2] }, bucket: { x: bucket[0], z: bucket[1], yaw: P.animals.bucket[2] },
    },
    jerryCanSpots: [
      ...base.jerryCanSpots.filter((j) => j.where !== 'by the Dutch barn' && j.where !== 'by the field shed').map((j) => (j.where === 'by the petrol tank' ? tanks(j) : j.where === 'by the silage bales' ? { ...j, x: pt(P.jerryCan)[0], z: pt(P.jerryCan)[1], where: 'behind the barn' } : j)).map((j) => ({ ...j, where: { 'by the paddock': 'by the trailers', 'by the field gate': 'out in the yard' }[j.where] ?? j.where })),
      again.dutchCan,
      ...today.jerryCanSpots.filter((j) => j.where === 'by the field shed').map(onShed),
    ],
    restSpots: [...fences, ...again.dutchSeats, ...today.restSpots.filter((r) => r.id.startsWith('fieldShed')).map(onShed)],
    // The stone shed stands at the Sheep Field's field-barn spot until #624 builds the field barn there; its seats, can and parking spot go with it.
    fieldShed: { ...today.fieldShed, x: shedAt[0], z: shedAt[1] },
    // The grass field's spots go with Home Ground and the Dutch barn's with the Dutch barn; the east fields' are gone with the fields, but for the one by the shed.
    spawn: { ...base.spawn, away: [...again.homeAway, ...farmsteadAway(), ...again.dutchAway, ...away.filter((a) => a.where === 'by the field shed').map(onShed)] },
  };
}

/** The yard's dressing (#817) in game metres: `FARMSTEAD_PLAN.yardKit` with each plan position taken from the plan's origin. */
function yardKitLayout(k) {
  const pt = ([x, z]) => ({ x: fromPlan([x, z])[0], z: fromPlan([x, z])[1] });
  return {
    drain: { x: fromPlan([k.drain.x, 0])[0], z0: fromPlan([0, k.drain.z0])[1], z1: fromPlan([0, k.drain.z1])[1] },
    paths: k.paths.map((p) => ({ points: p.points.map(fromPlan), width: p.width })),
    mud: k.mud.map((m) => ({ ...pt(m.at), dx: m.d[0], dz: m.d[1], radius: m.radius })),
    muckLines: k.muckLines.map(([x0, z0, x1, z1]) => ({ x0: fromPlan([x0, z0])[0], z0: fromPlan([x0, z0])[1], x1: fromPlan([x1, z1])[0], z1: fromPlan([x1, z1])[1] })),
    puddles: k.puddles.map(([x, z, rx, rz]) => ({ ...pt([x, z]), rx, rz })),
    gully: pt(k.gully),
    wall: { ...pt(k.wall.at), yaw: k.wall.yaw },
    pallets: { ...pt(k.pallets.at), yaw: k.pallets.yaw },
    tyres: pt(k.tyres.at),
    gates: k.gates.map((g) => ({ ...pt(g.at), along: g.along, inward: g.inward ?? -1 })),
    stack: pt(k.stack.at),
    round: k.round.map(pt),
    spike: pt(k.spike),
    straw: k.straw.map(pt),
    stackyardTrack: k.stackyardTrack.map(([x, z, radius]) => ({ ...pt([x, z]), radius })),
  };
}

/** Where a vehicle can be left in the farmstead and on the drive when the day deals it away from the yard (spawn.away), game metres. */
function farmsteadAway() {
  const spot = (plan, where, extra = {}) => ({ x: fromPlan(plan)[0], z: fromPlan(plan)[1], where, ...extra });
  return [
    spot([447, 345], 'by the stackyard'),
    spot([560, 400], 'out in the yard'),
    spot([600, 345.5], 'along the drive', { jitter: 1, tight: true }),
    spot([455, 352], 'across the yard'),
  ];
}

/**
 * Hollow Wood on the new farm (#683), plan metres. The Run, the Fern Trail, the pond, the logs and the deadwood keep their shapes and are carried over
 * as they are (Jamie: "keep its shape, the Run and the Trail"); only their place changes. `runAt` is where the Run's middle lies: the field's middle,
 * 5 m east of it, because the field's north-west corner is cut by the outline and the Run's own would stand 1.6 m from it (5 m east leaves 6.4 m). The
 * gate is the Wet Meadow gateway in `GATEWAYS_PLAN` (the wood's south side), 38 m east of where the Run's lead-in meets it once the Run is in the
 * middle, so the lead-in bends west inside the south hedge (`leadIn`: 12 m straight in from the gate, then these points to where it runs straight into the
 * Run's junction as today's does); Jamie chose that over moving the gateway (18 November 2026). `deadwood` lies in the bands north and south of the Run, where the
 * extra ground is. `logYard` is the anchor of the woodpile, in the Wet Meadow just east of the gate with the south hedge at its back (the stack
 * stands against it as it stood against the grass field's north hedge).
 */
export const WOOD_PLAN = {
  runAt: [126, 131.5],
  leadIn: [[127, 203.5], [120, 198.5], [110, 194.5], [100, 192], [95, 189]],
  deadwood: [[165, 204, 0.6, 4.4], [62, 202, 2.4, 3.8], [150, 66, 1.1, 4.8], [110, 56, 2.9, 3.6]], // the last lay across the boundary track at z 60 (#1187)
  oak: [80, 113], // the veteran oak, in the glade north of the pond (19 m from the nearest track)
  logYard: [142, 235],
  // The woodpile's scenery, as offsets from `logYard`'s anchor: a lean-to with an old stack under it along the south hedge beyond the working stack (which
  // stands 9.8 to 13.2 m east of the anchor), and a chopping block by the rounds. The hedge's face is 10.9 m north of the anchor there, and its bushes reach about 1 m past it, so the lean-to stands 2 m off.
  scenery: { leanTo: { x: 20.2, z: -7.6, yaw: 0, length: 4.6, depth: 2.3 }, block: { x: 5.8, z: -1.6 } },
};

/** The point `s` metres along a run of points from its first. */
function pointOnRun(points, s) {
  let left = s;
  for (let i = 0; i + 1 < points.length; i++) {
    const e = edgeBetween(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
    if (left <= e.length || i + 2 === points.length) {
      const p = pointAlong(e, left);
      return [p.x, p.z];
    }
    left -= e.length;
  }
  return points[0];
}

/**
 * Today's wood carried to the new farm in game metres (#683): `woods` with its field's outline (`outline`, which `woods.js` reads trees, mud and the
 * ground's weight from), the south side's line (`south`), the gate at its gateway, the lead-in bent from it to the Run, everything of the Run's and the
 * Trail's carried by the one shift, the trees and bushes scaled to the area (today's density), and the woodpile's anchor beside the gate.
 */
export function woodsLayout(today, raw, P = WOOD_PLAN) {
  const W = today.woods;
  const fields = clippedFields();
  const runs = boundariesOf(fields);
  const gateway = placeGateways(runs).find((g) => [g.a, g.b].sort().join('|') === 'wet|wood');
  const south = runs[gateway.boundary].points;
  const outlinePlan = fields.find((f) => f.name === 'wood').points;
  const outline = movePoints(outlinePlan);
  const b = polygonBounds(outline);
  const gate = fromPlan(pointOnRun(south, gateway.at));
  const west = placeGateways(runs).find((g) => [g.a, g.b].sort().join('|') === 'out|wood');
  const back = fromPlan(pointOnRun(runs[west.boundary].points, west.at));
  const runBox = polygonBounds(W.circuit.points);
  const [tx, tz] = fromPlan(P.runAt);
  const dx = tx - (runBox.minX + runBox.maxX) / 2;
  const dz = tz - (runBox.minZ + runBox.maxZ) / 2;
  const moved = ([x, z]) => [x + dx, z + dz];
  const area = polygonArea(outline) / ((W.maxX - W.minX) * (W.maxZ - W.minZ));
  const anchor = { x: fromPlan(P.logYard)[0], z: fromPlan(P.logYard)[1], yaw: 0 };
  const resolved = resolveLayout({ anchors: { logYard: anchor }, logYard: raw.logYard, scenery: at('logYard', P.scenery) });
  return {
    woods: {
      ...W,
      minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ, outline, south: [fromPlan(south[0]), fromPlan(south[south.length - 1])],
      gate: { x: gate[0], z: gate[1], width: W.gate.width, open: true },
      circuit: { ...W.circuit, points: W.circuit.points.map(moved) },
      backLane: { x: back[0], z: back[1], width: 2 * west.half },
      leadIn: [gate, [gate[0], gate[1] - 12], ...P.leadIn.map(fromPlan), ...W.leadIn.slice(1).map(moved)],
      hump: { ...W.hump, x: W.hump.x + dx, z: W.hump.z + dz },
      pond: { ...W.pond, x: W.pond.x + dx, z: W.pond.z + dz },
      deadwood: [...W.deadwood.map(([x, z, yaw, len]) => [x + dx, z + dz, yaw, len]), ...P.deadwood.map(([x, z, yaw, len]) => [...fromPlan([x, z]), yaw, len])],
      trail: { ...W.trail, points: W.trail.points.map(moved), entrance: { x: W.trail.entrance.x + dx, z: W.trail.entrance.z + dz } },
      oak: { x: fromPlan(P.oak)[0], z: fromPlan(P.oak)[1], clear: 11 },
      trees: Math.round(W.trees * area),
      bushes: Math.round(W.bushes * area),
    },
    anchor,
    logYard: { ...resolved.logYard, scenery: resolved.scenery },
  };
}

/** The Old Pit on the new farm (#685), plan metres: where the dealt pit is centred, in the field's west of centre so the lane side has the entrance. */
export const PIT_PLAN = { centre: [805, 108], gateWidth: 4.8 };

/**
 * `layout.quarry` on the new farm, game metres (#685): today's, with the pit's field as its own shape (`outline`, with `minX` to `maxZ` its bounds),
 * the pit centred about `PIT_PLAN.centre`, and its two gates (`gates`): the lane gate the haul road ends in, shut and solid, and the farm gate from the
 * stone track, tied open, the way in. Each is `{ id, x, z, width, open, inward }` where `inward` is the unit vector from it into the field.
 */
export function quarryLayout(today, P = PIT_PLAN) {
  const Q = today.quarry;
  const fields = clippedFields();
  const runs = boundariesOf(fields);
  const outline = movePoints(fields.find((f) => f.name === 'pit').points);
  const b = polygonBounds(outline);
  const gateways = placeGateways(runs);
  const [mx, mz] = [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2];
  const gateOf = (id, extra) => {
    const g = gateways.find((w) => w.id === id);
    const run = movePoints(runs[g.boundary].points);
    const [x, z] = movePoints([pointOnRun(runs[g.boundary].points, g.at)])[0];
    // The stretch of the line the gate is on, and the normal to it that points into the field.
    const edges = run.slice(1).map((q, i) => edgeBetween(run[i][0], run[i][1], q[0], q[1]));
    const edge = edges.reduce((best, e) => {
      const t = Math.max(0, Math.min(e.length, (x - e.x1) * e.dx + (z - e.z1) * e.dz));
      const d = Math.hypot(x - (e.x1 + e.dx * t), z - (e.z1 + e.dz * t));
      return d < best.d ? { e, d } : best;
    }, { e: edges[0], d: Infinity }).e;
    const turn = (mx - x) * -edge.dz + (mz - z) * edge.dx >= 0 ? 1 : -1;
    return { id, x, z, width: P.gateWidth, inward: [-edge.dz * turn, edge.dx * turn], ...extra };
  };
  const centre = fromPlan(P.centre);
  const lane = gateOf('pitlane', { open: false, haul: true });
  return {
    quarry: {
      name: Q.name, minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ, outline, centre: { x: centre[0], z: centre[1] },
      gates: [lane, gateOf('quarry', { open: true })],
    },
    anchor: { x: centre[0], z: centre[1], yaw: 0 },
    budgetSpots: { pitGate: { x: lane.x + lane.inward[0] * 8, z: lane.z + lane.inward[1] * 8 } }, // just inside the shut lane gate, looking out at it and in at the pit (#685)
  };
}

/**
 * The hill side on the new farm (#684), plan metres: the green lane, the stream and the ford, Hill Pasture with its banks, climb, fence, hut and flask
 * rock, the Sheep Field and the Wet Meadow. The shapes are today's (`layout.hill` in layout.js, read by world/hill.js), set on the plan's fields.
 * `lane` is the lane's middle line (the lane field is its hedges' width either side: `CORNERS_PLAN` pe less p1) from the head at Home Ground's
 * edge to `toZ`, just short of the stream at `stream.z`. `bankStretch` carries today's six banks out from the stream to about 175 m deep, where
 * the plan's map draws them (Jamie, 16 November 2026): each bank keeps its rise and width, so each is still 38 degrees at its steepest, and the
 * treads between them lengthen. `gentle` is the easy way up at the east end by Brook Meadow, which the climb takes. `fence` runs north to south
 * from the stream to the south hedge, its gap 22 m wide from the stream's edge, the whole of the foot, where quads cross it on the way to the climb. `wood` is the copse in the
 * pasture's north-west, thicker than today's (`trees`, `bushes`). The meadow's pond is at the plan's (112, 292) with its way in from the gateway
 * at (197, 296); its oaks stand round it as they did, by their offsets from it. The sheep field is walled all round, the lane's side included (the lane has a hedge on Far Field's side and the wall on the other, #674's review). Its cross wall runs near the top at z 468,
 * its gap mid-field, and its banks fall in two terraces; `thorns` are in clumps clear of the wall, the gateways and the barn's spot.
 */
export const HILL_PLAN = {
  lane: { x: 199.6, top: 440, toZ: 564, halfWidth: 2.1, sink: 1, hedgeOff: 4.6, hedgeHeight: 3.3 },
  gates: [{ side: -1, z: 500, width: 4.8 }, { side: 1, z: 500, width: 4.8 }],
  stream: { z: 570, wander: 2.5, halfWidth: 1.6, depth: 0.75, water: 0.32, ford: { halfWidth: 3.4, depth: 0.42, reach: 6 } },
  valley: 2.5,
  bankStretch: 3.3,
  slowWander: 4,
  gentle: { fromX: 300, toX: 380, factor: 2.4 },
  wood: { minX: 52, maxX: 100, minZ: 610, maxZ: 690, trees: 85, bushes: 150 },
  crown: { rise: 3.5, r: 55 }, // a swell under the hut, so its roof shows over the last bank from the ford (the plan's landform alone hides it by 2 m)
  hedgeOaks: [[190, 841, 1.4], [290, 836.5, 1.3], [375, 836, 1.5], [419, 650, 1.5], [419, 790, 1.2]],
  fence: { from: [232, 574], to: [232, 848], gap: { at: 14, half: 11 } },
  viewpoint: { at: [262, 814], yaw: Math.PI, height: 0.45 },
  climb: { points: [[372, 598], [380, 660], [368, 715], [352, 772]], gateHalf: 4.5 },
  meadow: {
    pond: { at: [112, 292], rx: 11, rz: 8, depth: 1.1, water: 0.6 },
    track: [[193, 296], [176, 295.4], [160, 294.6], [144, 293.6], [126, 292.6]],
    trees: [[-8, 6], [4, 10], [11, 4], [9, -9], [-2, -10], [-11, -12]], // offsets from the pond, today's but for the west bank's, where the veteran oak stands (#881)
  },
  sheep: {
    terraces: { banks: [491, 527], width: 7, ease: 10, stand: [330, 478] },
    wall: { z: 468, to: 414, gap: { at: 330, half: 2.6 }, height: 1 },
    thorns: [[222, 512], [231, 540], [258, 498], [266, 553], [290, 486], [312, 530], [336, 548], [348, 500], [362, 525], [384, 492], [396, 538], [240, 478], [318, 478], [404, 512]],
  },
};

/**
 * The river and the brook on the new farm (#565), plan metres: the hill's stream widens at (420, 572) into the river through Brook Meadow, full width
 * to about x 650, and narrows back to the brook, which runs east under the lane's bridge (#688) and past the north of the village street to a spring by the A-road. The land falls east, so
 * the water runs with it. `points` are the brook's waypoints after the stream's end; `river` is world/brook.js's (`fromX`, `rampIn`, `toX`,
 * `rampOut`, `halfWidth`, `bends`, `vary`, `drinks`: [x, side]); `crossing` is the raised bed (its x a plan x); `bridge` is where the farm
 * bridge (#689) goes over the river, `willows` are [x, side, metres out from the bank] and `crackWillow` the big one by the bridge.
 */
export const RIVER_PLAN = {
  points: [[535, 586], [650, 600], [694, 621], [751, 636], [815, 645], [885, 647], [905, 653], [925, 660], [960, 668], [1000, 674], [1050, 674], [1100, 670], [1150, 668], [1200, 671], [1250, 676]],
  wander: 1.2,
  source: 30, // it shallows out to a spring 30 m before its end, short of the A-road's verge (#688)
  river: {
    eastward: true, fromX: 420, rampIn: 40, toX: 710, rampOut: 60, halfWidth: 5.25, depth: 1.3, water: 0.95, deepFrom: 0.45, level: 9,
    bends: { amp: 8, k: 0.068, phase: 0.6 }, vary: { amount: 0.25, k: 0.17, phase: 1 },
    drinks: [[505, -1], [560, -1], [615, -1], [530, 1], [585, 1], [630, 1]],
    worn: [[424, 544, 6], [420, 640, 5]], // [x, z, r] the trodden ground at the gateways from Hay Meadow and the stone track
    // The banks from the bends (#999, world/brook.js): the water stands `freeboard` m under the field; `wall` m from the bed's edge to the field in a
    // straight, `cut` on a bend's outside; the bar comes out of the water at `bar.from` of the half-width and runs `bar.reach` m on up to the field;
    // a bend's banks start at `from` of its sine and are full by `full`; the crossing's landings run `landing` m back and a drinking place `drink`;
    // `relief` m of hummocks on the banks; the brook past the meadow has its own `wall` as far as `brook.to`, the lane's verge.
    banks: { freeboard: 0.8, wall: 1.6, cut: 0.9, bar: { from: 0.55, reach: 5.5 }, from: 0.25, full: 0.7, landing: 7, drink: 4.5, relief: 0.14, brook: { wall: 1.3, to: 899 } },
    // The pools and riffles (#1000, world/brook.js): from `from` the surface steps, let down `lead.depth` m over the `lead.reach` m above it so the bank
    // above the crossing stays 0.3 m clear, until it meets the steady fall again (by `to`). The crossing is the first riffle, `crossing` m long about its
    // middle and `narrow` of its width narrower; `riffles` are the plan x's where each of the rest begins, `length` m long, the last where the river
    // narrows into the brook, below which the surface falls `tail.share` as fast as the steady fall until it meets it (the land falls away south of it
    // there, and its bank would stand only 0.06 m over the water). A pool's surface falls `third` as fast as the river's steady fall, and a riffle drops
    // it back to `below` m under that, by `drop` m; the water stands `water.head` deep at a pool's head and `water.foot` at its foot, `water.riffle` over
    // a riffle, which has a gravel bar out of the water from `bar.from` of the half-width (`bar.bend` on a bend, where the bend's own bar is already out
    // there) and `bar.reach` m on up the bank, running `bar.tail` m past its foot. The land falls 7.2% from the crossing for 100 m and 1.5% for
    // the 70 m below it, so on the steep reach a riffle comes every 7 to 12 m (0.5 m is the most a riffle drops, and with 12 m pools it couldn't keep
    // up with the land there) and on the flat the pools are long. Where they go was walked out from the ground: a riffle wherever the pool's surface had
    // climbed back to the steady fall, its pool 4 m and more from riffle to riffle.
    steps: {
      from: 450, to: 760, crossing: 3, length: 2, third: 1 / 3, below: 0.3, drop: [0.3, 0.5], narrow: 0.1, lead: { reach: 15, depth: 0.25 }, tail: { share: 0.8 },
      riffles: [487.5, 495.5, 502.5, 510.75, 517.75, 526, 534, 543, 554.5, 563, 570, 577, 589, 648, 665],
      water: { head: 0.95, foot: 1.4, riffle: 0.38 }, bar: { from: 0.35, bend: 0.15, reach: 4, tail: 0.5 },
    },
  },
  crossing: { x: 475, half: 4.5, ramp: 3, water: 0.2, posts: 4 },
  bridge: [420, 572],
  crackWillow: [431, 563],
  willows: [
    [447, -1, 3.5], [452, -1, 6.5], [466, 1, 4], [497, 1, 5], [503, 1, 8.5], [521, -1, 4.5], [549, 1, 4], [556, 1, 7.5],
    [572, -1, 5], [578, -1, 8], [601, 1, 4.5], [606, 1, 8], [624, -1, 4], [628, -1, 7],
  ],
};

const boundsRect = (pts) => {
  const b = polygonBounds(pts);
  return { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ };
};

/** The brook, the river and its meadow for `layout.hill` on the new farm, game metres (#565): `meadow` is Brook Meadow's own outline. */
export function riverLayout(hill, meadow, P = RIVER_PLAN) {
  const R = P.river;
  const [crossX] = fromPlan([P.crossing.x, 0]);
  const gateXs = [meadow.minX, meadow.maxX, fromPlan([885, 0])[0]]; // the farm's east boundary, along the lane
  return {
    brook: { points: P.points.map(fromPlan), wander: P.wander, source: P.source, bridge: true },
    river: {
      ...R, fromX: fromPlan([R.fromX, 0])[0], toX: fromPlan([R.toX, 0])[0], drinks: R.drinks.map(([x, side]) => [fromPlan([x, 0])[0], side]), worn: R.worn.map(([x, z, r]) => [...fromPlan([x, z]), r]),
      crossing: { ...P.crossing, x: crossX }, bridge: { x: fromPlan(P.bridge)[0], z: fromPlan(P.bridge)[1] },
      banks: { ...R.banks, brook: { ...R.banks.brook, to: fromPlan([R.banks.brook.to, 0])[0] } },
      steps: { ...R.steps, from: fromPlan([R.steps.from, 0])[0], to: fromPlan([R.steps.to, 0])[0], riffles: R.steps.riffles.map((x) => fromPlan([x, 0])[0]) },
    },
    riverside: {
      ...meadow, gates: gateXs, trees: [],
      willows: P.willows.map(([x, side, off]) => [fromPlan([x, 0])[0], side, off]), crackWillow: fromPlan(P.crackWillow),
    },
  };
}

/**
 * `layout.hill` on the new farm, game metres (#684): today's, with the places in `HILL_PLAN` and each field's own outline for the pasture, the sheep
 * field and the meadow. The river, the brook and Brook Meadow are put on at the end (`riverLayout`, #565).
 */
export function hillLayout(today, P = HILL_PLAN) {
  const T = today.hill;
  const fields = Object.fromEntries(clippedFields().map((f) => [f.name, movePoints(f.points)]));
  const pt = (p) => fromPlan(p);
  const here = (name) => ({ ...boundsRect(fields[name]), points: fields[name] });
  const [lx] = pt([P.lane.x, 0]);
  const [, top] = pt([0, P.lane.top]);
  const [, toZ] = pt([0, P.lane.toZ]);
  const [, streamZ] = pt([0, P.stream.z]);
  const [, wallZ] = pt([0, P.sheep.wall.z]);
  const pond = pt(P.meadow.pond.at);
  const climbStand = pt(P.sheep.terraces.stand);
  const [fx0, fz0] = pt(P.fence.from);
  const [fx1, fz1] = pt(P.fence.to);
  const hill = {
    ...T,
    lane: { ...T.lane, x: lx, top, toZ, halfWidth: P.lane.halfWidth, sink: P.lane.sink, hedgeOff: P.lane.hedgeOff, hedgeHeight: P.lane.hedgeHeight },
    pasture: here('hill'),
    stream: { ...T.stream, ...P.stream, z: streamZ, west: { x: fromPlan(BACK_LANE_PLAN.ford.at)[0], minX: fromPlan([BACK_LANE_PLAN.ford.west, 0])[0], halfRoad: BACK_LANE_PLAN.halfWidth } },
    valley: P.valley,
    slowWander: P.slowWander,
    banks: T.banks.map((b) => ({ ...b, at: Math.round(b.at * P.bankStretch) })),
    gentle: { ...T.gentle, fromX: pt([P.gentle.fromX, 0])[0], toX: pt([P.gentle.toX, 0])[0], factor: P.gentle.factor },
    wood: { minX: pt([P.wood.minX, 0])[0], maxX: pt([P.wood.maxX, 0])[0], minZ: pt([0, P.wood.minZ])[1], maxZ: pt([0, P.wood.maxZ])[1], trees: P.wood.trees, bushes: P.wood.bushes },
    crown: { x: pt(FIELD_LANDMARKS_PLAN.find((l) => l.kind === 'hut').at)[0], z: pt(FIELD_LANDMARKS_PLAN.find((l) => l.kind === 'hut').at)[1], ...P.crown },
    hedgeOaks: P.hedgeOaks.map(([x, z, s]) => [...pt([x, z]), s]),
    gates: P.gates.map((g) => ({ ...g, z: pt([0, g.z])[1] })),
    paddocks: {
      ramp: T.paddocks.ramp,
      west: {
        rect: here('wet'),
        pond: { ...T.paddocks.west.pond, ...P.meadow.pond, x: pond[0], z: pond[1], at: undefined },
        track: P.meadow.track.map(pt),
        trees: P.meadow.trees.map(([dx, dz]) => [pond[0] + dx, pond[1] + dz]),
      },
      east: {
        rect: here('sheep'),
        terraces: { banks: P.sheep.terraces.banks.map((z) => pt([0, z])[1]), width: P.sheep.terraces.width, ease: P.sheep.terraces.ease, stand: { x: climbStand[0], z: climbStand[1] } },
        wall: { z: wallZ, from: lx + P.lane.hedgeOff, to: pt([P.sheep.wall.to, 0])[0], height: P.sheep.wall.height, gap: { at: pt([P.sheep.wall.gap.at, 0])[0], half: P.sheep.wall.gap.half } },
        thorns: P.sheep.thorns.map(pt),
      },
    },
    fence: { from: [fx0, fz0], to: [fx1, fz1], gap: P.fence.gap },
    viewpoint: { x: pt(P.viewpoint.at)[0], z: pt(P.viewpoint.at)[1], yaw: P.viewpoint.yaw, height: P.viewpoint.height },
    hut: { ...T.hut, x: pt(FIELD_LANDMARKS_PLAN.find((l) => l.kind === 'hut').at)[0], z: pt(FIELD_LANDMARKS_PLAN.find((l) => l.kind === 'hut').at)[1] },
    climb: { points: P.climb.points.map(pt), gateHalf: P.climb.gateHalf },
  };
  Object.assign(hill, riverLayout(hill, here('brook')));
  delete hill.paddocks.west.pond.at;
  return hill;
}

/**
 * Nether Thornby (#688), plan metres: across the lane, its street leaving the lane's east edge at a junction (the brook passes under the lane's bridge 60 m
 * north of it) and running east, past the pub, the green, the shop and the cottages, to the stub of it at the A-road (`STREET_STUB_PLAN`). Every building
 * is centred on its footprint on the plan's map (docs/farm-plan.svg) at the size it was built at, and faces the street: yaw 0 on the north side (its front
 * to the south), Math.PI on the south. The garage is on the lane itself, its forecourt south of it with a mouth onto the lane. The church's plot, the hall
 * and the playing field are left clear (`clear`, #715, #716). Everything is an offset from `anchor`, so the village moves as one (layoutAnchors.js).
 */
export const VILLAGE_PLAN = {
  anchor: [1000, 710],
  limit: 20,
  pavement: 1.7,
  street: [[907, 720], [930.5, 720.8], [955, 720.9], [982.6, 720.2], [1013, 719.3], [1047.5, 718.2], [1086, 717.3], [1129, 716.5], [1177.6, 716.3], [1232, 717]],
  area: [906, 586, 1234, 812], // [minX, minZ, maxX, maxZ]: the street, the garage and its forecourt, the church's plot's front and the playing field
  pub: {
    name: 'The Plough & Harrow', at: [981, 698], halfX: 8.5, halfZ: 5.5, wallHeight: 5.6, ridge: 8.8, door: [981, 704.2],
    carPark: { rect: [932, 690, 964, 712], entry: [942, 951] }, stop: [948, 701], benches: [[974, 710], [988, 709.2]],
  },
  shop: { name: "Pargeter's Stores", sub: 'Post Office', at: [987, 732], halfX: 5.5, halfZ: 4.5, wallHeight: 5.3, ridge: 7.8, door: [983.6, 727.2] },
  garage: {
    name: 'Hollis Motors', at: [943, 592.5], halfX: 8, halfZ: 4.2, wallHeight: 4.4, ridge: 5.6,
    pumps: [[922, 606], [930, 606], [938, 606]], forecourt: [907.4, 596.7, 953, 612], board: [910.6, 610.6],
  },
  // `design` is the house's shape (villageHouses.js: 'cottage' the plain pair of storeys, 'thatched', 'gabled' a larger house with a cross-gable, 'bungalow', 'terrace' three
  // houses in a row); the others of the issue's "different designs" (#543) are on the lane's approach. n7 and the bench at the far end fill the bare end opposite the pub.
  cottages: [
    { id: 'n1', at: [1057, 698.5], yaw: 0, halfX: 4, halfZ: 3.2, wallHeight: 4.6, ridge: 7, wall: 'render', paint: '#d8cfae', door: '#7a2a22' },
    { id: 'n2', at: [1083, 698.5], yaw: 0, design: 'thatched', halfX: 4.2, halfZ: 3.5, wallHeight: 3.9, ridge: 7.1, wall: 'stone', door: '#2d4a3a' },
    { id: 'n3', at: [1109, 698.5], yaw: 0, design: 'gabled', halfX: 5.2, halfZ: 3.6, wallHeight: 5, ridge: 7.8, wall: 'brick', door: '#23406b' },
    { id: 'n4', at: [1137, 698.5], yaw: 0, halfX: 3.6, halfZ: 3.2, wallHeight: 4.4, ridge: 6.7, wall: 'render', paint: '#cfd8c4', door: '#8a5a2b' },
    { id: 'n5', at: [1165, 698.5], yaw: 0, design: 'bungalow', halfX: 6, halfZ: 4, wallHeight: 2.7, ridge: 4.7, wall: 'render', paint: '#e4dcc4', door: '#6b2f4a' },
    { id: 'n6', at: [1197, 698.5], yaw: 0, design: 'terrace', halfX: 10.5, halfZ: 3.2, wallHeight: 4.6, ridge: 7, wall: 'brick', door: '#2d4a3a', doors: ['#2d4a3a', '#7a2a22', '#23406b'] },
    { id: 'n7', at: [1221, 698.5], yaw: 0, halfX: 4, halfZ: 3.2, wallHeight: 4.6, ridge: 7, wall: 'render', paint: '#cfd8c4', door: '#8a5a2b' },
    { id: 's1', at: [1041, 730.5], yaw: Math.PI, halfX: 4, halfZ: 3.2, wallHeight: 4.6, ridge: 7, wall: 'brick', door: '#23406b' },
    { id: 's2', at: [1069, 730.5], yaw: Math.PI, design: 'bungalow', halfX: 6, halfZ: 4, wallHeight: 2.7, ridge: 4.7, wall: 'render', paint: '#cfd8c4', door: '#8a5a2b' },
    { id: 's3', at: [1097, 730.5], yaw: Math.PI, design: 'thatched', halfX: 4.2, halfZ: 3.5, wallHeight: 3.9, ridge: 7.1, wall: 'stone', door: '#6b2f4a' },
    { id: 's4', at: [1127, 730.5], yaw: Math.PI, design: 'gabled', halfX: 5.2, halfZ: 3.6, wallHeight: 5, ridge: 7.8, wall: 'render', paint: '#d8cfae', door: '#7a2a22' },
    { id: 's5', at: [1160, 730.5], yaw: Math.PI, design: 'terrace', halfX: 10.5, halfZ: 3.2, wallHeight: 4.6, ridge: 7, wall: 'brick', door: '#2d4a3a', doors: ['#8a5a2b', '#2d4a3a', '#6b2f4a'] },
  ],
  green: { at: [1022, 699], r: 9 }, // the plan's green is 12 m across the middle of it: its oak, a bench and the war memorial's place (#716) stand on it
  trees: [{ at: [1022, 697], scale: 0.8 }, { at: [1070, 697], scale: 0.5 }, { at: [1151, 697], scale: 0.5 }],
  sign: [917, 714], // "Nether Thornby", at the junction on the street's north side
  phone: [1002, 725.6],
  busStop: [972, 725.6],
  farBench: [1208, 713.4], // a bench at the street's far end, on the north verge, looking over the street (#543)
  /**
   * The lane's approach (#819): the village builds up as you drive in. 30 mph discs and a village sign on the lane at z 486 (from the north) and z 800 (from the south) and on the street
   * at x 1262 (from the A-road), each post's back the national limit for the traffic leaving; three houses facing the lane across their front gardens, and a small farm, a stone
   * house and a barn round a walled yard with its gateway on a track from the lane. A sign's `yaw` is where its front looks (0 south, Math.PI north, Math.PI / 2 east). The
   * lane's east verge is x 909.2 and its west x 900.8; the street's verges are 5.3 m either side of its middle.
   */
  approach: {
    limit: 30,
    houses: [
      { id: 'l1', at: [927, 500], yaw: -Math.PI / 2, design: 'gabled', halfX: 5.5, halfZ: 4.2, wallHeight: 5, ridge: 7.8, wall: 'brick', door: '#7a2a22' },
      { id: 'l2', at: [927, 526], yaw: -Math.PI / 2, design: 'thatched', halfX: 4.4, halfZ: 3.6, wallHeight: 4, ridge: 7.2, wall: 'stone', door: '#2d4a3a' },
      { id: 'l3', at: [927, 552], yaw: -Math.PI / 2, design: 'bungalow', halfX: 6, halfZ: 4.2, wallHeight: 2.7, ridge: 4.7, wall: 'render', paint: '#d8cfae', door: '#23406b' },
    ],
    farm: {
      yard: [932, 442, 982, 478], wall: 0.5, wallHeight: 1.4,
      gateway: { z: 459.5, width: 4.5 }, // in the west wall
      track: { from: [905, 459.5], halfWidth: 2 },
      house: { id: 'fh', name: 'the farmhouse', at: [955, 450.2], yaw: 0, design: 'farmhouse', halfX: 6.5, halfZ: 4.2, wallHeight: 5, ridge: 7.6, wall: 'stone', door: '#2d4a3a' },
      barn: { id: 'fb', name: 'the barn', at: [957, 470.5], yaw: Math.PI, design: 'barn', halfX: 13, halfZ: 5, wallHeight: 4.4, ridge: 7.2, wall: 'stone', door: '#5a4a32' },
    },
    signs: [
      { kind: 'limit', at: [909.2, 486], yaw: Math.PI }, { kind: 'limit', at: [900.8, 486], yaw: Math.PI }, { kind: 'village', at: [909.2, 481], yaw: Math.PI },
      { kind: 'limit', at: [900.8, 800], yaw: 0 }, { kind: 'limit', at: [909.2, 800], yaw: 0 }, { kind: 'village', at: [900.8, 805], yaw: 0 },
      { kind: 'limit', at: [1262, 711.7], yaw: Math.PI / 2 }, { kind: 'limit', at: [1262, 723.3], yaw: Math.PI / 2 }, { kind: 'village', at: [1267, 723.3], yaw: Math.PI / 2 },
    ],
  },
  // Left clear (the church's plot, the hall and the playing field): plan rectangles [minX, minZ, maxX, maxZ].
  clear: { church: [1228, 740, 1280, 788], hall: [1180, 727, 1200, 738], field: [1036, 756, 1152, 810] },
  gardenDepth: 6,
};

/** Nether Thornby on the new farm, game metres (#688): `layout.village` as the village's code reads it, and the anchor it is placed from. */
export function villageLayout(P = VILLAGE_PLAN) {
  const [ax, az] = fromPlan(P.anchor);
  const rel = ([x, z]) => { const [gx, gz] = fromPlan([x, z]); return [gx - ax, gz - az]; };
  const pt = (p) => { const [x, z] = rel(p); return { x, z }; };
  const rect = ([x0, z0, x1, z1]) => { const [a, b] = rel([x0, z0]); const [c, d] = rel([x1, z1]); return { minX: a, maxX: c, minZ: b, maxZ: d }; };
  const building = ({ at: p, door, ...b }) => ({ ...pt(p), ...b, ...(door ? { door: Array.isArray(door) ? pt(door) : door } : {}) });
  const G = P.garage;
  const cp = P.pub.carPark;
  const [, ez0] = rel([0, cp.rect[3]]);
  const local = {
    name: 'Nether Thornby',
    limit: P.limit,
    road: { pavement: P.pavement },
    area: rect(P.area),
    pub: {
      ...building(P.pub),
      yaw: 0,
      carPark: { ...rect(cp.rect), entry: { minX: rel([cp.entry[0], 0])[0], maxX: rel([cp.entry[1], 0])[0], minZ: ez0, maxZ: ez0 } },
      stop: pt(P.pub.stop),
      benches: P.pub.benches.map(pt),
    },
    shop: { ...building(P.shop), yaw: Math.PI },
    garage: { ...building(G), yaw: 0, pumps: { spots: G.pumps.map((p) => [rel(p)[0], rel(p)[1]]) }, forecourt: rect(G.forecourt), board: pt(G.board) },
    cottages: P.cottages.map(building),
    farBench: pt(P.farBench),
    approach: {
      limit: P.approach.limit,
      houses: P.approach.houses.map(building),
      farm: {
        yard: rect(P.approach.farm.yard), wall: P.approach.farm.wall, wallHeight: P.approach.farm.wallHeight,
        gateway: { ...pt([P.approach.farm.yard[0], P.approach.farm.gateway.z]), width: P.approach.farm.gateway.width },
        house: building(P.approach.farm.house), barn: building(P.approach.farm.barn),
      },
      signs: P.approach.signs.map(({ at: p, ...sign }) => ({ ...pt(p), ...sign })),
    },
    green: { ...pt(P.green.at), r: P.green.r },
    trees: P.trees.map(({ at: p, scale }) => ({ ...pt(p), scale })),
    sign: pt(P.sign),
    phone: pt(P.phone),
    busStop: pt(P.busStop),
    clear: Object.fromEntries(Object.entries(P.clear).map(([k, r]) => [k, rect(r)])),
    gardenDepth: P.gardenDepth,
    flat: false, // the ground is the land's own, not laid to a plane along the street (the street runs 325 m)
  };
  const { village } = resolveLayout({ anchors: { village: { x: ax, z: az, yaw: 0 } }, village: at('village', local) });
  village.garage.pumps.xs = village.garage.pumps.spots.map(([x]) => x);
  village.garage.pumps.z = village.garage.pumps.spots[0][1];
  const street = {
    id: 'street', name: 'the village street', surface: 'tarmac', halfWidth: 2.3, pavement: P.pavement, junction: { end: 'start', onto: 'lane' },
    markings: { centre: 'dashed', edge: true, giveWay: true }, points: P.street.map(fromPlan), verge: 0, hedged: false, draw: 'mesh', lift: 0.075,
  };
  const F = P.approach.farm;
  const track = {
    id: 'farmTrack', name: 'the small farm\'s track', surface: 'tarmac', halfWidth: F.track.halfWidth, points: [fromPlan(F.track.from), fromPlan([F.yard[0], F.gateway.z])],
    junction: { end: 'start', onto: 'lane' },
  };
  return { village, anchor: { x: ax, z: az, yaw: 0 }, street, track };
}

/** The Moor's two budget spots in game metres (#821): beside the trig pillar on the ridge, looking out over the whole common, and in the middle of the common among its heather. */
export function moorBudgetSpots() {
  const [rx, rz] = fromPlan([MOOR_FEATURES_PLAN.trig.at[0] + 6, MOOR_FEATURES_PLAN.trig.at[1]]);
  const [mx, mz] = fromPlan([-190, 470]);
  return { moorRidge: { x: rx, z: rz }, moorMiddle: { x: mx, z: mz } };
}

/**
 * The moor gate (#713) in game metres: the point of the outline's wall nearest `RESERVED_PLAN.moorGate`, the way the wall runs there (`yaw`, the gate's length along it) and
 * the width between its posts, which is the gateway's gap less the posts' own room, as the drive's bypass gate has it.
 */
export function moorGateLayout() {
  const gw = GATEWAYS_PLAN.find((g) => g.id === 'moor');
  const [px, pz] = RESERVED_PLAN.moorGate.at;
  let best = null;
  OUTLINE_PLAN.forEach((a, i) => {
    const b = OUTLINE_PLAN[(i + 1) % OUTLINE_PLAN.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const t = Math.min(1, Math.max(0, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
    if (!best || d < best.d) best = { d, at: [a[0] + dx * t, a[1] + dz * t], yaw: Math.atan2(dx, dz) };
  });
  const [x, z] = fromPlan(best.at);
  return { x, z, yaw: best.yaw, width: 2 * gw.half - 0.7 };
}

/**
 * The farm's tracks, bridge and headlands in game metres (#689): the two stone tracks and the grass boundary track as roads of the network (painted into
 * the ground, so the weather lies on them), the farm bridge where the south track crosses the river's head, and each arable field's headland as `{ field, ring }`
 * (the ring is the strip's inner edge, `width` m in from the field's own edge).
 */
export function tracksLayout(T = STONE_TRACKS_PLAN) {
  const stone = (id, name, pts, worn = []) => ({
    id, name, surface: 'stone', halfWidth: T.halfWidth, points: densify(pts, 25).map(fromPlan), markings: { centre: 'none' }, verge: T.verge, hedged: false, draw: 'ground',
    worn: worn.map(([x, z, r]) => [...fromPlan([x, z]), r]), // [x, z, r] ground trodden bare: the banks at the farm bridge's two ends
  });
  const loop = boundaryTrackPoints(OUTLINE_PLAN);
  const B = BOUNDARY_TRACK_PLAN;
  const roads = [
    stone('stoneNorth', 'the stone track north', T.north),
    stone('stoneSouth', 'the stone track south', T.south, [[FARM_BRIDGE_PLAN.at[0], FARM_BRIDGE_PLAN.at[1] - FARM_BRIDGE_PLAN.length / 2 - 2.2, 3.2], [FARM_BRIDGE_PLAN.at[0], FARM_BRIDGE_PLAN.at[1] + FARM_BRIDGE_PLAN.length / 2 + 2.2, 3.2]]),
    { id: 'boundaryTrack', name: 'the boundary track', surface: 'grass', halfWidth: B.halfWidth, points: [...loop, loop[0]].map(fromPlan), markings: { centre: 'none' }, verge: B.verge, hedged: false, draw: 'ground', loop: true },
  ];
  const [bx, bz] = fromPlan(FARM_BRIDGE_PLAN.at);
  const headlands = clippedFields().filter((f) => f.kind === 'arable').map((f) => ({ field: f.name, ring: movePoints(headlandRing(f.points)) }));
  return { roads, farmBridge: { x: bx, z: bz, length: FARM_BRIDGE_PLAN.length, width: FARM_BRIDGE_PLAN.width, yaw: FARM_BRIDGE_PLAN.yaw }, headlands: { width: HEADLAND_WIDTH, fields: headlands } };
}

/** The A-road junction's budget spot (#692): 14 m up the lane from where it meets the A-road, on the lane's centre line, looking at the junction's furniture and the road beyond. */
function junctionSpot([a, b]) {
  const t = 14 / Math.hypot(b[0] - a[0], b[1] - a[1]);
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t };
}

/** The frame budget's spot at the river (#999): on the crossing's north landing, 6 m back from the water, from the crossing's one anchor (brook.js `crossing`). */
function riverBudgetSpot(hill) {
  const c = createBrook({ hill })?.crossing();
  return c ? c.landing(-1, 6) : null;
}

/** The farm: the base layout (resolved) with what the plan moves put in its place. */
export function layoutNew(today, raw) {
  const [gx0, gz0] = fromPlan([GROUND_PLAN.minX, GROUND_PLAN.minZ]);
  const [gx1, gz1] = fromPlan([GROUND_PLAN.maxX, GROUND_PLAN.maxZ]);
  const arable = FIELDS_PLAN.filter((f) => f.kind === 'arable');
  const [hx, hz] = fromPlan(NORTH_HOLLOW_PLAN.at);
  const drive = driveLayout();
  const neighbour = neighbourLayout();
  const farmstead = farmsteadLayout(today, raw);
  const wood = woodsLayout(today, raw);
  const hill = hillLayout(today);
  const pit = quarryLayout(today);
  const village = villageLayout();
  const tracks = tracksLayout();
  const stubbleFields = Object.fromEntries(arable.map((f, i) => [f.name, { ...(i % 2 ? WHEAT : BARLEY) }]));
  const fieldsLayout = newFields();
  stubbleFields.north = { ...stubbleFields.north, hollow: { x: hx, z: hz, rx: NORTH_HOLLOW_PLAN.rx, rz: NORTH_HOLLOW_PLAN.rz, depth: NORTH_HOLLOW_PLAN.depth } };
  const layout = {
    ...farmstead, ground: { minX: gx0, maxX: gx1, minZ: gz0, maxZ: gz1 }, landform: landformPoints(), stubbleClumps: STUBBLE_CLUMPS, stubbleFields, ...fieldsLayout, ...fieldWorkPlaces(fieldsLayout.fields), jobFields: JOB_FIELDS,
    stewardship: stewardshipLayout(), reserved: reservedLayout(),
    upperThornby: { at: fromPlan(BACK_LANE_PLAN.upperThornby) },
    junctions: JUNCTIONS_PLAN, turnRound: turnRoundLayout(), laneFittings: laneFittingsLayout(), aRoadFittings: { layBy: { ...A_ROAD_PLAN.layBy, z: A_ROAD_PLAN.layBy.z - PLAN_ORIGIN[1] } },
    ...drive, roads: [...drive.roads, village.street, village.track, neighbour.track, backLaneLayout(), aRoadLayout(), streetStubLayout(), ...tracks.roads], farmBridge: tracks.farmBridge, headlands: tracks.headlands,
    woods: wood.woods, logYard: wood.logYard, hill, village: village.village, quarry: pit.quarry, gate: { x: hill.lane.x, z: hill.lane.top, side: 'south', width: today.gate.width, open: true },
    anchors: { ...farmstead.anchors, village: village.anchor, neighbour: neighbour.anchor, logYard: wood.anchor, pit: pit.anchor, hut: { x: hill.hut.x, z: hill.hut.z, yaw: 0 } }, neighbourFarm: neighbour.neighbourFarm, neighbourLand: neighbourLandLayout(),
    budgetSpots: { ...farmstead.budgetSpots, ...pit.budgetSpots, junction: junctionSpot(drive.roads.find((r) => r.id === 'lane').points), hairpins: (([x, z]) => ({ x, z }))(fromPlan(BACK_LANE_PLAN.budgetSpot)), backLaneNorth: (([x, z]) => ({ x, z }))(fromPlan(BACK_LANE_PLAN.farViewSpot)), neighbour: { x: neighbour.neighbourFarm.gateway.x + 3, z: neighbour.neighbourFarm.gateway.z }, ...moorBudgetSpots(), river: riverBudgetSpot(hill) }, // the neighbour's just inside her gateway (#569), the Moor's on its ridge and in its middle (#821), the river's crossing (#999)
    fieldLandmarks: fieldLandmarksLayout(), moor: { ...moorLayout(MOOR_FEATURES_PLAN, MOOR_PLAN, fromPlan), gate: moorGateLayout() },
    landmarks: LANDMARKS_PLAN.map((l) => ({ ...l, at: fromPlan(l.at) })),
    // The places a girl names where she is (npc/spotNames.js), where the new farm has them (#690): down the green lane, on the hill by the flask rock, just inside the wood's gate.
    namedSpots: { lane: { x: hill.lane.x, z: hill.stream.z - 85 }, hill: { x: hill.viewpoint.x, z: hill.viewpoint.z }, wood: { x: wood.woods.gate.x, z: wood.woods.gate.z - 12 } },
  };
  for (const key of REMOVED) delete layout[key];
  return layout;
}
