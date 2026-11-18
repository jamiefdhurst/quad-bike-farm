// The new farm (docs/farm-plan.md), built behind `?layout=2` until #692 makes it the default. It starts from today's layout (layout.js) and
// replaces only what has moved: so far the ground, the farm's outline and its fields with their boundaries and gateways (#681). Everything
// else stays at today's numbers until its own move, and is named in `NOT_MOVED_YET` with the issue that moves it. Decided with Jamie on
// 9 November 2026: leaving a piece out stopped the game loading for 16 of the 21 pieces tried (docs/decisions/world.md, "A piece not yet
// moved stays where it is").
//
// Positions here are written in the plan's own metres, as the map in docs/farm-plan.svg has them (x east, z south, from its north-west
// corner), so they can be checked against it by eye. The game's (0, 0) is the middle of the yard, so a game position is the plan position
// less `PLAN_ORIGIN`. Pure: no Three.js.

import { resolveLayout, at } from './layoutAnchors.js';
import { resolveWithBarnLocal } from './layoutBarn.js';
import { intersectPolygons, polygonArea, polygonBounds, clockwise, edgeBetween, insetPolygon, pointInPolygon, distanceToEdges, polygonEdges } from './polygons.js';

/** Where the game's (0, 0) is on the plan: the middle of the yard. */
export const PLAN_ORIGIN = [520, 365];

/** A plan position as a game position. */
export const fromPlan = ([x, z]) => [x - PLAN_ORIGIN[0], z - PLAN_ORIGIN[1]];

/** Which layout `?layout=` asks for: 2 for the new farm, otherwise 1 (today's). */
export const layoutFromSearch = (search = '') => (new URLSearchParams(search).get('layout') === '2' ? 2 : 1);

/** The page's address query for loading on layout `n`: `?layout=2` added for the new farm, taken out for today's, everything else kept. */
export function searchForLayout(search, n) {
  const params = new URLSearchParams(search);
  if (n === 2) params.set('layout', '2');
  else params.delete('layout');
  const q = params.toString();
  return q ? `?${q}` : '';
}

/** The rectangle of ground with physics, drawn in tiles (#665): the farm, Back Lane round it and the far side of the lane, in plan metres. */
const GROUND_PLAN = { minX: -70, maxX: 1350, minZ: -70, maxZ: 970 };

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
  p1: [195, 440], p2: [412, 440], p3: [618, 440],
  r0: [-10, 565], r1: [200, 565], r2: [420, 545], r3: [640, 525], e3: [885, 520],
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
  { name: 'home', label: 'Home Ground', kind: 'grass', corners: 'm1 m2 p2 p1 q1' },
  { name: 'farmstead', label: 'The farmstead', kind: 'yard', corners: 'm2 m3 s0 s1 p3 p2' },
  { name: 'lanefield', label: 'Lane Field', kind: 'arable', corners: 'm3 m4 m5 e1 s0' },
  { name: 'drive', label: 'The drive', kind: 'lane', corners: 's0 e1 e2 s1' },
  { name: 'longpiece', label: 'Long Piece', kind: 'arable', corners: 's1 e2 e3 r3 p3' },
  { name: 'far', label: 'Far Field', kind: 'arable', corners: 'q0 q1 p1 r1 r0' },
  { name: 'sheep', label: 'Sheep Field', kind: 'pasture', corners: 'p1 p2 r2 r1' },
  { name: 'hay', label: 'Hay Meadow', kind: 'hay', corners: 'p2 p3 r3 r2' },
  { name: 'hill', label: 'Hill Pasture', kind: 'rough', corners: 'r0 r1 r2 b2 b0' },
  { name: 'brook', label: 'Brook Meadow', kind: 'pasture', corners: 'r2 r3 l4 b3 b2' },
  { name: 'ley', label: 'Low Ley', kind: 'ley', corners: 'r3 e3 e4 l4' },
  { name: 'south', label: 'South Field', kind: 'arable', corners: 'l4 e4 b4 b3' },
];

/** The fields walled in drystone (#696 sets every edge's real kind); every other edge is a hedge for now. */
const WALLED = ['sheep', 'hill'];

/** The lines railed, post and rail (#682): Home Ground's side to the yard, where the paddock's fences were. */
const RAILED = ['farmstead|home'];

/** The lines with nothing on them (#568): the drive is open to the fields either side and to the yard, so the crops come up to its verge. */
const OPEN_LINES = ['drive|lanefield', 'drive|longpiece', 'drive|farmstead'];

/**
 * The gateways, plan metres: from field `a` to `b` (or 'out', off the farm), at the point on the line between them nearest `at`, `half` m
 * either side. A point nearer a corner than its half and a metre is moved along to clear it. Open gaps for now; gates by kind are #696's.
 */
export const GATEWAYS_PLAN = [
  { a: 'wood', b: 'wet', at: [130, 215], why: 'the wood\'s gate (the wood touches Home Ground only at a corner)' },
  { a: 'home', b: 'farmstead', at: [412, 368], why: 'Home Ground from the yard' },
  { a: 'home', b: 'sheep', at: [200, 444], why: 'the head of the green lane, which runs down between Far Field and the sheep field (#684)' },
  { a: 'home', b: 'sheep', at: [240, 440], why: 'Home Ground to the sheep field, on the plan\'s map' },
  { a: 'farmstead', b: 'hay', at: [420, 440], why: 'the stone track south out of the yard into Hay Meadow' },
  { a: 'hay', b: 'sheep', at: [413, 455], why: 'the sheep field from the stone track just inside Hay Meadow (it touches the farmstead only at a corner)' },
  { a: 'far', b: 'sheep', at: [195, 500], why: 'the green lane\'s gates into the sheep field and Far Field, one gap until #684 lays the lane between them (#674\'s review)' },
  { a: 'hay', b: 'brook', at: [420, 545], why: 'the stone track on south to the river' },
  { a: 'farmstead', b: 'top', at: [546, 232], why: 'Top Field from the stone track north' },
  { a: 'top', b: 'pit', at: [720, 150], why: 'the pit\'s field from the stone track north' },
  { a: 'north', b: 'out', at: [380, 30], why: 'North Field onto Back Lane (#686)' },
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
  grid: { x: 881.7, length: 3.6, pitch: 0.16, margin: 0.3 },
  signSpot: [877, 338.2],
  reflectors: [[889, 341.4], [889, 348.6], [897, 341.4], [897, 348.6]],
  potholes: [[798, 343.6, 0.55], [736, 346.4, 0.4], [668, 343.2, 0.6], [851, 347.2, 0.35]],
  washes: [[700, 341.6], [700, 348.4], [790, 341.8]],
  patches: 70,
};

/** The lane (#568): straight at plan x 905 for the length of the ground. #687 bends it round to the A-road and #686 hangs Back Lane off it. */
export const LANE_PLAN = { x: 905, halfWidth: 2.3, minZ: -70, maxZ: 970, ridden: [245, 445] };

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
  house: { x: 13.5, z: 25.5, halfX: 7, halfZ: 4.2, wallHeight: 5.2, ridge: 7.6, door: { x: 13.5, z: 21.3, halfWidth: 0.55, height: 2.05 } }, // plan (1011, 318)
  barn: { x: -26.5, z: -26, halfX: 13, halfZ: 8.5, wallHeight: 4.8, ridge: 7.6, door: { x: -13.5, z: -26, halfWidth: 2.6, height: 3.6 } }, // plan (971, 266.5)
  // Her Tor, the one she drives to the farm (traffic.js `VISITOR_KINDS.neighbour`), her UTV and her old tractor: none in the way in or the tanker's way.
  parked: [
    { kind: 'tor', x: 30.5, z: 13.5, yaw: 1.2, colour: 0x5d6d4a, reg: 'K412 PBW' }, // plan (1028, 306)
    { kind: 'utv', x: 40.5, z: 29.5, yaw: 0.35, colour: 0x7a2a22 }, // plan (1038, 322)
    { kind: 'tractor', x: -10.5, z: 9.5, yaw: 3.0, colour: 0xb02a20 }, // plan (987, 302)
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
  slab: { minX: -47, maxX: 47, minZ: -42, maxZ: 21.3 },
};

/**
 * The neighbour's land (#569), plan metres: her fields east of the lane as the plan's map has them, a block from the lane's hedge (x 912) to x 1290
 * and from z -60 to 560, cut by hedges at z 150, x 1110, x 1230 (below z 150) and z 420. Drawn at far-ground detail: each field's own grass tone in
 * the ground and the outer ring, her hedges as plain strips (hedgeFar.js) with a collider each, no leaves, and her 22 dairy cows on the plan's map
 * as scenery in the two north fields. `lines` run along x (`x`: a hedge at that x from `from` to `to` in z) or along z (`z`), with `gaps` open
 * where a gate or a way through will be (the lane's hedge has her track's and her north field gate's). The north field gate is in the lane's hedge
 * at plan z 130 (the map ends the herd's walk, `M912 286 V130 H930`, there: #714 walks them). The village's field (z 560 on) is #688's.
 */
export const NEIGHBOUR_LAND_PLAN = {
  fields: [
    { name: 'northWest', rect: [912, -60, 1110, 150], tone: [0.4, 0.53, 0.25] },
    { name: 'northEast', rect: [1110, -60, 1290, 150], tone: [0.36, 0.48, 0.22] },
    { name: 'yardField', rect: [912, 150, 1110, 420], tone: [0.44, 0.56, 0.27] },
    { name: 'middle', rect: [1110, 150, 1230, 560], tone: [0.38, 0.5, 0.24] },
    { name: 'east', rect: [1230, 150, 1290, 560], tone: [0.52, 0.54, 0.28] },
    { name: 'south', rect: [912, 420, 1110, 560], tone: [0.42, 0.54, 0.26] },
  ],
  lines: [
    { x: 912, from: -60, to: 560, gaps: [[289, 295], [127.5, 132.5]] },
    { x: 1110, from: -60, to: 560, gaps: [[98, 103], [290, 295]] },
    { x: 1230, from: 150, to: 560, gaps: [[300, 305]] },
    { x: 1290, from: -60, to: 560, gaps: [] },
    { z: -60, from: 912, to: 1290, gaps: [] },
    { z: 150, from: 912, to: 1290, gaps: [[1000, 1005], [1170, 1175]] },
    { z: 420, from: 912, to: 1110, gaps: [[1000, 1005]] },
    { z: 560, from: 912, to: 1290, gaps: [] },
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

/**
 * Every place in today's layout still at today's numbers on the new farm, by its key in the layout, with the issue that moves it. A move takes
 * its own off this list, and #692 needs it empty.
 */
export const NOT_MOVED_YET = {
  // The farmstead's own pieces are placed now (#682, `farmsteadLayout`, below); what is left of today's grass field is the hill's and the wood's reference.
  fieldHalf: '#684 (the hill and the wood still place themselves from the grass field)', gate: '#684 (the gate onto the green lane)',
  dragStrip: '#616',
  'anchors.logYard': '#683', woods: '#683', logYard: '#683',
  'anchors.hut': '#684', hill: '#684 (its river and riverside meadow #565)',
  'anchors.pit': '#685', quarry: '#685',
  'anchors.village': '#688', village: '#688',
  // Today's rectangle of farm, which the wood, the hill and the quarry still place themselves from, and the village street.
  farm: '#683 (the wood), #684 (the hill), #685 (the quarry)', 'roads.2': '#688 (the village street)',
  hayMeadow: '#691', sprayField: '#691', harrowField: '#691',
  trough: '#710', fieldShed: '#624',
  namedSpots: '#690',
};

/** What in today's layout is a setting rather than a place, so it never moves. */
export const SETTINGS = [
  'outerMargin', 'outerSize', 'budgetSpots', 'hedgeThickness', 'hedgeHeight', 'trackHalfWidth', 'trackName', 'trackDepth', 'puddleRadius',
  'puddleDepth', 'bogDepth', 'baleSeat', 'jerryCanJitter',
];

/** What the new farm puts in place of today's, by key. */
export const REPLACED = [
  'ground', 'stubbleFields', 'road', 'publicLane', 'roads', 'anchors.neighbour', 'neighbourFarm', 'barnLocal',
  // The farmstead (#682): the barn and the yard with all that stands in them, the stackyard and its Dutch barn, the cars, the muck heap, and Home Ground's play things.
  'anchors.barn', 'anchors.yard', 'anchors.bonfire', 'barn', 'bell', 'silage', 'barnBaleSpots', 'loft', 'bench', 'benchCharger', 'generator', 'weatherStation',
  'jumperRail', 'helmetHooks', 'bay', 'bay2', 'moneyTin', 'shed', 'jack', 'axleStands', 'rusty', 'plover', 'yard', 'cars', 'paddock', 'lawns', 'farmAnimals',
  'fuelTank', 'jerryCanSpots', 'trailer', 'tipTrailer', 'sprayer', 'harrows', 'dieselBowser', 'toolbox', 'benchOil', 'oilBottle', 'coolantBottle',
  'antiGelBottle', 'plugAdditive', 'benchLeads', 'benchPack', 'hose', 'dutchBarn', 'jumpRamp', 'lineUp', 'coneCourse', 'trackPoints', 'puddles', 'bogs',
  'bonfire', 'brushwood', 'strawBaleSpots', 'restSpots', 'spawn', 'muckHeap',
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
    runs.push({ ...run, kind: open ? 'none' : RAILED.includes([run.a, run.b].sort().join('|')) ? 'rail' : WALLED.includes(run.a) || WALLED.includes(run.b) ? 'wall' : 'hedge' });
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
    return { a: g.a, b: g.b, boundary: best.boundary, at, half, moved: Math.abs(at - best.s) + best.d, ...(g.gate && { gate: true, id: g.id, shut: !!g.shut }) };
  });
}

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
export const FIXED_NAMES = ['wood', 'pit', 'home', 'farmstead', 'drive'];

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
  { field: 'ley', kind: 'brookAlders', route: 'M650 600 C700 632 790 648 885 650', along: [0.08, 0.78], count: 6, bank: -4 },
  // Big old oaks scattered over the meadow south of the river.
  { field: 'brook', kind: 'bigOaks', trees: [[480, 670], [560, 700], [590, 640], [500, 775]] },
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
    gateways: gateways.map(({ a, b, boundary, at, half, gate, id, shut }) => ({ a, b, boundary, at, half, ...(gate && { gate, id, shut }) })),
  };
}

/** Square metres of each field and of the outline, for the tests and the decisions record. */
export function areasOf(fields = clippedFields()) {
  return { outline: polygonArea(clockwise(OUTLINE_PLAN)), fields: Object.fromEntries(fields.map((f) => [f.name, polygonArea(f.points)])) };
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
    reflectors: D.reflectors.map(at),
    potholes: D.potholes.map(([x, pz, r]) => ({ x: x - PLAN_ORIGIN[0], z: pz - PLAN_ORIGIN[1], r })),
    washes: D.washes.map(at),
    patches: D.patches,
  };
  const [laneX, laneMin] = fromPlan([L.x, L.minZ]);
  const [, laneMax] = fromPlan([L.x, L.maxZ]);
  const [, rideMin] = fromPlan([L.x, L.ridden[0]]);
  const [, rideMax] = fromPlan([L.x, L.ridden[1]]);
  const publicLane = { x: laneX, halfWidth: L.halfWidth, minZ: laneMin, maxZ: laneMax, open: { minZ: rideMin, maxZ: rideMax } };
  const roads = [
    { id: 'lane', name: 'the lane', surface: 'tarmac', halfWidth: L.halfWidth, points: [[laneX, laneMin], [laneX, laneMax]], markings: { centre: 'dashed' }, verge: 1, hedged: false, draw: 'mesh', lift: 0.07 },
    {
      id: 'farm', name: 'the drive', surface: 'tarmac', halfWidth: D.halfWidth, points: [[fromX, z], [toX, z]], junction: { end: 'end', onto: 'lane' },
      markings: { centre: 'none' }, verge: D.verge, hedged: false, draw: 'ground', level: { shoulder: 3, lead: [2, 0] }, edge: 'gravel', patches: D.patches,
      potholes: road.potholes.map(({ x, z, r }) => ({ x, z, r })), washes: road.washes,
    },
  ];
  return { road, publicLane, roads };
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
  barn: { at: [515.6, 329.8], yaw: -Math.PI / 2 }, // the first span's middle: the walls stand at plan x 501.8 to 520.2 and z 324.6 to 335, inside the plan's 498 to 524 by 319 to 337
  yard: { at: [517.6, 339.8], yaw: -Math.PI / 2 },
  home: { at: [332, 360] },
  bonfire: { at: [400, 424] }, // Home Ground's south-east corner
  dutch: { at: [446, 268] }, // the Dutch barn's middle, at the stackyard's north, its open front facing south
  slab: [425, 317, 615, 415], // the yard, concrete
  stackyard: [420, 253, 472, 309],
  orchard: [478, 250, 538, 310],
  garden: { rect: [552, 250, 615, 312], gate: { x: 583, width: 3.6 } }, // lawn behind a stone wall, its gate on the yard side
  cars: { z: 326, xs: [578, 583.2, 588.4], yaw: Math.PI }, // beside the garden, nosed in towards its wall (plan 572 to 612 by 319 to 333)
  muck: [486, 416],
  harrows: { at: [548, 372], yaw: -Math.PI / 2 },
  silage: [500, 315], // the stack's north-west corner, behind the barn's back wall
  animals: { pen: [486, 270, 492.5, 277], sty: [500, 270, 504.5, 275], bin: [496.5, 266, 0], bucket: [498, 266.4, 0.4] }, // in the orchard
  fenceSeats: [340, 352, 384, 396], // on Home Ground's rail, at plan z, facing out over the field
  frontage: [317, 415], // the stretch of Home Ground's rail the yard fronts
  // What the later items build, held clear now: no placeholder, plain yard or grass.
  keptClear: [
    { name: 'machinery shed', by: '#617', rect: [428, 325, 442, 373] },
    { name: 'grain store', by: '#699', rect: [582, 355, 612, 381] },
    { name: 'cattle shed and clamp', by: '#694', rect: [470, 385, 558, 407] },
    { name: 'sheep pens', by: '#695', rect: [432, 383, 462, 409] },
  ],
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
  const base = resolveWithBarnLocal(raw, anchors);
  const pt = (p) => fromPlan(p);
  const bin = fromPlan(P.animals.bin);
  const bucket = fromPlan(P.animals.bucket);
  const fences = P.fenceSeats.map((z, i) => ({ id: ['fenceNorth', 'fenceSouth', 'fenceEast', 'fenceWest'][i], kind: 'fence', x: fromPlan([412.45, z])[0], z: fromPlan([412.45, z])[1], yaw: -Math.PI / 2, seat: 1.05 }));
  const cars = Object.fromEntries(Object.keys(today.cars).map((k, i) => [k, { x: fromPlan([P.cars.xs[i], P.cars.z])[0], z: fromPlan([P.cars.xs[i], P.cars.z])[1], yaw: P.cars.yaw, where: 'by the garden' }]));
  return {
    ...base,
    farmstead: {
      slab, stackyard: rectOf(P.stackyard), orchard: rectOf(P.orchard),
      garden: { ...rectOf(P.garden.rect), gate: { x: fromPlan([P.garden.gate.x, 0])[0], width: P.garden.gate.width } },
      keptClear: P.keptClear.map(({ name, by, rect }) => ({ name, by, ...rectOf(rect) })),
      rails: { minZ: fromPlan([0, P.frontage[0]])[1], maxZ: fromPlan([0, P.frontage[1]])[1] },
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
    silage: { x: pt(P.silage)[0], z: pt(P.silage)[1] },
    muckHeap: { ...today.muckHeap, x: pt(P.muck)[0], z: pt(P.muck)[1] },
    paddock: undefined, // the paddock's fences are Home Ground's rails now
    lawns: { garden: { ...rectOf([P.garden.rect[0] + 2, P.garden.rect[1] + 2, P.garden.rect[2] - 2, P.garden.rect[3] - 2]) } },
    farmAnimals: {
      pen: rectOf(P.animals.pen), sty: rectOf(P.animals.sty),
      bin: { x: bin[0], z: bin[1], yaw: P.animals.bin[2] }, bucket: { x: bucket[0], z: bucket[1], yaw: P.animals.bucket[2] },
    },
    jerryCanSpots: [
      ...base.jerryCanSpots.filter((j) => j.where !== 'by the Dutch barn' && j.where !== 'by the field shed').map((j) => ({ ...j, where: { 'by the paddock': 'by the trailers', 'by the field gate': 'out in the yard' }[j.where] ?? j.where })),
      again.dutchCan,
      ...today.jerryCanSpots.filter((j) => j.where === 'by the field shed'),
    ],
    restSpots: [...fences, ...again.dutchSeats, ...today.restSpots.filter((r) => r.id.startsWith('fieldShed'))],
    // The grass field's spots go with Home Ground and the Dutch barn's with the Dutch barn; the east fields' stay where they were (named spots read them, #690).
    spawn: { ...base.spawn, away: [...again.homeAway, ...farmsteadAway(), ...again.dutchAway, ...away.filter((a) => !inGrassField(a) && a.where !== 'in the Dutch barn')] },
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

/** The new farm: today's layout (resolved) with what has moved put in its place. */
export function layoutNew(today, raw) {
  const [gx0, gz0] = fromPlan([GROUND_PLAN.minX, GROUND_PLAN.minZ]);
  const [gx1, gz1] = fromPlan([GROUND_PLAN.maxX, GROUND_PLAN.maxZ]);
  const arable = FIELDS_PLAN.filter((f) => f.kind === 'arable');
  const [hx, hz] = fromPlan(NORTH_HOLLOW_PLAN.at);
  const drive = driveLayout();
  const neighbour = neighbourLayout();
  const farmstead = farmsteadLayout(today, raw);
  const stubbleFields = Object.fromEntries(arable.map((f, i) => [f.name, { ...(i % 2 ? WHEAT : BARLEY) }]));
  stubbleFields.north = { ...stubbleFields.north, hollow: { x: hx, z: hz, rx: NORTH_HOLLOW_PLAN.rx, rz: NORTH_HOLLOW_PLAN.rz, depth: NORTH_HOLLOW_PLAN.depth } };
  return {
    ...farmstead, newFarm: true, ground: { minX: gx0, maxX: gx1, minZ: gz0, maxZ: gz1 }, landform: landformPoints(), stubbleClumps: STUBBLE_CLUMPS, stubbleFields, ...newFields(),
    stewardship: stewardshipLayout(), reserved: reservedLayout(),
    ...drive, roads: [...drive.roads, ...today.roads.filter((r) => r.id === 'street'), neighbour.track],
    anchors: { ...farmstead.anchors, neighbour: neighbour.anchor }, neighbourFarm: neighbour.neighbourFarm, neighbourLand: neighbourLandLayout(),
    budgetSpots: { ...farmstead.budgetSpots, neighbour: { x: neighbour.neighbourFarm.gateway.x + 3, z: neighbour.neighbourFarm.gateway.z } }, // just inside her gateway (#569)
    fieldLandmarks: fieldLandmarksLayout(),
    landmarks: LANDMARKS_PLAN.map((l) => ({ ...l, at: fromPlan(l.at) })),
  };
}

/** One line about which farm this is, for the console's `layout` and the panel. */
export function describeLayout(chosen, notMoved = NOT_MOVED_YET) {
  if (chosen !== 2) return 'today\'s farm (layout 1). layout 2 loads the new farm, built behind ?layout=2 and not saved';
  const moves = new Set(Object.values(notMoved).flatMap((v) => v.match(/#\d+/g)));
  return `the new farm (layout 2, not saved): ${Object.keys(notMoved).length} places still at today's numbers, for ${moves.size} moves. layout 1 loads today's`;
}
