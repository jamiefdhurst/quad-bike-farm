// Where the signs along Back Lane stand (#686). Pure: no Three.js. Each is { kind, s, side, facing }: `s` m along the road, `side` 1 or -1 the verge it
// stands on (as laneHedges.js's), and `facing` +1 or -1 the way of travel that reads it (+1 is the road's own direction, in increasing s), or 0 for a sign
// that faces across the road and is read from either way. A sign for
// traffic both ways is two entries. roadSigns.js draws them.

import { pointAt } from './roads.js';

export const SIGN_KINDS = ['singleTrack', 'nationalLimit', 'passingPlace', 'bends', 'chevron', 'ford', 'gauge', 'fingerpost'];

/** m before a hazard its warning stands, and from the junction the junction's signs. */
export const WARN_BEFORE = 55;
export const JUNCTION_SIGNS = 8;
/** m along the road of the point nearest (x, z). */
export function sAlong(road, x, z) {
  let best = Infinity;
  let at = 0;
  for (const p of road.samples) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < best) [best, at] = [d, p.s];
  }
  return at;
}

/**
 * Every sign on the road. Keeping left, a driver reads the verge on the left of their way: side 1 in laneHedges.js's terms is the left of travel along
 * +s (its offset is (tz, -tx), north when heading east on the map), so a sign for `facing` +1 stands on side 1 and one for -1 on side -1.
 */
export function laneSigns(road) {
  const out = [];
  const left = (facing) => facing;
  // At each end of the lane: what the entry says, standing on the left of the way in.
  for (const [s, facing] of [[JUNCTION_SIGNS, 1], [road.length - JUNCTION_SIGNS, -1]]) {
    for (const kind of ['singleTrack', 'nationalLimit']) out.push({ kind, s: s + (kind === 'nationalLimit' ? -facing * 3 : 0), side: left(facing), facing });
  }
  for (const b of road.bays ?? []) {
    out.push({ kind: 'passingPlace', s: b.s, side: b.side, facing: 1 }, { kind: 'passingPlace', s: b.s, side: b.side, facing: -1 });
  }
  const hairpins = (road.hairpins ?? []).map(([x, z]) => sAlong(road, x, z));
  if (hairpins.length) {
    out.push({ kind: 'bends', s: Math.min(...hairpins) - WARN_BEFORE, side: left(1), facing: 1 }, { kind: 'bends', s: Math.max(...hairpins) + WARN_BEFORE, side: left(-1), facing: -1 });
    for (const s of hairpins) for (const d of [-9, 0, 9]) out.push({ kind: 'chevron', s: s + d, side: outsideOf(road, s + d), facing: 0 }); // across the road, to be read from either way
  }
  if (road.ford) {
    const s = sAlong(road, road.ford.at[0], road.ford.at[1]);
    out.push({ kind: 'ford', s: s - road.ford.reach - 8, side: left(1), facing: 1 }, { kind: 'ford', s: s + road.ford.reach + 8, side: left(-1), facing: -1 });
    out.push({ kind: 'gauge', s: s - 4, side: 1, facing: 0 }); // at the ford's edge, its numbers across the road
  }
  if (road.footpath) out.push({ kind: 'fingerpost', s: sAlong(road, road.footpath.at[0], road.footpath.at[1]) - 3, side: footpathSide(road), facing: 1 });
  return out;
}

/** The side of the road that is on the outside of the bend at `s`: the side the road turns away from. */
export function outsideOf(road, s) {
  const a = pointAt(road, Math.max(0, s - 6));
  const b = pointAt(road, Math.min(road.length, s + 6));
  const turn = a.tx * b.tz - a.tz * b.tx; // positive: turning one way (towards -side 1 as sidePoint has it)
  return turn > 0 ? 1 : -1;
}

/** The side the footpath leaves on: the one it heads towards (the hill to the west of the road). */
export function footpathSide(road) {
  const p = pointAt(road, sAlong(road, road.footpath.at[0], road.footpath.at[1]));
  const dx = road.footpath.to[0] - road.footpath.at[0];
  const dz = road.footpath.to[1] - road.footpath.at[1];
  return dx * p.tz - dz * p.tx >= 0 ? 1 : -1;
}
