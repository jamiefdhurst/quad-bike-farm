// The hedges along Back Lane (#686). Pure: no Three.js. A hedge runs down each side of the single track at the edge of the verge, closed off at the
// lane's two ends, broken where a gate or the footpath's stile is, and pushed back where a passing place widens the road, so the bay is clear.
// `laneHedgeRuns` says where hedge is and is not, `laneHedgePoint` where it stands at a distance along; props.js lays blocks along each run.

import { pointAt } from './roads.js';

/** m of the road's two ends with no hedge, so the junction with the lane is open. */
export const JUNCTION_OPEN = 9;
/** m a bay takes to ease out to its full width at each end. */
const BAY_EASE = 2;

/** The point `off` m out from the road's middle on `side` (1 or -1: the side a passing place on that side widens to) at `s` m along. */
export function sidePoint(road, s, side, off) {
  const p = pointAt(road, s);
  return { x: p.x + p.tz * side * off, z: p.z - p.tx * side * off, tx: p.tx, tz: p.tz };
}

/** How many metres out from the middle the hedge stands on `side` at `s`: the carriageway, the verge, and a passing place's bay where there is one. */
export function hedgeOffset(road, s, side) {
  let off = road.halfWidth + (road.pavement ?? 0) + (road.verge ?? 0);
  for (const b of road.bays) {
    if (b.side !== side) continue;
    const into = Math.min(s - (b.s - b.length / 2), b.s + b.length / 2 - s);
    if (into > 0) off += b.bay * Math.min(1, into / BAY_EASE);
  }
  return off;
}

/**
 * The stretches of hedge down each side: [{ side, from, to }] in metres along the road. `gaps` are { s, half, side? }, a gate or stile `half` m either
 * side of `s` (on one side if `side` is given, else both).
 */
export function laneHedgeRuns(road, gaps = []) {
  const runs = [];
  for (const side of [1, -1]) {
    const cuts = gaps
      .filter((g) => g.side === undefined || g.side === side)
      .map((g) => [g.s - g.half, g.s + g.half])
      .concat([[-1, JUNCTION_OPEN], [road.length - JUNCTION_OPEN, road.length + 1]])
      .sort((a, b) => a[0] - b[0]);
    let at = 0;
    for (const [a, b] of cuts) {
      if (a > at) runs.push({ side, from: at, to: a });
      at = Math.max(at, b);
    }
    if (at < road.length) runs.push({ side, from: at, to: road.length });
  }
  return runs;
}

/** Which side of the road (1 or -1) the point (x, z) is on, near `s` m along it: the sign of its offset across the road there. */
export function sideOf(road, s, x, z) {
  const p = pointAt(road, s);
  return (x - p.x) * p.tz - (z - p.z) * p.tx >= 0 ? 1 : -1;
}

/**
 * The hedgerow trees: [{ side, s, scale }] a tree every 35 to 75 m along each side, standing in the hedge, not in a gap, a bay or within `JUNCTION_OPEN` plus
 * 12 m of an end. `random` is a 0..1 source.
 */
export function laneTrees(road, random, gaps = []) {
  const out = [];
  for (const side of [1, -1]) {
    for (let s = JUNCTION_OPEN + 12 + random() * 30; s < road.length - JUNCTION_OPEN - 12; s += 35 + random() * 40) {
      if (gaps.some((g) => Math.abs(s - g.s) < g.half + 4 && (g.side === undefined || g.side === side))) continue;
      if (road.bays.some((b) => b.side === side && Math.abs(s - b.s) < b.length / 2 + 3)) continue;
      out.push({ side, s, scale: 1.1 + random() * 0.6 });
    }
  }
  return out;
}
