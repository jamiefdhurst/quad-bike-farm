// Where things stand along the A-road and at the lane's junctions (#687). Pure: no Three.js. The A-road runs south on the map, so its side 1 is east and
// side -1 west (laneHedges.js `sidePoint`); a minor road meets it end to side at `mouth`, and everything here is placed from that, in game metres.

import { pointAt } from './roads.js';
import { sAlong, outsideOf } from './laneSigns.js';

/** The way (dx, dz) is facing, as the yaw a sign built to face +z is turned by. */
export const yawFacing = (dx, dz) => Math.atan2(dx, dz);

/**
 * Each junction of the plan (`layout.junctions`) laid on the network: `{ id, road, end, mouth, out, left, aS, aDir, fingerArm }`. `mouth` is where the minor
 * road's end meets the A-road's middle, `out` the unit way a driver is heading as they come to it, `left` the unit way to their left, `aDir` the A-road's
 * direction of increasing s there, and `lines` the place names on the fingerpost.
 */
export function junctionSites(net, junctions) {
  const sites = [];
  for (const j of junctions) {
    const r = net.road(j.road);
    const a = net.road(j.onto);
    if (!r || !a) continue;
    const p = pointAt(r, j.end === 'start' ? 0 : r.length);
    const sign = j.end === 'start' ? -1 : 1; // the way a driver heads as they come in to the junction, along the road's s
    const out = { x: p.tx * sign, z: p.tz * sign };
    const aS = sAlong(a, p.x, p.z);
    const ap = pointAt(a, aS);
    sites.push({
      id: j.id, road: j.road, end: j.end, mouth: { x: p.x, z: p.z }, out, left: { x: out.z, z: -out.x }, aS, aDir: { x: ap.tx, z: ap.tz }, aHalf: a.halfWidth,
      lines: j.lines, minorHalf: r.halfWidth, bell: r.bellmouth ?? { width: 2.2, length: 8 },
    });
  }
  return sites;
}

/** The A-road's `edgeBreaks` for its junctions: [{ s, half }]. */
export function junctionBreaks(net, a) {
  const out = [];
  for (const r of net.roads) {
    for (const j of r.junctions ?? []) {
      if (j.onto !== a.id) continue;
      const p = pointAt(r, j.end === 'start' ? 0 : r.length);
      out.push({ s: sAlong(a, p.x, p.z), half: r.halfWidth + (r.bellmouth?.width ?? 0) + 1.5 });
    }
  }
  return out;
}

/**
 * What stands at each junction: [{ kind, x, z, yaw, ... }]. A give-way sign on the left of the way in, 7 m before the line, facing the driver; a fingerpost on
 * the right corner, its arm pointing along the A-road; a grit bin (the first junction) or a grit heap (the others) on the left beyond the sign; and the national
 * speed limit disc across the A-road, facing the minor road.
 */
export function junctionFittings(sites) {
  const out = [];
  sites.forEach((s, i) => {
    const at = (back, side) => ({ x: s.mouth.x - s.out.x * back + s.left.x * side, z: s.mouth.z - s.out.z * back + s.left.z * side });
    const edge = s.minorHalf + s.bell.width + 1.3;
    out.push({ kind: 'giveWay', ...at(7, s.minorHalf + 1.4), yaw: yawFacing(-s.out.x, -s.out.z), site: s.id });
    // The fingerpost's arm points to the place along the A-road: `Kelby` up the road (north), `Ashwell` down it (south). Its board reads from the way in.
    const north = i === 0;
    const dir = { x: s.aDir.x * (north ? -1 : 1), z: s.aDir.z * (north ? -1 : 1) };
    out.push({ kind: 'fingerpost', ...at(6, -edge), yaw: Math.atan2(-dir.z, dir.x), lines: s.lines, site: s.id });
    out.push({ kind: i === 0 ? 'gritBin' : 'gritHeap', ...at(13, edge + 0.4), yaw: yawFacing(-s.out.x, -s.out.z), site: s.id });
    out.push({ kind: 'nationalLimit', x: s.mouth.x + s.out.x * (s.aHalf + 2.4), z: s.mouth.z + s.out.z * (s.aHalf + 2.4), yaw: yawFacing(-s.out.x, -s.out.z), site: s.id });
  });
  return out;
}

/** The cat's eyes down the A-road's middle: [{ x, z, yaw }] every `every` m, none within `half` of a junction's mouth (`breaks`). */
export function catsEyes(a, every, breaks = []) {
  const out = [];
  for (let s = every; s < a.length - 1; s += every) {
    if (breaks.some((b) => Math.abs(s - b.s) < b.half)) continue;
    const p = pointAt(a, s);
    out.push({ x: p.x, z: p.z, yaw: Math.atan2(p.tx, p.tz) });
  }
  return out;
}

/** The bus bay of the plan on the A-road: { s, length, width, side } with `s` the metres along nearest its plan z, and where the bus stop flag stands. */
export function layByOf(a, layBy) {
  if (!layBy) return null;
  const zGame = layBy.z; // game metres
  let s = 0;
  let best = Infinity;
  for (const p of a.samples) {
    const d = Math.abs(p.z - zGame);
    if (d < best) [best, s] = [d, p.s];
  }
  const end = s + layBy.length / 2;
  const q = pointAt(a, end);
  const off = a.halfWidth + layBy.width + 0.8;
  return { s, length: layBy.length, width: layBy.width, side: layBy.side, flag: { x: q.x + q.tz * layBy.side * off, z: q.z - q.tx * layBy.side * off, yaw: Math.atan2(-q.tz * layBy.side, q.tx * layBy.side) } };
}

/** The grit bins at a bend: [{ x, z, yaw }] on the outside of the lane's bend at each planned point, facing the road. */
export function bendBins(road, points) {
  return points.map(([x, z]) => {
    const s = sAlong(road, x, z);
    const side = outsideOf(road, s);
    const p = pointAt(road, s);
    const off = road.halfWidth + 1.4;
    const bx = p.x + p.tz * side * off;
    const bz = p.z - p.tx * side * off;
    return { x: bx, z: bz, yaw: Math.atan2(-p.tz * side, p.tx * side) };
  });
}

/** Whether (x, z) is within `margin` m of the lane's cottages and their gardens, the postbox or the bin stand (layout.laneFittings), where no tree stands. */
export function inLaneFittings(layout, x, z, margin = 0) {
  const F = layout.laneFittings;
  if (!F) return false;
  const c = F.cottages;
  if (x > c.minX - margin && x < c.maxX + margin && z > c.minZ - margin && z < c.maxZ + margin) return true;
  return [F.postbox, F.binStand].some((p) => Math.hypot(p.x - x, p.z - z) < margin);
}

/** The A-road's hedge gaps: both sides open at each junction's mouth, the west side open along her land (she has her own hedge there), the bus bay's east side. */
export function aRoadGaps(net, a, layout) {
  const gaps = junctionBreaks(net, a).map((b) => ({ s: b.s, half: b.half + 3 }));
  const land = layout.neighbourLand;
  if (land) {
    const zs = land.fields.map((f) => [f.minZ, f.maxZ]).flat();
    const s0 = sAlong(a, a.samples[0].x, Math.min(...zs) - 1);
    const s1 = sAlong(a, a.samples[0].x, Math.max(...zs) + 1);
    gaps.push({ s: (s0 + s1) / 2, half: (s1 - s0) / 2 + 2, side: -1 });
  }
  const by = layByOf(a, layout.aRoadFittings?.layBy);
  if (by) gaps.push({ s: by.s, half: by.length / 2 + 3, side: by.side });
  return gaps;
}
