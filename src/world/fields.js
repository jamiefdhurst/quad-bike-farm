// The shape of the farm: the grass field, the farm road east out of it and the stubble fields either side, the hedges between them with
// their gateways, what the ground is (grass, stubble or tarmac) and a way round from one field to another through the gateways.
// Through the south gate, the green lane and the hill pasture (world/hill.js) are fields too, and through the north gate, the wood (world/woods.js).
// Pure: built from the layout (layout.js), used by the terrain, the props, the tyres and the girls.

import { createHill } from './hill.js';
import { createWoods } from './woods.js';
import { createOutbuildings } from './outbuildings.js';
import { villageShape } from './village.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const inRect = (r, x, z, margin = 0) => x >= r.minX + margin && x <= r.maxX - margin && z >= r.minZ + margin && z <= r.maxZ - margin;

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
  const gate = layout.gate;
  const grass = { minX: -F, maxX: F, minZ: -F, maxZ: F };
  const hill = createHill(layout);
  const woods = createWoods(layout);
  const built = createOutbuildings(layout);

  // The road's corridor between its hedges, and the two stubble fields either side of it.
  const corridor = road ? { lo: road.z - road.halfWidth - road.verge, hi: road.z + road.halfWidth + road.verge } : null;
  const padX = road?.pad?.x ?? 0;
  const areas = { grass };
  if (road) {
    areas.north = { minX: F, maxX: farm.maxX, minZ: farm.minZ, maxZ: corridor.lo };
    areas.south = { minX: F, maxX: farm.maxX, minZ: corridor.hi, maxZ: farm.maxZ };
    areas.road = { minX: F, maxX: road.hedgeTo, minZ: corridor.lo, maxZ: corridor.hi };
    areas.end = { minX: road.hedgeTo, maxX: farm.maxX, minZ: corridor.lo, maxZ: corridor.hi }; // round the hardstanding, open to both fields
  }
  if (hill) {
    areas.lane = { ...hill.laneRect, minZ: F };
    areas.hill = { ...hill.pasture };
    if (hill.west) areas.meadow = { ...hill.west };
    if (hill.east) areas.sheep = { ...hill.east };
  }
  if (woods) areas.woods = { ...woods.rect };
  // On foot, a girl wandering about the hill pasture keeps to the bottom of it, over the stream from the lane: this rect, less the 6 m margin
  // clampToArea is given, is the strip just past the water and short of the foot, 8 m either side of the lane.
  const wanderAreas = {};
  if (hill) {
    let lo = -Infinity;
    let hi = Infinity;
    for (let x = hill.lane.x - 8; x <= hill.lane.x + 8; x += 0.5) {
      lo = Math.max(lo, hill.farEdge(x) + 1);
      hi = Math.min(hi, hill.farEdge(x) + layout.hill.foot - 0.5);
    }
    wanderAreas.hill = { minX: hill.lane.x - 14, maxX: hill.lane.x + 14, minZ: lo - 6, maxZ: Math.max(lo, hi) + 6 };
  }

  /** Which field (x, z) is in: 'grass', 'road', 'end', 'north', 'south', 'lane', 'hill', 'meadow' (west of the lane), 'sheep' (east of it), 'woods' (through the north gate), or 'out' beyond the hedges. */
  function areaOf(x, z) {
    if (inRect(grass, x, z)) return 'grass';
    for (const k of ['road', 'end', 'north', 'south', 'lane', 'hill', 'meadow', 'sheep', 'woods']) if (areas[k] && inRect(areas[k], x, z)) return k;
    return 'out';
  }

  // Hedge lines, each straight along x or z from (x1, z1) to (x2, z2), with gaps { at, half } along it. A gap with a gate in it is `gate`,
  // and `shut` if the gate is (the south gate is tied open; the big gate at the end of the road is shut). `height` is a taller hedge's own.
  const gateGap = { id: 'south', at: gate.x, half: gate.width / 2 + 0.35, gate: true, shut: !gate.open };
  const northGap = woods ? { id: 'north', at: woods.gate.x, half: woods.gate.width / 2 + 0.35, gate: true, shut: !woods.gate.open } : null;
  const roadGap = road?.gate ? { id: 'road', at: road.z, half: road.gate.width / 2 + 0.35, gate: true, shut: true } : null; // the game opens and shuts both (world/gates.js)
  const hedges = [
    { x1: -F, z1: -F, x2: F, z2: -F, gaps: northGap ? [northGap] : [] },
    { x1: -F, z1: F, x2: F, z2: F, gaps: [gateGap] },
    { x1: -F, z1: -F, x2: -F, z2: F, gaps: [] },
    { x1: F, z1: -F, x2: F, z2: F, gaps: road ? [{ at: road.z, half: (corridor.hi - corridor.lo) / 2 }] : [] },
  ];
  if (road) {
    const gaps = (xs) => xs.map((at) => ({ at, half: road.gapWidth / 2 }));
    hedges.push(
      { x1: F, z1: farm.minZ, x2: farm.maxX, z2: farm.minZ, gaps: [] },
      { x1: F, z1: farm.maxZ, x2: farm.maxX, z2: farm.maxZ, gaps: [] },
      { x1: farm.maxX, z1: farm.minZ, x2: farm.maxX, z2: farm.maxZ, gaps: roadGap ? [roadGap] : [] },
      { x1: F, z1: corridor.lo, x2: road.hedgeTo, z2: corridor.lo, gaps: gaps(road.gaps.north) },
      { x1: F, z1: corridor.hi, x2: road.hedgeTo, z2: corridor.hi, gaps: gaps(road.gaps.south) },
    );
  }
  if (woods) {
    // The wood's hedges on its other three sides; the fourth is the grass field's north hedge, with the gate in it.
    const r = woods.rect;
    hedges.push(
      { x1: r.minX, z1: r.minZ, x2: r.maxX, z2: r.minZ, gaps: [] },
      { x1: r.minX, z1: r.minZ, x2: r.minX, z2: r.maxZ, gaps: [] },
      { x1: r.maxX, z1: r.minZ, x2: r.maxX, z2: r.maxZ, gaps: [] },
    );
  }
  if (hill) {
    // The lane's tall hedges on top of its banks, from the gate to the pasture, and the pasture's own all round, open where the lane comes in.
    const { lane, pasture: p } = hill;
    const lx = [lane.x - lane.hedgeOff, lane.x + lane.hedgeOff];
    if (hill.west) {
      // The lane runs between the two fields beside it with nothing in between (the banks are still there, with a ramp at each gateway);
      // they are hedged round their outer sides: a short piece of the grass field's south hedge west of its corner, and a hedge down each side.
      hedges.push(
        { x1: hill.west.minX, z1: F, x2: -F, z2: F, gaps: [] },
        { x1: hill.west.minX, z1: F, x2: hill.west.minX, z2: lane.toZ, gaps: [] },
        { x1: hill.east.maxX, z1: F, x2: hill.east.maxX, z2: lane.toZ, gaps: [] },
      );
    } else {
      for (const x of lx) hedges.push({ x1: x, z1: F, x2: x, z2: lane.toZ, gaps: [], height: lane.hedgeHeight });
    }
    hedges.push(
      // The pasture's north hedge is open along its whole width where the two fields beside the lane meet it (they are hedged on their
      // outer sides only).
      { x1: p.minX, z1: p.minZ, x2: p.maxX, z2: p.minZ, gaps: [hill.west ? { at: (p.minX + p.maxX) / 2, half: (p.maxX - p.minX) / 2 + 1 } : { at: lane.x, half: lane.hedgeOff }] },
      { x1: p.minX, z1: p.maxZ, x2: p.maxX, z2: p.maxZ, gaps: [] },
      { x1: p.minX, z1: p.minZ, x2: p.minX, z2: p.maxZ, gaps: [] },
      { x1: p.maxX, z1: p.minZ, x2: p.maxX, z2: p.maxZ, gaps: [] },
    );
  }
  for (const h of hedges) {
    h.alongX = h.z1 === h.z2;
    h.length = h.alongX ? h.x2 - h.x1 : h.z2 - h.z1;
  }

  /** Whether the point `s` along a hedge (an x for one along x, a z for one along z) is in one of its gaps. */
  const inGap = (h, s) => h.gaps.some((g) => Math.abs(s - g.at) < g.half);

  /** Metres to the nearest hedge line (gaps and all). */
  function hedgeDistance(x, z) {
    let best = Infinity;
    for (const h of hedges) {
      const d = h.alongX ? Math.hypot(Math.max(h.x1 - x, 0, x - h.x2), z - h.z1) : Math.hypot(x - h.x1, Math.max(h.z1 - z, 0, z - h.z2));
      if (d < best) best = d;
    }
    return best;
  }

  /** Metres along `yaw` (0 is +z) from (x, z) to the first hedge or shut gate it would hit, not counting the open gaps; Infinity if none. */
  function hedgeAhead(x, z, yaw) {
    const dx = Math.sin(yaw);
    const dz = Math.cos(yaw);
    let best = Infinity;
    for (const h of hedges) {
      const d = h.alongX ? (Math.abs(dz) < 1e-6 ? -1 : (h.z1 - z) / dz) : Math.abs(dx) < 1e-6 ? -1 : (h.x1 - x) / dx;
      if (d < 0 || d >= best) continue;
      const s = h.alongX ? x + dx * d : z + dz * d;
      const lo = h.alongX ? h.x1 : h.z1;
      if (s < lo || s > lo + h.length || h.gaps.some((g) => !g.shut && Math.abs(s - g.at) < g.half)) continue;
      best = d;
    }
    return best;
  }

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

  // Gateways: a point either side of each gap (2 m out), joining the two fields it's between. The open sides round the hardstanding count too.
  const gateways = [];
  const link = (a, pa, b, pb, gap = null) => gateways.push({ a, pa, b, pb, gap });
  link('grass', { x: gate.x, z: F - 2.5 }, hill ? 'lane' : 'out', { x: gate.x, z: F + 2.5 }, gateGap); // a shut gate is no way through
  if (woods) link('grass', { x: woods.gate.x, z: -F + 2.5 }, 'woods', { x: woods.gate.x, z: -F - 2.5 }, northGap);
  if (hill) link('lane', { x: hill.lane.x, z: hill.lane.toZ - 2 }, 'hill', { x: hill.lane.x, z: hill.lane.toZ + 2 });
  if (hill) {
    for (const g of hill.gates) {
      link('lane', { x: g.x - g.side * 2, z: g.z }, g.side < 0 ? 'meadow' : 'sheep', { x: g.x + g.side * 2.5, z: g.z });
    }
  }
  if (road) {
    link('grass', { x: F - 2.5, z: road.z }, 'road', { x: F + 2.5, z: road.z });
    for (const x of road.gaps.north) link('road', { x, z: corridor.lo + 1.5 }, 'north', { x, z: corridor.lo - 2.5 });
    for (const x of road.gaps.south) link('road', { x, z: corridor.hi - 1.5 }, 'south', { x, z: corridor.hi + 2.5 });
    link('road', { x: road.hedgeTo - 2, z: road.z }, 'end', { x: road.hedgeTo + 2, z: road.z });
    const endX = (road.hedgeTo + farm.maxX) / 2;
    link('end', { x: endX, z: corridor.lo + 1 }, 'north', { x: endX, z: corridor.lo - 2.5 });
    link('end', { x: endX, z: corridor.hi - 1 }, 'south', { x: endX, z: corridor.hi + 2.5 });
  }

  /**
   * The way on foot or on a quad from `from` to `to` without going through a hedge: the gateway points to pass, then `to`. Just [to] when
   * they're in the same field. Shortest by straight lines between gateways (there are only a dozen, so a plain Dijkstra).
   */
  function route(from, to) {
    const start = areaOf(from.x, from.z);
    const goal = areaOf(to.x, to.z);
    if (start === goal) return [to];
    // Nodes: 0 is `from`, 1 is `to`, then each gateway's two points.
    const nodes = [{ p: from, area: start }, { p: to, area: goal }];
    for (const g of gateways) if (!g.gap?.shut) nodes.push({ p: g.pa, area: g.a, twin: nodes.length + 1 }, { p: g.pb, area: g.b, twin: nodes.length });
    const dist = nodes.map(() => Infinity);
    const prev = nodes.map(() => -1);
    const done = nodes.map(() => false);
    dist[0] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || u === 1) break;
      done[u] = true;
      const relax = (v) => {
        const d = dist[u] + Math.hypot(nodes[v].p.x - nodes[u].p.x, nodes[v].p.z - nodes[u].p.z);
        if (d < dist[v]) {
          dist[v] = d;
          prev[v] = u;
        }
      };
      if (nodes[u].twin !== undefined) relax(nodes[u].twin);
      for (let v = 1; v < nodes.length; v++) if (v !== u && !done[v] && nodes[v].area === nodes[u].area) relax(v);
    }
    if (dist[1] === Infinity) return [to];
    const path = [];
    for (let v = 1; v > 0; v = prev[v]) path.unshift(nodes[v].p);
    return path;
  }

  /**
   * The next point to head for on the way from `from` to `to`, skipping a point she's already within `reach` metres of, or has already passed:
   * on the far side of it along the way to the next point and (`lane` m) within a lane's width of that line. Without the second rule, a
   * gateway point 2.5 m short of a gap drew her back as she walked on through it, once she was more than `reach` past it, and she stood
   * dithering at the gap (the cattle grid's, mostly).
   */
  function nextWaypoint(from, to, reach = 1.5, lane = 1.5) {
    const path = route(from, to);
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      if (Math.hypot(p.x - from.x, p.z - from.z) <= reach) continue;
      const q = path[i + 1];
      if (q) {
        const dx = q.x - p.x;
        const dz = q.z - p.z;
        const len = Math.hypot(dx, dz) || 1;
        const along = ((from.x - p.x) * dx + (from.z - p.z) * dz) / len;
        const across = Math.abs(((from.x - p.x) * dz - (from.z - p.z) * dx) / len);
        if (along > 0 && across <= lane) continue;
      }
      return p;
    }
    return to;
  }

  /** Whether (x, z) is inside the farm's outer hedges, `margin` metres in. */
  function inFarm(x, z, margin = 0) {
    return inRect(farm, x, z, margin);
  }

  /** (x, z) pulled inside the field `area` (as areaOf names it), `margin` metres in from its edges; in the hill pasture, its bottom. */
  function clampToArea(area, x, z, margin = 0) {
    const r = wanderAreas[area] ?? areas[area];
    if (!r) return { x, z };
    const m = Math.min(margin, (r.maxX - r.minX) / 2, (r.maxZ - r.minZ) / 2);
    return { x: clamp(x, r.minX + m, r.maxX - m), z: clamp(z, r.minZ + m, r.maxZ - m) };
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
    let d = outsideRect(farm, x, z);
    if (hill) d = Math.min(d, hill.outside(x, z));
    if (woods) d = Math.min(d, woods.outside(x, z));
    return d;
  }

  const gates = { south: gateGap, north: northGap, road: roadGap };
  // The ground tyres wear: the farm and, through the south gate, the lane, the fields beside it and the pasture.
  const wearBounds = hill
    ? { minX: Math.min(farm.minX, hill.pasture.minX, hill.west?.minX ?? Infinity), maxX: Math.max(farm.maxX, hill.pasture.maxX), minZ: farm.minZ, maxZ: Math.max(farm.maxZ, hill.pasture.maxZ) }
    : farm;
  /** 0..1 how much of the ground at (x, z) is the green lane's own, which ruts deeper and dries slower than a field (groundWear.js). */
  const laneAt = (x, z) => {
    if (!hill || z < hill.laneRect.minZ || z > hill.laneRect.maxZ) return 0;
    return 1 - smoothstep(hill.lane.halfWidth, hill.lane.halfWidth + 1.5, Math.abs(x - hill.lane.x));
  };
  return { wearBounds, laneAt, farm, hill, woods, gates, outside: outsideAll, grass, areas, hedges, gateways, soakAt, stubbleField, areaOf, hedgeDistance, hedgeAhead, tarmacAt, stubbleAt, route, nextWaypoint, inFarm, clampToArea, inGap };
}
