// Traffic along Back Lane (#686). Pure: no Three.js. A vehicle is a `LaneDrive`, which has the same face as traffic.js's `Drive` (x, z, yaw, speed, update(dt),
// arrived) so the lane's view draws it, but moves by how far along the road it is (`s`), keeping to the left. On a single track two vehicles that meet cannot
// pass except at a passing place, so the one with a bay on its left, nearer, before they would meet, pulls in and waits until the other has gone by. The
// rest is in `shouldYield`. Tested in tests/backLane.test.js.

import { pointAt, KEEP_LEFT } from './roads.js';

export const BACK_LANE_TRAFFIC = {
  sight: 90, // m: how far ahead a driver sees an oncoming vehicle
  bayRoom: 6, // m short of where they would meet that a bay must be, to be worth pulling into
  stopAt: 1.2, // m into the bay's middle: where it stops, nose to the bay's centre
  creep: 2.2, // m/s: when there is no bay to pull into, they edge past
  pullIn: 0.9, // m: how far into the bay a waiting vehicle stands, over its usual keep-left
};

/** The point and heading of a vehicle at `s` m along the road, `dir` its way, keeping left, plus `aside` m more to its left (into a bay). */
export function placeOnLane(road, s, dir, aside = 0) {
  const p = pointAt(road, s);
  const off = road.halfWidth * KEEP_LEFT + aside;
  return { x: p.x + p.tz * dir * off, z: p.z - p.tx * dir * off, yaw: Math.atan2(dir * p.tx, dir * p.tz) };
}

/** The passing place on the left of a vehicle heading `dir` that is nearest ahead between `from` and `to` (m along): the bay, or null. */
export function bayAhead(road, from, to, dir) {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  let best = null;
  for (const b of road.bays) {
    if (b.side !== dir || b.s < lo || b.s > hi) continue; // a bay on the left of travel along +s is side 1 (laneHedges.js)
    if (!best || Math.abs(b.s - from) < Math.abs(best.s - from)) best = b;
  }
  return best;
}

/**
 * Whether `a` should pull in for `b`, which it will meet head on: the one with a bay on its left before they meet, and the nearer such bay, goes in; if
 * neither has one the lower `id` just goes on and the other creeps. Both run this each tick on the same numbers, so they agree.
 */
export function shouldYield(road, a, b, p = BACK_LANE_TRAFFIC) {
  const gap = (b.s - a.s) * a.dir; // m between them, positive when b is ahead of a
  if (gap <= 0 || gap > p.sight || b.dir === a.dir) return null;
  const meet = a.s + (gap / 2) * a.dir; // about where they meet, if neither slows
  const mine = bayAhead(road, a.s + p.bayRoom * a.dir, meet + p.bayRoom * a.dir, a.dir);
  const theirs = bayAhead(road, b.s + p.bayRoom * b.dir, meet + p.bayRoom * b.dir, b.dir);
  const myCost = mine ? Math.abs(mine.s - a.s) : Infinity;
  const theirCost = theirs ? Math.abs(theirs.s - b.s) : Infinity;
  if (myCost === Infinity && theirCost === Infinity) return { bay: null, yields: a.id > b.id }; // neither: the later-dealt one creeps
  return myCost < theirCost || (myCost === theirCost && a.id < b.id) ? { bay: mine, yields: true } : { bay: mine, yields: false };
}

/** One vehicle on the lane. Its `drive` is itself, as traffic.js's vehicles have a `drive`. */
export class LaneDrive {
  constructor({ id, road, all, dir, speed, p = BACK_LANE_TRAFFIC }) {
    Object.assign(this, { id, road, all, dir, cruise: speed, speed, p });
    this.s = dir > 0 ? 0 : road.length;
    this.aside = 0; // m into a bay
    this.state = 'driving'; // 'driving' | 'pulling' (heading for a bay) | 'waiting' (in it)
    this.bay = null;
    this.arrived = false;
    this.waited = 0;
    this.blocked = false;
    this.refresh();
  }

  refresh() {
    const at = placeOnLane(this.road, this.s, this.dir, this.aside);
    Object.assign(this, at);
  }

  /** The vehicle coming the other way that matters most: the nearest one ahead within sight. */
  oncoming() {
    let best = null;
    for (const o of this.all) {
      if (o === this || o.dir === this.dir || o.arrived) continue;
      const gap = (o.s - this.s) * this.dir;
      if (gap > -3 && gap < this.p.sight && (!best || gap < (best.s - this.s) * this.dir)) best = o;
    }
    return best;
  }

  /** Whether something in `blockers` ({ x, z }: you, the quads, the girls) is in the way ahead, within the stopping room and not off to the side. */
  inTheWay(blockers) {
    const reach = 5 + this.speed * 1.2;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    return blockers.some((b) => {
      const dx = b.x - this.x;
      const dz = b.z - this.z;
      const ahead = dx * fx + dz * fz;
      return ahead > 0.5 && ahead < reach && Math.abs(dx * fz - dz * fx) < 1.6;
    });
  }

  update(dt, blockers = []) {
    if (this.arrived) return;
    const other = this.oncoming();
    let want = this.cruise;
    if (this.state === 'driving' && other) {
      const call = shouldYield(this.road, this, other, this.p);
      if (call?.yields && call.bay) {
        this.state = 'pulling';
        this.bay = call.bay;
      } else if (call?.yields) want = this.p.creep; // no bay either side: edge past
    }
    if (this.state === 'pulling') {
      const left = (this.bay.s - this.s) * this.dir;
      want = left <= this.p.stopAt ? 0 : Math.min(this.cruise, Math.sqrt(2 * 4 * (left - this.p.stopAt)) + 0.4);
      this.aside = Math.min(this.p.pullIn, this.aside + dt * 0.8 * (left < 14 ? 1 : 0));
      if (left <= this.p.stopAt && this.speed < 0.2) this.state = 'waiting';
    } else if (this.state === 'waiting') {
      want = 0;
      this.waited += dt;
      const gone = !other || (other.s - this.s) * this.dir < -2.5; // it has gone by, or is not there
      if (gone) {
        this.state = 'driving';
        this.waited = 0;
      }
    } else if (this.aside > 0) {
      this.aside = Math.max(0, this.aside - dt * 0.8); // easing back out onto the road
    }
    if (this.inTheWay(blockers)) want = 0; // you, a quad or a girl on the road: it stops and waits for you to move
    this.blocked = this.state === 'waiting' || want === 0;
    this.speed = this.speed < want ? Math.min(want, this.speed + 2 * dt) : Math.max(want, this.speed - 5 * dt);
    this.s += this.dir * this.speed * dt;
    if ((this.dir > 0 && this.s >= this.road.length) || (this.dir < 0 && this.s <= 0)) this.arrived = true;
    this.s = Math.max(0, Math.min(this.road.length, this.s));
    this.refresh();
  }
}
