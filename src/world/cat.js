// The barn cat: it prowls the yard, sleeps curled on a warm engine or a sunny seat until it is shooed off, rubs round a girl who is stood
// about, shelters in the barn when it is wet, cold or dark, and runs from a revving or fast-moving vehicle. Pure: no Three.js and no
// sound. The game says what is around each step (`ctx`) and gets back events (a mew, a settle, a shooing) to sound and tell the girls about.
//
// ctx = { threats: [{ x, z, speed, loud }], perches: [{ id, x, z, y, warm, taken }], friends: [{ id, x, z, free }], shelter }
//   threats: you and every vehicle; `loud` 0..1 is how hard an engine is being run (0 for anything that is not running).
//   perches: where it could lie: `warm` 0..1 the engine's held heat or the sun on the seat, `taken` someone is on it or it is running.
//   friends: the girls; `free` is whether one is stood about (not busy).
//   shelter: it is too wet, cold or dark to be out, so it goes home to the barn.

export const DEFAULT_CAT_PARAMS = {
  enabled: 1, // 0 or 1: whether there is a cat (read when the game is dealt)
  walkSpeed: 0.7, // m/s strolling
  trotSpeed: 1.9, // m/s going to a perch, a girl or home
  runSpeed: 5.6, // m/s bolting
  sitMin: 4, // s sat about washing or watching, at least
  sitMax: 16, // s sat about, at most
  strollMax: 9, // m furthest an aimless stroll goes
  perchChance: 0.55, // 0..1 chance, when it next decides, that it heads for a warm perch if there is one
  perchWarmMin: 0.3, // 0..1 how warm an engine or a seat has to be for it to want to lie there
  perchStayMin: 0.12, // 0..1 it gets up once the perch has cooled below this
  perchReach: 32, // m furthest it will go for a perch
  sleepMin: 80, // s asleep on a perch, at least
  sleepMax: 280, // s asleep on a perch, at most
  jumpSeconds: 0.7, // s a jump up or down takes
  fleeRadius: 3, // m something has to come to scare it on the ground
  fleeSpeedReach: 0.9, // extra metres of that per m/s of the thing's speed
  fleeLoud: 14, // extra metres of that for a vehicle revved flat out
  wakeLoud: 0.55, // 0..1 how hard a vehicle has to be run beside a sleeping cat to send it off (its own perch starting always does)
  wakeReach: 9, // m that has to be within
  fleeDistance: 17, // m it runs before it stops
  hideMin: 15, // s it sits wary after a fright, at least
  hideMax: 50, // s after a fright, at most
  banSeconds: 240, // s it keeps off a perch it was shooed from
  greetRate: 0.03, // chance a second that it goes over to a girl stood about, when one is within greetReach
  greetReach: 13, // m of a girl that makes it think of rubbing round her
  greetSeconds: 24, // s it stays with her
  mewMin: 25, // s between mews, at least
  mewMax: 90, // s between mews, at most
  shelterRain: 0.25, // 0..1 how hard it rains before the cat goes in
  shelterCold: 2, // degrees C below which the cat stays in
  shelterDark: 0.7, // 0..1 how dark before the cat goes in for the night
};

export const CAT_PARAM_RANGES = {
  enabled: [0, 1, 1],
  walkSpeed: [0.2, 1.5, 0.05],
  trotSpeed: [0.5, 3.5, 0.1],
  runSpeed: [2, 9, 0.2],
  sitMin: [0.5, 30, 0.5],
  sitMax: [1, 60, 0.5],
  strollMax: [2, 25, 1],
  perchChance: [0, 1, 0.05],
  perchWarmMin: [0, 1, 0.02],
  perchStayMin: [0, 0.6, 0.02],
  perchReach: [5, 80, 1],
  sleepMin: [5, 300, 5],
  sleepMax: [10, 900, 5],
  jumpSeconds: [0.2, 2, 0.05],
  fleeRadius: [0.5, 10, 0.5],
  fleeSpeedReach: [0, 3, 0.1],
  fleeLoud: [0, 30, 1],
  wakeLoud: [0.05, 1, 0.05],
  wakeReach: [2, 25, 1],
  fleeDistance: [5, 40, 1],
  hideMin: [2, 60, 1],
  hideMax: [5, 150, 1],
  banSeconds: [0, 900, 10],
  greetRate: [0, 0.3, 0.005],
  greetReach: [3, 30, 1],
  greetSeconds: [5, 90, 1],
  mewMin: [5, 120, 5],
  mewMax: [10, 300, 5],
  shelterRain: [0, 1, 0.05],
  shelterCold: [-10, 12, 0.5],
  shelterDark: [0.2, 1, 0.05],
};

const TAU = Math.PI * 2;
const angleDiff = (a, b) => ((((b - a) % TAU) + 3 * Math.PI) % TAU) - Math.PI;
const pick = (random, lo, hi) => lo + random() * Math.max(0, hi - lo);

/** The modes it is asleep or going up or down in: it ignores people and slow traffic in these. */
const SETTLED = ['sleep', 'jump', 'down'];

export class Cat {
  /**
   * `allowed(x, z)` where it may walk; `home` { x, z, via } where it shelters (`via` the doorway it goes in and out by); `inHome(x, z)`
   * whether a point is inside that shelter; `groundAt(x, z)` the ground's height.
   */
  constructor({ allowed, home, inHome = () => false, groundAt = () => 0, random = Math.random, params = { ...DEFAULT_CAT_PARAMS } }) {
    this.allowed = allowed;
    this.home = home;
    this.inHome = inHome;
    this.indoors = false; // on its way home: through the door yet
    this.groundAt = groundAt;
    this.random = random;
    this.p = params;
    this.x = home.x;
    this.z = home.z;
    this.y = 0;
    this.yaw = 0;
    this.speed = 0;
    this.mode = 'sit'; // sit, walk, seek, jump, sleep, down, flee, hide, greetWalk, greeted, homeWalk or curl
    this.t = 1; // seconds left in the mode (sit, sleep, hide, greeted, curl)
    this.goal = null;
    this.perchId = null;
    this.jump = null; // { from: {x,y,z}, to: {x,y,z}, t }
    this.bans = new Map(); // perch id -> seconds before it will go back
    this.friend = null; // id of the girl it has gone to
    this.fussed = false; // she has had her second go at it
    this.mewIn = pick(random, 5, 30);
    this.phase = 0;
    this.y = this.groundAt(this.x, this.z);
  }

  place(x, z) {
    this.x = x;
    this.z = z;
    this.y = this.groundAt(x, z);
    this.mode = 'sit';
    this.t = 2;
    this.goal = null;
    this.perchId = null;
    this.jump = null;
    this.speed = 0;
  }

  /** What it is showing for the view: 'run', 'trot', 'walk', 'sit', 'curl' (asleep), 'jump' or 'stand'. */
  get pose() {
    switch (this.mode) {
      case 'flee': return 'run';
      case 'seek': case 'greetWalk': case 'homeWalk': case 'leave': return 'trot';
      case 'walk': return 'walk';
      case 'sleep': case 'curl': return 'curl';
      case 'jump': case 'down': return 'jump';
      default: return 'sit';
    }
  }

  /** Whether it is asleep on something (the thing you shoo it from). */
  get perched() {
    return this.mode === 'sleep' || (this.mode === 'jump' && this.jump?.up);
  }

  get purring() {
    return this.mode === 'sleep' || this.mode === 'curl' || this.mode === 'greeted';
  }

  get panicked() {
    return this.mode === 'flee';
  }

  /** Sends it to a girl (the debug panel's and console's): it goes over to her as if it had thought of it. */
  visit(id) {
    if (this.mode === 'sleep') return false;
    this.friend = id;
    this.mode = 'greetWalk';
    this.perchId = null;
    return true;
  }

  /** Shooed (the player pressing E at it, or a girl): off a perch it hops down and runs; on the ground it runs. Returns whether it was moved. */
  shoo(fromX, fromZ) {
    if (this.mode === 'flee') return false;
    const wasPerched = this.perched;
    if (this.perchId != null) this.bans.set(this.perchId, this.p.banSeconds);
    this.startFlee(fromX, fromZ);
    return wasPerched ? 'perch' : 'ground';
  }

  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.phase += dt;
    for (const [id, s] of this.bans) {
      if (s - dt <= 0) this.bans.delete(id);
      else this.bans.set(id, s - dt);
    }
    this.mewIn -= dt;
    if (this.mewIn <= 0) {
      this.mewIn = pick(this.random, p.mewMin, p.mewMax);
      if (!SETTLED.includes(this.mode) && this.mode !== 'curl') events.push({ kind: 'mew', ...this.at() });
    }

    this.watchThreats(ctx, events);
    this.step(dt, ctx, events);
    if (!SETTLED.includes(this.mode)) this.y += (this.groundAt(this.x, this.z) - this.y) * Math.min(1, dt * 10);
    return events;
  }

  at() {
    return { x: this.x, y: this.y, z: this.z };
  }

  perchOf(ctx) {
    return this.perchId == null ? null : ctx.perches.find((q) => q.id === this.perchId) ?? null;
  }

  /** Something frightening: a vehicle coming at it or revved near it, or its own perch starting up. */
  watchThreats(ctx, events) {
    const p = this.p;
    if (this.mode === 'flee' || this.mode === 'hide') return;
    if (this.mode === 'sleep' || this.mode === 'jump' || this.mode === 'down') {
      const perch = this.perchOf(ctx);
      if (this.mode !== 'down' && (!perch || perch.taken)) {
        // Its vehicle is started or someone has got on it: off it goes.
        if (perch) this.bans.set(perch.id, p.banSeconds * 0.25);
        const from = ctx.threats.reduce((b, t) => (!b || Math.hypot(t.x - this.x, t.z - this.z) < Math.hypot(b.x - this.x, b.z - this.z) ? t : b), null);
        this.startFlee(from?.x ?? this.x + 1, from?.z ?? this.z, events, true);
      }
      else if (this.mode === 'sleep') {
        for (const t of ctx.threats) {
          if (t.loud >= p.wakeLoud && Math.hypot(t.x - this.x, t.z - this.z) < p.wakeReach) {
            this.startFlee(t.x, t.z, events, true);
            return;
          }
        }
      }
      return;
    }
    for (const t of ctx.threats) {
      const d = Math.hypot(t.x - this.x, t.z - this.z);
      if (d < p.fleeRadius + (t.speed ?? 0) * p.fleeSpeedReach + (t.loud ?? 0) * p.fleeLoud) {
        this.startFlee(t.x, t.z, events, true);
        return;
      }
    }
  }

  /** Off it goes, away from (fromX, fromZ), to somewhere it is let go. */
  startFlee(fromX, fromZ, events = null, scared = false) {
    if (this.mode === 'sleep' || this.mode === 'jump' || this.mode === 'down') {
      // Leaves a perch in a leap down to the ground beside it, then runs.
      const to = { x: this.x, y: this.groundAt(this.x, this.z), z: this.z };
      this.jump = { from: this.at(), to, t: 0, up: false, then: 'flee', fromX, fromZ };
      this.mode = 'down';
      events?.push({ kind: 'woke', ...this.at(), scared });
      return;
    }
    this.runAway(fromX, fromZ);
    events?.push({ kind: 'fled', ...this.at(), scared });
  }

  runAway(fromX, fromZ) {
    const p = this.p;
    const away = Math.atan2(this.z - fromZ, this.x - fromX);
    this.goal = null;
    for (let i = 0; i < 8 && !this.goal; i++) {
      const a = away + (this.random() - 0.5) * (0.8 + i * 0.25);
      const r = p.fleeDistance * (0.6 + this.random() * 0.4);
      const gx = this.x + Math.cos(a) * r;
      const gz = this.z + Math.sin(a) * r;
      if (this.allowed(gx, gz)) this.goal = { x: gx, z: gz };
    }
    if (!this.goal) {
      this.mode = 'hide';
      this.t = pick(this.random, p.hideMin, p.hideMax);
    } else this.mode = 'flee';
    this.perchId = null;
  }

  /** Walks toward `goal` at `speed`; true once there. */
  walkTo(goal, speed, dt, turn = 9) {
    const dx = goal.x - this.x;
    const dz = goal.z - this.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.25) {
      this.speed = 0;
      return true;
    }
    const want = Math.atan2(dx, dz); // yaw 0 faces +z, as the view's cat does
    this.yaw += angleDiff(this.yaw, want) * Math.min(1, dt * turn);
    const step = Math.min(d, speed * dt);
    const nx = this.x + (dx / d) * step;
    const nz = this.z + (dz / d) * step;
    if (this.allowed(nx, nz)) {
      this.x = nx;
      this.z = nz;
      this.speed = speed;
      return false;
    }
    this.speed = 0;
    return true; // blocked: counts as arrived
  }

  step(dt, ctx, events) {
    const p = this.p;
    switch (this.mode) {
      case 'sit':
        this.speed = 0;
        this.t -= dt;
        this.maybeGreet(dt, ctx);
        if (this.mode === 'sit' && this.t <= 0) this.decide(ctx);
        break;
      case 'walk':
        if (this.walkTo(this.goal, p.walkSpeed, dt)) this.rest();
        else this.maybeGreet(dt, ctx);
        break;
      case 'seek': {
        const perch = this.perchOf(ctx);
        if (!perch || perch.taken || perch.warm < p.perchWarmMin * 0.6) return this.rest();
        const arrived = this.walkTo(perch, p.trotSpeed, dt);
        if (Math.hypot(perch.x - this.x, perch.z - this.z) > 1.4) {
          if (arrived) this.rest(); // blocked on the way
          return;
        }
        if (arrived || Math.hypot(perch.x - this.x, perch.z - this.z) < 0.6) {
          this.jump = { from: this.at(), to: { x: perch.x, y: perch.y, z: perch.z }, t: 0, up: true };
          this.mode = 'jump';
          this.speed = 0;
        }
        break;
      }
      case 'jump': case 'down': this.stepJump(dt, ctx, events); break;
      case 'sleep': {
        this.speed = 0;
        this.t -= dt;
        const perch = this.perchOf(ctx);
        if (this.t <= 0 || !perch || perch.warm < p.perchStayMin) {
          if (perch) this.bans.set(perch.id, p.banSeconds * 0.5); // had its sleep; not straight back
          this.jump = { from: this.at(), to: { x: this.x, y: this.groundAt(this.x, this.z), z: this.z }, t: 0, up: false, then: 'sit' };
          this.mode = 'down';
          events.push({ kind: 'woke', ...this.at(), scared: false });
        }
        break;
      }
      case 'flee':
        if (this.walkTo(this.goal, p.runSpeed, dt, 14)) {
          this.mode = 'hide';
          this.t = pick(this.random, p.hideMin, p.hideMax);
        }
        break;
      case 'hide':
        this.speed = 0;
        this.t -= dt;
        if (this.t <= 0) this.rest();
        break;
      case 'greetWalk': {
        const f = ctx.friends?.find((o) => o.id === this.friend);
        if (!f || !f.free) return this.rest();
        const a = Math.atan2(this.x - f.x, this.z - f.z);
        const goal = { x: f.x + Math.sin(a) * 0.7, z: f.z + Math.cos(a) * 0.7 };
        if (this.walkTo(goal, p.trotSpeed, dt)) {
          this.mode = 'greeted';
          this.t = p.greetSeconds;
          this.fussed = false;
          this.yaw = Math.atan2(f.x - this.x, f.z - this.z);
          events.push({ kind: 'greeted', id: f.id, ...this.at() });
        }
        break;
      }
      case 'greeted': {
        this.speed = 0;
        this.t -= dt;
        const f = ctx.friends?.find((o) => o.id === this.friend);
        if (f) this.yaw += angleDiff(this.yaw, Math.atan2(f.x - this.x, f.z - this.z)) * Math.min(1, dt * 4);
        if (!this.fussed && this.t < p.greetSeconds * 0.55) {
          this.fussed = true;
          if (f?.free) events.push({ kind: 'fussed', id: f.id, ...this.at() });
        }
        if (this.t <= 0 || !f || !f.free || Math.hypot(f.x - this.x, f.z - this.z) > 2.5) this.rest();
        break;
      }
      case 'homeWalk':
        if (!ctx.shelter) return this.rest();
        if (!this.indoors && this.home.via) {
          if (this.walkTo(this.home.via, p.trotSpeed, dt)) this.indoors = true;
          break;
        }
        if (this.walkTo(this.home, p.trotSpeed, dt)) {
          this.mode = 'curl';
          this.t = 30;
        }
        break;
      case 'leave': // out of the shelter by its door
        if (this.walkTo(this.home.via, p.trotSpeed, dt)) this.rest();
        break;
      case 'curl':
        this.speed = 0;
        if (!ctx.shelter) {
          this.t -= dt;
          if (this.t < 25) this.rest();
        }
        break;
      default:
        break;
    }
  }

  /** Back to sitting, for a few seconds, before it decides what next. */
  rest() {
    this.mode = 'sit';
    this.t = pick(this.random, this.p.sitMin, this.p.sitMax);
    this.speed = 0;
    this.goal = null;
    this.perchId = null;
    this.friend = null;
  }

  stepJump(dt, ctx, events) {
    const j = this.jump;
    j.t += dt / Math.max(0.1, this.p.jumpSeconds);
    const k = Math.min(1, j.t);
    const arc = Math.sin(k * Math.PI) * 0.35;
    this.x = j.from.x + (j.to.x - j.from.x) * k;
    this.z = j.from.z + (j.to.z - j.from.z) * k;
    this.y = j.from.y + (j.to.y - j.from.y) * k + arc;
    if (k < 1) return;
    this.y = j.to.y;
    this.jump = null;
    if (j.up) {
      this.mode = 'sleep';
      this.t = pick(this.random, this.p.sleepMin, this.p.sleepMax);
      events.push({ kind: 'settled', id: this.perchId, ...this.at() });
    } else if (j.then === 'flee') {
      this.runAway(j.fromX, j.fromZ);
      events.push({ kind: 'fled', ...this.at(), scared: true });
    } else this.rest();
  }

  /** A girl stood about with the cat in sight: now and then it goes over to rub round her legs. */
  maybeGreet(dt, ctx) {
    const p = this.p;
    if (ctx.shelter || !ctx.friends?.length || this.random() > p.greetRate * dt) return;
    let best = null;
    let bestD = p.greetReach;
    for (const f of ctx.friends) {
      const d = Math.hypot(f.x - this.x, f.z - this.z);
      if (f.free && d < bestD && d > 1.2) {
        best = f;
        bestD = d;
      }
    }
    if (!best) return;
    this.friend = best.id;
    this.mode = 'greetWalk';
  }

  /** Sit time is over: out of the weather, onto something warm, or just a stroll. */
  decide(ctx) {
    const p = this.p;
    if (ctx.shelter) {
      this.mode = 'homeWalk';
      this.indoors = this.inHome(this.x, this.z);
      return;
    }
    if (this.home.via && this.inHome(this.x, this.z)) {
      this.mode = 'leave';
      return;
    }
    if (this.random() < p.perchChance) {
      let total = 0;
      const options = [];
      for (const q of ctx.perches ?? []) {
        if (q.taken || q.warm < p.perchWarmMin || this.bans.has(q.id)) continue;
        if (Math.hypot(q.x - this.x, q.z - this.z) > p.perchReach) continue;
        options.push(q);
        total += q.warm;
      }
      if (options.length) {
        let r = this.random() * total;
        const choice = options.find((q) => (r -= q.warm) <= 0) ?? options[options.length - 1];
        this.perchId = choice.id;
        this.mode = 'seek';
        return;
      }
    }
    for (let i = 0; i < 6; i++) {
      const a = this.random() * TAU;
      const r = 2 + this.random() * (p.strollMax - 2);
      const goal = { x: this.x + Math.cos(a) * r, z: this.z + Math.sin(a) * r };
      if (this.allowed(goal.x, goal.z)) {
        this.goal = goal;
        this.mode = 'walk';
        return;
      }
    }
    this.rest();
  }
}

/** How warm a vehicle is to lie on: whichever is more, the heat its metal is holding or the sun on its seat. Nothing when it is wet or snowing. */
export function perchWarmth({ soak = 0, sun = 0, wet = 0, snow = 0 }) {
  const sunny = Math.max(0, sun) * (1 - Math.min(1, wet * 2)) * (1 - Math.min(1, snow * 2)) * 0.9;
  return Math.max(0, Math.min(1, Math.max(soak, sunny)));
}

/** Whether it is too wet, cold or dark for the cat to be out. */
export function catShelter({ rain = 0, snow = 0, temperature = 12, darkness = 0 }, p = DEFAULT_CAT_PARAMS) {
  return rain > p.shelterRain || snow > 0.1 || temperature < p.shelterCold || darkness > p.shelterDark;
}
