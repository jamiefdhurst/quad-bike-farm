// The farm map on M: what to draw and where, worked out from the layout, the fields and the track, with no canvas or Three.js, so it can
// be tested. North is -z and east is +x, so the map puts x across and z down the page, north up. hud/mapView.js draws it.

import { createBrook } from '../world/brook.js';
import { pointAlong, polygonBounds, polygonEdges, pointInPolygon, distanceToEdges } from '../world/polygons.js';
import { dutchBarnShape, fieldShedShape } from '../world/outbuildings.js';
import { neighbourFarmShape } from '../world/neighbourFarm.js';
import { stripPoint } from '../world/layout.js';
import { nearestTrackFraction } from '../world/startLine.js';
import { roadNetwork } from '../world/roads.js';

export const DEFAULT_MAP_PARAMS = {
  size: 0.88, // the map's side as a share of the shorter side of the screen
  opacity: 0.96, // how solid the paper is over the game
  markerScale: 1, // the vehicles, items and people drawn this many times their usual size
};

export const MAP_PARAM_RANGES = {
  size: [0.4, 1, 0.01],
  opacity: [0.3, 1, 0.01],
  markerScale: [0.5, 2.5, 0.05],
};

// A muted Ordnance Survey palette: fields in their own colours, hedges dark green, the road grey, the track brown.
/** Metres of the neighbours' land shown round the farm and the hill. */
export const MAP_MARGIN = 6;
/** The least metres of paper added below the ground for the key (#360): it has a strip of its own and never stands on the map. */
export const MAP_KEY_STRIP = 31;
/** How much of the ground's height the key's strip is, when that is more than `MAP_KEY_STRIP`. */
export const MAP_KEY_SHARE = 0.16;

export const MAP_COLOURS = {
  paper: '#e9e4d4',
  outside: '#d5d8bd',
  grass: '#b9cf94',
  barley: '#e3dcae',
  wheat: '#e6d39c',
  verge: '#c3d6a0',
  lane: '#aac487',
  pasture: '#a9bf86',
  wood: '#7fa268',
  woodland: '#9cb87c', // the north wood's ground, under its sprinkle of trees
  quarryField: '#b3bf8c', // the gravel pit's rough field
  arable: '#e6d39c', // a field a plan calls arable, when it is not one of today's two stubble fields
  hay: '#cfd99a',
  ley: '#bfd48e',
  rough: '#c4c39a',
  pit: '#cdbf9a', // the pit's walls
  pitFloor: '#bfae86', // and its floor and haul road
  hedge: '#3f6b35',
  gate: '#7d7d7d',
  road: '#9a9893',
  roadEdge: '#6f6d68',
  track: '#a5835c',
  trail: '#d6bf8e', // the Fern Trail, paler than the tracks
  gravel: '#c6bba5',
  bog: '#6e5539',
  water: '#6f9cc0',
  building: '#5b4d42',
  shed: '#7d6c5c',
  muck: '#6b5236',
  trough: '#8a9aa3',
  fence: '#8a6a45',
  ink: '#2c2a26',
  label: '#4a4438',
  start: '#2e9a44', // a start (the cones are the same green)
  finish: '#1f6dcc', // and a finish
};

/** The rect a rect and another make together. */
const pick = (p) => ({ x: p.x, z: p.z });
const union = (a, b) => ({ minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX), minZ: Math.min(a.minZ, b.minZ), maxZ: Math.max(a.maxZ, b.maxZ) });
const centred = (x, z, hx, hz) => ({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });

/** The strip of paper under `ground` the key stands in: a share of its height, but never less than `MAP_KEY_STRIP` m. */
export const keyStripHeight = (ground) => Math.max(MAP_KEY_STRIP, Math.round((ground.maxZ - ground.minZ) * MAP_KEY_SHARE));

/**
 * The ground the map covers: the farm (its outline's box if it has one), every field inside its hedges, and any `extra` rectangles (the places
 * across the lane, the roads), with `margin` metres round them. `ground` is that, and `bounds` is the whole sheet, with the key's strip added
 * below it, so the key never lands on the ground.
 */
export function mapBounds(fields, margin = MAP_MARGIN, extra = []) {
  let r = { ...fields.farm };
  for (const a of Object.values(fields.areas)) r = union(r, a);
  for (const e of extra) r = union(r, e);
  const ground = { minX: r.minX - margin, maxX: r.maxX + margin, minZ: r.minZ - margin, maxZ: r.maxZ + margin };
  return { ...ground, ground, maxZ: ground.maxZ + keyStripHeight(ground) };
}

/**
 * Fitting `bounds` into a `width` by `height` box, keeping its shape and centring it: metres to pixels and back. `scale` is pixels a metre.
 */
export function mapTransform(bounds, width, height) {
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxZ - bounds.minZ;
  const scale = Math.min(width / w, height / h);
  const ox = (width - w * scale) / 2;
  const oy = (height - h * scale) / 2;
  return {
    scale,
    width,
    height,
    toMap: (x, z) => [ox + (x - bounds.minX) * scale, oy + (z - bounds.minZ) * scale],
    toWorld: (u, v) => [bounds.minX + (u - ox) / scale, bounds.minZ + (v - oy) / scale],
  };
}

/**
 * The lengths of hedge actually grown along a hedge line, between its gaps, as segments, and the gates in it. Open gaps are left out, gates
 * are drawn across their gap.
 */
export function hedgeRuns(h) {
  const at = (s) => pointAlong(h, s);
  const gaps = [...h.gaps].sort((a, b) => a.at - b.at);
  const runs = [];
  let from = 0;
  for (const g of gaps) {
    const a = Math.max(0, g.at - g.half);
    if (a > from) runs.push([at(from), at(a)]);
    from = Math.max(from, Math.min(h.length, g.at + g.half));
  }
  if (h.length > from) runs.push([at(from), at(h.length)]);
  const gates = gaps.filter((g) => g.gate).map((g) => ({ from: at(g.at - g.half), to: at(g.at + g.half), shut: !!g.shut }));
  return { runs, gates };
}

/** A rotated rectangle's corners: centred on (x, z), `along` m long the way `yaw` points (0 is +z), `across` m wide. */
export function boxCorners(x, z, yaw, along, across) {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const a = along / 2;
  const c = across / 2;
  return [
    [x + fx * a - fz * c, z + fz * a + fx * c],
    [x + fx * a + fz * c, z + fz * a - fx * c],
    [x - fx * a + fz * c, z - fz * a - fx * c],
    [x - fx * a - fz * c, z - fz * a + fx * c],
  ];
}

/**
 * Everything fixed on the map, in metres: the fields, hedges and gates, the road and the track, the stream and the ford, the buildings and
 * the bits of the yard, and the names to write on it. `track` is the world's Track (its `points` and `sample`).
 */
export function farmMapFeatures(layout, fields, track, margin = MAP_MARGIN) {
  const C = MAP_COLOURS;
  const A = fields.areas;
  // Everything else the map must hold: the roads (the lane runs past the farm's east hedge), the village and the neighbour across the lane.
  const net = roadNetwork(layout);
  // Every road in the network, unless it says `map: false`: its middle line, half width and any round hardstanding, drawn by hud/mapView.js.
  const roads = net.roads.filter((r) => r.map !== false).map((r) => ({ id: r.id, name: r.name, points: net.pointsAlong(r.id, { step: 4 }).map((p) => [p.x, p.z]), half: r.halfWidth, pads: r.pads.map((q) => ({ x: q.x, z: q.z, r: q.radius })) }));
  const extra = roads.map((r) => {
    const xs = r.points.map((p) => p[0]);
    const zs = r.points.map((p) => p[1]);
    return { minX: Math.min(...xs) - r.half, maxX: Math.max(...xs) + r.half, minZ: Math.min(...zs) - r.half, maxZ: Math.max(...zs) + r.half };
  });
  if (layout.village?.area) extra.push(layout.village.area);
  if (layout.neighbourFarm?.yard) extra.push(layout.neighbourFarm.yard);
  const bounds = mapBounds(fields, margin, extra);
  const ground = bounds.ground;
  const hill = fields.hill;
  const crop = (k) => layout.stubbleFields?.[k]?.crop;
  const fieldFill = { grass: C.grass, road: C.verge, end: C.verge, north: crop('north') === 'barley' ? C.barley : C.wheat, south: crop('south') === 'barley' ? C.barley : C.wheat, lane: C.lane, hill: C.pasture, meadow: C.pasture, sheep: C.pasture, riverside: C.pasture, woods: C.woodland, quarry: C.quarryField };
  const kindFill = { grass: C.grass, arable: C.arable, hay: C.hay, ley: C.ley, wood: C.woodland, pasture: C.pasture, rough: C.rough, yard: C.gravel, lane: C.lane };
  const areas = Object.entries(A).map(([kind, rect]) => ({
    kind, rect, points: fields.polygons[kind], fieldKind: fields.kinds?.[kind], fill: fieldFill[kind] ?? kindFill[fields.kinds?.[kind]] ?? C.grass,
  }));

  const hedges = [];
  const gates = [];
  for (const h of fields.hedges) {
    const { runs, gates: g } = hedgeRuns(h);
    for (const [a, b] of runs) hedges.push({ x1: a.x, z1: a.z, x2: b.x, z2: b.z, width: layout.hedgeThickness ?? 1.8 });
    gates.push(...g);
  }

  // The stream across the bottom of the pasture, wider over the ford.
  const stream = [];
  let ford = null;
  if (hill) {
    for (let x = hill.pasture.minX; x <= hill.pasture.maxX + 1e-6; x += 2) stream.push({ x, z: hill.streamZ(x), half: hill.halfAt(x) });
    ford = { x: hill.lane.x, z: hill.streamZ(hill.lane.x), half: hill.halfAt(hill.lane.x) };
    // On under the hedge as the brook, as far as the map goes (it is out of sight in the culvert under the lane, so its width pinches there).
    for (const p of createBrook(layout)?.line(2) ?? []) if (p.x > hill.pasture.maxX && p.x <= bounds.maxX) stream.push(p);
  }

  const pond = hill?.pond ?? null;
  const woods = fields.woods;
  const quarry = fields.quarry;
  const woodsTrack = woods ? { points: woods.track.points, leadIn: woods.leadIn, half: woods.halfWidth } : null;
  const woodsTrail = woods?.trail ? { points: woods.trailTrack.points, half: woods.trailHalf } : null;
  const woodsBogs = woods ? woods.bogs.map((b) => ({ x: b.x, z: b.z, r: b.radius })) : [];

  const bogs = (layout.bogs ?? []).map((b) => {
    const p = b.track !== undefined ? track.sample(b.track) : b;
    return { x: p.x, z: p.z, r: b.radius };
  });

  const strip = layout.dragStrip;
  const dragStrip = strip ? (() => {
    const along = strip.length + strip.runOff;
    const mid = along / 2;
    return boxCorners(strip.x + Math.sin(strip.yaw) * mid, strip.z + Math.cos(strip.yaw) * mid, strip.yaw, along, strip.width);
  })() : null;
  const r = layout.jumpRamp;
  const ramp = r ? boxCorners(r.x + Math.sin(r.yaw) * r.length / 2, r.z + Math.cos(r.yaw) * r.length / 2, r.yaw, r.length, r.width) : null;

  // Every start (green) and finish (blue), so they can be found from across the farm: the lap's line by the yard (both in one, so a start), the
  // drag strip, the hill climb and the pit climb. Amy's cone course is plain orange cones and isn't marked.
  const marks = [];
  const lap = layout.yard ? track.sample(nearestTrackFraction(track, layout.yard.x, layout.yard.z)) : null;
  if (lap) marks.push({ kind: 'start', x: lap.x, z: lap.z });
  if (strip) marks.push({ kind: 'start', ...pick(stripPoint(strip, 0, 0)) }, { kind: 'finish', ...pick(stripPoint(strip, strip.length, 0)) });
  for (const pts of [layout.hill?.climb?.points, quarry?.climb?.points]) {
    if (pts?.length > 1) marks.push({ kind: 'start', x: pts[0][0], z: pts[0][1] }, { kind: 'finish', x: pts[pts.length - 1][0], z: pts[pts.length - 1][1] });
  }

  const dutch = dutchBarnShape(layout);
  const shed = fieldShedShape(layout);
  const b = layout.barn;
  const buildings = [];
  if (b) buildings.push({ name: 'barn', rect: centred(b.x, b.z + (b.annex?.halfZ ?? 0), b.halfX, b.halfZ + (b.annex?.halfZ ?? 0)), fill: C.building });
  if (dutch) buildings.push({ name: 'dutchBarn', rect: dutch.roof, fill: C.building });
  if (shed) buildings.push({ name: 'fieldShed', rect: shed.outer, fill: C.building });
  const hut = layout.hill?.hut;
  if (hut) buildings.push({ name: 'hut', rect: centred(hut.x, hut.z, hut.width / 2, hut.length / 2), fill: C.building });
  const nf = neighbourFarmShape(layout);
  if (nf) buildings.push({ name: 'neighbourHouse', rect: nf.house.outer, fill: C.building }, { name: 'neighbourBarn', rect: nf.barn.outer, fill: C.building });
  const v = layout.village;
  if (v) {
    for (const k of ['pub', 'shop', 'garage']) if (v[k]) buildings.push({ name: k, rect: centred(v[k].x, v[k].z, v[k].halfX, v[k].halfZ), fill: C.building });
    for (const c of v.cottages ?? []) buildings.push({ name: `cottage ${c.id}`, rect: centred(c.x, c.z, c.halfX, c.halfZ), fill: C.building });
  }
  const fh = layout.farmhouse; // a farm plan's own house, when it has one (today's farm has none: the one house is the neighbour's)
  if (fh) buildings.push({ name: 'farmhouse', rect: centred(fh.x, fh.z, fh.halfX, fh.halfZ), fill: C.building });
  const small = [];
  if (layout.fuelTank) small.push({ name: 'fuelTank', rect: centred(layout.fuelTank.x, layout.fuelTank.z, 0.8, 1.4), fill: C.shed });
  if (layout.dieselBowser) small.push({ name: 'dieselBowser', rect: centred(layout.dieselBowser.x, layout.dieselBowser.z, 0.7, 1.2), fill: C.shed });
  const t = layout.trough;
  if (t) small.push({ name: 'trough', rect: centred(t.x, t.z, t.length / 2, t.width / 2), fill: C.trough });
  const m = layout.muckHeap;
  const muckHeap = m ? { x: m.x, z: m.z, rx: m.halfX, rz: m.halfZ } : null;
  const p = layout.paddock;
  const paddock = p ? centred(p.x, p.z, p.half, p.half) : null;
  // The woodpile (items/logSplitter.js): the stack and the rounds lying by it. Its label carries the stack's count, which the view adds as it draws.
  const ly = layout.logYard;
  const woodpile = ly?.stack ? {
    stack: boxCorners(ly.stack.x, ly.stack.z, ly.stack.yaw ?? 0, WOODPILE_LENGTH, WOODPILE_WIDTH),
    rounds: (ly.piles ?? []).map(([x, z]) => ({ x, z, r: 1.3 })),
  } : null;
  const yard = layout.yard ? { x: layout.yard.x, z: layout.yard.z, r: layout.yard.radius } : null;
  const wood = layout.hill?.wood ?? null;

  // Names on the map. Fields in a larger hand, places smaller, each where there's room for it.
  const labels = [];
  const field = (text, x, z) => labels.push({ text, x, z, kind: 'field' });
  const place = (text, x, z, dz = 0) => labels.push({ text, x, z: z + dz, kind: 'place' });
  if (!layout.fields) {
    field('Grass field', 0, -68);
    if (A.north) field(`${cap(crop('north') ?? 'stubble')} stubble`, (A.north.minX + A.north.maxX) / 2, A.north.minZ + 20);
    if (A.south) field(`${cap(crop('south') ?? 'stubble')} stubble`, (A.south.minX + A.south.maxX) / 2 + 10, A.south.maxZ - 14);
    if (A.meadow) field('Wet meadow', (A.meadow.minX + A.meadow.maxX) / 2 - 10, A.meadow.minZ + 10);
    if (A.sheep) field('Sheep field', (A.sheep.minX + A.sheep.maxX) / 2 + 6, A.sheep.minZ + 8);
    if (A.riverside) field('Riverside meadow', (A.riverside.minX + A.riverside.maxX) / 2 + 4, A.riverside.maxZ - 18);
    if (hill) field('Hill pasture', (hill.pasture.minX + hill.pasture.maxX) / 2 + 12, hill.pasture.maxZ - 12);
  }
  if (v) {
    // Nether Thornby across the lane: its name, and the three buildings you'd go to.
    if (v.area) place(v.name, v.area.minX + 38, v.area.maxZ - 3);
    if (v.pub) place('Pub', v.pub.x, v.pub.z, -v.pub.halfZ - 3);
    if (v.shop) place('Shop', v.shop.x, v.shop.z, -v.shop.halfZ - 3);
    if (v.garage) place('Garage', v.garage.x, v.garage.z, v.garage.halfZ + 3);
  }
  if (fh) place('Farmhouse', fh.x, fh.z, fh.halfZ + 3);
  if (woodpile) labels.push({ text: 'Woodpile', reserve: WOODPILE_RESERVE, id: 'woodpile', dynamic: true, x: ly.stack.x, z: ly.stack.z - 5, kind: 'place' });
  // The other roads, named along their length (the farm road has its own, placed by hand below). A name is kept inside the ground, whatever the road's end.
  const sheet = 700 / Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ); // about how many pixels a metre, for how far to keep a name in
  for (const rd of roads) {
    const mid = rd.points[Math.floor(rd.points.length * 0.6)]; // a little past the middle: the middle of the lane is the farm road's junction
    const inVillage = v?.area && mid[0] >= v.area.minX && mid[0] <= v.area.maxX && mid[1] >= v.area.minZ && mid[1] <= v.area.maxZ;
    if (rd.id === 'farm' || !rd.name || inVillage) continue; // the village's own name stands for its street
    const text = cap(rd.name);
    const half = (text.length * 6) / 2 / sheet + 3;
    place(text, Math.min(ground.maxX - half, Math.max(ground.minX + half, mid[0] - rd.half - half)), mid[1]);
  }
  if (hut) place('Hut', hut.x - 2, hut.z - 7.5);
  if (b) place('Barn', b.x - 5, b.z + b.halfZ + 6); // south-west of it, clear of the quads parked in the yard (which has no name: it's crowded)
  if (paddock) place('Paddock', p.x, p.z, p.half + 4);
  if (strip) place('Drag strip', strip.x + 6, strip.z + 6);
  if (r) place('Jump', r.x, r.z, -6);
  if (roads.some((r) => r.id === 'farm')) place('Farm road', (layout.road.fromX + layout.road.hedgeTo) / 2 - 20, layout.road.z - 9);
  if (dutch) place('Dutch barn', layout.dutchBarn.x - 4, layout.dutchBarn.z - layout.dutchBarn.halfZ - 4);
  if (shed) place('Field shed', layout.fieldShed.x + 21, layout.fieldShed.z + 1);
  if (nf) place('Neighbour', nf.yard.minX + 14, nf.yard.minZ + 7);
  if (m) place('Muck heap', m.x, m.z, m.halfZ + 4);
  if (t) place('Trough', t.x, t.z - 5);
  if (hill) {
    place('Lane', hill.lane.x + 9, (layout.fieldHalf + hill.lane.toZ) / 2);
    place('Ford', hill.lane.x + 9, ford.z + 1);
    place('Stream', hill.pasture.maxX - 16, hill.streamZ(hill.pasture.maxX - 16) - 4);
    const cr = layout.hill.river?.crossing;
    if (cr) place('River crossing', cr.x, createBrook(layout).zAt(cr.x) + layout.hill.river.halfWidth + 5);
  }
  if (wood) place('Wood', (wood.minX + wood.maxX) / 2, (wood.minZ + wood.maxZ) / 2);
  if (woods) {
    const r = woods.rect;
    field(woods.name, (r.minX + r.maxX) / 2 + 20, r.minZ + 10);
    const p = woods.at(woods.track.totalLength * 0.97); // on the way back to the junction, in the open by the gate
    place(woods.circuitName, p.x + 6, p.z - 10);
    if (woods.trail) {
      const t = woods.trailAt(woods.trailTrack.totalLength * 0.2);
      place(woods.trail.name, t.x, t.z - 9);
    }
    if (woods.pond) place('Pond', woods.pond.x, woods.pond.z, woods.pond.rz + 4);
  }
  if (quarry) {
    field(quarry.name, quarry.rect.maxX - 26, quarry.rect.maxZ - 20);
    place('Pit climb', quarry.climb.points[2][0], quarry.climb.points[2][1], 12); // where the line finishes, written inside the lip so it stays on the map
    place('Pond', quarry.pond.x, quarry.pond.z, quarry.pond.rz + 4);
  }
  const tp = track.sample(0.78);
  place(layout.trackName ?? 'Track', tp.x + 8, tp.z);
  // A plan that names its fields: each name where its field has the most room, clear of the buildings and of every name already written.
  if (layout.fields) {
    const clear = [...buildings, ...small].map((b) => b.rect);
    for (const l of labels) clear.push(nameBox(l, sheet));
    for (const f of layout.fields) {
      const at = labelSpot(fields.polygons[f.name], clear, nameBox({ text: f.name, kind: 'field', x: 0, z: 0 }, sheet));
      field(f.name, at.x, at.z);
      clear.push(nameBox({ text: f.name, kind: 'field', ...at }, sheet));
    }
  }

  // The key, north arrow and scale bar have a strip of their own below the ground (`bounds` is the ground and that strip), at any size of ground.
  // This is the least of it: hud/mapView.js lays the list out across the whole width of the sheet, which is more than the ground's.
  const key = { minX: bounds.minX + 4, maxX: bounds.maxX - 4, minZ: ground.maxZ + 3, maxZ: bounds.maxZ - 4 };

  return {
    bounds, ground, key, areas, hedges, gates, stream, ford, pond, roads, track: { points: track.points, half: layout.trackHalfWidth }, bogs, dragStrip, ramp,
    woodsTrack, woodsTrail, woodsBogs, woodsPond: woods?.pond ?? null, woodland: woods ? { ...woods.rect } : null,
    quarryPit: quarry ? quarryOutline(quarry) : null,
    buildings, small, muckHeap, paddock, yard, wood, woodpile, labels, marks,
    neighbourYard: nf ? { ...nf.outline } : null,
  };
}

/** The pit as the map draws it: its lip and the foot of its walls as outlines, the haul roads, the pond and the heaps. */
export function quarryOutline(quarry) {
  const ring = (radius) => Array.from({ length: 72 }, (_, i) => {
    const a = (i / 72) * Math.PI * 2;
    const p = quarry.frameAt(a, radius(a));
    return [p.x, p.z];
  });
  return {
    rim: ring((a) => quarry.rimAt(a)),
    floor: ring((a) => quarry.floorEdge(a)),
    roads: [quarry.roadPoints, quarry.rampPoints].map((pts) => pts.map((p) => [p.x, p.z])),
    roadHalf: quarry.roadHalf,
    pond: quarry.pond,
    heaps: quarry.pit.heaps.map((h) => ({ x: h.x, z: h.z, r: h.r })),
    climb: quarry.climb.points,
  };
}

/** A name that carries a count, `Woodpile (12)`; the name alone while there is no count to say. */
export const countedName = (text, n) => (n === undefined ? text : `${text} (${n})`);

/** The log stack as the map draws it: about as long as 12 logs side by side (`STACK_SHAPE`), a little deeper than a log. */
const WOODPILE_LENGTH = 3.6;
const WOODPILE_WIDTH = 1.2;

/** The most `Woodpile (n)` can say, written out so the label's room is kept for it whatever the count is. */
const WOODPILE_RESERVE = 'Woodpile (99)';

/** The rectangle in metres a name takes, about 6 px a letter for a place and 8 for a field, 14 px tall, at `sheet` pixels a metre. */
export function nameBox(l, sheet) {
  const hw = ((l.reserve ?? l.text).length * (l.kind === 'field' ? 8 : 6)) / 2 / sheet;
  const hh = 7 / sheet;
  return { minX: l.x - hw, maxX: l.x + hw, minZ: l.z - hh, maxZ: l.z + hh };
}

/**
 * The point in a polygon furthest from its sides (searched on a grid) where a name as big as `box` (a rectangle round the origin) misses every
 * rectangle in `avoid`: somewhere the name has the most room. If there is nowhere clear, the roomiest point anyway.
 */
export function labelSpot(points, avoid = [], box = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 }) {
  const edges = polygonEdges(points);
  const b = polygonBounds(points);
  const step = Math.max(1, Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 60);
  const hits = (x, z) => avoid.some((r) => x + box.minX < r.maxX && r.minX < x + box.maxX && z + box.minZ < r.maxZ && r.minZ < z + box.maxZ);
  let best = { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2, d: -1 };
  let bestClear = null;
  for (let x = b.minX + step / 2; x < b.maxX; x += step) {
    for (let z = b.minZ + step / 2; z < b.maxZ; z += step) {
      if (!pointInPolygon(points, x, z, 0, edges)) continue;
      const d = distanceToEdges(edges, x, z);
      if (d > best.d) best = { x, z, d };
      if (d > (bestClear?.d ?? -1) && !hits(x, z)) bestClear = { x, z, d };
    }
  }
  const { x, z } = bestClear ?? best;
  return { x, z };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Where the markers (you, the girls, the vehicles and the items) go on the map, in pixels. A marker off the map is pinned to its edge,
 * `inset` pixels in, and flagged, so a quad that's gone through a hedge into the neighbours' still shows which way it went.
 */
export function placeMarkers(markers, transform, inset = 8) {
  return markers.map((mk) => {
    const [u, v] = transform.toMap(mk.x, mk.z);
    const cu = Math.min(transform.width - inset, Math.max(inset, u));
    const cv = Math.min(transform.height - inset, Math.max(inset, v));
    return { ...mk, u: cu, v: cv, off: cu !== u || cv !== v };
  });
}

/** The angle to draw something facing `yaw` (0 is +z, south, down the page) at, clockwise from up the page, for canvas rotate(). */
export const mapAngle = (yaw) => Math.PI - yaw;
