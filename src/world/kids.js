// The neighbours' kids on mini motos, now and then along the public lane (#52). Pure: no Three.js, no sound. A `KidsGroup` is one to
// three riders in single file on the lane's near side. If you or one of the girls is within sight of the big gate as they come up to it
// they stop outside, turn to look in and watch for a while, then ride on; otherwise they just go by. While they watch, the girls are
// keener on what shows off (`showOffBoost`). Traffic (traffic.js) deals the groups and draws them with the lane's vehicles.

import { Drive, laneX, headingTo } from './traffic.js';

export const DEFAULT_KIDS_PARAMS = {
  kidsEvery: 720, // s: on average between groups of kids on the lane by day (0 turns them off)
  firstKids: 240, // s into a game before the first group can set out
  kidsMax: 3, // most riders in a group
  kidsSpeed: 5, // m/s: how fast they ride
  watchRange: 30, // m: how near the big gate you or a girl must be for them to stop and watch
  watchSeconds: 25, // s they watch for
  watchGrace: 6, // s they carry on watching after the last of you has gone out of range
  kidsShowOff: 1.5, // how much keener a girl is on showing off (the ramp, doughnuts, a race) while they watch: 1 is no change
};

export const KIDS_PARAM_RANGES = {
  kidsEvery: [0, 1800, 30],
  firstKids: [0, 900, 10],
  kidsMax: [1, 3, 1],
  kidsSpeed: [2, 9, 0.5],
  watchRange: [10, 60, 1],
  watchSeconds: [5, 90, 1],
  watchGrace: [0, 30, 1],
  kidsShowOff: [1, 4, 0.1],
};

/** The mini motos' paints, and the outfits the riders wear: [jumper or shirt colour]. */
export const KIDS_BIKES = [0xd2541c, 0x2e7d4f, 0xb8282a, 0x3f6fa8, 0xe0b422];
export const KIDS_TOPS = ['#c0392b', '#2a6f97', '#e0a21f', '#5b8c3a', '#8a4f9e'];

/** What a girl does on her own that someone could watch and be impressed by (offer keys, npc/chooser.js). */
export const SHOWY_OFFERS = ['showOff', 'jumps', 'doughnuts', 'race', 'raceDare', 'climb', 'cones', 'bigGo'];

/** How much more weight an offer gets while kids are watching: `kidsShowOff` for a showy one, else 1. */
export function showOffBoost(key, watching, params) {
  return watching && SHOWY_OFFERS.includes(key) ? params.kidsShowOff : 1;
}

const wrap = (a) => ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;

/**
 * One group on the lane. `count` riders go `dir` (1 is towards +z) from the lane's end; the leader stops level with the big gate and each
 * of the others a bike's length or two behind. Phases: 'riding', then 'watching' (if anyone was near), then 'leaving'.
 */
export class KidsGroup {
  constructor({ places, params, dir, count, random }) {
    this.places = places;
    this.p = params;
    this.dir = dir;
    this.phase = 'riding';
    this.decided = false;
    this.t = 0;
    this.lastSeen = 0; // s since a watcher was last in range
    const lane = places.lane;
    const x = laneX(lane, dir);
    const z0 = dir > 0 ? lane.minZ - 12 : lane.maxZ + 12;
    this.endZ = dir > 0 ? lane.maxZ + 30 : lane.minZ - 30;
    this.riders = [];
    for (let i = 0; i < count; i++) {
      const drive = new Drive({ x, z: z0 - dir * i * 3.5, yaw: dir > 0 ? 0 : Math.PI, speed: params.kidsSpeed, cruise: params.kidsSpeed, radius: 2, accel: 3, brake: 4 });
      drive.go([{ x, z: this.endZ, speed: params.kidsSpeed }]);
      this.riders.push({
        id: i,
        drive,
        bike: KIDS_BIKES[Math.floor(random() * KIDS_BIKES.length)],
        top: KIDS_TOPS[i % KIDS_TOPS.length], // a rider's place in the line has her jumper, so each of the three is dressed once, ahead (trafficView.js)
        stopAt: { x, z: places.gate.z - dir * i * 2.2 },
      });
    }
    this.x = x;
  }

  get leader() {
    return this.riders[0];
  }

  /** Whether any of `watchers` ({ x, z }) is within sight of the big gate. */
  anyoneWatching(watchers) {
    const g = this.places.gate;
    return watchers.some((w) => Math.hypot(w.x - g.x, w.z - g.z) < this.p.watchRange);
  }

  update(dt, ctx) {
    const events = [];
    this.t += dt;
    const gate = this.places.gate;
    const toGate = this.dir * (gate.z - this.leader.drive.z); // metres left to the gate, negative once past it
    const watched = this.anyoneWatching(ctx.watchers ?? []);
    if (this.phase === 'riding') {
      if (!this.decided && toGate < 18 && toGate > 0) {
        this.decided = true;
        events.push({ type: 'kidsComing', x: this.leader.drive.x, z: this.leader.drive.z });
        if (watched) {
          for (const r of this.riders) r.drive.go([{ x: r.stopAt.x, z: r.stopAt.z, stop: true, speed: this.p.kidsSpeed * 0.7 }]);
          this.phase = 'arriving';
        }
      }
      if (!this.passedGate && toGate <= 0) {
        this.passedGate = true;
        events.push({ type: 'kidsPass', x: this.leader.drive.x, z: this.leader.drive.z });
      }
    } else if (this.phase === 'arriving') {
      if (this.riders.every((r) => r.drive.arrived)) {
        this.phase = 'watching';
        this.watchT = 0;
        this.lastSeen = 0;
        events.push({ type: 'kidsWatch', x: this.leader.drive.x, z: this.leader.drive.z });
      }
    } else if (this.phase === 'watching') {
      this.watchT += dt;
      this.lastSeen = watched ? 0 : this.lastSeen + dt;
      if (this.watchT > this.p.watchSeconds || this.lastSeen > this.p.watchGrace) {
        this.phase = 'leaving';
        for (const r of this.riders) r.drive.go([{ x: this.x, z: this.endZ, speed: this.p.kidsSpeed }]);
        events.push({ type: 'kidsLeave', x: this.leader.drive.x, z: this.leader.drive.z });
      }
    }
    for (const r of this.riders) {
      const d = r.drive;
      if (this.phase === 'watching') {
        // Sat stopped, turned to look in through the gate.
        d.yaw = wrap(d.yaw + Math.max(-1.5 * dt, Math.min(1.5 * dt, wrap(headingTo(d.x, d.z, gate.x, gate.z) - d.yaw))));
        d.speed = 0;
      } else d.update(dt, ctx.blockers ?? []);
    }
    if (this.riders.every((r) => r.drive.arrived) && this.phase !== 'watching' && this.phase !== 'arriving') {
      this.done = true;
      events.push({ type: 'kidsGone' });
    }
    return events;
  }

  /** Watching right now: the girls are impressed by an audience. */
  get watching() {
    return this.phase === 'watching';
  }
}

/** When the next group sets out: a random wait around `kidsEvery`, never less than a fifth of it. */
export const nextKids = (every, random) => Math.max(0.2 * every, -Math.log(1 - random() * 0.999) * every);

/** The kids on the lane: when the next group sets out, and the group out now (one at a time, by day, in fine weather). */
export class Kids {
  constructor({ places, params = DEFAULT_KIDS_PARAMS, random = Math.random }) {
    this.places = places;
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.group = null;
    this.nextIn = params.firstKids + nextKids(params.kidsEvery || 1, random) * 0.5;
  }

  /** Sets a group off now if there is not one. `count` riders (1 to `kidsMax`), or dealt. */
  start(count) {
    if (this.group) return null;
    const n = count ?? 1 + Math.floor(this.random() * this.p.kidsMax);
    this.group = new KidsGroup({ places: this.places, params: this.p, dir: this.random() < 0.5 ? 1 : -1, count: Math.max(1, Math.min(this.p.kidsMax, n)), random: this.random });
    return this.group;
  }

  /** ctx: darkness (0..1), fine (no rain or frost), watchers ([{ x, z }]: you and the girls), blockers. Returns the group's events. */
  update(dt, ctx) {
    const events = [];
    this.clock += dt;
    if (!this.group && this.p.kidsEvery > 0) {
      this.nextIn -= dt;
      if (this.nextIn <= 0) {
        if ((ctx.darkness ?? 0) < 0.3 && ctx.fine !== false) this.start();
        this.nextIn = nextKids(this.p.kidsEvery, this.random);
      }
    }
    if (this.group) {
      for (const e of this.group.update(dt, ctx)) {
        events.push(e);
        if (e.type === 'kidsGone') this.group = null;
      }
    }
    return events;
  }

  /** Whether a group is watching right now. */
  get watching() {
    return !!this.group?.watching;
  }
}
