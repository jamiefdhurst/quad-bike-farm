// Seats that ride differently. The frame's bumps are the same everywhere on a vehicle, but a seat is not bolted to the frame: a pillion
// pad, the rack, a cab seat, the back bench on its leaf springs and the UTV's bare bed each sit on something of their own, so each gets its
// own share. Every seat is a damped spring driven by the frame's vertical acceleration (soft and bouncy on leaf springs, short and sharp in the
// bed), with some extra rise and fall from the seat's distance behind the middle when the vehicle pitches. When it runs out of travel, it
// slams (the seat bottoms out, or the bed throws her up). Pure logic, no Three.js: the quad moves the anchors and the girls react to the slams.

export const SEAT_KINDS = ['pillion', 'rack', 'front', 'rear', 'bed'];

const SEAT_DEFAULTS = {
  // gain: times the frame's acceleration it feels. freq: Hz of the spring. damp: damping ratio. pitch: extra share of the body's pitch it feels, for
  // how far it is from the middle. max: travel either way in metres. slam: fraction of max at which it bottoms out. up: whether it can fly up (the bed).
  pillion: { gain: 0.9, freq: 3.2, damp: 0.35, pitch: 0.6, max: 0.05, slam: 0.9 }, // a sprung pad over the rear axle: more pitch than the front
  rack: { gain: 0.7, freq: 4, damp: 0.4, pitch: 0.4, max: 0.04, slam: 0.9 }, // over the nose, on the front springs
  front: { gain: 0.5, freq: 3, damp: 0.5, pitch: 0.2, max: 0.04, slam: 0.9 }, // a cab seat on its cushion
  rear: { gain: 1.1, freq: 2.1, damp: 0.12, pitch: 0.7, max: 0.09, slam: 0.8 }, // the back bench over the leaf springs: bounces and comes down hard
  bed: { gain: 1.2, freq: 5, damp: 0.2, pitch: 0.7, max: 0.12, slam: 0.75 }, // the bare bed: a short sharp bounce, and she leaves it over a big one
};

export const DEFAULT_SEAT_PARAMS = {
  slamGap: 0.7, // seconds between slams for the same seat
  slamSpeed: 0.25, // m/s: the seat has to be running into its stop this fast for it to count as a slam
  accelMax: 60, // m/s^2: the most of a bump the springs are given
  accelSmoothing: 0.02, // seconds
};
for (const k of SEAT_KINDS) {
  for (const [name, v] of Object.entries(SEAT_DEFAULTS[k])) DEFAULT_SEAT_PARAMS[`${k}${name[0].toUpperCase()}${name.slice(1)}`] = v;
}

export const SEAT_PARAM_RANGES = {
  slamGap: [0, 5, 0.1],
  slamSpeed: [0.02, 2, 0.01],
  accelMax: [5, 200, 5],
  accelSmoothing: [0.005, 0.3, 0.005],
};
for (const k of SEAT_KINDS) {
  const K = (n) => `${k}${n[0].toUpperCase()}${n.slice(1)}`;
  SEAT_PARAM_RANGES[K('gain')] = [0, 3, 0.05];
  SEAT_PARAM_RANGES[K('freq')] = [0.5, 12, 0.1];
  SEAT_PARAM_RANGES[K('damp')] = [0.02, 1.5, 0.01];
  SEAT_PARAM_RANGES[K('pitch')] = [0, 2, 0.05];
  SEAT_PARAM_RANGES[K('max')] = [0.01, 0.3, 0.005];
  SEAT_PARAM_RANGES[K('slam')] = [0.3, 1, 0.01];
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** The frame's vertical acceleration (m/s^2), from its height each step. */
export class UpAccel {
  constructor() {
    this.prevY = null;
    this.prevV = 0;
    this.accel = 0;
  }

  update(dt, y, p = DEFAULT_SEAT_PARAMS) {
    if (dt <= 0) return this.accel;
    if (this.prevY !== null) {
      const v = (y - this.prevY) / dt;
      const a = (v - this.prevV) / dt;
      this.accel += (clamp(a, -p.accelMax, p.accelMax) - this.accel) * Math.min(1, dt / Math.max(1e-3, p.accelSmoothing));
      this.prevV = v;
    }
    this.prevY = y;
    return this.accel;
  }
}

/** One seat's spring. `x` is how far it has risen (metres) above where it sits at rest. */
export class SeatSpring {
  constructor(kind, params = DEFAULT_SEAT_PARAMS) {
    this.kind = kind;
    this.p = params;
    this.x = 0;
    this.v = 0;
    this.sinceSlam = Infinity;
  }

  param(name) {
    return this.p[`${this.kind}${name[0].toUpperCase()}${name.slice(1)}`];
  }

  /**
   * @param {number} dt
   * @param {number} accel  the frame's vertical acceleration, m/s^2 (up positive)
   * @param {number} lift  extra metres from the frame pitching, for how far this seat is from the middle (set by the caller)
   * @returns {{ offset: number, slam: null | { kind: string, strength: number, up: boolean } }}  how far above rest to put the seat
   */
  update(dt, accel, lift = 0) {
    const p = this.p;
    const w = 2 * Math.PI * this.param('freq');
    const zeta = this.param('damp');
    const max = this.param('max');
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / n;
    let slam = null;
    this.sinceSlam += dt;
    for (let i = 0; i < n; i++) {
      // The frame goes up, the seat lags: it is pushed down relative to the frame.
      this.v += (-this.param('gain') * accel - w * w * this.x - 2 * zeta * w * this.v) * h;
      this.x += this.v * h;
      const stop = max * this.param('slam');
      if (Math.abs(this.x) >= stop && this.v * Math.sign(this.x) > p.slamSpeed && this.sinceSlam >= p.slamGap) {
        slam = { kind: this.kind, strength: clamp(Math.abs(this.v) / (p.slamSpeed * 6), 0, 1), up: this.x > 0 };
        this.sinceSlam = 0;
      }
      if (Math.abs(this.x) > max) {
        this.x = Math.sign(this.x) * max;
        this.v = 0; // bottomed out (or thrown up against its top)
      }
    }
    return { offset: this.x + clamp(lift, -max, max), slam };
  }
}
