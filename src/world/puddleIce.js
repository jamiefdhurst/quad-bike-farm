// The skin of ice on the track's puddles on a frosty day. Pure, no Three.js: each puddle grows ice while the temperature is below freezing,
// the ice melts when it warms, and wheels crossing it load it until it cracks and then breaks, leaving open water that takes a while to
// freeze over again. Grip on it is like glass (the quad reads `coverAt` and `params.gripSlip`); open water is the usual puddle.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export const DEFAULT_PUDDLE_ICE_PARAMS = {
  freezeBelow: 0, // °C: below this a puddle starts to freeze over
  meltAbove: 1, // °C: above this the ice melts
  freezeSeconds: 40, // seconds to freeze over from open water to full thickness in a hard frost (3 °C below freezing or colder)
  meltSeconds: 90, // seconds for full ice to melt a few degrees above freezing
  skin: 0.15, // thickness (0..1) at which it counts as ice: thinner is just a film and the wheels go through it
  gripSlip: 0.14, // tyre grip on ice (friction slip; the puddles themselves are 0.3 to 0.42): like glass
  strength: 1800, // newtons a wheel can put on full-thickness ice for a second before it gives; thinner ice goes sooner
  speedWeight: 0.12, // how much more a wheel hurts it for each m/s (a wheel hitting it at speed)
  crackAt: 0.4, // damage (0..1) at which it cracks audibly; it breaks at 1
  openSeconds: 90, // after it breaks the water stays open at least this long before it can freeze over again
};

export const PUDDLE_ICE_PARAM_RANGES = {
  freezeBelow: [-5, 2, 0.5],
  meltAbove: [-2, 8, 0.5],
  freezeSeconds: [5, 300, 5],
  meltSeconds: [10, 600, 10],
  skin: [0.02, 0.6, 0.01],
  gripSlip: [0.03, 0.4, 0.01],
  strength: [300, 6000, 50],
  speedWeight: [0, 0.5, 0.01],
  crackAt: [0.1, 0.9, 0.05],
  openSeconds: [0, 600, 10],
};

/** How frozen a puddle would be if it had been left at this temperature long enough: 0 (open) to 1 (a hard frost's worth). */
export function freezeTarget(p, temperature) {
  return clamp((p.freezeBelow - temperature) / 3, 0, 1);
}

export class PuddleIce {
  /**
   * @param {{x:number, z:number}[]} puddles  Where they are (the terrain's own list).
   * @param {number} radius                   The hollow's radius; the water is the middle of it.
   */
  constructor(puddles, radius, params = { ...DEFAULT_PUDDLE_ICE_PARAMS }) {
    this.puddles = puddles;
    this.radius = radius;
    this.params = params;
    this.thickness = puddles.map(() => 0); // 0 open water .. 1 thick ice
    this.damage = puddles.map(() => 0); // 0 sound .. 1 broken through
    this.open = puddles.map(() => 0); // seconds left before a broken puddle may freeze again
    this.events = []; // { type: 'crack' | 'break', index, x, z, strength } until taken
  }

  /** Puddles as they would be after a long night at this temperature (a game that starts on a frosty morning). */
  settle(temperature) {
    const t = freezeTarget(this.params, temperature);
    this.thickness.fill(t);
    this.damage.fill(0);
    this.open.fill(0);
  }

  /** Freezing or melting with the temperature now. */
  update(dt, temperature, rain = 0) {
    const p = this.params;
    const target = freezeTarget(p, temperature);
    const melt = temperature > p.meltAbove ? (clamp((temperature - p.meltAbove) / 3, 0.1, 1) / p.meltSeconds) * (1 + rain) : 0;
    for (let i = 0; i < this.thickness.length; i++) {
      if (this.open[i] > 0) this.open[i] = Math.max(0, this.open[i] - dt);
      let t = this.thickness[i];
      if (melt > 0) t -= melt * dt;
      else if (this.open[i] <= 0 && t < target) t = Math.min(target, t + dt / p.freezeSeconds);
      else if (t > target) t = Math.max(target, t - dt / p.meltSeconds); // a warmer spell than the ice was made in
      this.thickness[i] = clamp(t, 0, 1);
      if (!this.isIce(i)) this.damage[i] = Math.max(0, this.damage[i] - dt * 0.2); // a film heals
    }
  }

  isIce(i) {
    return this.thickness[i] >= this.params.skin;
  }

  /** How much of the puddle at (x, z) is under ice, 0..1: the middle of a frozen one is 1, the open water of a melted one 0. */
  coverAt(x, z) {
    const R = this.radius;
    let c = 0;
    for (let i = 0; i < this.puddles.length; i++) {
      if (!this.isIce(i)) continue;
      const pd = Math.hypot(x - this.puddles[i].x, z - this.puddles[i].z);
      if (pd >= R) continue;
      c = Math.max(c, 1 - smoothstep(R * 0.45, R * 0.85, pd));
    }
    return c;
  }

  /** Index of the frozen puddle whose water is under (x, z), or -1. */
  iceIndexAt(x, z) {
    let best = -1;
    let bestD = this.radius * 0.85;
    for (let i = 0; i < this.puddles.length; i++) {
      if (!this.isIce(i)) continue;
      const pd = Math.hypot(x - this.puddles[i].x, z - this.puddles[i].z);
      if (pd < bestD) {
        bestD = pd;
        best = i;
      }
    }
    return best;
  }

  /**
   * A wheel is on the ice at (x, z) carrying `load` newtons at `speed` m/s for `dt` seconds. Cracks it, then breaks it.
   * @returns {'crack'|'break'|null} what happened this step
   */
  load(x, z, load, speed, dt) {
    const i = this.iceIndexAt(x, z);
    if (i < 0 || load <= 0) return null;
    const p = this.params;
    const thick = Math.max(this.thickness[i], p.skin);
    const before = this.damage[i];
    // The thinner the ice and the harder and faster the wheel, the sooner it goes.
    this.damage[i] = Math.min(1, before + ((load * (1 + p.speedWeight * Math.abs(speed))) / (p.strength * thick)) * dt);
    const at = { index: i, x: this.puddles[i].x, z: this.puddles[i].z, strength: clamp(0.4 + this.damage[i] * 0.6, 0, 1) };
    if (this.damage[i] >= 1) {
      this.breakIce(i);
      this.events.push({ type: 'break', ...at, strength: 1 });
      return 'break';
    }
    if (before < p.crackAt && this.damage[i] >= p.crackAt) {
      this.events.push({ type: 'crack', ...at });
      return 'crack';
    }
    return null;
  }

  /** Open water, for a while. */
  breakIce(i) {
    this.thickness[i] = 0;
    this.damage[i] = 0;
    this.open[i] = this.params.openSeconds;
  }

  /** Every puddle open water (the debug panel's "break it"). */
  breakAll() {
    for (let i = 0; i < this.thickness.length; i++) if (this.isIce(i)) this.breakIce(i);
  }

  /** Every puddle frozen to this thickness (the debug panel); 0 melts them. */
  setAll(thickness) {
    this.thickness.fill(clamp(thickness, 0, 1));
    this.damage.fill(0);
    this.open.fill(0);
  }

  /** For the debug panel: how many are frozen, how thick the thickest is, and how many are cracked. */
  describe() {
    const frozen = this.thickness.filter((_, i) => this.isIce(i)).length;
    const cracked = this.damage.filter((d, i) => this.isIce(i) && d >= this.params.crackAt).length;
    const thickest = Math.max(0, ...this.thickness);
    return `${frozen} of ${this.thickness.length} frozen over, ${cracked} cracked, thickest ${Math.round(thickest * 100)}%`;
  }

  take() {
    return this.events.splice(0);
  }
}
