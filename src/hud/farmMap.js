// The farm map on M: what to draw and where, worked out from the layout, the fields and the track, with no canvas or Three.js, so it can
// be tested. North is -z and east is +x, so the map puts x across and z down the page, north up. hud/mapView.js draws it.

import { createBrook } from '../world/brook.js';
import { dutchBarnShape, fieldShedShape } from '../world/outbuildings.js';
import { neighbourFarmShape } from '../world/neighbourFarm.js';

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
/** Metres added to the map's south edge when the gravel pit has taken the open ground its key stood on, for the key to stand in. */
export const MAP_KEY_STRIP = 31;

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
};

/** The rect a rect and another make together. */
const union = (a, b) => ({ minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX), minZ: Math.min(a.minZ, b.minZ), maxZ: Math.max(a.maxZ, b.maxZ) });
const centred = (x, z, hx, hz) => ({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });

/** The ground the map covers: the farm, the hill and the wood inside their hedges, and `margin` metres round them. */
export function mapBounds(fields, margin = MAP_MARGIN) {
  let r = { ...fields.farm };
  if (fields.areas.lane) r = union(r, fields.areas.lane);
  if (fields.areas.hill) r = union(r, fields.areas.hill);
  if (fields.areas.meadow) r = union(r, fields.areas.meadow);
  if (fields.areas.sheep) r = union(r, fields.areas.sheep);
  if (fields.areas.riverside) r = union(r, fields.areas.riverside);
  if (fields.areas.woods) r = union(r, fields.areas.woods);
  if (fields.areas.quarry) r = union(r, fields.areas.quarry);
  return { minX: r.minX - margin, maxX: r.maxX + margin, minZ: r.minZ - margin, maxZ: r.maxZ + margin + (fields.areas.quarry ? MAP_KEY_STRIP : 0) };
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
  const lo = h.alongX ? h.x1 : h.z1;
  const hi = lo + h.length;
  const at = (s) => (h.alongX ? { x: s, z: h.z1 } : { x: h.x1, z: s });
  const gaps = [...h.gaps].sort((a, b) => a.at - b.at);
  const runs = [];
  let from = lo;
  for (const g of gaps) {
    const a = Math.max(lo, g.at - g.half);
    if (a > from) runs.push([at(from), at(a)]);
    from = Math.max(from, Math.min(hi, g.at + g.half));
  }
  if (hi > from) runs.push([at(from), at(hi)]);
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
  const bounds = mapBounds(fields, margin);
  const A = fields.areas;
  const hill = fields.hill;
  const crop = (k) => layout.stubbleFields?.[k]?.crop;
  const fieldFill = { grass: C.grass, road: C.verge, end: C.verge, north: crop('north') === 'barley' ? C.barley : C.wheat, south: crop('south') === 'barley' ? C.barley : C.wheat, lane: C.lane, hill: C.pasture, meadow: C.pasture, sheep: C.pasture, riverside: C.pasture, woods: C.woodland, quarry: C.quarryField };
  const areas = Object.entries(A).map(([kind, rect]) => ({ kind, rect, fill: fieldFill[kind] ?? C.grass }));

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
  const road = layout.road ? { x1: layout.road.fromX, x2: layout.road.toX, z: layout.road.z, half: layout.road.halfWidth, pad: layout.road.pad ? { x: layout.road.pad.x, z: layout.road.z, r: layout.road.pad.radius } : null } : null;

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
  const small = [];
  if (layout.fuelTank) small.push({ name: 'fuelTank', rect: centred(layout.fuelTank.x, layout.fuelTank.z, 0.8, 1.4), fill: C.shed });
  if (layout.dieselBowser) small.push({ name: 'dieselBowser', rect: centred(layout.dieselBowser.x, layout.dieselBowser.z, 0.7, 1.2), fill: C.shed });
  const t = layout.trough;
  if (t) small.push({ name: 'trough', rect: centred(t.x, t.z, t.length / 2, t.width / 2), fill: C.trough });
  const m = layout.muckHeap;
  const muckHeap = m ? { x: m.x, z: m.z, rx: m.halfX, rz: m.halfZ } : null;
  const p = layout.paddock;
  const paddock = p ? centred(p.x, p.z, p.half, p.half) : null;
  const yard = layout.yard ? { x: layout.yard.x, z: layout.yard.z, r: layout.yard.radius } : null;
  const wood = layout.hill?.wood ?? null;

  // Names on the map. Fields in a larger hand, places smaller, each where there's room for it.
  const labels = [];
  const field = (text, x, z) => labels.push({ text, x, z, kind: 'field' });
  const place = (text, x, z, dz = 0) => labels.push({ text, x, z: z + dz, kind: 'place' });
  field('Grass field', 0, -68);
  if (A.north) field(`${cap(crop('north') ?? 'stubble')} stubble`, (A.north.minX + A.north.maxX) / 2, A.north.minZ + 20);
  if (A.south) field(`${cap(crop('south') ?? 'stubble')} stubble`, (A.south.minX + A.south.maxX) / 2 + 10, A.south.maxZ - 14);
  if (A.meadow) field('Wet meadow', (A.meadow.minX + A.meadow.maxX) / 2 - 10, A.meadow.minZ + 10);
  if (A.sheep) field('Sheep field', (A.sheep.minX + A.sheep.maxX) / 2 + 6, A.sheep.minZ + 8);
  if (A.riverside) field('Riverside meadow', (A.riverside.minX + A.riverside.maxX) / 2, A.riverside.maxZ - 10);
  if (hill) field('Hill pasture', (hill.pasture.minX + hill.pasture.maxX) / 2 + 12, hill.pasture.maxZ - 12);
  if (hut) place('Hut', hut.x - 2, hut.z - 7.5);
  if (b) place('Barn', b.x - 5, b.z + b.halfZ + 6); // south-west of it, clear of the quads parked in the yard (which has no name: it's crowded)
  if (paddock) place('Paddock', p.x, p.z, p.half + 4);
  if (strip) place('Drag strip', strip.x + 6, strip.z + 6);
  if (r) place('Jump', r.x, r.z, -6);
  if (road) place('Farm road', (road.x1 + layout.road.hedgeTo) / 2 - 20, road.z - 9);
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

  // The map's key, north arrow and scale go in the neighbours' land south of the farm and east of the hill, where there's room.
  // With the riverside meadow there (south of the farm, beyond the hill), they go in the open ground north-east of the farm instead, past the wood.
  const key = A.quarry && A.riverside
    ? { minX: A.riverside.maxX + 4, maxX: bounds.maxX - 4, minZ: bounds.maxZ - 4 - 84, maxZ: bounds.maxZ - 4 }
    : A.riverside && A.woods
    ? { minX: A.woods.maxX + 4, maxX: bounds.maxX - 4, minZ: bounds.minZ + 4, maxZ: fields.farm.minZ - 8 }
    : { minX: (A.hill?.maxX ?? fields.farm.minX) + (nf ? 4 : 10), maxX: Math.min(bounds.maxX - 4, nf ? nf.yard.minX - 6 : Infinity), minZ: fields.farm.maxZ + 8, maxZ: bounds.maxZ - 4 };

  return {
    bounds, key, areas, hedges, gates, stream, ford, pond, road, track: { points: track.points, half: layout.trackHalfWidth }, bogs, dragStrip, ramp,
    woodsTrack, woodsTrail, woodsBogs, woodsPond: woods?.pond ?? null, woodland: woods ? { ...woods.rect } : null,
    quarryPit: quarry ? quarryOutline(quarry) : null,
    buildings, small, muckHeap, paddock, yard, wood, labels,
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
