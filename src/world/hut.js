// The shepherd's hut on the hill pasture (layout.hill.hut): where it stands and what is where inside it, and the stove and kettle in it.
// Pure: no Three.js. hutBuild.js draws it, hutHost.js wires it into the game, npc/hutStay.js is the girls' visits.
//
// The hut has its own frame: local +z is the door end (the steps), local +x is to the right facing the door, and the floor is `floor` m up.
// A point in it is { x, z } in that frame, turned into the world by `toWorld`.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export const DEFAULT_HUT_PARAMS = {
  burnSeconds: 900, // seconds a lit stove burns before it goes out (three hours of game time)
  logSeconds: 450, // seconds a log adds when you put one on a burning stove
  maxSeconds: 1800, // most it will hold at once
  warmUp: 45, // seconds from lit to full heat
  coolDown: 300, // seconds from out to cold
  warmAt: 0.35, // heat (0..1) at which the hut is warm and the kettle heats
  boilSeconds: 25, // seconds a warm stove takes to boil the kettle
  pourSeconds: 2.2, // seconds you hold E to pour and drink a mug of tea
  warmRadius: 2.5, // metres from the stove, outside the hut, that its heat reaches (through the open top of the door)
  lightReach: 7, // metres the stove's light reaches
  lightCandela: 14, // the stove's light at the full dark, a fifth of that by day
};

export const HUT_PARAM_RANGES = {
  burnSeconds: [60, 3600, 30],
  logSeconds: [30, 1800, 30],
  maxSeconds: [120, 7200, 60],
  warmUp: [5, 300, 5],
  coolDown: [20, 1200, 10],
  warmAt: [0.05, 0.9, 0.05],
  boilSeconds: [2, 120, 1],
  pourSeconds: [0.5, 8, 0.1],
  warmRadius: [0.5, 8, 0.5],
  lightReach: [2, 20, 0.5],
  lightCandela: [0, 60, 1],
};

/** What is where in the hut's own frame, in metres (x right facing the door, z towards the door end). The build and the girls both read this. */
export const HUT_INSIDE = {
  stove: { x: 0.62, z: 1.3 },
  kettle: { x: 0.62, z: 1.3, rise: 0.74 }, // on the hob, above the floor
  shelf: { x: -1.05, z: 0.35, rise: 1.35 },
  bunk: { z0: -2, z1: -1, rise: 0.42 }, // across the back end, its top this far above the floor
  seats: [{ x: -0.45, z: -1.2 }, { x: 0.38, z: -1.2 }], // on the bunk's front edge, two girls side by side
  stepTop: 0.28, // the step at the door: its top above the ground
  stepZ: [2, 2.5],
  doorHalf: 0.4,
};

/**
 * The hut's place and its frame, or null when the layout has none. `toWorld(lx, lz)` and `toLocal(x, z)` convert; `inside` is within the
 * walls, `covered` under the roof (it overhangs), `levelK` how much the ground is levelled there (1 under it, easing to 0 outside).
 */
export function hutShape(layout) {
  const h = layout.hill?.hut;
  if (!h) return null;
  const sin = Math.sin(h.yaw);
  const cos = Math.cos(h.yaw);
  const hl = h.length / 2;
  const hw = h.width / 2;
  const toWorld = (lx, lz) => ({ x: h.x + lx * cos + lz * sin, z: h.z - lx * sin + lz * cos });
  const toLocal = (x, z) => ({ x: (x - h.x) * cos - (z - h.z) * sin, z: (x - h.x) * sin + (z - h.z) * cos });
  const inside = (x, z, margin = 0) => {
    const l = toLocal(x, z);
    return Math.abs(l.x) <= hw - margin && Math.abs(l.z) <= hl - margin;
  };
  const covered = (x, z) => {
    const l = toLocal(x, z);
    return Math.abs(l.x) <= hw + 0.3 && Math.abs(l.z) <= hl + 0.45;
  };
  /** Distance from the hut's centre to a point, in the level ground's own shape: a rounded box a little bigger than the hut. */
  const levelDistance = (x, z) => {
    const l = toLocal(x, z);
    return Math.hypot(Math.max(Math.abs(l.x) - hw, 0), Math.max(Math.abs(l.z) - (hl + 1.2), 0));
  };
  const levelK = (x, z) => 1 - smoothstep(h.level, h.level + h.fade, levelDistance(x, z));
  const near = (x, z, margin = h.clear) => Math.hypot(x - h.x, z - h.z) < margin;
  const chimney = toWorld(HUT_INSIDE.stove.x, HUT_INSIDE.stove.z);
  const at = (p) => toWorld(p.x, p.z);
  return {
    ...h,
    halfLength: hl,
    halfWidth: hw,
    toWorld,
    toLocal,
    inside,
    covered,
    levelK,
    near,
    chimney,
    stove: at(HUT_INSIDE.stove),
    door: toWorld(0, hl),
    /** Where she stands at the foot of the steps before she goes up. */
    footOfSteps: toWorld(0, hl + 1.1),
    /** The two places on the bunk's edge, as rest spots would have them: { x, z, yaw } (yaw is the way she faces, towards the door). */
    seatPoints: HUT_INSIDE.seats.map((s) => ({ ...at(s), yaw: h.yaw })),
    /** Where the walk up goes, from the foot of the steps, as { x, z, rise } with `rise` above the ground at that point. */
    stepsWay: [
      { ...toWorld(0, HUT_INSIDE.stepZ[1] - 0.2), rise: HUT_INSIDE.stepTop },
      { ...toWorld(0, hl - 0.1), rise: h.floor },
      { ...toWorld(0.05, 0.1), rise: h.floor },
      { ...toWorld(0, -0.7), rise: h.floor },
    ],
    /** The hut's footprint as a box the girls walk round (npc/detour.js): the walls and wheels, the steps and the drawbar at the other end. */
    box() {
      const corners = [[-hw - 0.4, -hl - 3.7], [hw + 0.4, -hl - 3.7], [hw + 0.4, hl + 0.6], [-hw - 0.4, hl + 0.6]].map(([lx, lz]) => toWorld(lx, lz));
      return {
        minX: Math.min(...corners.map((c) => c.x)),
        maxX: Math.max(...corners.map((c) => c.x)),
        minZ: Math.min(...corners.map((c) => c.z)),
        maxZ: Math.max(...corners.map((c) => c.z)),
      };
    },
  };
}

/** The stove: fuel, heat and the kettle on it. */
export class Stove {
  constructor(params = { ...DEFAULT_HUT_PARAMS }) {
    this.p = params;
    this.fuel = 0; // seconds of burning left
    this.heat = 0; // 0 cold to 1 full
    this.kettle = 0; // 0 cold to 1 boiled
    this.pour = 0; // seconds of pouring so far
    this.lights = 0; // times it has been lit this game
  }

  get burning() {
    return this.fuel > 0;
  }

  /** Warm enough to feel it, and for the kettle. */
  get warm() {
    return this.heat >= this.p.warmAt;
  }

  /** Whether there is a fire to see: burning, or still glowing. */
  get glowing() {
    return this.burning || this.heat > 0.08;
  }

  get boiled() {
    return this.kettle >= 1;
  }

  /** 0..1 how much smoke the chimney gives. */
  get smoke() {
    return this.burning ? 0.35 + 0.65 * this.heat : this.heat * 0.3;
  }

  /** Lights it from cold (or an ember). Returns whether that did anything. */
  light() {
    if (this.burning) return false;
    this.fuel = this.p.burnSeconds;
    this.lights++;
    return true;
  }

  /** A log on a burning stove. */
  stoke() {
    if (!this.burning || this.fuel >= this.p.maxSeconds - 1) return false;
    this.fuel = Math.min(this.p.maxSeconds, this.fuel + this.p.logSeconds);
    return true;
  }

  /** Whether another log would go on. */
  get canStoke() {
    return this.burning && this.fuel < this.p.maxSeconds - 1;
  }

  /** What the player's E does at the stove right now: 'light', 'stoke' or null. */
  get action() {
    if (!this.burning) return 'light';
    return this.canStoke ? 'stoke' : null;
  }

  /** Whether a spot is warmed: in the hut, or within the stove's reach outside it, with the stove warm. */
  warms(inHut, distance) {
    return this.warm && (inHut || distance <= this.p.warmRadius);
  }

  /** Holding E at the kettle. Returns true while pouring, and 'done' when the mug is poured. */
  pouring(dt) {
    if (!this.boiled) return false;
    this.pour += dt;
    if (this.pour >= this.p.pourSeconds) {
      this.pour = 0;
      this.kettle = 0.45; // she's emptied a mug's worth; it needs a few seconds to come back up
      return 'done';
    }
    return true;
  }

  /** E let go: the pour stops and starts again from the top. */
  stopPouring() {
    this.pour = 0;
  }

  /** One step. Events: { type: 'out' } when the last of the fuel goes. */
  update(dt) {
    const p = this.p;
    const events = [];
    if (this.fuel > 0) {
      this.fuel = Math.max(0, this.fuel - dt);
      this.heat = Math.min(1, this.heat + dt / p.warmUp);
      if (this.fuel === 0) events.push({ type: 'out' });
    } else {
      this.heat = Math.max(0, this.heat - dt / p.coolDown);
    }
    if (this.warm) this.kettle = Math.min(1, this.kettle + dt / p.boilSeconds);
    else this.kettle = Math.max(0, this.kettle - dt / (p.coolDown * 0.2));
    return events;
  }

  /** The debug panel's "put it out and clear it". */
  reset() {
    this.fuel = 0;
    this.heat = 0;
    this.kettle = 0;
    this.pour = 0;
  }
}
