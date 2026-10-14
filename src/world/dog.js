// The farm dog, Meg, a border collie: she follows you at a loose distance, sits when you stop, sniffs about, hops up on the rear rack of the
// quad you are on when you pull up (and down again when you get off), chases quads and the girls going by, and nips at a girl's heels as
// she walks. Pure: no Three.js and no sound. The game says what is around each step (`ctx`) and gets back events to sound and tell the
// girls about.
//
// ctx = { owner: { x, z, speed }, rack, vehicles: [{ id, x, z, speed, yaw, driver }], girls: [{ id, x, z, yaw, speed }] }
//   owner: you (on foot, or on a quad: its position): { x, z, speed, yaw, riding }.
//   rack: the rear rack of the quad you are on, or null if you are on foot or the quad has none: { id, x, y, z, yaw, ok }; `ok` is false
//     when something else is in the way (a girl sat on the back).
//   vehicles: every vehicle but yours. `driver` is the id of the girl at the controls, or null.
//   girls: the girls on foot (anything else leaves them out): `speed` is how fast she is walking.

export const DEFAULT_DOG_PARAMS = {
  enabled: 1, // 0 or 1: whether there is a dog (read when the game is dealt)
  walkSpeed: 1.3, // m/s wandering about while you stand still
  trotSpeed: 3.2, // m/s following you at your heels
  runSpeed: 7.5, // m/s catching you up, chasing
  sprintSpeed: 13, // m/s when she is a long way behind a quad
  followMin: 4, // m from you at which she stops coming after you and goes back to her own business
  followMax: 12, // m from you before she comes after you
  sprintFrom: 22, // m behind you at which she runs flat out
  wanderMax: 10, // m furthest she mooches from you while you are about
  sitDelay: 3, // s she stands before she sits
  sitMin: 6, // s sat or stood about, at least
  sitMax: 20, // s sat or stood about, at most
  sniffMin: 2, // s nose down, at least
  sniffMax: 5, // s nose down, at most
  hopWait: 1.2, // s you have been stopped on a quad before she goes for the rack
  hopReach: 30, // m furthest she will come to get on
  hopSeconds: 0.55, // s a hop up or down takes
  rideBan: 6, // s after she gets down before she will get back on
  chaseReach: 28, // m of a vehicle that makes her think of chasing it
  chaseMinSpeed: 3, // m/s a vehicle has to be going to be worth chasing
  chaseRate: 0.12, // chance a second, when one is going by, that she goes after it
  chaseSeconds: 9, // s she keeps at it
  chaseCooldown: 35, // s before she chases again
  chaseSide: 3, // m she runs to the side of what she chases
  bootsReach: 14, // m of a girl walking that makes her go after her heels
  bootsRate: 0.08, // chance a second that she goes after a walking girl's boots
  bootsSeconds: 8, // s she worries at her heels
  barkEvery: 1.1, // s between barks while she chases
  dodgeRadius: 2, // m ahead of a vehicle she has to be to jump out of its way
  dodgeSpeedReach: 0.9, // extra metres of that per m/s of its speed
  lostDistance: 120, // m from you before she is put back near you
  stuckSeconds: 3, // s held up against a hedge or wall, far from you, before she is put near you
};

export const DOG_PARAM_RANGES = {
  enabled: [0, 1, 1],
  walkSpeed: [0.4, 2.5, 0.05],
  trotSpeed: [1, 5, 0.1],
  runSpeed: [3, 12, 0.25],
  sprintSpeed: [6, 20, 0.5],
  followMin: [1, 6, 0.25],
  followMax: [3, 20, 0.5],
  sprintFrom: [8, 60, 1],
  wanderMax: [2, 15, 0.5],
  sitDelay: [0, 15, 0.5],
  sitMin: [1, 40, 0.5],
  sitMax: [2, 90, 0.5],
  sniffMin: [0.5, 10, 0.5],
  sniffMax: [1, 20, 0.5],
  hopWait: [0, 8, 0.1],
  hopReach: [5, 80, 1],
  hopSeconds: [0.2, 1.5, 0.05],
  rideBan: [0, 60, 1],
  chaseReach: [5, 80, 1],
  chaseMinSpeed: [0.5, 12, 0.5],
  chaseRate: [0, 1, 0.01],
  chaseSeconds: [2, 40, 1],
  chaseCooldown: [0, 180, 5],
  chaseSide: [1.5, 8, 0.25],
  bootsReach: [3, 40, 1],
  bootsRate: [0, 1, 0.01],
  bootsSeconds: [2, 30, 1],
  barkEvery: [0.3, 5, 0.1],
  dodgeRadius: [0.5, 6, 0.25],
  dodgeSpeedReach: [0, 3, 0.1],
  lostDistance: [30, 400, 5],
  stuckSeconds: [1, 15, 0.5],
};

const TAU = Math.PI * 2;
const angleDiff = (a, b) => ((((b - a) % TAU) + 3 * Math.PI) % TAU) - Math.PI;
const pick = (random, lo, hi) => lo + random() * Math.max(0, hi - lo);

/** The modes she cannot be called off: on the rack, getting on or off, or out of the way of a vehicle. */
const COMMITTED = ['hop', 'ride', 'down', 'dodge'];

export class Dog {
  /** `allowed(x, z)` where she may go; `groundAt(x, z)` the ground's height. */
  constructor({ allowed, groundAt = () => 0, random = Math.random, params = { ...DEFAULT_DOG_PARAMS } }) {
    this.allowed = allowed;
    this.groundAt = groundAt;
    this.random = random;
    this.p = params;
    this.x = 0;
    this.z = 0;
    this.y = this.groundAt(0, 0);
    this.yaw = 0;
    this.speed = 0;
    this.mode = 'idle'; // idle, wander, sniff, follow, seek, hop, ride, down, chase, nip or dodge
    this.t = 1; // seconds left in the mode (idle, sniff, chase, nip)
    this.idleFor = 0; // seconds in idle so far: she stands, then sits
    this.goal = null;
    this.target = null; // id of what she is chasing: a vehicle's or a girl's
    this.jump = null; // { from, to, t, up }
    this.rackId = null; // the quad she is on, or going to
    this.lastRack = null; // where she sat on the last frame, for getting down once the quad has gone from under you
    this.stillFor = 0; // seconds you have been stopped on a quad
    this.banned = 0; // seconds before she will get on a rack again
    this.chaseCool = 0;
    this.stuck = 0;
    this.barkIn = 0;
    this.phase = 0;
  }

  place(x, z) {
    this.x = x;
    this.z = z;
    this.y = this.groundAt(x, z);
    this.mode = 'idle';
    this.t = 2;
    this.idleFor = 0;
    this.goal = null;
    this.jump = null;
    this.speed = 0;
    this.rackId = null;
  }

  /** What the view shows: 'run', 'trot', 'walk', 'stand', 'sit', 'sniff', 'ride' or 'jump'. */
  get pose() {
    switch (this.mode) {
      case 'chase': case 'nip': case 'dodge': return 'run';
      case 'follow': return this.speed > this.p.trotSpeed + 0.5 ? 'run' : this.speed > 0.2 ? 'trot' : 'stand';
      case 'seek': return 'trot';
      case 'wander': return 'walk';
      case 'sniff': return 'sniff';
      case 'hop': case 'down': return 'jump';
      case 'ride': return 'ride';
      default: return this.idleFor > this.p.sitDelay ? 'sit' : 'stand';
    }
  }

  /** Whether she is sat on a quad's rack (or getting on). */
  get riding() {
    return this.mode === 'ride' || (this.mode === 'hop' && this.jump?.up);
  }

  get panting() {
    return this.pose === 'run' && this.speed > 4;
  }

  /** Puts her on the rack at once (the debug panel's). */
  mount(rack) {
    this.rackId = rack.id;
    this.lastRack = rack;
    this.x = rack.x;
    this.z = rack.z;
    this.y = rack.y;
    this.yaw = rack.yaw;
    this.mode = 'ride';
    this.jump = null;
    this.speed = 0;
  }

  at() {
    return { x: this.x, y: this.y, z: this.z };
  }

  /** Sets her after a vehicle or a girl's heels now (the debug panel's), whatever she was up to except riding. Returns the event. */
  start(kind, id, ctx) {
    if (this.riding || this.mode === 'down') return null;
    this.mode = kind;
    this.target = id;
    this.t = kind === 'chase' ? this.p.chaseSeconds : this.p.bootsSeconds;
    this.barkIn = 0;
    this.rackId = null;
    const v = kind === 'chase' ? ctx.vehicles.find((q) => q.id === id) : null;
    return kind === 'chase' ? { kind, id, girl: v?.driver ?? null, ...this.at() } : { kind, id, ...this.at() };
  }

  update(dt, ctx) {
    const events = [];
    this.phase += dt;
    this.banned = Math.max(0, this.banned - dt);
    this.chaseCool = Math.max(0, this.chaseCool - dt);
    this.barkIn -= dt;
    const o = ctx.owner;
    const still = o.speed < 0.6;
    this.stillFor = ctx.rack && still ? this.stillFor + dt : 0;

    if (!COMMITTED.includes(this.mode)) this.watchTraffic(ctx, events);
    this.step(dt, ctx, events);
    if (!this.riding && this.mode !== 'down') this.y += (this.groundAt(this.x, this.z) - this.y) * Math.min(1, dt * 12);
    return events;
  }

  /** A vehicle coming straight at her: she jumps clear. */
  watchTraffic(ctx, events) {
    const p = this.p;
    const o = ctx.owner;
    for (const v of o.riding ? [...ctx.vehicles, o] : ctx.vehicles) { // your own quad too, if you are on one
      if (v.speed < 1.5) continue;
      const fx = Math.sin(v.yaw);
      const fz = Math.cos(v.yaw);
      const rx = this.x - v.x;
      const rz = this.z - v.z;
      const ahead = rx * fx + rz * fz;
      const lateral = rx * fz - rz * fx;
      if (ahead < 0 || ahead > p.dodgeRadius + v.speed * p.dodgeSpeedReach || Math.abs(lateral) > 1.6) continue;
      const side = lateral >= 0 ? 1 : -1;
      const gx = this.x + fz * side * 5;
      const gz = this.z - fx * side * 5;
      this.goal = this.allowed(gx, gz) ? { x: gx, z: gz } : { x: this.x - fz * side * 5, z: this.z + fx * side * 5 };
      this.mode = 'dodge';
      this.t = 2;
      events.push({ kind: 'yelp', ...this.at() });
      return;
    }
  }

  /** Walks toward `goal` at `speed`, sliding along an obstacle; true once there. Counts the time held up. */
  walkTo(goal, speed, dt, turn = 10) {
    const dx = goal.x - this.x;
    const dz = goal.z - this.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.3) {
      this.speed = 0;
      return true;
    }
    this.yaw += angleDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * turn);
    const step = Math.min(d, speed * dt);
    const sx = (dx / d) * step;
    const sz = (dz / d) * step;
    if (this.allowed(this.x + sx, this.z + sz)) {
      this.x += sx;
      this.z += sz;
    } else if (this.allowed(this.x + sx, this.z)) this.x += sx;
    else if (this.allowed(this.x, this.z + sz)) this.z += sz;
    else {
      this.speed = 0;
      this.stuck += dt;
      return false;
    }
    this.speed = speed;
    this.stuck = 0;
    return false;
  }

  /** Back beside you, behind and to a side, on ground she may stand on. */
  catchUp(o) {
    for (let i = 0; i < 12; i++) {
      const a = this.random() * TAU;
      const r = 5 + this.random() * 6;
      const x = o.x + Math.cos(a) * r;
      const z = o.z + Math.sin(a) * r;
      if (this.allowed(x, z)) {
        this.place(x, z);
        return true;
      }
    }
    return false;
  }

  step(dt, ctx, events) {
    const p = this.p;
    const o = ctx.owner;
    const d = Math.hypot(o.x - this.x, o.z - this.z);
    switch (this.mode) {
      case 'ride': {
        const r = ctx.rack;
        if (r && r.ok && r.id === this.rackId) {
          this.lastRack = r;
          this.x = r.x;
          this.y = r.y;
          this.z = r.z;
          this.yaw = r.yaw;
          this.speed = 0;
        } else this.getDown(events); // you have got off, or something is sat there
        return;
      }
      case 'hop': return this.stepJump(dt, ctx, events);
      case 'down': return this.stepJump(dt, ctx, events);
      case 'dodge':
        this.t -= dt;
        if (this.walkTo(this.goal, p.runSpeed * 1.1, dt, 16) || this.t <= 0) this.settle();
        return;
      default: break;
    }

    // Lost: too far behind, or held up against something for too long when she is a way off.
    if (d > p.lostDistance || (this.stuck > p.stuckSeconds && d > 12)) {
      this.stuck = 0;
      if (this.catchUp(o)) return;
    }

    // Onto the rack: you are stopped on a quad that has one.
    if (ctx.rack?.ok && this.banned <= 0 && this.stillFor > p.hopWait && d < p.hopReach && !['chase', 'nip'].includes(this.mode)) {
      this.mode = 'seek';
      this.rackId = ctx.rack.id;
    }
    if (this.mode === 'seek') {
      const r = ctx.rack;
      if (!r || !r.ok || r.id !== this.rackId || this.stillFor < p.hopWait * 0.5 || this.banned > 0) return this.settle();
      const near = Math.hypot(r.x - this.x, r.z - this.z);
      this.walkTo(r, near > 12 ? p.runSpeed : p.trotSpeed, dt, 12);
      if (this.stuck > 1.5) {
        this.banned = p.rideBan; // can't get to it from here
        return this.settle();
      }
      if (near < 1.1) {
        this.jump = { from: this.at(), to: { x: r.x, y: r.y, z: r.z }, t: 0, up: true };
        this.mode = 'hop';
        this.speed = 0;
        events.push({ kind: 'bark', ...this.at(), excited: true });
      }
      return;
    }

    if (this.mode === 'chase') return this.stepChase(dt, ctx, events);
    if (this.mode === 'nip') return this.stepNip(dt, ctx, events);

    // Something worth going after.
    if (this.chaseCool <= 0 && d < p.followMax * 3) {
      const v = ctx.vehicles.find((q) => q.speed > p.chaseMinSpeed && Math.hypot(q.x - this.x, q.z - this.z) < p.chaseReach && this.random() < p.chaseRate * dt);
      if (v) return void events.push(this.start('chase', v.id, ctx));
      const g = ctx.girls.find((q) => q.speed > 0.5 && Math.hypot(q.x - this.x, q.z - this.z) < p.bootsReach && this.random() < p.bootsRate * dt);
      if (g) return void events.push(this.start('nip', g.id, ctx));
    }

    // Following you, or mooching about while you stand.
    // Only when you have got well away from her: otherwise she has her own business (a sit, a sniff, a mooch about).
    if (d > p.followMax || (this.mode === 'follow' && d > p.followMin)) {
      this.mode = 'follow';
      const far = d > p.sprintFrom;
      const speed = far ? p.sprintSpeed : d > p.followMax * 1.5 || o.speed > p.trotSpeed ? p.runSpeed : p.trotSpeed;
      // Heads for a point just behind you rather than the middle of you.
      const back = Math.min(p.followMin * 0.7, d);
      const gx = o.x - ((o.x - this.x) / (d || 1)) * back;
      const gz = o.z - ((o.z - this.z) / (d || 1)) * back;
      this.walkTo({ x: gx, z: gz }, speed, dt, 12);
      return;
    }
    if (this.mode === 'follow') this.settle();

    switch (this.mode) {
      case 'idle':
        this.speed = 0;
        this.idleFor += dt;
        this.t -= dt;
        if (d > 1.5) this.yaw += angleDiff(this.yaw, Math.atan2(o.x - this.x, o.z - this.z)) * Math.min(1, dt * 1.5); // watches you
        if (this.t <= 0) this.decide(ctx);
        break;
      case 'wander':
        if (this.walkTo(this.goal, p.walkSpeed, dt) || this.stuck > 1.5) {
          this.stuck = 0;
          this.mode = 'sniff';
          this.t = pick(this.random, p.sniffMin, p.sniffMax);
        }
        break;
      case 'sniff':
        this.speed = 0;
        this.t -= dt;
        if (this.t <= 0) this.settle();
        break;
      default: break;
    }
  }

  /** Sits or stands about for a bit. */
  settle() {
    this.mode = 'idle';
    this.t = pick(this.random, this.p.sitMin, this.p.sitMax);
    this.idleFor = 0;
    this.speed = 0;
    this.goal = null;
    this.target = null;
  }

  /** Time stood about is over: a mooch about near you, or a sniff where she is. */
  decide(ctx) {
    const p = this.p;
    const o = ctx.owner;
    for (let i = 0; i < 6; i++) {
      const a = this.random() * TAU;
      const r = 1.5 + this.random() * (p.wanderMax - 1.5);
      const goal = { x: o.x + Math.cos(a) * r, z: o.z + Math.sin(a) * r };
      if (this.allowed(goal.x, goal.z)) {
        this.goal = goal;
        this.mode = 'wander';
        return;
      }
    }
    this.mode = 'sniff';
    this.t = pick(this.random, p.sniffMin, p.sniffMax);
  }

  /** Runs beside what she is chasing, a few metres off its line, barking, until she tires of it. */
  stepChase(dt, ctx, events) {
    const p = this.p;
    const v = ctx.vehicles.find((q) => q.id === this.target);
    this.t -= dt;
    if (!v || v.speed < 1 || this.t <= 0 || Math.hypot(ctx.owner.x - this.x, ctx.owner.z - this.z) > p.followMax * 6) return this.giveUp();
    const side = Math.sign(angleDiff(v.yaw, Math.atan2(this.x - v.x, this.z - v.z))) || 1;
    const gx = v.x + Math.cos(v.yaw) * side * p.chaseSide - Math.sin(v.yaw) * 1.5;
    const gz = v.z - Math.sin(v.yaw) * side * p.chaseSide - Math.cos(v.yaw) * 1.5;
    this.walkTo({ x: gx, z: gz }, v.speed > p.runSpeed ? p.sprintSpeed : p.runSpeed, dt, 14);
    this.bark(events);
    if (this.stuck > 1.5) this.giveUp();
  }

  /** Weaves behind a walking girl, at her heels. */
  stepNip(dt, ctx, events) {
    const p = this.p;
    const g = ctx.girls.find((q) => q.id === this.target);
    this.t -= dt;
    if (!g || this.t <= 0) return this.giveUp();
    const sway = Math.sin(this.phase * 3) * 0.9;
    const gx = g.x - Math.sin(g.yaw) * 0.9 + Math.cos(g.yaw) * sway;
    const gz = g.z - Math.cos(g.yaw) * 0.9 - Math.sin(g.yaw) * sway;
    this.walkTo({ x: gx, z: gz }, Math.max(p.trotSpeed, g.speed * 1.5), dt, 12);
    this.bark(events);
    if (this.stuck > 1.5) this.giveUp();
  }

  bark(events) {
    if (this.barkIn > 0) return;
    this.barkIn = this.p.barkEvery * (0.8 + this.random() * 0.4);
    events.push({ kind: 'bark', ...this.at(), excited: false });
  }

  giveUp() {
    this.chaseCool = this.p.chaseCooldown;
    this.settle();
    this.idleFor = this.p.sitDelay; // panting, sat down at once
  }

  /** Off the rack to the ground beside where it was. */
  getDown(events) {
    const r = this.lastRack ?? { x: this.x, y: this.y, z: this.z, yaw: this.yaw };
    const side = this.random() < 0.5 ? 1 : -1;
    let to = { x: r.x + Math.cos(r.yaw) * side * 1.1, z: r.z - Math.sin(r.yaw) * side * 1.1 };
    if (!this.allowed(to.x, to.z)) to = { x: r.x - Math.cos(r.yaw) * side * 1.1, z: r.z + Math.sin(r.yaw) * side * 1.1 };
    if (!this.allowed(to.x, to.z)) to = { x: r.x - Math.sin(r.yaw) * 1.4, z: r.z - Math.cos(r.yaw) * 1.4 };
    this.jump = { from: this.at(), to: { x: to.x, y: this.groundAt(to.x, to.z), z: to.z }, t: 0, up: false };
    this.mode = 'down';
    this.banned = this.p.rideBan;
    this.rackId = null;
    events.push({ kind: 'down', ...this.at() });
  }

  stepJump(dt, ctx, events) {
    const j = this.jump;
    j.t += dt / Math.max(0.1, this.p.hopSeconds);
    const k = Math.min(1, j.t);
    const to = j.up && ctx.rack?.id === this.rackId ? { x: ctx.rack.x, y: ctx.rack.y, z: ctx.rack.z } : j.to; // the rack moves if the quad rolls
    const arc = Math.sin(k * Math.PI) * 0.3;
    this.x = j.from.x + (to.x - j.from.x) * k;
    this.z = j.from.z + (to.z - j.from.z) * k;
    this.y = j.from.y + (to.y - j.from.y) * k + arc;
    if (ctx.rack && j.up) this.yaw += angleDiff(this.yaw, ctx.rack.yaw) * Math.min(1, dt * 8);
    if (k < 1) return;
    this.jump = null;
    if (j.up) {
      if (ctx.rack?.ok && ctx.rack.id === this.rackId) {
        this.mode = 'ride';
        this.lastRack = ctx.rack;
        events.push({ kind: 'mounted', id: this.rackId, ...this.at() });
      } else this.getDown(events); // the quad has gone from under her
    } else {
      this.y = j.to.y;
      this.settle();
    }
  }
}
