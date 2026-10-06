// Smoke and smell. Amy hates two-stroke smoke: stood downwind of a running two-stroke she coughs and waves it away.
// Jess loves it. Pure logic: the game says who and what is where and which way the wind blows; this says who has
// breathed it in. (Following one on a quad is HerDrive's `followSmokeGap`.)

export const DEFAULT_SMOKE_PARAMS = {
  plumeLength: 9, // metres downwind of the exhaust that smoke carries
  plumeWidth: 1.3, // half-width at the pipe
  plumeSpread: 0.22, // metres wider per metre downwind
  calmWind: 0.35, // m/s: slower than this the smoke just hangs behind the quad
  pipeBehind: 1.1, // metres behind the quad's middle that the exhaust is
  minLevel: 0.3, // how much smoke (0..1) there has to be to bother her
  reactAfter: 1.2, // seconds in it before she reacts
  coughGap: 30, // seconds before Amy coughs again
  loveGap: 50, // seconds before Jess says how much she likes it
  waveFor: 2.6, // seconds Amy waves it away
};

export const SMOKE_PARAM_RANGES = {
  plumeLength: [1, 30, 0.5],
  plumeWidth: [0.2, 5, 0.1],
  plumeSpread: [0, 1, 0.01],
  calmWind: [0, 3, 0.05],
  pipeBehind: [0, 3, 0.1],
  minLevel: [0, 1, 0.05],
  reactAfter: [0, 10, 0.1],
  coughGap: [0, 300, 5],
  loveGap: [0, 300, 5],
  waveFor: [0.5, 10, 0.1],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** How much a quad is smoking, 0..1: nothing from a four-stroke or one that's off; a two-stroke more on the throttle and cold. */
export function smokeLevel(q) {
  if (!q.twoStroke || !q.running) return 0;
  return clamp01(0.35 + 0.5 * clamp01(q.throttle) + 0.3 * (1 - clamp01(q.temperature / 0.6)));
}

/** Whether a point is in the smoke from a quad's exhaust: downwind of it, or behind it when the air is still. */
export function inPlume(point, q, wind, p) {
  const speed = Math.hypot(wind.x, wind.z);
  const dir = speed > p.calmWind ? { x: wind.x / speed, z: wind.z / speed } : { x: -Math.sin(q.yaw), z: -Math.cos(q.yaw) };
  // The pipe is behind the middle of the quad, whichever way the smoke then drifts.
  const px = q.x - Math.sin(q.yaw) * p.pipeBehind;
  const pz = q.z - Math.cos(q.yaw) * p.pipeBehind;
  const rx = point.x - px;
  const rz = point.z - pz;
  const along = rx * dir.x + rz * dir.z;
  if (along < 0 || along > p.plumeLength) return false;
  const across = Math.abs(rx * dir.z - rz * dir.x);
  return across <= p.plumeWidth + p.plumeSpread * along;
}

export class SmokeSense {
  constructor(params = { ...DEFAULT_SMOKE_PARAMS }) {
    this.p = params;
    this.clock = 0;
    this.exposed = {}; // girl id -> seconds in smoke
    this.last = {}; // girl id -> when she last reacted
  }

  /**
   * One step. `ctx`:
   *   wind: { x, z }
   *   girls: [{ id, x, z, free }]       free: stood about (so she can stand there coughing)
   *   quads: [{ id, x, z, yaw, twoStroke, running, throttle, temperature }]
   * Returns events: { type: 'cough', girl, spec } (Amy) and { type: 'love', girl, spec } (Jess).
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.clock += dt;
    for (const g of ctx.girls) {
      const q = g.free ? ctx.quads.find((o) => smokeLevel(o) >= p.minLevel && inPlume(g, o, ctx.wind, p)) : null;
      this.exposed[g.id] = q ? (this.exposed[g.id] ?? 0) + dt : 0;
      if (!q || this.exposed[g.id] < p.reactAfter) continue;
      const hates = g.id === 'amy';
      if (this.clock - (this.last[g.id] ?? -Infinity) < (hates ? p.coughGap : p.loveGap)) continue;
      this.last[g.id] = this.clock;
      events.push({ type: hates ? 'cough' : 'love', girl: g.id, spec: q.id });
    }
    return events;
  }
}
