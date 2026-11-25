// The hedges along Back Lane (#686). Pure: no Three.js. A hedge runs down each side of the single track at the edge of the verge, closed off at the
// lane's two ends, broken where a gate or the footpath's stile is, and pushed back where a passing place widens the road, so the bay is clear.
// `laneHedgeRuns` says where hedge is and is not, `laneHedgePoint` where it stands at a distance along; props.js lays blocks along each run.

import { pointAt, GATE_HALF } from './roads.js';
import { sAlong, footpathSide } from './laneSigns.js';

export { GATE_HALF }; // the gate's opening lives with the road, whose ditch is piped under it (#1016)

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

export const FORD_OPEN = 6; // m either side of the ford that the hedges are open, for the stream
export const STILE_HALF = 1.1; // m either side of the stile that the hedge is open

/** How far along the road (m) the point (x, z) is nearest: a walk of the samples, run once for each of a few gates. */
function nearestS(road, x, z) {
  let best = Infinity;
  let at = 0;
  for (const p of road.samples) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < best) [best, at] = [d, p.s];
  }
  return at;
}

/** Where the lane's gates are and which side they are on: [{ id, s, side }], from the road's `gates` (the farm's gateway each stands across from). */
export function laneGates(road) {
  return (road.gates ?? []).map((g) => {
    const s = nearestS(road, g.farm[0], g.farm[1]);
    return { id: g.id, s, side: sideOf(road, s, g.farm[0], g.farm[1]) };
  });
}

/** The common is on the lane's west side as it runs south, which is side -1 (laneHedges.js `sideOf`). */
export const MOOR_SIDE = -1;
export const BRIDLE_GATE_OFFSET = 3.2; // m along the lane from a cattle grid to its bridle gate, outside the unhedged stretch
export const BRIDLE_HALF = 0.85; // m either side of a bridle gate's middle that the hedge leaves open: the leaf and a post each side

/** Where the lane crosses the common: { from, to } m along it, from the first cattle grid to the second, or null with no grids. */
export function moorStretch(road) {
  const grids = road.moor?.grids;
  if (!grids || grids.length < 2) return null;
  const [a, b] = grids.map((g) => nearestS(road, g.near[0], g.near[1])).sort((x, y) => x - y);
  return { from: a, to: b };
}

/** The hedge's gaps: the gates now, a stile and its footpath when #686's footpath is placed. `kind` names each (gate, ford, stile, common, bridle gate). */
export function laneGaps(road) {
  const gaps = laneGates(road).map((g) => ({ s: g.s, half: GATE_HALF, side: g.side, kind: 'gate', id: g.id }));
  if (road.ford) gaps.push({ s: sAlong(road, road.ford.at[0], road.ford.at[1]), half: FORD_OPEN, kind: 'ford' }); // the stream runs through the hedge line on both sides
  if (road.footpath) gaps.push({ s: sAlong(road, road.footpath.at[0], road.footpath.at[1]), half: STILE_HALF, side: footpathSide(road), kind: 'stile' });
  const moor = moorStretch(road);
  if (moor) {
    gaps.push({ s: (moor.from + moor.to) / 2, half: (moor.to - moor.from) / 2, side: MOOR_SIDE, kind: 'common' }); // the common's side is open between the grids (#713)
    gaps.push({ s: moor.from - BRIDLE_GATE_OFFSET, half: BRIDLE_HALF, side: MOOR_SIDE, kind: 'bridle gate' }, { s: moor.to + BRIDLE_GATE_OFFSET, half: BRIDLE_HALF, side: MOOR_SIDE, kind: 'bridle gate' }); // and each grid's bridle gate
  }
  return gaps;
}
