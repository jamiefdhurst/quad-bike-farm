// The electric fence across the hill pasture (layout.hill.fence): a line of poles with two strands of tape and a gap you can ride through,
// an energiser on the hedge at its end that ticks. Touch a strand with a quad's nose or tail, or on foot, and it gives a jolt, with a cooldown so
// one brush is one zap. Pure logic, no Three.js: where the wire is, who is touching it, and the tick; the posts and tape are built in
// world/electricFenceBuild.js, the jolt and the yelps are in game.js, the sound in audio/fenceAudio.js.

export const DEFAULT_FENCE_PARAMS = {
  live: 1, // 1 the fence is switched on, 0 off (the wire is just a wire)
  tickEvery: 1.4, // seconds between the energiser's ticks
  zapCooldown: 2.5, // seconds before the same thing can be zapped again
  vehicleReach: 0.7, // m either side of the wire a quad's nose or tail can be and touch it
  footReach: 0.35, // m either side of the wire you can be on foot and touch it
  zapKick: 5, // how hard the jolt shakes a quad and the camera, in pulse kicks (vibration)
  zapSlow: 0.6, // 0..1 how much of its speed a quad keeps after the jolt (the rider flinches off the throttle)
  hearWithin: 30, // m the tick can be heard from
};

export const FENCE_PARAM_RANGES = {
  live: [0, 1, 1],
  tickEvery: [0.4, 4, 0.1],
  zapCooldown: [0.5, 8, 0.1],
  vehicleReach: [0.2, 1.5, 0.05],
  footReach: [0.1, 1, 0.05],
  zapKick: [0, 12, 0.5],
  zapSlow: [0.2, 1, 0.05],
  hearWithin: [5, 80, 1],
};

/**
 * The fence as a line across the pasture, or null if the layout has none. Written either along x at `z` from `fromX` to `toX` with its gap at x
 * `gap.at` (today's farm), or as a line from `from` to `to` ([x, z] each) with the gap `gap.at` m along it from `from` (the new farm's runs north
 * to south). Either way the energiser is at the end, on the hedge, the gap is `half` m either side of its middle where the wire is down, and
 * `heights` are the strands' heights. Everything below is in metres along the line from its first end.
 */
export function createElectricFence(layout) {
  const f = layout.hill?.fence;
  if (!f) return null;
  const from = f.from ?? [f.fromX, f.z];
  const to = f.to ?? [f.toX, f.z];
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const dir = { x: (to[0] - from[0]) / length, z: (to[1] - from[1]) / length };
  const gap = { at: f.from ? f.gap.at : f.gap.at - f.fromX, half: f.gap.half };
  const fence = { ...f, from, to, length, dir, gap, heights: f.heights ?? [0.55, 0.95] };
  /** The point `s` m along the line. */
  fence.pointAt = (s) => ({ x: from[0] + dir.x * s, z: from[1] + dir.z * s });
  /** Where (x, z) is against the line: `s` m along it and `off` m to one side. */
  fence.along = (x, z) => ({ s: (x - from[0]) * dir.x + (z - from[1]) * dir.z, off: (z - from[1]) * dir.x - (x - from[0]) * dir.z });
  /** Whether (x, z) is within `reach` m of a strand that is up (not in the gap, and between the ends). */
  fence.near = (x, z, reach) => {
    const { s, off } = fence.along(x, z);
    return Math.abs(off) <= reach && s >= 0 && s <= length && Math.abs(s - gap.at) > gap.half;
  };
  /**
   * Whether (x, z) is on half `half` of the pasture (0 or 1) and `margin` m clear of the wire: the flock keeps to the half it is given, and never
   * crosses the line, the gap included. Half 0 is the left of the line looking from its first end (the west half of a fence that runs north to south
   * from its north end, the south side of one that runs east), half 1 the right.
   */
  fence.onHalf = (x, z, half, margin = 1.5) => {
    const { off } = fence.along(x, z);
    return Math.abs(off) > margin && (off >= 0 ? 0 : 1) === half;
  };
  /** The runs of wire either side of the gap, as [from, to] pairs in metres along the line. */
  fence.spans = () => [[0, gap.at - gap.half], [gap.at + gap.half, length]];
  return fence;
}

/**
 * The state of the fence: its tick and who has been zapped lately. Each step, say who is on or near it: `touchers` is a list of
 * { id, kind: 'vehicle' | 'foot', points: [{ x, z }] } (a quad's nose, middle and tail; your feet). Returns the events that happened:
 * { type: 'tick' } and { type: 'zap', id, kind, x, z }.
 */
export class ElectricFence {
  constructor(fence, params = { ...DEFAULT_FENCE_PARAMS }) {
    this.fence = fence;
    this.p = params;
    this.clock = 0;
    this.tickIn = 0.6;
    this.cooling = new Map(); // id -> seconds until it can be zapped again
    this.lastZap = null;
  }

  get live() {
    return !!this.fence && this.p.live >= 0.5;
  }

  /** The first of `points` that is touching the wire, for a toucher of this kind, or null. */
  touching(kind, points) {
    if (!this.live) return null;
    const reach = kind === 'foot' ? this.p.footReach : this.p.vehicleReach;
    return points.find((pt) => this.fence.near(pt.x, pt.z, reach)) ?? null;
  }

  update(dt, touchers = []) {
    const events = [];
    if (!this.fence) return events;
    this.clock += dt;
    for (const [id, left] of this.cooling) {
      if (left - dt <= 0) this.cooling.delete(id);
      else this.cooling.set(id, left - dt);
    }
    if (this.live) {
      this.tickIn -= dt;
      if (this.tickIn <= 0) {
        this.tickIn += this.p.tickEvery;
        events.push({ type: 'tick' });
      }
    }
    for (const t of touchers) {
      const hit = this.touching(t.kind, t.points);
      if (!hit || this.cooling.has(t.id)) continue;
      this.cooling.set(t.id, this.p.zapCooldown);
      this.lastZap = { id: t.id, kind: t.kind, x: hit.x, z: hit.z, at: this.clock };
      events.push({ type: 'zap', id: t.id, kind: t.kind, x: hit.x, z: hit.z });
    }
    return events;
  }

  /** A zap now, as if `id` had touched the wire at (x, z) (the debug panel's button): ignores the cooldown. */
  zapNow(id, kind, x, z) {
    this.cooling.set(id, this.p.zapCooldown);
    this.lastZap = { id, kind, x, z, at: this.clock };
    return { type: 'zap', id, kind, x, z };
  }
}
