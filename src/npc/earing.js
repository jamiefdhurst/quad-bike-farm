// Who's that by ear. A girl stood about hears a quad running somewhere she can't see, with her friend on it, and says
// which quad it is and how it's being ridden ("That's Jess on the blue, she never lets it idle"), from how far off it
// is and how its engine sounds. Pure logic: the game says what is running where.

export const DEFAULT_EAR_PARAMS = {
  minRange: 28, // metres: nearer than this she can see it, so she'd not need to listen
  maxRange: 130, // and further than this she can't hear it over the farm
  hardSpeed: 7, // m/s: flat out, to her ear
  hardThrottle: 0.8, // or this much throttle
  coldBelow: 0.45, // engine temperature (0..1) under which it sounds cold
  wornAbove: 0.4, // wear above which it sounds rough
  chance: 0.04, // per second, while there's something to hear
  gap: 75, // seconds between her saying so
  settle: 3, // seconds it has been running and driven before she places it
};

export const EAR_PARAM_RANGES = {
  minRange: [5, 100, 1],
  maxRange: [30, 400, 5],
  hardSpeed: [1, 20, 0.5],
  hardThrottle: [0.1, 1, 0.05],
  coldBelow: [0, 1, 0.05],
  wornAbove: [0, 1, 0.05],
  chance: [0, 1, 0.005],
  gap: [0, 600, 5],
  settle: [0, 20, 0.5],
};

/** How it sounds: 'hard' (flat out), 'rough' (cold or worn: not a healthy noise) or 'steady'. */
export function soundOf(q, p) {
  if (q.temperature < p.coldBelow || q.wear > p.wornAbove) return 'rough';
  if (Math.abs(q.speed) > p.hardSpeed || q.throttle > p.hardThrottle) return 'hard';
  return 'steady';
}

export class Hearing {
  constructor(params = { ...DEFAULT_EAR_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.last = {}; // girl id -> time she last said something
    this.since = {}; // spec id -> seconds it's been running with somebody driving it
  }

  /**
   * One step. `ctx`:
   *   girls: [{ id, x, z, free }]                free: stood about, nothing on
   *   quads: [{ id, x, z, running, driver, speed, throttle, temperature, wear }]   driver: a girl's id, 'you' or null
   * Returns events: { girl, spec, driver, sound } for a girl who has placed a quad her friend is on.
   */
  update(dt, ctx) {
    const p = this.p;
    this.clock += dt;
    for (const q of ctx.quads) this.since[q.id] = q.running && q.driver ? (this.since[q.id] ?? 0) + dt : 0;
    const events = [];
    for (const g of ctx.girls) {
      if (!g.free || this.clock - (this.last[g.id] ?? -Infinity) < p.gap) continue;
      const heard = ctx.quads.filter((q) => {
        if (!q.running || !q.driver || q.driver === 'you' || q.driver === g.id || this.since[q.id] < p.settle) return false;
        const d = Math.hypot(q.x - g.x, q.z - g.z);
        return d >= p.minRange && d <= p.maxRange;
      });
      if (!heard.length || this.random() >= p.chance * dt) continue;
      const q = heard[Math.floor(this.random() * heard.length)];
      this.last[g.id] = this.clock;
      events.push({ girl: g.id, spec: q.id, driver: q.driver, sound: soundOf(q, p) });
    }
    return events;
  }
}
