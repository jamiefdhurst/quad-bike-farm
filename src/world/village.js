// The village (layout.village): the shape of it, from the layout. Pure: the side road's curve, the buildings' footprints, the ground levelled
// under them, the walls that shut the village in and the spot the girls ask to be taken to at the pub. world/villageProps.js draws it.

import { roadNetwork, smoothRoad, dashes } from './roads.js';

const rect = (x, z, hx, hz) => ({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
const inRect = (r, x, z, margin = 0) => x > r.minX - margin && x < r.maxX + margin && z > r.minZ - margin && z < r.maxZ + margin;
export const OAK_CROWN = 5.2; // m a crown spreads from its trunk, a unit of scale (the oak in villageProps.js)
const outside = (r, x, z) => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));
const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export { smoothRoad };

/** The marks on the village road: a broken white line down the middle (it is two-way) and one give-way line across the lane going out, not both. */
export function roadMarks(S) {
  const centre = [];
  centre.push(...dashes({ on: 2, off: 4, from: S.giveWay + 3, to: S.road.length - 3, width: 0.1, whole: true }));
  // The give-way line: a double broken line across the north half only, the traffic leaving the village (it keeps left, so heading east is on the north).
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
  const carPark = v.pub.carPark;
  // Where the side road meets the lane: it starts at the lane's west edge (the lane's own tarmac is under the rest), and the give-way line sits
  // just inside that, across the half of the road that carries traffic out (the north side, the left heading east).
  const lane = layout.publicLane;
  const laneEdge = lane.x - lane.halfWidth;
  const mouth = Math.max(0, road.findIndex((p) => p.x <= laneEdge));
  const giveWay = Math.max(mouth + 1, road.findIndex((p) => p.x <= laneEdge - 2.4));
  // The garage's forecourt: from its front to the road's pavement.
  const garage = buildings.find((b) => b.kind === 'garage');
  const forecourt = { minX: garage.outer.minX, maxX: garage.outer.maxX, minZ: garage.outer.minZ - 9.2, maxZ: garage.outer.minZ };
  const a = v.area;
  const t = 0.3;
  // Drystone walls shutting the village in (north, south and west; the lane's own barrier is the east): boxes { x, z, hx, hz }.
  const walls = [
    { x: (a.minX + a.maxX) / 2, z: a.minZ, hx: (a.maxX - a.minX) / 2, hz: t },
    { x: (a.minX + a.maxX) / 2, z: a.maxZ, hx: (a.maxX - a.minX) / 2, hz: t },
    { x: a.minX, z: (a.minZ + a.maxZ) / 2, hx: t, hz: (a.maxZ - a.minZ) / 2 },
  ];
  // What is levelled: each building to the ground at its middle, the forecourt likewise, and the car park to the ground at its mouth on the road's
  // side, easing back over longer, so the way in from the road isn't a ramp.
  const pads = [
    ...buildings.map((b) => ({ r: b.outer, at: [b.x, b.z], reach: 3.5 })),
    { r: forecourt, at: [(forecourt.minX + forecourt.maxX) / 2, (forecourt.minZ + forecourt.maxZ) / 2], reach: 3.5 },
    { r: carPark, at: [(carPark.minX + carPark.maxX) / 2, carPark.maxZ + 3], reach: 7 },
  ];
  const footprints = buildings.map((b) => b.outer);

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
    const d = outside(a, x, z);
    return d >= AREA_EASE ? 0 : 1 - smooth(clamp01(d / AREA_EASE));
  };
  /** The level of that plane at x: the natural ground at the lane's end of the road, to the natural ground at the other end, straight between. */
  function planeAt(x, natural) {
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
    /** The road past its closed gate: a middle line bending away and the metres it rises. */
    beyond: smoothRoad(v.end.beyond, 1),
    /** The closed gate: `end.back` m before the road's last sample, facing along the road's heading there (the gate runs across it). */
    gate: { x: road[road.length - 1].x - road[road.length - 1].tx * v.end.back, z: road[road.length - 1].z - road[road.length - 1].tz * v.end.back, tx: road[road.length - 1].tx, tz: road[road.length - 1].tz },
    beyondRise: v.end.rise,
    roadHalfWidth: street.halfWidth,
    curb,
    area: a,
    buildings,
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
    laneGap: [a.minZ + 1, street.points[0][1] + 15],
  };
}

/** The village's walls and the car park as the farm map and the trees see them: whether (x, z) is in the village's own ground. */
export function inVillage(layout, x, z, margin = 0) {
  const s = villageShape(layout);
  return !!s && s.nearVillage(x, z, margin);
}
