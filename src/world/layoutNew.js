// The new farm (docs/farm-plan.md), built behind `?layout=2` until #692 makes it the default. It starts from today's layout (layout.js) and
// replaces only what has moved: so far the ground, the farm's outline and its fields with their boundaries and gateways (#681). Everything
// else stays at today's numbers until its own move, and is named in `NOT_MOVED_YET` with the issue that moves it. Decided with Jamie on
// 9 November 2026: leaving a piece out stopped the game loading for 16 of the 21 pieces tried (docs/decisions/world.md, "A piece not yet
// moved stays where it is").
//
// Positions here are written in the plan's own metres, as the map in docs/farm-plan.svg has them (x east, z south, from its north-west
// corner), so they can be checked against it by eye. The game's (0, 0) is the middle of the yard, so a game position is the plan position
// less `PLAN_ORIGIN`. Pure: no Three.js.

import { intersectPolygons, polygonArea, clockwise, edgeBetween } from './polygons.js';

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
  { a: 'drive', b: 'out', at: [885, 345], half: 4, why: 'the drive onto the lane (#568 puts the cattle grid in it)' },
  { a: 'farmstead', b: 'drive', at: [618, 345], half: 4, why: 'the drive into the yard' },
  { a: 'drive', b: 'lanefield', at: [700, 335], why: 'Lane Field from the drive' },
  { a: 'drive', b: 'longpiece', at: [700, 355], why: 'Long Piece from the drive' },
  { a: 'brook', b: 'hill', at: [420, 640], why: 'Hill Pasture from the stone track, past the river' },
  { a: 'brook', b: 'ley', at: [640, 580], why: 'Low Ley from Brook Meadow, north of the river' },
  { a: 'brook', b: 'south', at: [640, 720], why: 'South Field from the end of the stone track' },
];

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
  // The farmstead, with Home Ground's play things (the Home Loop, jump, cones, line-up, bonfire), the Dutch barn and the girls' places.
  'anchors.barn': '#682', 'anchors.yard': '#682', 'anchors.bonfire': '#682', fieldHalf: '#682', gate: '#682', barn: '#682', bell: '#682',
  silage: '#682', barnBaleSpots: '#682', loft: '#682', bench: '#682', benchCharger: '#682', generator: '#682', weatherStation: '#682',
  jumperRail: '#682', helmetHooks: '#682', bay: '#682', bay2: '#682', moneyTin: '#682', shed: '#682', jack: '#682', axleStands: '#682', rusty: '#682',
  plover: '#682', yard: '#682', cars: '#682', paddock: '#682', lawns: '#682', farmAnimals: '#682', fuelTank: '#682', jerryCanSpots: '#682',
  trailer: '#682', tipTrailer: '#682', sprayer: '#682', harrows: '#682', dieselBowser: '#682', toolbox: '#682', benchOil: '#682',
  oilBottle: '#682', coolantBottle: '#682', antiGelBottle: '#682', plugAdditive: '#682', benchLeads: '#682', benchPack: '#682', hose: '#682',
  dutchBarn: '#682', jumpRamp: '#682', lineUp: '#682', coneCourse: '#682', trackPoints: '#682', puddles: '#682', bogs: '#682',
  bonfire: '#682', brushwood: '#682', strawBaleSpots: '#682', restSpots: '#682', spawn: '#682',
  dragStrip: '#616',
  'anchors.logYard': '#683', woods: '#683', logYard: '#683',
  'anchors.hut': '#684', hill: '#684 (its river and riverside meadow #565)',
  'anchors.pit': '#685', quarry: '#685',
  'anchors.neighbour': '#569', neighbourFarm: '#569',
  'anchors.village': '#688', village: '#688',
  // Today's farm road and its rectangle of farm, the lane and the street.
  farm: '#568', road: '#568', publicLane: '#568', roads: '#568 (the drive), #686 (Back Lane), #688 (the street)',
  hayMeadow: '#691', sprayField: '#691', harrowField: '#691',
  muckHeap: '#694', trough: '#710', fieldShed: '#624',
  namedSpots: '#690',
};

/** What in today's layout is a setting rather than a place, so it never moves. */
export const SETTINGS = [
  'outerMargin', 'outerSize', 'budgetSpots', 'hedgeThickness', 'hedgeHeight', 'trackHalfWidth', 'trackName', 'trackDepth', 'puddleRadius',
  'puddleDepth', 'bogDepth', 'baleSeat', 'jerryCanJitter',
];

/** What the new farm puts in place of today's, by key. */
export const REPLACED = ['ground', 'stubbleFields'];

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
    runs.push({ ...run, kind: WALLED.includes(run.a) || WALLED.includes(run.b) ? 'wall' : 'hedge' });
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
    return { a: g.a, b: g.b, boundary: best.boundary, at, half, moved: Math.abs(at - best.s) + best.d };
  });
}

const movePoints = (pts) => pts.map(fromPlan);

/** The landform as the game reads it: game x and the height above the yard's ground, so the yard keeps the height it has today. */
export function landformPoints(plan = LANDFORM_PLAN) {
  const yard = plan.find(([x]) => x === PLAN_ORIGIN[0]);
  if (!yard) throw new Error('the landform has no height at the yard');
  return plan.map(([x, h]) => [x - PLAN_ORIGIN[0], h - yard[1]]);
}

/** The fields, boundaries, gateways and outline in game metres, as fieldPlan.js `planFromData` reads them. */
export function newFields() {
  const fields = clippedFields();
  const runs = boundariesOf(fields);
  const gateways = placeGateways(runs);
  return {
    outline: movePoints(clockwise(OUTLINE_PLAN)),
    fields: fields.map((f) => ({ name: f.name, label: f.label, kind: f.kind, points: movePoints(f.points) })),
    boundaries: runs.map((r) => ({ points: movePoints(r.points), kind: r.kind, between: [r.a, r.b] })),
    gateways: gateways.map(({ a, b, boundary, at, half }) => ({ a, b, boundary, at, half })),
  };
}

/** Square metres of each field and of the outline, for the tests and the decisions record. */
export function areasOf(fields = clippedFields()) {
  return { outline: polygonArea(clockwise(OUTLINE_PLAN)), fields: Object.fromEntries(fields.map((f) => [f.name, polygonArea(f.points)])) };
}

/** The new farm: today's layout (resolved) with what has moved put in its place. */
export function layoutNew(today) {
  const [gx0, gz0] = fromPlan([GROUND_PLAN.minX, GROUND_PLAN.minZ]);
  const [gx1, gz1] = fromPlan([GROUND_PLAN.maxX, GROUND_PLAN.maxZ]);
  const arable = FIELDS_PLAN.filter((f) => f.kind === 'arable');
  const [hx, hz] = fromPlan(NORTH_HOLLOW_PLAN.at);
  const stubbleFields = Object.fromEntries(arable.map((f, i) => [f.name, { ...(i % 2 ? WHEAT : BARLEY) }]));
  stubbleFields.north = { ...stubbleFields.north, hollow: { x: hx, z: hz, rx: NORTH_HOLLOW_PLAN.rx, rz: NORTH_HOLLOW_PLAN.rz, depth: NORTH_HOLLOW_PLAN.depth } };
  return { ...today, newFarm: true, ground: { minX: gx0, maxX: gx1, minZ: gz0, maxZ: gz1 }, landform: landformPoints(), stubbleClumps: STUBBLE_CLUMPS, stubbleFields, ...newFields() };
}

/** One line about which farm this is, for the console's `layout` and the panel. */
export function describeLayout(chosen, notMoved = NOT_MOVED_YET) {
  if (chosen !== 2) return 'today\'s farm (layout 1). layout 2 loads the new farm, built behind ?layout=2 and not saved';
  const moves = new Set(Object.values(notMoved).flatMap((v) => v.match(/#\d+/g)));
  return `the new farm (layout 2, not saved): ${Object.keys(notMoved).length} places still at today's numbers, for ${moves.size} moves. layout 1 loads today's`;
}
