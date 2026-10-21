// The yard's animals: four hens loose in a run and a pig in her sty (the feeding job is one of the chalkboard's, world/farmJobs.js). Pure
// logic, no Three.js: the game says where the vehicles and you are, this moves the animals and says what they did (a cluck, a scatter, a
// squeal), and world/farmAnimalsView.js draws them. Tested in tests/farmAnimals.test.js.
//
// Each lot (the hens, the pig) has a hunger that rises over the game and goes to nothing when fed. A hungry pig squeals when you are near and
// the hens crowd the fence nearest you; nothing is lost if you never feed them. A vehicle with its engine running close to the hens
// scatters them (flapping, squawking); the pig only grunts at it.

export const HEN_COUNT = 4;

export const DEFAULT_ANIMAL_PARAMS = {
  startHunger: 0.35, // how hungry they are at the start of a day (0 fed, 1 starving)
  hungerSeconds: 900, // seconds for a fed lot to go from fed to starving
  hungryAt: 0.6, // hungry enough to crowd the fence and squeal
  feedSeconds: 4, // holding E at the run or the sty feeds them in this long
  feedReach: 2.4, // metres from the fence you can still feed over it
  feedUse: 0.45, // how much of a full bucket one lot takes
  scatterRadius: 9, // m: a vehicle with its engine running this close to the hens scatters them (a moving one, further, below)
  scatterPerSpeed: 1.2, // m more per m/s a vehicle is moving
  panicSeconds: 3, // how long a scattered hen keeps running after the scare is over
  scatterCool: 6, // s between one scatter being announced and the next
  henWalk: 0.5, // m/s strolling
  henRun: 3.6, // m/s scattering
  crowdReach: 12, // m: how close you are for the hens to crowd you and the pig to squeal for you
  pigWalk: 0.7, // m/s
  squealEvery: 9, // s between a hungry pig's squeals (it varies by half)
  gruntEvery: 22, // s between a content pig's grunts
  cluckEvery: 7, // s between a hen's clucks (it varies by half)
};

export const ANIMAL_PARAM_RANGES = {
  startHunger: [0, 1, 0.05],
  hungerSeconds: [60, 3600, 30],
  hungryAt: [0.2, 1, 0.05],
  feedSeconds: [0.5, 20, 0.5],
  feedReach: [0.5, 6, 0.1],
  feedUse: [0.1, 1, 0.05],
  scatterRadius: [2, 30, 0.5],
  scatterPerSpeed: [0, 4, 0.1],
  panicSeconds: [0.5, 10, 0.5],
  scatterCool: [1, 30, 1],
  henWalk: [0.1, 2, 0.05],
  henRun: [1, 8, 0.1],
  crowdReach: [3, 40, 1],
  pigWalk: [0.1, 2, 0.05],
  squealEvery: [2, 40, 1],
  gruntEvery: [5, 90, 1],
  cluckEvery: [2, 40, 1],
};

/** Metres from (x, z) to a rectangle { minX, maxX, minZ, maxZ } (0 inside it). */
export function distanceToRect(r, x, z) {
  return Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));
}

/** The point on a rectangle's edge (pulled `inset` m inside) nearest (x, z): where animals crowd to be next to you. */
export function nearestEdge(r, x, z, inset = 0.4) {
  return { x: Math.min(r.maxX - inset, Math.max(r.minX + inset, x)), z: Math.min(r.maxZ - inset, Math.max(r.minZ + inset, z)) };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class FarmAnimals {
  /** `pen` and `sty` are rectangles { minX, maxX, minZ, maxZ }; `random` returns 0..1. */
  constructor({ pen, sty, random, params = { ...DEFAULT_ANIMAL_PARAMS } }) {
    this.p = params;
    this.pen = pen;
    this.sty = sty;
    this.random = random;
    this.hens = Array.from({ length: HEN_COUNT }, () => ({ x: 0, z: 0, heading: 0, mode: 'peck', timer: 0, tx: 0, tz: 0, panic: 0, speed: 0, cluck: 0 }));
    this.pig = { x: 0, z: 0, heading: 0, mode: 'rest', timer: 0, tx: 0, tz: 0, speed: 0, sound: 0 };
    this.hunger = { hens: params.startHunger, pig: params.startHunger };
    this.progress = { hens: 0, pig: 0 }; // 0..1 of a feed in hand
    this.fed = { hens: false, pig: false }; // fed since the day began (what the job counts)
    this.scatterCool = 0;
    this.emptyWarned = false;
    this.touched = { hens: false, pig: false }; // fed this frame (so the progress does not ebb)
    this.reset();
  }

  /** Back to the start of a day: everyone fed-or-not as at dawn, in a scatter of places. */
  reset() {
    const r = this.random;
    const { pen, sty } = this;
    for (const h of this.hens) {
      h.x = pen.minX + 0.6 + r() * (pen.maxX - pen.minX - 1.2);
      h.z = pen.minZ + 0.6 + r() * (pen.maxZ - pen.minZ - 1.2);
      h.heading = r() * Math.PI * 2;
      h.mode = 'peck';
      h.timer = 1 + r() * 4;
      h.panic = 0;
      h.speed = 0;
      h.cluck = 1 + r() * this.p.cluckEvery;
    }
    this.pig.x = (sty.minX + sty.maxX) / 2;
    this.pig.z = (sty.minZ + sty.maxZ) / 2;
    this.pig.heading = r() * Math.PI * 2;
    this.pig.mode = 'rest';
    this.pig.timer = 3 + r() * 6;
    this.pig.speed = 0;
    this.pig.sound = 4 + r() * this.p.gruntEvery;
    this.hunger = { hens: this.p.startHunger, pig: this.p.startHunger };
    this.progress = { hens: 0, pig: 0 };
    this.fed = { hens: false, pig: false };
    this.scatterCool = 0;
    this.emptyWarned = false;
  }

  hungry(which) {
    return this.hunger[which] >= this.p.hungryAt;
  }

  /** Both lots fed since the day began. */
  get allFed() {
    return this.fed.hens && this.fed.pig;
  }

  rectOf(which) {
    return which === 'hens' ? this.pen : this.sty;
  }

  /** Whether (x, z) is close enough to the run or the sty to feed over its fence. */
  canFeed(which, x, z) {
    return distanceToRect(this.rectOf(which), x, z) <= this.p.feedReach;
  }

  /**
   * One step of holding E at a fence with the bucket. `bucketFeed` is what is in it (0..1). Returns { used, events }: how much of the
   * bucket went, and 'fed' (with which) when they have had enough, 'empty' once when the bucket runs out.
   */
  feeding(which, dt, bucketFeed) {
    const p = this.p;
    const events = [];
    if (this.hunger[which] <= 0.02) return { used: 0, events }; // she has just had it
    if (bucketFeed <= 0.0001) {
      if (!this.emptyWarned) events.push({ type: 'empty' });
      this.emptyWarned = true;
      return { used: 0, events };
    }
    this.emptyWarned = false;
    this.touched[which] = true;
    const step = dt / p.feedSeconds;
    const used = Math.min(bucketFeed, step * p.feedUse);
    this.progress[which] = Math.min(1, this.progress[which] + used / p.feedUse);
    if (this.progress[which] >= 1) {
      this.hunger[which] = 0;
      this.progress[which] = 0;
      this.fed[which] = true;
      events.push({ type: 'fed', which });
    }
    return { used, events };
  }

  /**
   * One step. `ctx`: `threats` (vehicles: { x, z, running, speed }), `you` ({ x, z } on foot or on a quad: where hungry animals look
   * for you) and `near` (whether you are close enough that a squeal is worth making). Returns events: { type: 'cluck' | 'scatter' |
   * 'squeal' | 'grunt', x, z }.
   */
  update(dt, ctx = {}) {
    const p = this.p;
    const events = [];
    this.scatterCool = Math.max(0, this.scatterCool - dt);
    for (const k of ['hens', 'pig']) this.hunger[k] = Math.min(1, this.hunger[k] + dt / p.hungerSeconds);
    for (const k of ['hens', 'pig']) {
      if (!this.touched[k]) this.progress[k] = Math.max(0, this.progress[k] - dt * 0.3); // let go of the fence and a half-done feed is lost
      this.touched[k] = false;
    }
    this.updateHens(dt, ctx, events);
    this.updatePig(dt, ctx, events);
    return events;
  }

  updateHens(dt, ctx, events) {
    const p = this.p;
    const r = this.random;
    const pen = this.pen;
    const threats = (ctx.threats ?? []).filter((t) => t.running || t.speed > 1);
    const you = ctx.you ?? null;
    const crowd = you && this.hungry('hens') && distanceToRect(pen, you.x, you.z) <= p.crowdReach ? nearestEdge(pen, you.x, you.z) : null;
    let scattered = null;
    for (const h of this.hens) {
      // The nearest thing that frightens her.
      let scare = null;
      let scareD = Infinity;
      for (const t of threats) {
        const d = Math.hypot(t.x - h.x, t.z - h.z);
        const reach = p.scatterRadius + Math.abs(t.speed ?? 0) * p.scatterPerSpeed;
        if (d < reach && d < scareD) {
          scare = t;
          scareD = d;
        }
      }
      if (scare) {
        if (h.panic <= 0) scattered = scattered ?? { x: h.x, z: h.z };
        h.panic = p.panicSeconds;
        h.flee = Math.atan2(h.x - scare.x, h.z - scare.z); // straight away from it
      } else h.panic = Math.max(0, h.panic - dt);

      h.timer -= dt;
      if (h.panic > 0) {
        h.mode = 'run';
        const jitter = Math.sin((h.x + h.z) * 3 + h.panic * 9) * 0.9; // a hen does not run straight
        h.heading = (h.flee ?? h.heading) + jitter;
      } else if (h.mode === 'run') {
        h.mode = 'peck';
        h.timer = 1 + r() * 2;
      } else if (crowd) {
        if (h.mode !== 'walk' || h.tx !== crowd.x) {
          h.mode = 'walk';
          h.tx = clamp(crowd.x + (r() - 0.5) * 1.6, pen.minX + 0.3, pen.maxX - 0.3);
          h.tz = clamp(crowd.z + (r() - 0.5) * 1.6, pen.minZ + 0.3, pen.maxZ - 0.3);
          h.timer = 4;
        }
        if (Math.hypot(h.tx - h.x, h.tz - h.z) < 0.25) h.mode = 'peck';
      } else if (h.timer <= 0) {
        if (h.mode === 'peck' && r() < 0.6) {
          h.mode = 'walk';
          h.tx = pen.minX + 0.5 + r() * (pen.maxX - pen.minX - 1);
          h.tz = pen.minZ + 0.5 + r() * (pen.maxZ - pen.minZ - 1);
          h.timer = 6;
        } else {
          h.mode = 'peck';
          h.timer = 1.5 + r() * 5;
        }
      }

      if (h.mode === 'walk') {
        const dx = h.tx - h.x;
        const dz = h.tz - h.z;
        if (Math.hypot(dx, dz) < 0.2) {
          h.mode = 'peck';
          h.timer = 1.5 + r() * 4;
        } else h.heading = Math.atan2(dx, dz);
      }
      h.speed = h.mode === 'run' ? p.henRun : h.mode === 'walk' ? p.henWalk : 0;
      if (h.speed > 0) {
        h.x = clamp(h.x + Math.sin(h.heading) * h.speed * dt, pen.minX + 0.2, pen.maxX - 0.2);
        h.z = clamp(h.z + Math.cos(h.heading) * h.speed * dt, pen.minZ + 0.2, pen.maxZ - 0.2);
      }

      h.cluck -= dt;
      if (h.cluck <= 0) {
        h.cluck = p.cluckEvery * (0.5 + r());
        if (h.mode !== 'run') events.push({ type: 'cluck', x: h.x, z: h.z });
      }
    }
    if (scattered && this.scatterCool <= 0) {
      this.scatterCool = p.scatterCool;
      events.push({ type: 'scatter', x: scattered.x, z: scattered.z });
    }
  }

  updatePig(dt, ctx, events) {
    const p = this.p;
    const r = this.random;
    const sty = this.sty;
    const pig = this.pig;
    const you = ctx.you ?? null;
    const calling = you && this.hungry('pig') && distanceToRect(sty, you.x, you.z) <= p.crowdReach;
    pig.timer -= dt;
    if (calling) {
      const t = nearestEdge(sty, you.x, you.z, 0.6);
      pig.mode = 'walk';
      pig.tx = t.x;
      pig.tz = t.z;
    } else if (pig.timer <= 0) {
      if (pig.mode === 'rest' && r() < 0.5) {
        pig.mode = 'walk';
        pig.tx = sty.minX + 0.7 + r() * (sty.maxX - sty.minX - 1.4);
        pig.tz = sty.minZ + 0.7 + r() * (sty.maxZ - sty.minZ - 1.4);
        pig.timer = 10;
      } else {
        pig.mode = pig.mode === 'rest' ? 'root' : 'rest';
        pig.timer = 4 + r() * 8;
      }
    }
    pig.speed = 0;
    if (pig.mode === 'walk') {
      const dx = pig.tx - pig.x;
      const dz = pig.tz - pig.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.15) {
        pig.mode = calling ? 'root' : 'rest';
        pig.timer = 3 + r() * 5;
      } else {
        pig.heading = Math.atan2(dx, dz);
        pig.speed = p.pigWalk;
        pig.x = clamp(pig.x + (dx / d) * pig.speed * dt, sty.minX + 0.5, sty.maxX - 0.5);
        pig.z = clamp(pig.z + (dz / d) * pig.speed * dt, sty.minZ + 0.5, sty.maxZ - 0.5);
      }
    }
    pig.sound -= dt;
    if (pig.sound <= 0) {
      const hungry = this.hungry('pig');
      pig.sound = (hungry ? p.squealEvery : p.gruntEvery) * (0.5 + r());
      const near = ctx.near ?? true;
      // She grunts at an engine too, but only squeals for food.
      if (hungry && near) events.push({ type: 'squeal', x: pig.x, z: pig.z });
      else if (!hungry) events.push({ type: 'grunt', x: pig.x, z: pig.z });
    }
  }
}
