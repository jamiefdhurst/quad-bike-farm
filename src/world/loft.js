// The hayloft over the west end of the barn: where its floor, rail, ladder and hay are, who is up there, and what happens
// to someone hiding in the hay or stood under a girl who has a handful of straw. Pure logic, no Three.js; barnBuild.js
// draws it and game.js wires it up.

import { barnShape } from './barn.js';

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

/** Heights and places of the loft, from the layout. `floorY` is the barn floor's height. */
export function loftShape(layout, floorY) {
  const l = layout.loft;
  const { inner } = barnShape(layout);
  const top = floorY + l.floor;
  return {
    top, // the planks' upper face
    minX: inner.minX,
    maxX: l.edgeX,
    minZ: inner.minZ,
    maxZ: inner.maxZ,
    // Where the ladder stands on the barn floor, and where it lands on the loft (just inside the gap in the rail).
    ladderFoot: { x: l.ladder.footX, y: floorY, z: l.ladder.z },
    ladderTop: { x: l.edgeX - 0.35, y: top, z: l.ladder.z },
    // The rail along the open edge in two pieces, with the gap at the ladder between them: { z0, z1 }.
    railSpans: [
      { z0: inner.minZ, z1: l.ladder.z - l.ladder.gap / 2 },
      { z0: l.ladder.z + l.ladder.gap / 2, z1: inner.maxZ },
    ],
  };
}

/** Whether (x, z) is over the loft's planks, `margin` metres in from the edges. */
export function overLoft(layout, x, z, margin = 0) {
  const { inner } = barnShape(layout);
  return x > inner.minX + margin && x < layout.loft.edgeX - margin && z > inner.minZ + margin && z < inner.maxZ - margin;
}

/** Whether you're up there: over the planks and standing on them (feet more than half the floor height up). */
export function onLoft(layout, x, y, z, floorY) {
  return overLoft(layout, x, z) && y > floorY + layout.loft.floor * 0.5;
}

/** A climb between two points, eased, over `seconds`. update() returns the position and whether it's done. */
export class Climb {
  constructor(from, to, seconds) {
    this.from = from;
    this.to = to;
    this.seconds = Math.max(0.1, seconds);
    this.t = 0;
  }

  update(dt) {
    this.t = Math.min(1, this.t + dt / this.seconds);
    const k = smooth(this.t);
    return {
      x: this.from.x + (this.to.x - this.from.x) * k,
      y: this.from.y + (this.to.y - this.from.y) * k,
      z: this.from.z + (this.to.z - this.from.z) * k,
      done: this.t >= 1,
    };
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
