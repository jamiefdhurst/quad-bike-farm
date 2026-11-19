// How vehicles get along the lane now that it bends and meets the A-road (#687). Pure: no Three.js. The lane's road runs from the A-road junction in the
// north (its start, s 0) round the bend and south to where it leaves the map, so a pass, a visitor or a girl driving home follows its points rather than a
// straight line between its ends. Each route is a run of waypoints { x, z } on the left of the way, as traffic.js's `Drive` follows them.

import { KEEP_LEFT, pointAt } from './roads.js';
import { sAlong } from './laneSigns.js';

const STEP = 10; // m between waypoints along a road: close enough that a vehicle does not cut the lane's bend

/** The waypoints along road `id` heading `dir` (+1 along its s, -1 back), keeping left, from `from` to `to` metres along it (the whole road by default). */
export function along(net, id, dir, { from = 0, to = null, step = STEP, speed = null } = {}) {
  const r = net.road(id);
  const off = r.halfWidth * KEEP_LEFT;
  const pts = net.pointsAlong(id, { step, offset: off, dir, from, to: to ?? r.length });
  return speed ? pts.map((p) => ({ ...p, speed })) : pts;
}

/** The lane's waypoints heading `dir` (+1 from the A-road junction down to the south, -1 the other way), as { x, z, tx, tz }. */
function laneSides(net, dir) {
  return along(net, 'lane', dir).map(({ x, z, tx, tz }) => ({ x, z, tx, tz }));
}

/**
 * The way in along the lane to a drive at z `driveZ` (the farm's own gate or the drive's mouth) for a vehicle coming from `from` (+1: from the A-road in the
 * north, heading south; -1: from the south end, heading north): the waypoints up to 16 m short of it.
 */
export function laneApproach(net, from, driveZ) {
  const pts = laneSides(net, from);
  return pts.filter((p) => (from > 0 ? p.z < driveZ - 16 : p.z > driveZ + 16));
}

/**
 * The way out along the lane from the drive at `driveZ` heading `to` (+1 south, -1 north towards the A-road), from 18 m past it to the end of the lane: for
 * +1 that is the lane's south end and 30 m on, for -1 it is the bend and the junction, and 30 m on along the A-road's way.
 */
export function laneDeparture(net, to, driveZ) {
  const pts = laneSides(net, to);
  return pts.filter((p) => (to > 0 ? p.z > driveZ + 18 : p.z < driveZ - 18));
}

/** A point `d` m on past the last of `pts`, along its heading. */
export function pastEnd(pts, d) {
  const p = pts[pts.length - 1];
  return { x: p.x + p.tx * d, z: p.z + p.tz * d };
}

/** A point at `s` on the A-road for a vehicle heading along s (`sign` +1, south) or against it (-1, north), keeping left, with the heading. */
function aPoint(a, s, sign) {
  const p = pointAt(a, s);
  const off = a.halfWidth * KEEP_LEFT;
  return { x: p.x + p.tz * sign * off, z: p.z - p.tx * sign * off, tx: p.tx * sign, tz: p.tz * sign };
}

/** The A-road's waypoints from `fromS` to `toS` m along it, keeping left for the way that heads, every `step` m, both ends included. */
function aLeg(net, fromS, toS, step = 40) {
  const a = net.road('aRoad');
  const sign = toS >= fromS ? 1 : -1;
  const pts = [];
  for (let s = fromS; sign > 0 ? s < toS : s > toS; s += sign * step) pts.push(aPoint(a, s, sign));
  pts.push(aPoint(a, toS, sign));
  return pts;
}

/** The leg of a vehicle going out onto the A-road from the lane's junction at `junctionS`: up the road (north) or down it, to where the A-road leaves the map. */
export function aRoadOut(net, junctionS, north, clear = 10) {
  const a = net.road('aRoad');
  return north ? aLeg(net, junctionS - clear, 0) : aLeg(net, junctionS + clear, a.length);
}

/** The leg of a vehicle coming in to the lane's junction at `junctionS` from the A-road's far end: from the north end (heading south) or from the south end (heading north). */
export function aRoadIn(net, junctionS, fromNorth, clear = 10) {
  const a = net.road('aRoad');
  return fromNorth ? aLeg(net, 0, junctionS - clear) : aLeg(net, a.length, junctionS + clear);
}

/** The route of a vehicle that passes along the lane in direction `dir` (+1 from the A-road, -1 to it), with the A-road leg it comes in or goes out by (`north`). */
export function passRoute(net, dir, junctionS, north) {
  const lane = along(net, 'lane', dir);
  if (dir > 0) return [...aRoadIn(net, junctionS, north), ...lane, pastEnd(lane, 30)];
  return [...lane, ...aRoadOut(net, junctionS, north)];
}

/** How far along the A-road (m) the lane's junction with it is, or null where there is no A-road. */
export function junctionSOf(net) {
  const a = net.road('aRoad');
  const lane = net.road('lane');
  return a && lane ? sAlong(a, lane.samples[0].x, lane.samples[0].z) : null;
}
