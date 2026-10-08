// The shape of the farm: the grass field, the farm road east out of it and the stubble fields either side, the hedges between them with
// their gateways, what the ground is (grass, stubble or tarmac) and a way round from one field to another through the gateways.
// Pure: built from the layout (layout.js), used by the terrain, the props, the tyres and the girls.

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

export function createFields(layout) {
  const F = layout.fieldHalf;
  const farm = layout.farm ?? { minX: -F, maxX: F, minZ: -F, maxZ: F };
  const road = layout.road;
  const gate = layout.gate;
  const grass = { minX: -F, maxX: F, minZ: -F, maxZ: F };

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

  /** Which field (x, z) is in: 'grass', 'road', 'end', 'north', 'south', or 'out' beyond the farm's hedges. */
  function areaOf(x, z) {
    if (inRect(grass, x, z)) return 'grass';
    for (const k of ['road', 'end', 'north', 'south']) if (areas[k] && inRect(areas[k], x, z)) return k;
    return 'out';
  }

  // Hedge lines, each straight along x or z from (x1, z1) to (x2, z2), with gaps { at, half } along it. The south gate is a gap with a gate in it.
  const gateGap = { at: gate.x, half: gate.width / 2 + 0.35, gate: true };
  const hedges = [
    { x1: -F, z1: -F, x2: F, z2: -F, gaps: [] },
    { x1: -F, z1: F, x2: F, z2: F, gaps: [gateGap] },
    { x1: -F, z1: -F, x2: -F, z2: F, gaps: [] },
    { x1: F, z1: -F, x2: F, z2: F, gaps: road ? [{ at: road.z, half: (corridor.hi - corridor.lo) / 2 }] : [] },
  ];
  if (road) {
    const gaps = (xs) => xs.map((at) => ({ at, half: road.gapWidth / 2 }));
    hedges.push(
      { x1: F, z1: farm.minZ, x2: farm.maxX, z2: farm.minZ, gaps: [] },
      { x1: F, z1: farm.maxZ, x2: farm.maxX, z2: farm.maxZ, gaps: [] },
      { x1: farm.maxX, z1: farm.minZ, x2: farm.maxX, z2: farm.maxZ, gaps: [] },
      { x1: F, z1: corridor.lo, x2: road.hedgeTo, z2: corridor.lo, gaps: gaps(road.gaps.north) },
      { x1: F, z1: corridor.hi, x2: road.hedgeTo, z2: corridor.hi, gaps: gaps(road.gaps.south) },
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

  /** Metres along `yaw` (0 is +z) from (x, z) to the first hedge it would hit, not counting the gaps; Infinity if none. */
  function hedgeAhead(x, z, yaw) {
    const dx = Math.sin(yaw);
    const dz = Math.cos(yaw);
    let best = Infinity;
    for (const h of hedges) {
      const d = h.alongX ? (Math.abs(dz) < 1e-6 ? -1 : (h.z1 - z) / dz) : Math.abs(dx) < 1e-6 ? -1 : (h.x1 - x) / dx;
      if (d < 0 || d >= best) continue;
      const s = h.alongX ? x + dx * d : z + dz * d;
      const lo = h.alongX ? h.x1 : h.z1;
      if (s < lo || s > lo + h.length || inGap(h, s)) continue;
      best = d;
    }
    return best;
  }

  /** 0..1 how much of (x, z) is tarmac: the road and the hardstanding at its end, with a soft edge a hand's width across. */
  function tarmacAt(x, z) {
    if (!road) return 0;
    const edge = 0.15;
    const along = Math.max(road.fromX - x, 0, x - road.toX);
    const onRoad = 1 - smoothstep(road.halfWidth - edge, road.halfWidth + edge, Math.hypot(along, z - road.z));
    const onPad = road.pad ? 1 - smoothstep(road.pad.radius - edge, road.pad.radius + edge, Math.hypot(x - padX, z - road.z)) : 0;
    return Math.max(onRoad, onPad);
  }

  /** 0..1 how much of (x, z) is stubble: the two fields either side of the road, up to the tarmac. */
  function stubbleAt(x, z) {
    if (!road) return 0;
    const a = areaOf(x, z);
    if (a !== 'north' && a !== 'south') return 0;
    return 1 - tarmacAt(x, z);
  }

  // Gateways: a point either side of each gap (2 m out), joining the two fields it's between. The open sides round the hardstanding count too.
  const gateways = [];
  const link = (a, pa, b, pb) => gateways.push({ a, pa, b, pb });
  link('grass', { x: gate.x, z: F - 2.5 }, 'out', { x: gate.x, z: F + 2.5 });
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
    for (const g of gateways) nodes.push({ p: g.pa, area: g.a, twin: nodes.length + 1 }, { p: g.pb, area: g.b, twin: nodes.length });
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

  /** The next point to head for on the way from `from` to `to`, skipping a gateway point she's already within `reach` metres of. */
  function nextWaypoint(from, to, reach = 1.5) {
    const path = route(from, to);
    for (const p of path) if (Math.hypot(p.x - from.x, p.z - from.z) > reach) return p;
    return to;
  }

  /** Whether (x, z) is inside the farm's outer hedges, `margin` metres in. */
  function inFarm(x, z, margin = 0) {
    return inRect(farm, x, z, margin);
  }

  /** (x, z) pulled inside the field `area` (as areaOf names it), `margin` metres in from its edges. */
  function clampToArea(area, x, z, margin = 0) {
    const r = areas[area];
    if (!r) return { x, z };
    const m = Math.min(margin, (r.maxX - r.minX) / 2, (r.maxZ - r.minZ) / 2);
    return { x: clamp(x, r.minX + m, r.maxX - m), z: clamp(z, r.minZ + m, r.maxZ - m) };
  }

  return { farm, grass, areas, hedges, gateways, areaOf, hedgeDistance, hedgeAhead, tarmacAt, stubbleAt, route, nextWaypoint, inFarm, clampToArea, inGap };
}
