// The hayloft over the front of the barn (above the big doors, so the hay door in the end wall is a window at your eye height): where
// its floor, rail, ladder and hay are, who is up there, and what happens
// to someone hiding in the hay or stood under a girl who has a handful of straw. Pure logic, no Three.js; barnBuild.js
// draws it and game.js wires it up.

import { barnShape, barnFrame, barnLocal } from './barn.js';

export const DEFAULT_LOFT_PARAMS = {
  climbSeconds: 2.6, // how long the ladder takes, up or down
  girlLoftChance: 0.3, // chance that a girl who's decided to sit out on a fine day picks the loft (if it's free and near)
  hideCallAfter: 30, // seconds you've been hidden before a girl first calls for you
  hideCallEvery: 25, // seconds between calls after that
  hideFoundAfter: 110, // seconds hidden before a girl finds you (if one is in the loft she finds you in findWithGirl)
  findWithGirl: 5, // seconds before a girl who's sat in the loft finds you hiding there
  strawNear: 2.6, // metres: how close to the loft girl you have to stand, below her, for Jess to drop straw on you
  strawLinger: 1.5, // seconds you've been stood there before she does
  strawChance: 0.25, // chance a second it happens, once you've lingered and it's off cooldown
  strawCooldown: 90, // seconds before she does it again
};

export const LOFT_PARAM_RANGES = {
  climbSeconds: [0.5, 8, 0.1],
  girlLoftChance: [0, 1, 0.05],
  hideCallAfter: [5, 300, 5],
  hideCallEvery: [5, 300, 5],
  hideFoundAfter: [10, 600, 5],
  findWithGirl: [1, 60, 1],
  strawNear: [0.5, 6, 0.1],
  strawLinger: [0, 10, 0.1],
  strawChance: [0, 1, 0.01],
  strawCooldown: [5, 600, 5],
};

const smooth = (t) => t * t * (3 - 2 * t);

/**
 * Heights and places of the loft, from the layout, in the barn's own frame (barn.js: the same as the world's while the barn is not turned).
 * `floorY` is the barn floor's height. The planks run from the open edge (`edgeX`,
 * looking back into the barn) to the east end wall. You can only walk the middle band of it: the roof comes down at the sides, so
 * hay is stacked there, north and south of `band` metres either side of the barn's centre line.
 */
export function loftShape(layout, floorY) {
  const l = barnLocal(layout).loft;
  const { inner, z: midZ } = barnShape(layout);
  const top = floorY + l.floor;
  return {
    top, // the planks' upper face
    minX: l.edgeX,
    maxX: inner.maxX,
    edgeX: l.edgeX,
    minZ: inner.minZ,
    maxZ: inner.maxZ,
    // The walkable band across the planks, between the two hay stacks.
    walkMinZ: midZ - l.band,
    walkMaxZ: midZ + l.band,
    // Where the ladder stands on the barn floor, and where it lands on the loft (just inside the gap in the rail).
    ladderFoot: { x: l.ladder.footX, y: floorY, z: l.ladder.z },
    ladderTop: { x: l.edgeX + 0.35, y: top, z: l.ladder.z },
    // The ladder leans from its foot to `ladderTopX`, `ladderOver` above the planks (barnBuild.js draws it and `climbPoints` climbs it).
    ladderTopX: l.edgeX + 0.1,
    ladderOver: 0.7,
    // The rail along the open edge in two pieces, with the gap at the ladder between them: { z0, z1 }.
    railSpans: [
      { z0: inner.minZ, z1: l.ladder.z - l.ladder.gap / 2 },
      { z0: l.ladder.z + l.ladder.gap / 2, z1: inner.maxZ },
    ],
  };
}

/** How far from the ladder's rails you stand on it: a capsule's radius, so the top of the climb stops short of the planks' edge until you step onto them. */
export const CLIMB_STAND_OFF = 0.3;

/** Where the ladder's rails are, in x, at height `y`: it leans, so they move towards the loft as they rise. */
export function ladderXAt(lf, y) {
  const rise = lf.top + lf.ladderOver - lf.ladderFoot.y;
  return lf.ladderFoot.x + ((y - lf.ladderFoot.y) * (lf.ladderTopX - lf.ladderFoot.x)) / rise;
}

/**
 * The way up (or down) the ladder after `from`: [from, ...via, to]. Up the ladder's lean to the height of the planks, stood off it so your
 * head passes the planks' open edge rather than through them, then over the edge to `ladderTop`. Going down is the same points the other way.
 */
export function climbPoints(lf, from, up) {
  const foot = { x: lf.ladderFoot.x - 0.1, y: lf.ladderFoot.y, z: lf.ladderFoot.z };
  const high = { x: ladderXAt(lf, lf.top) - CLIMB_STAND_OFF, y: lf.top, z: lf.ladderTop.z };
  const top = { x: lf.ladderTop.x, y: lf.top, z: lf.ladderTop.z };
  return up ? [from, foot, high, top] : [from, top, high, foot];
}

/**
 * The way up the ladder as `climbPoints` has it, with `from` and every point of it in the world (the loft is worked out in the barn's own frame,
 * which is a turn about the barn's anchor in the world).
 */
export function worldClimbPoints(layout, lf, from, up) {
  const f = barnFrame(layout);
  const local = (p) => ({ ...p, ...f.toLocal(p.x, p.z) });
  const world = (p) => ({ ...p, ...f.toWorld(p.x, p.z) });
  return climbPoints(lf, local(from), up).map(world);
}

/** The girl's place in the loft for the rest-spot list, in the world: her seat, where she stands to climb, and the points she goes through. */
export function loftRestSpot(layout, lf) {
  const f = barnFrame(layout);
  const foot = f.toWorld(lf.ladderFoot.x, lf.ladderFoot.z);
  const top = f.toWorld(lf.ladderTop.x, lf.ladderTop.z);
  const seat = barnLocal(layout).loft.seat;
  const seatIn = f.toWorld(seat.x + 0.1, seat.z + 1.8); // a step in from the seat along the barn's own axes
  return {
    ...layout.loft.seat,
    stand: { x: foot.x, z: foot.z },
    via: [{ x: top.x, z: top.z, rise: layout.loft.floor }, { x: seatIn.x, z: seatIn.z, rise: layout.loft.floor }],
    climbSeconds: 4,
  };
}

/** Where Jess tips her straw from: `strawDx` towards the edge, along the barn's own x, from her seat. */
export function strawTip(layout, seat) {
  const d = barnFrame(layout).vecToWorld(layout.loft.strawDx, 0);
  return { x: seat.x + d.x, z: seat.z + d.z };
}

/** Whether the world point (x, z) is over the loft's planks, `margin` metres in from the edges. */
export function overLoft(layout, wx, wz, margin = 0) {
  const { inner } = barnShape(layout);
  const { x, z } = barnFrame(layout).toLocal(wx, wz);
  return x > barnLocal(layout).loft.edgeX + margin && x < inner.maxX - margin && z > inner.minZ + margin && z < inner.maxZ - margin;
}

/** Whether you're up there: over the planks and standing on them (feet more than half the floor height up). */
export function onLoft(layout, x, y, z, floorY) {
  return overLoft(layout, x, z) && y > floorY + layout.loft.floor * 0.5;
}

/** A climb between two points, by way of `via` if given, eased, over `seconds`. update() returns the position and whether it's done. */
export class Climb {
  constructor(from, to, seconds, via = []) {
    this.points = [from, ...via, to];
    this.seconds = Math.max(0.1, seconds);
    this.t = 0;
  }

  update(dt) {
    this.t = Math.min(1, this.t + dt / this.seconds);
    const { x, y, z } = pathAt(this.points, smooth(this.t));
    return { x, y, z, done: this.t >= 1 };
  }
}

/**
 * Points a girl passes through on the way up the ladder and across the planks to her seat: `[start, ...via, end]`
 * with `k` 0..1 along the whole path (by length), and a position back. Used both ways (k running down to climb down).
 */
export function pathAt(points, k) {
  const lens = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const l = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y, points[i].z - points[i - 1].z);
    lens.push(l);
    total += l;
  }
  let d = Math.min(1, Math.max(0, k)) * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const t = lens[i] > 0 ? Math.min(1, d / lens[i]) : 1;
      const a = points[i];
      const b = points[i + 1];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, climbing: i < lens.length - 1 };
    }
    d -= lens[i];
  }
  return { ...points[points.length - 1], climbing: false };
}

/**
 * Hiding in the hay. While you're hidden the girls can't find you: they stop offering rides and asking favours (the game
 * checks `active`), call for you now and then, and after a while one finds you. A girl sat up in the loft finds you quickly.
 * update() returns 'call' or 'found' (and then you're no longer hidden), or null.
 */
export class Hiding {
  constructor(params = { ...DEFAULT_LOFT_PARAMS }) {
    this.p = params;
    this.active = false;
    this.time = 0;
    this.nextCall = 0;
  }

  hide() {
    this.active = true;
    this.time = 0;
    this.nextCall = this.p.hideCallAfter;
  }

  reveal() {
    this.active = false;
    this.time = 0;
  }

  update(dt, { girlInLoft = false } = {}) {
    if (!this.active) return null;
    this.time += dt;
    const p = this.p;
    if (this.time >= (girlInLoft ? p.findWithGirl : p.hideFoundAfter)) {
      this.reveal();
      return 'found';
    }
    if (this.time >= this.nextCall) {
      this.nextCall = this.time + p.hideCallEvery;
      return 'call';
    }
    return null;
  }
}

/**
 * Jess in the loft tips straw on you. You have to be stood below near her for `strawLinger` seconds, then each second there is a
 * `strawChance` of it happening, and then she waits `strawCooldown`. update() returns true on the second it happens.
 */
export class StrawDrop {
  constructor(params = { ...DEFAULT_LOFT_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.near = 0;
    this.cooldown = 0;
    this.acc = 0;
  }

  update(dt, { jessUp, you, jess }) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    const close = !!jessUp && !!you && you.below && Math.hypot(you.x - jess.x, you.z - jess.z) < this.p.strawNear;
    if (!close) {
      this.near = 0;
      this.acc = 0;
      return false;
    }
    this.near += dt;
    if (this.near < this.p.strawLinger || this.cooldown > 0) return false;
    this.acc += dt;
    if (this.acc < 1) return false;
    this.acc -= 1;
    if (this.random() >= this.p.strawChance) return false;
    this.cooldown = this.p.strawCooldown;
    this.near = 0;
    return true;
  }
}
