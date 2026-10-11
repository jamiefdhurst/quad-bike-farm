// The flock on the hill pasture: a few sheep that graze, drift a little way and bunch up, and move off from a quad or a girl that comes
// close (further off if it's going fast). Pure: no Three.js and no sound. The game says where a sheep may stand (`allowed`) and what
// threatens them each step, and gets back the bleats to play.

export const DEFAULT_FLOCK_PARAMS = {
  count: 9, // sheep in the flock (read when the game is dealt)
  walkSpeed: 0.8, // m/s drifting from one patch of grass to the next
  runSpeed: 4.2, // m/s moving off from something
  turnRate: 3, // rad/s a sheep can turn at
  cohesion: 0.5, // 0..1 how strongly a drifting sheep heads back towards the others
  spread: 7, // m from the flock's middle a sheep is happy to wander before it turns back
  separation: 1.3, // m sheep keep from each other
  grazeMin: 5, // s standing with its head down, at least
  grazeMax: 20, // s standing with its head down, at most
  fleeRadius: 9, // m a vehicle or a person can come before they move off
  fleeSpeedReach: 1.3, // extra metres of alarm per m/s of the thing's speed
  fleeMax: 28, // m furthest anything can alarm them from
  calmSeconds: 3, // s a sheep keeps moving off after it was alarmed
  panicCatch: 0.5, // 0..1 chance a sheep next to one that bolts bolts too
  bleatMin: 12, // s between a calm sheep's bleats, at least
  bleatMax: 40, // s between a calm sheep's bleats, at most
  bleatScared: 3, // s between bleats while moving off, at most
};

export const FLOCK_PARAM_RANGES = {
  count: [0, 20, 1],
  walkSpeed: [0.2, 2, 0.05],
  runSpeed: [1, 8, 0.1],
  turnRate: [0.5, 8, 0.1],
  cohesion: [0, 1, 0.05],
  spread: [2, 20, 0.5],
  separation: [0.5, 3, 0.1],
  grazeMin: [1, 30, 1],
  grazeMax: [2, 60, 1],
  fleeRadius: [2, 30, 1],
  fleeSpeedReach: [0, 4, 0.1],
  fleeMax: [5, 60, 1],
  calmSeconds: [0.5, 10, 0.5],
  panicCatch: [0, 1, 0.05],
  bleatMin: [2, 60, 1],
  bleatMax: [4, 120, 1],
  bleatScared: [0.5, 10, 0.5],
};

const TAU = Math.PI * 2;
/** The shortest signed turn from angle a to angle b. */
const angleDiff = (a, b) => ((((b - a) % TAU) + 3 * Math.PI) % TAU) - Math.PI;

export class Flock {
  /**
   * `allowed(x, z)` says whether a sheep may stand there (not in the water, the wood, the gorse, up a bank too steep, or through a
   * hedge). `random` is a seeded 0..1 source, so the same game deals the same flock.
   */
  constructor({ allowed, random = Math.random, params = { ...DEFAULT_FLOCK_PARAMS } }) {
    this.allowed = allowed;
    this.random = random;
    this.p = params;
    this.sheep = [];
  }

  /** Puts the flock down together around `centre` (or the nearest allowed ground to it). Returns how many were placed. */
  place(centre) {
    const { random, p } = this;
    this.sheep = [];
    let tries = 0;
    while (this.sheep.length < p.count && tries++ < p.count * 60) {
      const a = random() * TAU;
      const r = Math.sqrt(random()) * Math.min(p.spread, 3 + tries * 0.05);
      const x = centre.x + Math.cos(a) * r;
      const z = centre.z + Math.sin(a) * r;
      if (!this.allowed(x, z)) continue;
      if (this.sheep.some((s) => Math.hypot(s.x - x, s.z - z) < p.separation)) continue;
      this.sheep.push(this.makeSheep(x, z));
    }
    return this.sheep.length;
  }

  makeSheep(x, z) {
    const { random, p } = this;
    return {
      x,
      z,
      yaw: random() * TAU,
      speed: 0,
      mode: 'graze', // graze, walk or run
      t: p.grazeMin + random() * (p.grazeMax - p.grazeMin),
      goal: null,
      head: 1, // 0 head up, 1 head down
      bleatIn: p.bleatMin + random() * (p.bleatMax - p.bleatMin),
      pitch: 0.82 + random() * 0.4, // each sheep's voice, as a playback rate
      size: 0.92 + random() * 0.18,
      phase: random() * TAU, // where in her step she is
    };
  }

  /** Where the middle of the flock is. */
  centre() {
    const n = this.sheep.length || 1;
    return { x: this.sheep.reduce((s, a) => s + a.x, 0) / n, z: this.sheep.reduce((s, a) => s + a.z, 0) / n };
  }

  /**
   * Moves the flock on `dt` seconds. `threats` is a list of `{ x, z, speed }` (quads, the tractor, the girls, you). Returns the bleats
   * to play: `{ sheep, x, z, pitch, loud }`.
   */
  update(dt, threats = []) {
    const { p, random } = this;
    const bleats = [];
    const mid = this.centre();
    const bolted = [];
    for (const s of this.sheep) {
      let away = null;
      for (const t of threats) {
        const d = Math.hypot(s.x - t.x, s.z - t.z);
        const reach = Math.min(p.fleeMax, p.fleeRadius + Math.abs(t.speed ?? 0) * p.fleeSpeedReach);
        if (d < reach && (!away || d < away.d)) away = { d, x: s.x - t.x, z: s.z - t.z };
      }
      if (away) {
        // Away from it, and a little towards the others: they'd rather run with the flock than off alone.
        const len = Math.hypot(away.x, away.z) || 1;
        const toMid = Math.hypot(mid.x - s.x, mid.z - s.z) || 1;
        const gx = away.x / len + ((mid.x - s.x) / toMid) * 0.35 * p.cohesion;
        const gz = away.z / len + ((mid.z - s.z) / toMid) * 0.35 * p.cohesion;
        const gl = Math.hypot(gx, gz) || 1;
        if (s.mode !== 'run') {
          bolted.push(s);
          s.bleatIn = Math.min(s.bleatIn, 0.3 + random() * p.bleatScared); // she calls out as she goes
        }
        s.mode = 'run';
        s.t = p.calmSeconds;
        s.goal = { x: s.x + (gx / gl) * 12, z: s.z + (gz / gl) * 12 };
      }
    }
    // A sheep next to one that has bolted may bolt too, in the same direction.
    for (const b of bolted) {
      for (const s of this.sheep) {
        if (s.mode === 'run' || Math.hypot(s.x - b.x, s.z - b.z) > 6 || random() > p.panicCatch) continue;
        s.mode = 'run';
        s.t = p.calmSeconds * 0.7;
        s.goal = b.goal;
      }
    }

    for (const s of this.sheep) {
      s.t -= dt;
      if (s.mode === 'graze') {
        s.head = Math.min(1, s.head + dt * 1.5);
        s.speed = 0;
        if (s.t <= 0) this.pickGoal(s, mid);
      } else {
        s.head = Math.max(0, s.head - dt * 3);
        if (s.mode === 'run' && s.t <= 0) this.pickGoal(s, mid);
        const reached = s.goal && Math.hypot(s.goal.x - s.x, s.goal.z - s.z) < 0.6;
        if (s.mode === 'walk' && (s.t <= 0 || reached || !s.goal)) this.settle(s);
        else this.step(s, dt);
      }
      s.bleatIn -= dt;
      if (s.bleatIn <= 0) {
        const scared = s.mode === 'run';
        bleats.push({ sheep: this.sheep.indexOf(s), x: s.x, z: s.z, pitch: s.pitch, loud: scared });
        const gap = p.bleatMin + random() * (p.bleatMax - p.bleatMin);
        s.bleatIn = scared ? 0.6 + random() * p.bleatScared : gap;
      }
    }
    return bleats;
  }

  /** Stops to graze. */
  settle(s) {
    const { p, random } = this;
    s.mode = 'graze';
    s.speed = 0;
    s.goal = null;
    s.t = p.grazeMin + random() * (p.grazeMax - p.grazeMin);
  }

  /** Picks the next patch to drift to: a few metres off, pulled back towards the others the further out it is. */
  pickGoal(s, mid) {
    const { p, random } = this;
    for (let i = 0; i < 8; i++) {
      const out = Math.hypot(s.x - mid.x, s.z - mid.z);
      const pull = Math.min(1, out / p.spread) * p.cohesion;
      let a = random() * TAU;
      const back = Math.atan2(mid.z - s.z, mid.x - s.x);
      a += angleDiff(a, back) * pull;
      const r = 2 + random() * 5;
      const gx = s.x + Math.cos(a) * r;
      const gz = s.z + Math.sin(a) * r;
      if (this.allowed(gx, gz)) {
        s.mode = 'walk';
        s.goal = { x: gx, z: gz };
        s.t = (r / p.walkSpeed) * 1.6;
        return;
      }
    }
    this.settle(s); // boxed in: stay put and try again after another graze
  }

  /** Turns towards the goal and walks or runs, keeping off the others and off ground a sheep won't stand on. */
  step(s, dt) {
    const { p } = this;
    const speed = s.mode === 'run' ? p.runSpeed : p.walkSpeed;
    let dx = s.goal.x - s.x;
    let dz = s.goal.z - s.z;
    // Keep apart.
    for (const o of this.sheep) {
      if (o === s) continue;
      const d = Math.hypot(s.x - o.x, s.z - o.z);
      if (d < p.separation && d > 0.001) {
        const push = ((p.separation - d) / p.separation) * 2;
        dx += ((s.x - o.x) / d) * push;
        dz += ((s.z - o.z) / d) * push;
      }
    }
    const want = Math.atan2(dx, dz); // yaw 0 faces +z
    const turn = angleDiff(s.yaw, want);
    const max = p.turnRate * dt * (s.mode === 'run' ? 1.6 : 1);
    s.yaw += Math.max(-max, Math.min(max, turn));
    // Slow to turn before it sets off.
    const facing = Math.max(0, Math.cos(angleDiff(s.yaw, want)));
    s.speed = speed * facing;
    const nx = s.x + Math.sin(s.yaw) * s.speed * dt;
    const nz = s.z + Math.cos(s.yaw) * s.speed * dt;
    if (this.allowed(nx, nz)) {
      s.x = nx;
      s.z = nz;
      s.phase += dt * (s.mode === 'run' ? 11 : 5) * (s.speed > 0.05 ? 1 : 0);
    } else if (s.mode === 'run') {
      // Cornered at a hedge or the water: turn about and try the other way.
      s.goal = { x: s.x - dx * 4, z: s.z - dz * 4 };
      s.speed = 0;
    } else {
      this.settle(s);
    }
  }
}

/**
 * Where to put the flock down: the roomiest bit of allowed ground in `bounds` ({ minX, maxX, minZ, maxZ }), judged by how many of the
 * points in a ring round it are allowed, one of the best picked at random so each game starts them somewhere different.
 */
export function findFlockSpot(allowed, bounds, random, { step = 4, ring = 7 } = {}) {
  const scored = [];
  for (let x = bounds.minX; x <= bounds.maxX; x += step) {
    for (let z = bounds.minZ; z <= bounds.maxZ; z += step) {
      if (!allowed(x, z)) continue;
      let ok = 0;
      let all = 0;
      for (const r of [ring * 0.5, ring]) {
        for (let a = 0; a < TAU; a += TAU / 8) {
          all++;
          if (allowed(x + Math.cos(a) * r, z + Math.sin(a) * r)) ok++;
        }
      }
      scored.push({ x, z, score: ok / all });
    }
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  const best = scored.filter((s) => s.score >= scored[0].score - 0.1);
  return best[Math.floor(random() * best.length)];
}
