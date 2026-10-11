// The two as a pair. Free, the one who wants company goes over and stands with her friend at talking distance, facing her; when one
// sets off for a wander, a sit down or a cup of tea, the other may tag along a step behind and to one side; when you come up to the
// two of them they turn a little towards you, so the three of you face the middle. Fallen out, none of it (fallingOut.js keeps
// them apart). Going over and tagging along are offers for the chooser (chooser.js); this never starts either itself. Pure.

export const DEFAULT_PAIR_PARAMS = {
  talk: 1.4, // metres apart when the two stand talking
  near: 4, // closer than this they're together already: she doesn't go over, and they count as a pair
  range: 40, // metres: further apart than this and she doesn't go over
  cooldown: 30, // seconds after going over or tagging along before she does either again
  tagNear: 6, // metres: her friend sets off from within this and she may tag along
  tagBehind: 1.2, // metres behind her friend as she tags along
  tagSide: 0.7, // and this far to one side
  tagFor: 90, // seconds she'll follow before giving up on wherever her friend is going
  openRange: 5, // metres: you within this of the pair and they turn to let you in
  openMax: 0.6, // radians: the most either turns from facing her friend to let you in (about 35 degrees)
};

export const PAIR_PARAM_RANGES = {
  talk: [0.8, 3, 0.05],
  near: [1.5, 10, 0.5],
  range: [5, 120, 1],
  cooldown: [0, 300, 5],
  tagNear: [1, 20, 0.5],
  tagBehind: [0.5, 4, 0.1],
  tagSide: [0, 2, 0.05],
  tagFor: [10, 300, 5],
  openRange: [1, 15, 0.5],
  openMax: [0, 1.5, 0.05],
};

/** The walks a friend can be tagged along on: off for a look round, a sit down, a cup of tea. */
export const TAG_KINDS = ['wander', 'rest', 'tea'];

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const headingTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
const TAU = Math.PI * 2;
const turnBetween = (from, to) => ((((to - from + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

/** Where she stands to talk to her friend: `p.talk` from her, on the side she's coming from, facing her. { x, z, facing } */
export function standBy(self, friend, p = DEFAULT_PAIR_PARAMS) {
  const d = dist(self, friend);
  const at = d < 1e-3 ? { x: friend.x, z: friend.z + p.talk } : { x: friend.x + ((self.x - friend.x) * p.talk) / d, z: friend.z + ((self.z - friend.z) * p.talk) / d };
  return { ...at, facing: headingTo(at, friend) };
}

/** Where she walks tagging along: behind her friend (`heading` her way) and to `side` (1 her left, -1 her right). { x, z } */
export function tagPoint(friend, side, p = DEFAULT_PAIR_PARAMS) {
  const fx = Math.sin(friend.heading);
  const fz = Math.cos(friend.heading);
  return { x: friend.x - fx * p.tagBehind + fz * p.tagSide * side, z: friend.z - fz * p.tagBehind - fx * p.tagSide * side };
}

/**
 * Which way she faces stood with her friend: at her friend, or, with you close to the two of them, at the middle of the three of you,
 * turned at most `p.openMax` from her friend. `you` may be null.
 */
export function pairFacing(self, friend, you, p = DEFAULT_PAIR_PARAMS) {
  const atFriend = headingTo(self, friend);
  if (!you) return atFriend;
  const mid = { x: (self.x + friend.x) / 2, z: (self.z + friend.z) / 2 };
  if (dist(mid, you) > p.openRange) return atFriend;
  const centre = { x: (self.x + friend.x + you.x) / 3, z: (self.z + friend.z + you.z) / 3 };
  const turn = Math.max(-p.openMax, Math.min(p.openMax, turnBetween(atFriend, headingTo(self, centre))));
  return atFriend + turn;
}

export class Pair {
  constructor(p = { ...DEFAULT_PAIR_PARAMS }) {
    this.p = p;
    this.coolUntil = {}; // girl id -> clock
    this.clock = 0;
  }

  update(dt) {
    this.clock += dt;
  }

  /** Which side of her friend (`heading` her way) she's on already, 1 her left or -1 her right, so tagging along she doesn't cross behind. */
  sideOf(g, f) {
    return Math.sin(f.heading) * (g.z - f.z) - Math.cos(f.heading) * (g.x - f.x) >= 0 ? -1 : 1;
  }

  /** Whether two girls (each { x, z }) are stood together as a pair. */
  together(a, b) {
    return dist(a, b) < this.p.near;
  }

  /**
   * What each girl could do with her friend, as offers (chooser.js). `ctx`: { fallenOut, girls: [{ id, x, z, heading, free, settled
   * (stood or sat about, not going anywhere), leaving (the key of the walk she's on her way to, or null), pairWeight, tagWeight }] }.
   * Returns [{ key: 'pairUp', girl, friend, to: { x, z, facing }, weight } | { key: 'tagAlong', girl, friend, side, weight }].
   */
  offers(ctx) {
    const p = this.p;
    if (ctx.fallenOut || ctx.girls.length < 2) return [];
    const out = [];
    for (const g of ctx.girls) {
      if (!g.free || this.clock < (this.coolUntil[g.id] ?? 0)) continue;
      for (const f of ctx.girls) {
        if (f === g) continue;
        const d = dist(g, f);
        if (f.settled && d > p.near && d < p.range) out.push({ key: 'pairUp', girl: g.id, friend: f.id, to: standBy(g, f, p), weight: g.pairWeight ?? 1 });
        if (TAG_KINDS.includes(f.leaving) && d < p.tagNear) {
          out.push({ key: 'tagAlong', girl: g.id, friend: f.id, side: this.sideOf(g, f), weight: g.tagWeight ?? 1 });
        }
      }
    }
    return out;
  }

  /** She took one: the cooldown starts, and the event for the game ({ type: 'pairUp' | 'tagAlong', girl, friend, to?, side? }). */
  take(o) {
    this.coolUntil[o.girl] = this.clock + this.p.cooldown;
    return o.key === 'pairUp' ? { type: 'pairUp', girl: o.girl, friend: o.friend, to: o.to } : { type: 'tagAlong', girl: o.girl, friend: o.friend, side: o.side };
  }
}
