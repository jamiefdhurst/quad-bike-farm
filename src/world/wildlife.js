// Wildlife on the farm: rabbits on the grass that sit up, hop about and bolt for the hedge when a quad or a person comes, and freeze
// in the headlights after dark until you are almost on them; and pheasants hidden at the foot of the hedges that burst out under your
// wheels, clattering off over the field. Pure: no Three.js and no sound. The game says where they may be (`allowed`, `spots`), what
// threatens them each step, and gets back the events (a bolt, a burst) to sound and tell the girls about.

export const DEFAULT_WILDLIFE_PARAMS = {
  rabbitCount: 14, // rabbits on the grass field (read when the game is dealt)
  pheasantCount: 3, // pheasants hidden in the hedge feet at a time (read when the game is dealt)
  rabbitFleeRadius: 8, // m a vehicle or a person can come before a rabbit bolts
  rabbitSpeedReach: 0.9, // extra metres of alarm per m/s of the thing's speed
  rabbitFleeMax: 22, // m furthest anything can alarm a rabbit from
  rabbitRunSpeed: 7.5, // m/s bolting for the hedge
  rabbitHopSpeed: 1.6, // m/s hopping from one patch to the next
  rabbitSitMin: 3, // s sat up or nibbling, at least
  rabbitSitMax: 14, // s sat up or nibbling, at most
  rabbitDownMin: 40, // s underground after a bolt, at least
  rabbitDownMax: 110, // s underground after a bolt, at most
  rabbitThump: 0.5, // 0..1 chance a bolting rabbit thumps a warning with its back foot
  beamReach: 32, // m a headlight picks out a rabbit from
  beamAngle: 0.3, // radians either side of the beam's line a rabbit counts as lit
  beamDark: 0.4, // 0..1 how dark it has to be for a rabbit to freeze in the beam
  beamBolt: 3.5, // m a lit rabbit lets a vehicle come before it bolts after all
  beamBoltReach: 0.3, // extra metres of that per m/s of the vehicle's speed
  pheasantBurstRadius: 5, // m a moving vehicle can come before a pheasant bursts out
  pheasantSpeedReach: 0.5, // extra metres of that per m/s of the vehicle's speed
  pheasantFootRadius: 3.2, // m someone on foot, or a vehicle at a crawl, can come
  pheasantBurstMax: 13, // m furthest a vehicle can flush one from
  pheasantFlySpeed: 11, // m/s once it is away
  pheasantFlight: 3.6, // s in the air before it is lost to sight
  pheasantPeak: 5, // m the highest it climbs
  pheasantAwayMin: 50, // s before another takes its place, at least
  pheasantAwayMax: 140, // s before another takes its place, at most
  pheasantClear: 30, // m from you a new pheasant must be put down, at least
  pheasantCallMin: 40, // s between a hidden pheasant's calls, at least
  pheasantCallMax: 120, // s between a hidden pheasant's calls, at most
};

export const WILDLIFE_PARAM_RANGES = {
  rabbitCount: [0, 40, 1],
  pheasantCount: [0, 10, 1],
  rabbitFleeRadius: [2, 25, 1],
  rabbitSpeedReach: [0, 3, 0.1],
  rabbitFleeMax: [5, 50, 1],
  rabbitRunSpeed: [2, 14, 0.5],
  rabbitHopSpeed: [0.5, 4, 0.1],
  rabbitSitMin: [0.5, 20, 0.5],
  rabbitSitMax: [1, 40, 0.5],
  rabbitDownMin: [2, 120, 1],
  rabbitDownMax: [5, 300, 1],
  rabbitThump: [0, 1, 0.05],
  beamReach: [5, 60, 1],
  beamAngle: [0.05, 0.8, 0.01],
  beamDark: [0, 1, 0.05],
  beamBolt: [1, 12, 0.5],
  beamBoltReach: [0, 1.5, 0.05],
  pheasantBurstRadius: [1, 15, 0.5],
  pheasantSpeedReach: [0, 2, 0.1],
  pheasantFootRadius: [1, 10, 0.2],
  pheasantBurstMax: [3, 30, 1],
  pheasantFlySpeed: [4, 20, 0.5],
  pheasantFlight: [1, 8, 0.1],
  pheasantPeak: [1, 12, 0.5],
  pheasantAwayMin: [5, 200, 5],
  pheasantAwayMax: [10, 400, 5],
  pheasantClear: [5, 80, 1],
  pheasantCallMin: [5, 200, 5],
  pheasantCallMax: [10, 400, 5],
};

const TAU = Math.PI * 2;
const angleDiff = (a, b) => ((((b - a) % TAU) + 3 * Math.PI) % TAU) - Math.PI;
const pick = (random, lo, hi) => lo + random() * Math.max(0, hi - lo);

/**
 * Places along the hedges, on the field side, a metre and a half out from the hedge's middle: where a rabbit's burrow could be or a
 * pheasant could hide. `hedges` as fields.js makes them (straight along x or z, with gaps), `inGap(h, s)` says whether the point
 * along a hedge is in a gap, `ok(x, z)` whether the place is any good. Each spot is `{ x, z, nx, nz }`, `n` pointing into the hedge.
 */
export function hedgeSpots(hedges, inGap, ok, { every = 6, offset = 1.5 } = {}) {
  const out = [];
  for (const h of hedges) {
    const len = h.length ?? (h.alongX ? h.x2 - h.x1 : h.z2 - h.z1);
    for (let s = every / 2; s < len; s += every) {
      const along = (h.alongX ? h.x1 : h.z1) + s;
      if (inGap(h, along) || inGap(h, along - 1.5) || inGap(h, along + 1.5)) continue;
      for (const side of [-1, 1]) {
        const x = h.alongX ? along : h.x1 + side * offset;
        const z = h.alongX ? h.z1 + side * offset : along;
        if (ok(x, z)) out.push({ x, z, nx: h.alongX ? 0 : -side, nz: h.alongX ? -side : 0 });
      }
    }
  }
  return out;
}

export class Rabbits {
  /** `allowed(x, z)` where a rabbit may sit; `burrows` the hedge spots it can bolt to. */
  constructor({ allowed, burrows, random = Math.random, params = { ...DEFAULT_WILDLIFE_PARAMS } }) {
    this.allowed = allowed;
    this.burrows = burrows;
    this.random = random;
    this.p = params;
    this.rabbits = [];
  }

  /** Puts rabbits down in the open a few metres from burrows. Returns how many. */
  place() {
    const { p, random, burrows } = this;
    this.rabbits = [];
    for (let tries = 0; this.rabbits.length < p.rabbitCount && burrows.length && tries < p.rabbitCount * 40; tries++) {
      const b = burrows[Math.floor(random() * burrows.length)];
      const r = 2 + random() * 9;
      const sx = -b.nx * r + (b.nz ? random() * 6 - 3 : 0); // out from the hedge, and some way along it
      const sz = -b.nz * r + (b.nx ? random() * 6 - 3 : 0);
      const x = b.x + sx;
      const z = b.z + sz;
      if (!this.allowed(x, z)) continue;
      this.rabbits.push(this.make(x, z, b));
    }
    return this.rabbits.length;
  }

  make(x, z, burrow) {
    const { p, random } = this;
    return {
      x,
      z,
      yaw: random() * TAU,
      speed: 0,
      mode: 'sit', // sit, hop, run, caught (frozen in a beam) or down (underground)
      t: pick(random, p.rabbitSitMin, p.rabbitSitMax),
      goal: null,
      burrow,
      phase: random() * TAU,
      size: 0.9 + random() * 0.2,
    };
  }

  nearestBurrow(r) {
    let best = null;
    let bd = Infinity;
    for (const b of this.burrows) {
      const d = Math.hypot(b.x - r.x, b.z - r.z);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  /**
   * Moves them on. `threats`: [{ x, z, speed, yaw, beam }] (`beam` 0..1 is how brightly its headlights shine, 0 for a person or a
   * quad with them off); `dark` 0 day to 1 night. Returns events [{ kind: 'bolt', x, z, thump }].
   */
  update(dt, threats = [], dark = 0) {
    const { p, random } = this;
    const events = [];
    for (const r of this.rabbits) {
      r.t -= dt;
      if (r.mode === 'down') {
        if (r.t <= 0) {
          r.mode = 'sit';
          r.x = r.burrow.x - r.burrow.nx * 0.6;
          r.z = r.burrow.z - r.burrow.nz * 0.6;
          r.t = pick(random, p.rabbitSitMin, p.rabbitSitMax);
        }
        continue;
      }
      if (r.mode !== 'run') {
        let alarmed = false;
        let lit = false;
        let close = false;
        for (const t of threats) {
          const d = Math.hypot(r.x - t.x, r.z - t.z);
          const sp = Math.abs(t.speed ?? 0);
          if (d < Math.min(p.rabbitFleeMax, p.rabbitFleeRadius + sp * p.rabbitSpeedReach)) alarmed = true;
          if (t.beam > 0.15 && dark >= p.beamDark && d < p.beamReach && Math.abs(angleDiff(t.yaw ?? 0, Math.atan2(r.x - t.x, r.z - t.z))) < p.beamAngle) {
            lit = true;
            if (d < p.beamBolt + sp * p.beamBoltReach) close = true;
          }
        }
        if (lit && !close) {
          r.mode = 'caught';
          r.speed = 0;
          r.goal = null;
        } else if (alarmed || close) {
          this.bolt(r, events);
        } else if (r.mode === 'caught') {
          r.mode = 'sit';
          r.t = 1.5;
        }
      }
      if (r.mode === 'sit') {
        r.speed = 0;
        if (r.t <= 0) this.pickHop(r);
      } else if (r.mode === 'hop') {
        this.step(r, dt, p.rabbitHopSpeed, 3);
      } else if (r.mode === 'run') {
        this.step(r, dt, p.rabbitRunSpeed, 12);
        if (Math.hypot(r.burrow.x - r.x, r.burrow.z - r.z) < 0.9) {
          r.mode = 'down';
          r.t = pick(random, p.rabbitDownMin, p.rabbitDownMax);
          r.speed = 0;
        }
      }
    }
    return events;
  }

  bolt(r, events) {
    r.burrow = this.nearestBurrow(r) ?? r.burrow;
    r.mode = 'run';
    r.goal = { x: r.burrow.x, z: r.burrow.z };
    events.push({ kind: 'bolt', x: r.x, z: r.z, thump: this.random() < this.p.rabbitThump });
  }

  pickHop(r) {
    const { random, p } = this;
    for (let i = 0; i < 6; i++) {
      const a = random() * TAU;
      const d = 0.8 + random() * 2.2;
      const x = r.x + Math.cos(a) * d;
      const z = r.z + Math.sin(a) * d;
      if (this.allowed(x, z)) {
        r.mode = 'hop';
        r.goal = { x, z };
        r.t = (d / p.rabbitHopSpeed) * 2;
        return;
      }
    }
    r.t = pick(random, p.rabbitSitMin, p.rabbitSitMax);
  }

  /** Turns to the goal and goes, in hops (the phase drives the arc). */
  step(r, dt, speed, turnRate) {
    const { p, random } = this;
    const dx = r.goal.x - r.x;
    const dz = r.goal.z - r.z;
    r.yaw += Math.max(-turnRate * dt, Math.min(turnRate * dt, angleDiff(r.yaw, Math.atan2(dx, dz))));
    r.speed = speed * Math.max(0, Math.cos(angleDiff(r.yaw, Math.atan2(dx, dz))));
    const nx = r.x + Math.sin(r.yaw) * r.speed * dt;
    const nz = r.z + Math.cos(r.yaw) * r.speed * dt;
    if (r.mode === 'run' || this.allowed(nx, nz)) {
      r.x = nx;
      r.z = nz;
      r.phase += dt * (r.mode === 'run' ? 14 : 8) * (r.speed > 0.05 ? 1 : 0);
    } else {
      r.mode = 'sit';
      r.speed = 0;
    }
    if (r.mode === 'hop' && (Math.hypot(dx, dz) < 0.25 || r.t <= 0)) {
      r.mode = 'sit';
      r.speed = 0;
      r.t = pick(random, p.rabbitSitMin, p.rabbitSitMax);
    }
  }
}

export class Pheasants {
  /** `spots` from hedgeSpots(): where one can lie hidden. */
  constructor({ spots, random = Math.random, params = { ...DEFAULT_WILDLIFE_PARAMS } }) {
    this.spots = spots;
    this.random = random;
    this.p = params;
    this.birds = [];
  }

  place() {
    this.birds = [];
    const used = new Set();
    for (let i = 0; i < this.p.pheasantCount && this.spots.length > used.size; i++) {
      const bird = { mode: 'gone', x: 0, z: 0, y: 0, dx: 0, dz: 0, yaw: 0, t: 0, u: 0, spot: -1, callIn: 0, phase: 0 };
      this.birds.push(bird);
      this.hide(bird, null, used);
    }
    return this.birds.length;
  }

  /** Puts the bird down hidden at a spot nobody else has and, if `from` is given, at least `pheasantClear` m from it. */
  hide(b, from, used = new Set(this.birds.filter((o) => o !== b && o.spot >= 0).map((o) => o.spot))) {
    const { p, random, spots } = this;
    for (let i = 0; i < 30; i++) {
      const k = Math.floor(random() * spots.length);
      const s = spots[k];
      if (used.has(k) || (from && Math.hypot(s.x - from.x, s.z - from.z) < p.pheasantClear)) continue;
      b.mode = 'hidden';
      b.spot = k;
      b.x = s.x;
      b.z = s.z;
      b.y = 0;
      b.yaw = Math.atan2(-s.nx, -s.nz);
      b.callIn = pick(random, p.pheasantCallMin, p.pheasantCallMax);
      used.add(k);
      return true;
    }
    b.mode = 'gone';
    b.spot = -1;
    b.t = 10; // no room just now: try again shortly
    return false;
  }

  /**
   * `threats`: [{ x, z, speed }]; `from`: where you are, so a new bird is not put down in your lap. Returns events:
   * { kind: 'burst', x, z, strength } as one flies up and { kind: 'call', x, z } now and then from a hidden one.
   */
  update(dt, threats = [], from = threats[0]) {
    const { p, random } = this;
    const events = [];
    for (const b of this.birds) {
      if (b.mode === 'hidden') {
        let nearest = null;
        for (const t of threats) {
          const d = Math.hypot(b.x - t.x, b.z - t.z);
          const sp = Math.abs(t.speed ?? 0);
          const reach = sp > 0.8 ? Math.min(p.pheasantBurstMax, p.pheasantBurstRadius + sp * p.pheasantSpeedReach) : p.pheasantFootRadius;
          if (d < reach && (!nearest || d < nearest.d)) nearest = { d, t };
        }
        if (nearest) {
          this.burst(b, nearest.t);
          events.push({ kind: 'burst', x: b.x, z: b.z, strength: Math.min(1.5, 0.8 + Math.abs(nearest.t.speed ?? 0) / 12) });
        } else if ((b.callIn -= dt) <= 0) {
          b.callIn = pick(random, p.pheasantCallMin, p.pheasantCallMax);
          events.push({ kind: 'call', x: b.x, z: b.z });
        }
      } else if (b.mode === 'fly') {
        b.t += dt;
        b.u = Math.min(1, b.t / b.flight);
        b.x += b.dx * p.pheasantFlySpeed * dt;
        b.z += b.dz * p.pheasantFlySpeed * dt;
        b.y = p.pheasantPeak * Math.pow(Math.sin(Math.PI * Math.min(1, b.u * 0.9 + 0.05)), 0.6);
        b.phase += dt * (b.u < 0.35 ? 30 : 12); // frantic at first, then a glide with flaps
        if (b.u >= 1) {
          b.mode = 'gone';
          b.spot = -1;
          b.t = pick(random, p.pheasantAwayMin, p.pheasantAwayMax);
        }
      } else if ((b.t -= dt) <= 0) {
        this.hide(b, from);
      }
    }
    return events;
  }

  burst(b, threat) {
    const { p, random } = this;
    const ax = b.x - threat.x;
    const az = b.z - threat.z;
    const len = Math.hypot(ax, az) || 1;
    const a = Math.atan2(ax / len, az / len) + (random() - 0.5) * 0.6; // away from it, give or take
    b.mode = 'fly';
    b.dx = Math.sin(a);
    b.dz = Math.cos(a);
    b.yaw = a;
    b.t = 0;
    b.u = 0;
    b.flight = p.pheasantFlight * (0.85 + random() * 0.3);
    b.spot = -1;
  }

  /** The debug panel's flush: the nearest hidden bird to (x, z) bursts as if something had come at it from there. */
  flush(x, z) {
    let best = null;
    let bd = Infinity;
    for (const b of this.birds) {
      const d = b.mode === 'hidden' ? Math.hypot(b.x - x, b.z - z) : Infinity;
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    if (!best) return null;
    this.burst(best, { x, z });
    return { kind: 'burst', x: best.x, z: best.z, strength: 1 };
  }
}
