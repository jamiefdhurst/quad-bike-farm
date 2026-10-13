// Traffic on the public lane just outside the farm's east hedge, and the visitors who come in through the big gate. Pure: no Three.js, no
// sound. `Drive` is a vehicle following waypoints (it brakes for anything ahead); `Traffic` deals the vehicles that go by and the
// visits; `Visit` is one visitor's trip (the post van's parcel, a neighbour calling) as a list of steps. The game draws it (trafficView.js),
// owns the gate, and gets back events to sound and tell the girls about.

export const DEFAULT_TRAFFIC_PARAMS = {
  passEvery: 160, // s: on average between vehicles going by on the lane by day (0 turns the lane's traffic off)
  nightQuiet: 3, // by night the lane is this many times quieter
  visitEvery: 540, // s: on average between visitors coming in through the gate (0 turns the visitors off)
  firstVisit: 150, // s into a game before the first visitor can set out
  postShare: 0.6, // 0..1 how many visitors are the post van; the rest are a neighbour calling
  leftOpenChance: 0.25, // 0..1 a visitor leaves the gate open behind them
  laneSpeedMin: 11, // m/s: a car or van on the lane
  laneSpeedMax: 17,
  tractorSpeed: 6.5, // m/s: a tractor on the lane
  farmSpeed: 7, // m/s: a visitor on the farm road
  parcelSeconds: 5, // s the post van's driver spends at the barn door
  chatSeconds: 30, // s a neighbour stands about at the barn
  honkAfter: 3, // s a visitor waits behind something in the way before she hoots
};

export const TRAFFIC_PARAM_RANGES = {
  passEvery: [0, 900, 10],
  nightQuiet: [1, 10, 0.5],
  visitEvery: [0, 1800, 30],
  firstVisit: [0, 900, 10],
  postShare: [0, 1, 0.05],
  leftOpenChance: [0, 1, 0.05],
  laneSpeedMin: [5, 25, 0.5],
  laneSpeedMax: [5, 30, 0.5],
  tractorSpeed: [2, 12, 0.5],
  farmSpeed: [2, 14, 0.5],
  parcelSeconds: [1, 20, 1],
  chatSeconds: [5, 90, 5],
  honkAfter: [1, 10, 0.5],
};

/**
 * What goes by on the lane: which model to build (the farm's own vehicles), the paints it comes in, how often it is the one that comes, and
 * its speed (a range in m/s, or null for the params' lane speeds).
 */
export const LANE_KINDS = {
  van: { model: 'defender', colours: [0xe8e8e4, 0x1d3d73, 0x6b7076, 0xf2f0e6], weight: 3, speed: null },
  landy: { model: 'series', colours: [0x3b4a36, 0x7a2a22, 0x8c8f90, 0x2d3f66], weight: 2, speed: null },
  tractor: { model: 'tractor', colours: [0x2f6b34, 0x234d8a, 0xb02a20], weight: 1, speed: 'tractor' },
  utv: { model: 'utv', colours: [0x4f5b3a, 0xb8860b, 0x7a2a22], weight: 1, speed: null },
};

/** The two kinds of visitor: what drives, in what paint, and what they do at the barn. */
export const VISITOR_KINDS = {
  post: { model: 'defender', colour: 0xc8102e, regs: ['G342 TVR'], does: 'parcel' },
  neighbour: { model: 'series', colours: [0x5d6d4a, 0x8a3b2e, 0x3d5a80, 0xc9c3b0], regs: ['L915 HRE', 'F604 WGT', 'M227 BDK', 'E158 NFA'], does: 'chat' }, // not the farm's own
};

const wrap = (a) => ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Heading (0 is +z, as the rest of the game) from (x, z) to (tx, tz). */
export const headingTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

/**
 * A vehicle following waypoints ({ x, z, speed?, stop? }). It steers at a turning circle of `radius`, slows for a sharp turn and for a
 * waypoint it must stop at, and brakes for anything in `blockers` ({ x, z }) in the way ahead of it.
 */
export class Drive {
  constructor({ x, z, yaw = 0, speed = 0, cruise = 8, radius = 4, accel = 2.5, brake = 5 }) {
    Object.assign(this, { x, z, yaw, speed, cruise, radius, accel, brake });
    this.path = [];
    this.waited = 0; // s held up by something in the way
    this.patience = 40; // s it waits for something to move before it edges past regardless
    this.ignoring = 0;
    this.blocked = false;
  }

  go(path) {
    this.path = path.map((p) => ({ ...p }));
  }

  get arrived() {
    return this.path.length === 0;
  }

  /** Whether something in `blockers` is in the way ahead: within a car's length plus the stopping room, and not off to the side. */
  inTheWay(blockers, aim = this.yaw) {
    const reach = 5 + this.speed * 1.2;
    const fx = Math.sin(aim);
    const fz = Math.cos(aim);
    for (const b of blockers) {
      const dx = b.x - this.x;
      const dz = b.z - this.z;
      const ahead = dx * fx + dz * fz;
      const across = Math.abs(dx * fz - dz * fx);
      if (ahead > 0.5 && ahead < reach && across < 1.6) return true;
    }
    return false;
  }

  update(dt, blockers = []) {
    const wp = this.path[0];
    // Looks along where it is heading and along where the next waypoint lies, so a corner doesn't swing it into something it hadn't faced yet.
    const toward = wp ? headingTo(this.x, this.z, wp.x, wp.z) : this.yaw;
    this.blocked = this.ignoring > 0 ? false : this.inTheWay(blockers) || (Math.abs(wrap(toward - this.yaw)) > 0.2 && this.inTheWay(blockers, toward));
    if (this.ignoring > 0) this.ignoring -= dt;
    this.waited = this.blocked && this.speed < 0.3 ? this.waited + dt : 0;
    if (this.waited > this.patience) {
      this.ignoring = 8; // held up too long by something that is not moving: edge past it
      this.waited = 0;
    }
    let want = 0;
    if (wp) {
      const dist = Math.hypot(wp.x - this.x, wp.z - this.z);
      const turn = wrap(headingTo(this.x, this.z, wp.x, wp.z) - this.yaw);
      want = wp.speed ?? this.cruise;
      if (Math.abs(turn) > 0.5) want = Math.min(want, 3.5); // round a corner slowly
      if (wp.stop) want = Math.min(want, Math.sqrt(2 * this.brake * 0.6 * Math.max(0, dist - 0.3)) + 0.4);
      if (this.blocked) want = 0;
      const rate = Math.max(this.speed, 1.5) / this.radius;
      this.yaw = wrap(this.yaw + clamp(turn, -rate * dt, rate * dt));
      if (dist < (wp.stop ? 0.6 : 2.2) || (wp.stop && this.speed < 0.2 && dist < 1.5)) {
        this.path.shift();
        if (wp.stop) {
          this.speed = 0;
          want = 0;
        }
      }
    }
    this.speed = this.speed < want ? Math.min(want, this.speed + this.accel * dt) : Math.max(want, this.speed - this.brake * dt);
    this.x += Math.sin(this.yaw) * this.speed * dt;
    this.z += Math.cos(this.yaw) * this.speed * dt;
  }
}

/** A weighted pick from LANE_KINDS: [id, kind]. */
export function pickKind(random) {
  const total = Object.values(LANE_KINDS).reduce((s, k) => s + k.weight, 0);
  let r = random() * total;
  for (const [id, k] of Object.entries(LANE_KINDS)) {
    r -= k.weight;
    if (r <= 0) return [id, k];
  }
  return Object.entries(LANE_KINDS)[0];
}

const exponential = (random, mean) => -Math.log(1 - random() * 0.999) * mean;

/**
 * Where the lane and the farm road are, from the layout: `lane` { x, halfWidth, minZ, maxZ }, `gate` { x, z } (the big gate in the east
 * hedge), `road` { z, halfWidth, fromX } the farm road, `barn` the stopping spot and the door the visitors go to, `turn` the loop to turn round in.
 */
export function visitPlaces(layout) {
  const lane = layout.publicLane;
  const road = layout.road;
  const gate = { x: layout.farm.maxX, z: road.z };
  const barn = layout.barn;
  const doorZ = barn.z + barn.halfZ;
  return {
    lane,
    gate,
    road,
    outside: { x: gate.x + 3.8, z: gate.z }, // where a vehicle waits outside the gate
    inside: { x: gate.x - 3.8, z: gate.z },
    grid: road.grid?.gateOffset == null ? null : { x: layout.fieldHalf + road.grid.gateOffset, z: road.z }, // the gate just east of the cattle grid
    // The barn's big doors face east, onto the yard; the wrapped silage is stacked beside its west wall, the bell
    // is by the north leaf and the second span's door is at z + 9.2. The vehicle stops east of the door, facing west, and turns round to the south, clear of both.
    stop: { x: barn.x + 14, z: barn.z + 7.5 },
    door: { x: barn.x + barn.halfX + 1.8, z: barn.z + 2.6 }, // where the driver goes
    parcel: { x: barn.x + barn.halfX + 1.4, z: barn.z + 4.2 },
    turn: { z0: barn.z + 7.5, z1: barn.z + 14.5, r: 3.5, dx: 4 },
  };
}

/** The lane x for a vehicle heading `dir` (+1 south, towards +z, -1 north): the left of the road, as it is here. */
export const laneX = (lane, dir) => lane.x + (dir > 0 ? 1 : -1) * lane.halfWidth * 0.48;

/**
 * The steps of one visit, in order. `from` is the way it comes in (+1 heading south, -1 north), `to` the way it leaves, `leaveOpen` whether
 * the gate is left open on the way out. Steps: drive { path }, exit / enter (the driver gets out or in), walk { to }, gate { open, at }
 * (the driver walks to the gate and swings it; only if it is not already so; `gate: 'grid'` is the one by the cattle grid), wait { seconds, event }.
 */
export function planVisit({ places, from, to, does, leaveOpen, farmSpeed }) {
  const { lane, gate, road, outside, inside, stop, door, turn, grid } = places;
  const steps = [];
  const sp = (p) => ({ ...p, speed: farmSpeed });
  // In along the lane, turn across it into the gateway and stop outside the gate.
  steps.push({
    type: 'drive',
    path: [
      { x: laneX(lane, from), z: gate.z - from * 16 },
      { x: lane.x - 0.8, z: gate.z - from * 6, speed: 5 },
      { x: outside.x + 1.2, z: gate.z, speed: 4 },
      { ...outside, stop: true },
    ],
  });
  const gateWalk = (side) => ({ x: gate.x + side * 2.4, z: gate.z + 3.4 });
  steps.push({ type: 'gate', open: true, at: gateWalk(1), side: 'out' });
  // Through the gate and along the farm road on the left (heading west, that is the south side).
  const inZ = road.z + 1;
  // The gate by the cattle grid: stop short of it, the driver opens it, and after the grid she shuts it behind her. `from` is the side she
  // is coming from (+1 east, -1 west). The driver stands on the grid's side of the gate.
  const gridGate = (open) => ({ type: 'gate', gate: 'grid', open, at: { x: grid.x - 1, z: grid.z + 4.4 }, side: open ? 'out' : 'in' });
  const east = grid ? grid.x + 5 : 0;
  const west = grid ? grid.x - 5.5 : 0;
  steps.push({
    type: 'drive',
    path: [
      sp({ x: gate.x - 2, z: gate.z, speed: 4 }),
      sp({ x: gate.x - 14, z: inZ }),
      ...(grid ? [sp({ x: east, z: inZ, stop: true })] : [sp({ x: road.fromX + 6, z: inZ })]),
    ],
  });
  if (grid) {
    steps.push(gridGate(true));
    steps.push({ type: 'drive', path: [sp({ x: west, z: inZ, stop: true })] });
    steps.push(gridGate(false));
  }
  steps.push({
    type: 'drive',
    path: [
      sp({ x: road.fromX - 6, z: inZ }), // through the cattle grid's gateway in the grass field's east hedge, not the hedge
      sp({ x: (road.fromX + stop.x) / 2 + 10, z: (inZ + stop.z) / 2 - 2 }),
      { x: stop.x + 8, z: stop.z, speed: 4 },
      { ...stop, stop: true },
    ],
  });
  steps.push({ type: 'event', event: 'arrived' });
  steps.push({ type: 'exit' });
  steps.push({ type: 'walk', to: [door] });
  steps.push({ type: 'wait', seconds: does === 'parcel' ? 'parcelSeconds' : 'chatSeconds', event: does === 'parcel' ? 'parcel' : 'chat', at: door });
  steps.push({ type: 'walk', to: [{ x: stop.x - 0.2, z: stop.z - 1.4 }] });
  steps.push({ type: 'enter' });
  // Round the loop to face east again, and back out along the road on the other side.
  const cx = stop.x - turn.dx;
  const mid = (turn.z0 + turn.z1) / 2;
  steps.push({
    type: 'drive',
    path: [
      { x: cx, z: turn.z0, speed: 4 },
      { x: cx - turn.r, z: mid, speed: 3.5 },
      { x: cx, z: turn.z1, speed: 4 },
      { x: stop.x + 6, z: turn.z1 - 1, speed: 5 },
      sp({ x: (road.fromX + stop.x) / 2, z: (road.z - 1 + stop.z) / 2 }),
      sp({ x: grid ? west : road.fromX - 6, z: road.z - 1, stop: !!grid }),
    ],
  });
  if (grid) {
    steps.push({ ...gridGate(true), if: 'shut' });
    steps.push({ type: 'drive', path: [sp({ x: east, z: road.z - 1, stop: true })] });
    steps.push(gridGate(false));
  }
  steps.push({
    type: 'drive',
    path: [
      sp({ x: road.fromX + 6, z: road.z - 1 }),
      sp({ x: gate.x - 14, z: road.z - 1 }),
      { x: inside.x, z: gate.z - 0.5, speed: 4 },
    ],
  });
  steps.push({ type: 'gate', open: true, at: { x: gate.x - 2.4, z: gate.z - 3.4 }, side: 'in', if: 'shut' });
  steps.push({
    type: 'drive',
    path: [{ x: gate.x + 2, z: gate.z, speed: 4 }, { ...outside, stop: !leaveOpen, speed: 4 }],
  });
  if (!leaveOpen) steps.push({ type: 'gate', open: false, at: gateWalk(1), side: 'out' });
  else steps.push({ type: 'event', event: 'leftOpen' });
  steps.push({
    type: 'drive',
    path: [
      { x: outside.x + 1.5, z: gate.z, speed: 4 },
      { x: laneX(lane, to) - to * 0.3, z: gate.z + to * 6, speed: 5 },
      { x: laneX(lane, to), z: gate.z + to * 18 },
      { x: laneX(lane, to), z: to > 0 ? lane.maxZ + 20 : lane.minZ - 20 },
    ],
  });
  return steps;
}

/**
 * One visit under way. `gate` is told in ctx on each update: { isOpen, set(open) -> boolean }. The vehicle is `drive`; the driver is `driver`
 * ({ mode: 'seat' | 'foot', x, z, heading, walking }). Events come back from update(): arrived, parcel, chat, gate (opened/shut), honk, leftOpen, done.
 */
export class Visit {
  constructor({ kind, places, from, to, leaveOpen, params, colour, reg = null }) {
    this.kind = kind;
    this.reg = reg ?? VISITOR_KINDS[kind].regs[0];
    this.colour = colour;
    this.params = params;
    this.places = places;
    this.leaveOpen = leaveOpen;
    this.from = from;
    const spec = VISITOR_KINDS[kind];
    this.model = spec.model;
    this.steps = planVisit({ places, from, to, does: spec.does, leaveOpen, farmSpeed: params.farmSpeed });
    const lane = places.lane;
    const startZ = from > 0 ? lane.minZ - 10 : lane.maxZ + 10;
    this.drive = new Drive({ x: laneX(lane, from), z: startZ, yaw: from > 0 ? 0 : Math.PI, speed: 10, cruise: 12 });
    this.driver = { mode: 'seat', x: 0, z: 0, heading: 0, walking: false };
    this.step = -1;
    this.t = 0;
    this.openedByVisitor = false;
    this.done = false;
    this.next();
  }

  get current() {
    return this.steps[this.step] ?? null;
  }

  next() {
    this.step++;
    this.t = 0;
    const s = this.current;
    if (!s) return;
    if (s.type === 'drive') this.drive.go(s.path);
    else this.drive.speed = 0; // anything but driving has the vehicle stood
  }

  /** The place beside the vehicle's driver door that she climbs out at, and the seat she climbs back into. */
  doorSpot() {
    const d = this.drive;
    return { x: d.x - Math.cos(d.yaw) * 1.45, z: d.z + Math.sin(d.yaw) * 1.45 };
  }

  /** Walks the driver towards (x, z); true once there. */
  walkTo(dt, x, z) {
    const d = this.driver;
    const dx = x - d.x;
    const dz = z - d.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.15) {
      d.walking = false;
      return true;
    }
    d.heading = Math.atan2(dx, dz);
    const step = Math.min(dist, 1.5 * dt);
    d.x += (dx / dist) * step;
    d.z += (dz / dist) * step;
    d.walking = true;
    return false;
  }

  update(dt, ctx) {
    const events = [];
    if (this.done) return events;
    const s = this.current;
    if (!s) {
      this.done = true;
      events.push({ type: 'done' });
      return events;
    }
    this.t += dt;
    if (s.type === 'drive') {
      this.drive.update(dt, ctx.blockers ?? []);
      if (this.drive.waited > this.params.honkAfter && (this.honkedAt === undefined || this.t - this.honkedAt > 6)) {
        this.honkedAt = this.t;
        events.push({ type: 'honk', x: this.drive.x, z: this.drive.z });
      }
      if (this.drive.arrived) {
        this.next();
      }
    } else if (s.type === 'event') {
      events.push({ type: s.event, x: this.drive.x, z: this.drive.z });
      this.next();
    } else if (s.type === 'exit') {
      const at = this.doorSpot();
      Object.assign(this.driver, { mode: 'foot', x: at.x, z: at.z, heading: this.drive.yaw });
      this.next();
    } else if (s.type === 'enter') {
      this.driver.mode = 'seat';
      this.driver.walking = false;
      this.next();
    } else if (s.type === 'walk') {
      if (this.walkTo(dt, s.to[0].x, s.to[0].z)) this.next();
    } else if (s.type === 'wait') {
      this.driver.walking = false;
      const secs = typeof s.seconds === 'string' ? this.params[s.seconds] : s.seconds;
      if (this.t === dt) events.push({ type: s.event, x: s.at.x, z: s.at.z });
      if (this.t >= secs) this.next();
    } else if (s.type === 'gate') this.gateStep(dt, s, ctx, events);
    return events;
  }

  /** Gets out, walks to the gate, swings it, walks back and gets in. Skipped if the gate is already as asked (an `if: 'shut'` one only when shut). */
  gateStep(dt, s, ctx, events) {
    const d = this.driver;
    const g = s.gate ? ctx.gates?.[s.gate] : ctx.gate;
    if (!g) return this.next(); // a gate this stand-in world has not got
    if (!s.phase) {
      const needed = g.isOpen !== s.open && (s.if !== 'shut' || !g.isOpen);
      if (!needed) return this.next();
      s.phase = 'out';
      const at = this.doorSpot();
      Object.assign(d, { mode: 'foot', x: at.x, z: at.z, heading: this.drive.yaw });
    }
    if (s.phase === 'out') {
      if (this.walkTo(dt, s.at.x, s.at.z)) {
        s.phase = 'swing';
        s.swungAt = this.t;
        if (g.set(s.open)) {
          events.push({ type: 'gate', open: s.open, which: s.gate ?? 'road' });
          if (s.open && !s.gate) this.openedByVisitor = true;
        } else s.phase = 'back'; // something in the way of shutting it: leave it
      }
    } else if (s.phase === 'swing') {
      d.walking = false;
      if (this.t - s.swungAt > ctx.swingSeconds) s.phase = 'back';
    } else if (s.phase === 'back') {
      const at = this.doorSpot();
      if (this.walkTo(dt, at.x, at.z)) {
        d.mode = 'seat';
        d.walking = false;
        s.phase = null;
        s.done = true;
        this.next();
      }
    }
  }
}

/** The lane's traffic and the visitors: when the next vehicle goes by, when a visitor sets out, and what is on the lane now. */
export class Traffic {
  constructor({ places, params = DEFAULT_TRAFFIC_PARAMS, random = Math.random }) {
    this.places = places;
    this.p = params;
    this.random = random;
    this.vehicles = []; // going by: { id, kind, colour, dir, drive }
    this.visit = null;
    this.clock = 0;
    this.nextPass = exponential(random, Math.max(1, params.passEvery)) * 0.5;
    this.nextVisit = params.firstVisit + exponential(random, Math.max(1, params.visitEvery) * 0.5);
    this.count = 0;
    this.forcedVisit = null;
  }

  /** Sets a vehicle off along the lane now (the debug panel's button, and the timer). `kind` a LANE_KINDS id, or random. */
  spawnPass(kind) {
    const lane = this.places.lane;
    const [id, spec] = kind && LANE_KINDS[kind] ? [kind, LANE_KINDS[kind]] : pickKind(this.random);
    const dir = this.random() < 0.5 ? 1 : -1;
    const p = this.p;
    const speed = spec.speed === 'tractor' ? p.tractorSpeed : p.laneSpeedMin + this.random() * Math.max(0, p.laneSpeedMax - p.laneSpeedMin);
    const z0 = dir > 0 ? lane.minZ - 12 : lane.maxZ + 12;
    const z1 = dir > 0 ? lane.maxZ + 30 : lane.minZ - 30;
    const drive = new Drive({ x: laneX(lane, dir), z: z0, yaw: dir > 0 ? 0 : Math.PI, speed, cruise: speed });
    drive.go([{ x: laneX(lane, dir), z: z1, speed }]);
    const colour = spec.colours[Math.floor(this.random() * spec.colours.length)];
    const v = { id: ++this.count, kind: id, model: spec.model, colour, dir, drive, passed: false };
    this.vehicles.push(v);
    return v;
  }

  /** Sets a visitor off now, if there is not one: `kind` 'post' or 'neighbour', or random. `leaveOpen` forces the gate's fate. */
  startVisit(kind, leaveOpen) {
    if (this.visit) return null;
    const k = VISITOR_KINDS[kind] ? kind : this.random() < this.p.postShare ? 'post' : 'neighbour';
    const spec = VISITOR_KINDS[k];
    const colour = spec.colour ?? spec.colours[Math.floor(this.random() * spec.colours.length)];
    const from = this.random() < 0.5 ? 1 : -1;
    const to = this.random() < 0.5 ? 1 : -1;
    this.visit = new Visit({
      kind: k,
      places: this.places,
      from,
      to,
      leaveOpen: leaveOpen ?? this.random() < this.p.leftOpenChance,
      params: this.p,
      colour,
      reg: spec.regs[Math.floor(this.random() * spec.regs.length)],
    });
    return this.visit;
  }

  /**
   * Moves everything on. ctx: darkness (0..1), blockers ([{ x, z }]: you, the quads, the girls), gate ({ isOpen, set }), gates ({ grid: the same, for the gate by the cattle grid }), swingSeconds.
   * Returns events: { type: 'pass', vehicle } when one goes by the gate, { type: 'gone', vehicle }, { type: 'visit', visit } as one sets
   * off, and the visit's own.
   */
  update(dt, ctx) {
    const events = [];
    const p = this.p;
    this.clock += dt;
    const quiet = 1 + (p.nightQuiet - 1) * (ctx.darkness ?? 0);
    if (p.passEvery > 0 && this.vehicles.length < 3) {
      this.nextPass -= dt;
      if (this.nextPass <= 0) {
        this.spawnPass();
        this.nextPass = exponential(this.random, p.passEvery * quiet);
      }
    }
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      v.drive.update(dt, ctx.blockers ?? []);
      if (!v.passed && Math.abs(v.drive.z - this.places.gate.z) < v.drive.speed * dt + 1) {
        v.passed = true;
        events.push({ type: 'pass', vehicle: v });
      }
      if (v.drive.arrived) {
        this.vehicles.splice(i, 1);
        events.push({ type: 'gone', vehicle: v });
      }
    }
    if (!this.visit && p.visitEvery > 0 && this.clock > p.firstVisit) {
      this.nextVisit -= dt;
      if (this.nextVisit <= 0 && (ctx.darkness ?? 0) < 0.7) {
        const v = this.startVisit();
        if (v) events.push({ type: 'visit', visit: v });
        this.nextVisit = exponential(this.random, p.visitEvery);
      }
    }
    if (this.visit) {
      for (const e of this.visit.update(dt, ctx)) {
        events.push(e);
        if (e.type === 'done') {
          events.push({ type: 'visitEnded', visit: this.visit });
          this.visit = null;
        }
      }
    }
    return events;
  }
}
