// The shape of the farm as questions the game asks of it: which field is this, how far to a hedge, what's ahead, the way round through the
// gateways. The fields are polygons with hedges along their edges (fieldPlan.js has today's farm); this is what the grass field, the farm road east out of it and the stubble fields either side, the hedges between them with
// their gateways, what the ground is (grass, stubble or tarmac) and a way round from one field to another through the gateways.
// Through the south gate, the green lane and the hill pasture (world/hill.js) are fields too, and through the north gate, the wood (world/woods.js), and from the barley field's north hedge, the gravel pit's field (world/quarry.js).
// Pure: built from the layout (layout.js), used by the terrain, the props, the tyres and the girls.

import { createHill } from './hill.js';
import { createWoods } from './woods.js';
import { createQuarry } from './quarry.js';
import { createOutbuildings } from './outbuildings.js';
import { villageShape } from './village.js';
import { createBrook } from './brook.js';
import { fieldPlan } from './fieldPlan.js';
import { createFieldMap } from './fieldMap.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** How far (x, z) is outside the rectangle, metres (0 inside). */
export function outsideRect(r, x, z) {
  const dx = Math.max(r.minX - x, 0, x - r.maxX);
  const dz = Math.max(r.minZ - z, 0, z - r.maxZ);
  return Math.hypot(dx, dz);
}

/**
 * The lie of the stubble fields: how far each lifts or drops the ground at (x, z), and how much of the wet it holds (0..1, 1 at the bottom of
 * the north field's hollow). The south field's rise starts a few metres off the road and fades in over its first 25 m from the grass field,
 * so neither the road nor the hedge between them has a step in it; past the far hedge it stays up, and the farmland beyond carries on from it.
 */
export function createFieldShape(layout) {
  const sf = layout.stubbleFields;
  const road = layout.road;
  const F = layout.fieldHalf;
  if (!sf || !road) return () => ({ lift: 0, soak: 0 });
  const roadEdge = road.z + road.halfWidth + road.verge;
  const farEdge = layout.farm?.maxZ ?? F;
  return function shapeAt(x, z) {
    let lift = 0;
    let soak = 0;
    const h = sf.north?.hollow;
    if (h) {
      const r = Math.hypot((x - h.x) / h.rx, (z - h.z) / h.rz);
      if (r < 1) {
        lift -= h.depth * (1 - smoothstep(0, 1, r));
        soak = 1 - smoothstep(0.3, 1, r);
      }
    }
    if (sf.south?.rise && x > F && z > roadEdge) lift += sf.south.rise * smoothstep(roadEdge + 3, farEdge, z) * smoothstep(F, F + 25, x);
    return { lift, soak };
  };
}

export function createFields(layout) {
  const F = layout.fieldHalf;
  const farm = layout.farm ?? { minX: -F, maxX: F, minZ: -F, maxZ: F };
  const road = layout.road;
  const hill = createHill(layout);
  const woods = createWoods(layout);
  const quarry = createQuarry(layout);
  const built = createOutbuildings(layout);
  const plan = fieldPlan(layout, { hill, woods, quarry, brook: createBrook(layout) });
  const padX = road?.pad?.x ?? 0;
  const { gateways, gates } = plan;
  const { polygons, areas, kinds, hedges, areaOf, inGap, hedgeDistance, hedgedAt, hedgeAhead, route, nextWaypoint, inFarm, clampToArea, outsideFarm } = createFieldMap(plan, farm);
  const grass = areas.grass;

  /**
   * 0..1 how much of (x, z) is tarmac or concrete: the farm road and the hardstanding at its end, the public lane, and the village's road,
   * pavements, car park and forecourt, with a soft edge a hand's width across.
   */
  const lane = layout.publicLane;
  const village = villageShape(layout);
  function tarmacAt(x, z) {
    const edge = 0.15;
    let t = 0;
    if (road) {
      const along = Math.max(road.fromX - x, 0, x - road.toX);
      const onRoad = 1 - smoothstep(road.halfWidth - edge, road.halfWidth + edge, Math.hypot(along, z - road.z));
      const onPad = road.pad ? 1 - smoothstep(road.pad.radius - edge, road.pad.radius + edge, Math.hypot(x - padX, z - road.z)) : 0;
      t = Math.max(onRoad, onPad);
    }
    if (lane && t < 1) {
      const along = Math.max(lane.minZ - z, 0, z - lane.maxZ);
      t = Math.max(t, 1 - smoothstep(lane.halfWidth - edge, lane.halfWidth + edge, Math.hypot(along, x - lane.x)));
    }
    return village && t < 1 ? Math.max(t, village.tarmacAt(x, z)) : t;
  }

  /** 0..1 how much of (x, z) is stubble: the two fields either side of the road, up to the tarmac, and not under the buildings out there. */
  function stubbleAt(x, z) {
    if (!road) return 0;
    const a = areaOf(x, z);
    if ((a !== 'north' && a !== 'south') || built.builtAt(x, z)) return 0;
    return 1 - tarmacAt(x, z);
  }

  const shape = createFieldShape(layout);

  /** 0..1 how much of the wet the ground holds here (the north field's hollow), for the wear's bogs. */
  function soakAt(x, z) {
    return shape(x, z).soak;
  }

  /** The stubble field's own settings (layout.stubbleFields) for 'north' or 'south'. */
  const stubbleField = (area) => layout.stubbleFields?.[area] ?? null;

  /** Metres (x, z) is outside the farm and the hill's hedges: how far into the neighbours' farmland (0 inside). */
  function outsideAll(x, z) {
    let d = outsideFarm(x, z);
    if (hill) d = Math.min(d, hill.outside(x, z));
    if (woods) d = Math.min(d, woods.outside(x, z));
    if (quarry) d = Math.min(d, quarry.outside(x, z));
    return d;
  }

  // The ground tyres wear: the farm and, through the south gate, the lane, the fields beside it and the pasture.
  const wearBounds = hill
    ? { minX: Math.min(farm.minX, hill.pasture.minX, hill.west?.minX ?? Infinity), maxX: Math.max(farm.maxX, hill.pasture.maxX), minZ: farm.minZ, maxZ: Math.max(farm.maxZ, hill.pasture.maxZ) }
    : farm;
  /** 0..1 how much of the ground at (x, z) is the green lane's own, which ruts deeper and dries slower than a field (groundWear.js). */
  const laneAt = (x, z) => {
    if (!hill || z < hill.laneRect.minZ || z > hill.laneRect.maxZ) return 0;
    return 1 - smoothstep(hill.lane.halfWidth, hill.lane.halfWidth + 1.5, Math.abs(x - hill.lane.x));
  };
  return { wearBounds, laneAt, farm, hill, woods, quarry, gates, outside: outsideAll, grass, areas, polygons, kinds, boundaries: plan.boundaries, hedges, gateways, soakAt, stubbleField, areaOf, hedgeDistance, hedgeAhead, hedgedAt, tarmacAt, stubbleAt, route, nextWaypoint, inFarm, clampToArea, inGap };
}
