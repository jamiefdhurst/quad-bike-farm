// Doughnuts. Bored, Jess spins doughnuts in the field, tearing it up. Amy watches and disapproves, then has a go herself.
// Pure logic: the steering for going round a circle (herDriving.js runs it as a drive mode), and who watches and who joins in.

export const DEFAULT_DOUGHNUT_PARAMS = {
  radius: 5, // metres: the circle she spins
  throttle: 0.65, // how hard she holds it
  forMin: 18, // seconds she goes round for
  forMax: 32,
  findFrom: 9, // metres from her quad the centre is looked for, from this...
  findTo: 20, // ...to this
  clearExtra: 2.5, // metres beyond the circle that has to be clear of bogs, puddles and obstacles
  radialGain: 0.35, // how hard she turns in or out to keep to the circle (radians per metre off it)
  churn: 0.7, // how much the ground is torn up under the wheels (0..1): the mud, ruts and clods that go with it
  watchRange: 35, // metres: Amy can see it from this far
  watchGap: 20, // seconds between her disapproving lines
  joinChance: 0.6, // the chance she has a go once Jess is done
  joinAfter: 4, // seconds after Jess stops
};

export const DOUGHNUT_PARAM_RANGES = {
  radius: [3, 12, 0.5],
  throttle: [0.2, 1, 0.05],
  forMin: [5, 120, 1],
  forMax: [5, 180, 1],
  findFrom: [3, 30, 1],
  findTo: [5, 50, 1],
  clearExtra: [0, 10, 0.5],
  radialGain: [0, 1, 0.01],
  churn: [0, 1, 0.05],
  watchRange: [5, 100, 1],
  watchGap: [2, 120, 1],
  joinChance: [0, 1, 0.05],
  joinAfter: [0, 30, 0.5],
};

const angleDiff = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

/** Steering and throttle for going round a circle: `dir` 1 turns one way, -1 the other; `steerGain` is the usual steering per radian off. */
export function doughnutControl(pos, yaw, centre, radius, dir, p, steerGain = 1.4) {
  const rx = pos.x - centre.x;
  const rz = pos.z - centre.z;
  const off = Math.hypot(rx, rz) - radius;
  const around = Math.atan2(rx, rz);
  const turn = Math.max(-0.9, Math.min(0.9, p.radialGain * off));
  const desired = around + dir * (Math.PI / 2 + turn);
  return { steer: Math.max(-1, Math.min(1, angleDiff(yaw, desired) * steerGain)), throttle: p.throttle };
}

/** Points round a circle, for checking it is clear. */
export function ringPoints(centre, radius, n = 12) {
  return Array.from({ length: n }, (_, i) => ({ x: centre.x + Math.sin((i / n) * Math.PI * 2) * radius, z: centre.z + Math.cos((i / n) * Math.PI * 2) * radius }));
}

/** Amy (or whoever isn't spinning) watching one and, when it's done, perhaps having a go. */
export class DoughnutWatch {
  constructor(params = { ...DEFAULT_DOUGHNUT_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.last = {};
    this.spinner = null;
    this.stoppedAt = null;
    this.joined = false;
  }

  /**
   * One step. `ctx`: { spinner: id of a girl doing doughnuts or null, girls: [{ id, free, distance }] } (distance from the
   * spinner). Returns events: { type: 'watch', girl } and { type: 'join', girl } (once the spinner is done).
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.clock += dt;
    const others = ctx.girls.filter((g) => g.id !== ctx.spinner);
    if (ctx.spinner) {
      this.spinner = ctx.spinner;
      this.stoppedAt = null;
      this.joined = false;
      for (const g of others) {
        if (!g.free || g.distance > p.watchRange || this.clock - (this.last[g.id] ?? -Infinity) < p.watchGap) continue;
        this.last[g.id] = this.clock;
        events.push({ type: 'watch', girl: g.id });
      }
      return events;
    }
    if (!this.spinner) return events;
    this.stoppedAt ??= this.clock;
    if (this.clock - this.stoppedAt < p.joinAfter) return events;
    const spinner = this.spinner;
    this.spinner = null;
    const g = ctx.girls.find((o) => o.id !== spinner && o.free);
    if (g && g.distance <= p.watchRange && this.random() < p.joinChance) events.push({ type: 'join', girl: g.id });
    return events;
  }
}
