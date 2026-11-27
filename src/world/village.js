// The village (layout.village): the shape of it, from the layout. Pure: the side road's curve, the buildings' footprints, the ground levelled
// under them, the walls that shut the village in and the spot the girls ask to be taken to at the pub. world/villageProps.js draws it.

import { roadNetwork, smoothRoad, dashes } from './roads.js';

const rect = (x, z, hx, hz) => ({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
const inRect = (r, x, z, margin = 0) => x > r.minX - margin && x < r.maxX + margin && z > r.minZ - margin && z < r.maxZ + margin;
export const OAK_CROWN = 5.2; // m a crown spreads from its trunk, a unit of scale (the oak in villageProps.js)
const outside = (r, x, z) => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));
const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The MOT bay in the garage's own frame: its middle `x` along the front and `front` m out from it, `len` along the wall and `wid` across, in m. */
export const MOT_BAY = { x: -4.4, front: 2.4, len: 5.2, wid: 2.5 };

/** The MOT bay's rectangle in the world, from the garage (which faces south at yaw 0 and north at yaw Math.PI): where the painted bay lies on the forecourt. */
export function motBayRect(garage) {
  const t = Math.cos(garage.yaw) > 0 ? 1 : -1;
  const x = garage.x + t * MOT_BAY.x;
  const z = garage.z + t * (garage.halfZ + MOT_BAY.front);
  return { minX: x - MOT_BAY.len / 2, maxX: x + MOT_BAY.len / 2, minZ: z - MOT_BAY.wid / 2, maxZ: z + MOT_BAY.wid / 2 };
}

/**
 * What is painted on the forecourt at each pump, in the world: a pale line across the far end of its bay (away from the garage, the way you drive in) and
 * a line down each side of it from there to the pump, and a drain grating beyond. Each is { x, z, w, d } (a box `w` along x and `d` along z). None is on the
 * side of the pumps the garage is on, so none can lie in the MOT bay.
 */
export function forecourtMarkings(garage, pumps) {
  const t = Math.cos(garage.yaw) > 0 ? 1 : -1; // the way from the garage out over the forecourt: +z facing south, -z facing north
  const out = { lines: [], drains: [] };
  const pz = pumps.z;
  for (const px of pumps.xs) {
    out.lines.push({ x: px, z: pz + t * 2.6, w: 3.6, d: 0.1 });
    for (const dx of [-1.8, 1.8]) out.lines.push({ x: px + dx, z: pz + t * 1.3, w: 0.1, d: 2.6 });
    out.drains.push({ x: px, z: pz + t * 3.4, w: 1.0, d: 0.26 });
  }
  return out;
}

/**
 * The rectangles of the village's ground that carry road mud (one grid each, world.js): on today's farm the village's whole area west of the lane; on the
 * new farm, whose village is a 325 m street with a car park and a forecourt off it, the street's own bounds, the car park and the forecourt (a grid
 * over the whole 325 by 226 m of it was 294,000 cells looped every frame, almost all grass, #1031). `roads` is the road network.
 */
export function villageMudBounds(layout, roads, margin) {
  const v = layout.village;
  const lane = layout.publicLane;
  if (v.garage.forecourt) return [roads.boundsOf('street', margin), v.pub.carPark, v.garage.forecourt];
  return [{ minX: v.area.minX, maxX: lane.x - lane.halfWidth - 1, minZ: v.area.minZ, maxZ: v.area.maxZ }];
}

export { smoothRoad };

/**
 * The speed limit signs at the street's two ends and halfway (#537), on the new farm's street: each { x, z, yaw, front, back }, `yaw` where its front looks (0 south, +z) and
 * `front`, `back` the mph on each face or 'national' (the national speed limit disc, for the traffic leaving). One post at each end on the left of the way in, 20 to those coming
 * in and the national limit to those leaving, and a repeater on the left halfway along showing 20 both ways. The lane gets none (its 30s are `approachSignSpecs`). `S` is the shape.
 */
export function streetLimitSigns(S) {
  const at = (i, side) => {
    const p = S.road[Math.min(S.road.length - 2, i)];
    const off = side * (S.curb + 0.1);
    return { x: p.x + -p.tz * off, z: p.z + p.tx * off };
  };
  const east = S.eastward ? Math.PI / 2 : -Math.PI / 2;
  const left = S.eastward ? -1 : 1; // the side of the street on the left of the way in from the lane
  return [
    { ...at(18, left), yaw: east, front: S.limit, back: 'national' },
    { ...at(S.road.length - 12, -left), yaw: east + Math.PI, front: S.limit, back: 'national' },
    { ...at(Math.floor(S.road.length / 2), left), yaw: east, front: S.limit, back: S.limit },
  ].filter((p) => !S.builtAt(p.x, p.z, 0.6));
}

/**
 * The signs on the lane's approach (#819), from the layout: each limit post { x, z, yaw, front: 30, back: 'national' } and each village sign { x, z, yaw, village: true }.
 * Empty on a farm without an approach.
 */
export function approachSignSpecs(v) {
  if (!v.approach) return [];
  return v.approach.signs.map((s) => (s.kind === 'village' ? { x: s.x, z: s.z, yaw: s.yaw, village: true } : { x: s.x, z: s.z, yaw: s.yaw, front: v.approach.limit, back: 'national' }));
}

/** The marks on the village road: a broken white line down the middle (it is two-way) and one give-way line across the lane going out, not both.
 * The line is on the positive side of the road (the right of the way it is drawn, the left of whoever leaves): on the north half of a road that runs west
 * from the lane, and the south half of one that runs east (the new farm's, #688). */
export function roadMarks(S) {
  const centre = [];
  centre.push(...dashes({ on: 2, off: 4, from: S.giveWay + 3, to: S.road.length - 3, width: 0.1, whole: true }));
  // The give-way line: a double broken line across the half that carries the traffic leaving the village (it keeps left).
  const giveWay = [];
  for (const row of [0, 0.5]) {
    for (let o = 0.1; o < S.roadHalfWidth - 0.3; o += 0.9) giveWay.push({ s: S.giveWay + row, len: 0.2, a: o, b: Math.min(o + 0.6, S.roadHalfWidth - 0.1) });
  }
  return { centre, giveWay: S.street.markings.giveWay ? giveWay : [] };
}

/** Where a building's front is: the z of its front wall, and which way the front faces (+1 south, towards +z; -1 north). */
/**
 * Samples laid back from the road's first one, out over the lane, along its heading: `count` of them `step` m apart, nearest the road last.
 * The road's mouth is clamped to the lane's edge, and only cross-sections that lie wholly past the edge squash flat onto it, so these stand
 * in for the stretch the road would have had if it went on across the lane (#588 left a wedge of bare ground without them).
 */
export function roadLeadIn(first, count, step) {
  return Array.from({ length: count }, (_, k) => {
    const d = (count - k) * step;
    return { x: first.x - first.tx * d, z: first.z - first.tz * d, tx: first.tx, tz: first.tz };
  });
}

export const frontOf = (b) => (Math.cos(b.yaw) > 0 ? { z: b.z + b.halfZ, face: 1 } : { z: b.z - b.halfZ, face: -1 });

/** Where a house's front door is along its front (its own x), by design: what the front garden's gate and path line up with (villageHouses.js draws the door there). */
export function frontDoorX(b) {
  if (b.design === 'gabled') return b.halfX * 0.48;
  if (b.design === 'bungalow') return b.halfX * 0.4 - 0.5;
  return 0;
}

/** A lane house's front garden: its hedge `depth` m out from the front wall, running `reach` m either side of the door and stopping `gap` m short of it for the gate. */
export const FRONT_GARDEN = { depth: 8.5, reach: 11.5, gap: 0.9 };

/** A point of a building's own frame (x along its front, z out from it) in the world, turned by its `yaw` as the house's group is. */
export function houseToWorld(b, lx, lz) {
  const c = Math.cos(b.yaw ?? 0);
  const s = Math.sin(b.yaw ?? 0);
  return { x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c };
}

/**
 * The hedges of a house's gardens (#1084), in its own frame: boxes { part, x, z, w, d, h } (`w` along its front, `d` out from it, `h` tall). A garden at the
 * back `depth` deep with a hedge down each side and across the end, but none for the small farm's farmhouse: its yard wall stands 4 m behind it and is the
 * garden's boundary. A lane house's front hedge either side of its gate, each run ending at the house's `plot` (a world { minZ, maxZ } along the lane,
 * which its front faces with a quarter turn), so it never runs into the next plot or through the neighbour's hedge.
 */
export function gardenHedges(b, depth) {
  const out = [];
  if (b.kind !== 'farmhouse') {
    const back = -b.halfZ;
    for (const sx of [-1, 1]) out.push({ part: 'side', x: sx * (b.halfX + 0.9), z: back - (depth - 1) / 2, w: 0.8, d: depth + 1, h: 1.5 });
    out.push({ part: 'back', x: 0, z: back - depth, w: b.halfX * 2 + 2.8, d: 0.8, h: 1.62 });
  }
  if (b.approach && b.design !== 'farmhouse') {
    const { depth: fd, reach, gap } = FRONT_GARDEN;
    const doorX = frontDoorX(b);
    let [lo, hi] = [-Infinity, Infinity];
    if (b.plot) {
      // The plot's ends along the lane in the house's own x: a quarter turn maps world z onto its x, one way or the other.
      const s = -Math.sin(b.yaw ?? 0);
      [lo, hi] = [(b.plot.minZ - b.z) * s, (b.plot.maxZ - b.z) * s].sort((p, q) => p - q);
    }
    for (const sign of [-1, 1]) {
      const from = Math.min(hi, Math.max(lo, doorX + sign * (gap + 0.2)));
      const to = Math.min(hi, Math.max(lo, doorX + sign * reach));
      if (Math.abs(to - from) < 0.3) continue;
      out.push({ part: 'front', x: (from + to) / 2, z: b.halfZ + fd, w: Math.abs(to - from), d: 0.8, h: 1.3 });
    }
  }
  return out;
}

/** A garden hedge box's four corners in the world, [x, z] each. */
export function hedgeCorners(b, p) {
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, k]) => {
    const w = houseToWorld(b, p.x + (i * p.w) / 2, p.z + (k * p.d) / 2);
    return [w.x, w.z];
  });
}

/**
 * The village from the layout, or null on a farm without one: the road's curve, every building with its footprint, the car park, the
 * walls that shut the area in, and what the rest of the world asks (is this built on, how much to level the ground here).
 */
const cache = new WeakMap();
export function villageShape(layout) {
  if (!cache.has(layout)) cache.set(layout, buildShape(layout));
  return cache.get(layout);
}

function buildShape(layout) {
  const v = layout.village;
  if (!v) return null;
  const street = roadNetwork(layout).road('street'); // the village street: the centreline, width and pavements are in `layout.roads`
  const road = street.samples;
  const curb = street.halfWidth + v.road.pavement;
  const buildings = [
    { id: 'pub', kind: 'pub', ...v.pub },
    { id: 'shop', kind: 'shop', ...v.shop },
    { id: 'garage', kind: 'garage', ...v.garage },
    ...v.cottages.map((c) => ({ kind: 'cottage', ...c })),
  ].map((b) => ({ ...b, outer: rect(b.x, b.z, b.halfX, b.halfZ) }));
  // The lane's approach (#819): three houses facing the lane (a quarter turn, so their frontage is along z) and a small farm's house and barn. Apart from `buildings`,
  // which are along the street, but as much a part of what is built on and levelled.
  const laneBuildings = [
    ...(v.approach?.houses ?? []).map((c) => ({ kind: 'cottage', approach: true, ...c })),
    ...(v.approach ? [{ kind: 'farmhouse', approach: true, ...v.approach.farm.house }, { kind: 'barn', approach: true, ...v.approach.farm.barn }] : []),
  ].map((b) => ({ ...b, outer: Math.abs(Math.sin(b.yaw ?? 0)) > 0.5 ? rect(b.x, b.z, b.halfZ, b.halfX) : rect(b.x, b.z, b.halfX, b.halfZ) }));
  const carPark = v.pub.carPark;
  // Where the side road meets the lane: it starts at the lane's west edge (the lane's own tarmac is under the rest), and the give-way line sits
  // just inside that, across the half of the road that carries traffic out (the north side, the left heading east).
  // A street that runs east from the lane (the new farm's) leaves its east edge instead of its west, and ends on the A-road's side, not at a closed gate.
  const lane = layout.publicLane;
  const eastward = road[road.length - 1].x > road[0].x;
  const laneEdge = eastward ? lane.x + lane.halfWidth : lane.x - lane.halfWidth;
  const past = (p, d = 0) => (eastward ? p.x >= laneEdge + d : p.x <= laneEdge - d);
  const mouth = Math.max(0, road.findIndex((p) => past(p)));
  const giveWay = Math.max(mouth + 1, road.findIndex((p) => past(p, 2.4)));
  const closed = !!v.end; // a road shut by a gate, with the village's walls round it
  // The garage's forecourt: from its front to the road's pavement.
  const garage = buildings.find((b) => b.kind === 'garage');
  const forecourt = v.garage.forecourt ?? { minX: garage.outer.minX, maxX: garage.outer.maxX, minZ: garage.outer.minZ - 9.2, maxZ: garage.outer.minZ };
  const a = v.area;
  const t = 0.3;
  // Drystone walls shutting the village in (north, south and west; the lane's own barrier is the east): boxes { x, z, hx, hz }.
  const walls = closed ? [
    { x: (a.minX + a.maxX) / 2, z: a.minZ, hx: (a.maxX - a.minX) / 2, hz: t },
    { x: (a.minX + a.maxX) / 2, z: a.maxZ, hx: (a.maxX - a.minX) / 2, hz: t },
    { x: a.minX, z: (a.minZ + a.maxZ) / 2, hx: t, hz: (a.maxZ - a.minZ) / 2 },
  ] : [];
  // What is levelled: each building to the ground at its middle, the forecourt likewise, and the car park to the ground at its mouth on the road's
  // side, easing back over longer, so the way in from the road isn't a ramp.
  const pads = [
    ...[...buildings, ...laneBuildings].map((b) => ({ r: b.outer, at: [b.x, b.z], reach: 3.5 })),
    { r: carPark, at: [(carPark.minX + carPark.maxX) / 2, carPark.maxZ + 3], reach: 7 },
  ];
  if (v.approach) {
    // The small farm's yard is levelled to the ground at its middle, easing out over 7 m beyond its wall.
    const yard = v.approach.farm.yard;
    pads.push({ r: yard, at: [(yard.minX + yard.maxX) / 2, (yard.minZ + yard.maxZ) / 2], reach: 7 });
  }
  if (v.garage.forecourt) {
    // On the new farm the land falls 6% east along a 46 m forecourt, so the slab follows it, and only what must stand level is levelled: the pumps' island
    // and canopy (to the ground at its middle, easing out over 4 m) and the MOT bay (to the garage's own floor level, so it meets the front flush).
    const { xs, z } = v.garage.pumps;
    const island = { minX: xs[0] - 1.6, maxX: xs[xs.length - 1] + 1.6, minZ: z - 2.4, maxZ: z + 2.4 };
    const turn = Math.cos(garage.yaw) > 0 ? 1 : -1;
    const bay = rect(garage.x + turn * MOT_BAY.x, garage.z + turn * (garage.halfZ + MOT_BAY.front), MOT_BAY.len / 2 + 0.6, MOT_BAY.wid / 2 + 0.6);
    pads.push({ r: island, at: [(island.minX + island.maxX) / 2, z], reach: 4 }, { r: bay, at: [garage.x, garage.z], reach: 2.5 });
  } else {
    pads.push({ r: forecourt, at: [(forecourt.minX + forecourt.maxX) / 2, (forecourt.minZ + forecourt.maxZ) / 2], reach: 3.5 });
  }
  // The box every pad's reach is inside: the ground is asked at every metre of the farm, and nearly all of it is nowhere near one (#1107).
  const padBox = {
    minX: Math.min(...pads.map((p) => p.r.minX - p.reach)),
    maxX: Math.max(...pads.map((p) => p.r.maxX + p.reach)),
    minZ: Math.min(...pads.map((p) => p.r.minZ - p.reach)),
    maxZ: Math.max(...pads.map((p) => p.r.maxZ + p.reach)),
  };
  const footprints = [...buildings, ...laneBuildings].map((b) => b.outer);

  /** Distance from (x, z) to the road's middle line, and how far along it that point is (s, in samples, about metres). */
  function roadAt(x, z) {
    let best = { d: Infinity, i: 0 };
    for (let i = 0; i < road.length; i++) {
      const d = Math.hypot(road[i].x - x, road[i].z - z);
      if (d < best.d) best = { d, i };
    }
    const r = road[best.i];
    return { d: best.d, s: best.i, side: Math.sign((x - r.x) * -r.tz + (z - r.z) * r.tx) || 1, at: r };
  }

  /**
   * How deep a cottage's back garden can run (m, up to 6): its hedge stands a metre inside the village's wall at the most, so it never goes out
   * over the brook beyond.
   */
  const gardenDepth = (b) => {
    if (v.gardenDepth !== undefined) return v.gardenDepth;
    const room = b.yaw === 0 ? b.z - b.halfZ - a.minZ : a.maxZ - (b.z + b.halfZ);
    return Math.max(0, Math.min(6, room - 1));
  };

  /** On a building or within `margin` of one (the trees keep off, a girl won't be put there). */
  const builtAt = (x, z, margin = 0) => footprints.some((r) => inRect(r, x, z, margin));
  /** Under a roof: out of the rain. */
  const covered = (x, z) => footprints.some((r) => inRect(r, x, z));
  /** Within `margin` m of anything in the village (or inside its area). */
  const nearVillage = (x, z, margin = 0) => inRect(a, x, z, margin);
  /**
   * 0..1 how much to level the ground at (x, z) to a pad's, and the level there from `ground(x, z)` at the pad's middle: flat under each
   * building, the car park and the forecourt, easing back over `reach` m outside it.
   */
  function floorAt(x, z, ground) {
    if (x <= padBox.minX || x >= padBox.maxX || z <= padBox.minZ || z >= padBox.maxZ) return null; // past every pad's reach
    let best = null;
    for (const { r, at, reach } of pads) {
      const d = outside(r, x, z);
      if (d >= reach) continue;
      const k = 1 - smooth(clamp01(d / reach));
      if (!best || k > best.k) best = { k, level: ground(at[0], at[1]) };
    }
    return best;
  }

  /**
   * 0..1 how much the whole village's ground is laid to its own level here: 1 inside the walls, easing out over `ease` m beyond them. The land
   * rises a good way over the village's width, which would put the car park a metre under the road at its mouth; laid to a plane along the road
   * (level across it) the road, the pavements, the doors and the pumps all sit square.
   */
  const AREA_EASE = 9;
  const areaWeight = (x, z) => {
    if (v.flat === false) return 0;
    const d = outside(a, x, z);
    return d >= AREA_EASE ? 0 : 1 - smooth(clamp01(d / AREA_EASE));
  };
  /** The level of that plane at x: the natural ground at the lane's end of the road, to the natural ground at the other end, straight between. */
  function planeAt(x, natural, z) {
    if (v.flat === false) return natural(x, z); // the land's own lie
    const p0 = street.points[0];
    const p1 = street.points[street.points.length - 1];
    const t = clamp01((p0[0] - x) / (p0[0] - p1[0]));
    return natural(p0[0], p0[1]) * (1 - t) + natural(p1[0], p1[1]) * t;
  }

  /**
   * 0..1 how much of (x, z) is the village's own hard standing besides the street (which is a road, world/roads.js): the car park and the
   * garage's forecourt, with the same soft edge a hand's width across as the roads'.
   */
  const EDGE = 0.15;
  function tarmacAt(x, z) {
    if (!inRect(a, x, z, 1)) return 0;
    const onRect = (r) => 1 - smooth(clamp01(outside(r, x, z) / (2 * EDGE)));
    return Math.max(onRect(carPark), onRect(forecourt));
  }

  return {
    v,
    street,
    name: v.name,
    tarmacAt,
    /** Where its own hard standing could be (the car park and the forecourt, and the edge's width round them). */
    tarmacBoxes: () => [carPark, forecourt].map((r) => ({ minX: r.minX - 2 * EDGE, maxX: r.maxX + 2 * EDGE, minZ: r.minZ - 2 * EDGE, maxZ: r.maxZ + 2 * EDGE })),
    areaWeight,
    planeAt,
    limit: v.limit,
    road,
    laneEdge,
    mouth,
    giveWay,
    eastward,
    closed,
    /** The road past its closed gate: a middle line bending away and the metres it rises (none on a street that goes through). */
    beyond: closed ? smoothRoad(v.end.beyond, 1) : [],
    /** The closed gate: `end.back` m before the road's last sample, facing along the road's heading there (the gate runs across it). */
    gate: closed ? { x: road[road.length - 1].x - road[road.length - 1].tx * v.end.back, z: road[road.length - 1].z - road[road.length - 1].tz * v.end.back, tx: road[road.length - 1].tx, tz: road[road.length - 1].tz } : null,
    beyondRise: closed ? v.end.rise : 0,
    roadHalfWidth: street.halfWidth,
    curb,
    area: a,
    buildings,
    laneBuildings,
    carPark,
    forecourt,
    walls,
    footprints,
    pub: buildings.find((b) => b.kind === 'pub'),
    shop: buildings.find((b) => b.kind === 'shop'),
    garage,
    /** Where the girls ask to be taken: pulled up in the pub's car park. */
    pubStop: { ...v.pub.stop },
    roadAt,
    builtAt,
    gardenDepth,
    covered,
    nearVillage,
    floorAt,
    /** The gap in the lane's west barrier where the side road turns off: [minZ, maxZ]. */
    laneGap: closed ? [a.minZ + 1, street.points[0][1] + 15] : null,
  };
}

/** The village's walls and the car park as the farm map and the trees see them: whether (x, z) is in the village's own ground. */
export function inVillage(layout, x, z, margin = 0) {
  const s = villageShape(layout);
  return !!s && s.nearVillage(x, z, margin);
}
