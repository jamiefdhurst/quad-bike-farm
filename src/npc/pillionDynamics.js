// How a pillion passenger's upper body moves with the quad: leaning into
// corners, tucking under acceleration, lurching forward under braking and
// bobbing over bumps. Each is a damped spring driven by the seat's
// accelerations, so she lags the bike a little and settles rather than
// snapping. Pure logic, no Three.js.

import { DEFAULT_PILLION_PARAMS } from './pillionParams.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

class Spring {
  constructor() {
    this.x = 0;
    this.v = 0;
  }

  /** Pulls x toward `target` (or pushes it with `force`, in units/s^2). */
  step(dt, freq, damping, target, force = 0) {
    const w = 2 * Math.PI * freq;
    // A few substeps keep it stable at slow frame rates.
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.v += (w * w * (target - this.x) - 2 * damping * w * this.v + force) * h;
      this.x += this.v * h;
    }
  }

  reset() {
    this.x = 0;
    this.v = 0;
  }
}

export class PillionDynamics {
  constructor(params = { ...DEFAULT_PILLION_PARAMS }) {
    this.params = params;
    this.roll = new Spring(); // radians, positive leans to her left
    this.pitch = new Spring(); // radians, positive leans forward
    this.heave = new Spring(); // metres, positive is up
    this.prev = null;
    // Smoothed accelerations in the quad's frame, m/s^2.
    this.accel = { forward: 0, left: 0, up: 0 };
  }

  reset() {
    this.roll.reset();
    this.pitch.reset();
    this.heave.reset();
    this.prev = null;
    this.accel.forward = this.accel.left = this.accel.up = 0;
  }

  /**
   * @param {number} dt
   * @param {object} motion  The quad's motion in its own frame:
   * @param {number} motion.forward  m/s along its nose
   * @param {number} motion.up       m/s along its up axis
   * @param {number} motion.yawRate  rad/s, positive turning left
   */
  update(dt, { forward, up, yawRate }) {
    if (dt <= 0) return;
    const p = this.params;
    const a = this.accel;
    const k = Math.min(1, dt / Math.max(1e-3, p.accelSmoothing));
    if (this.prev) {
      a.forward += ((forward - this.prev.forward) / dt - a.forward) * k;
      // Bumps are short, so the vertical gets less smoothing.
      a.up += ((up - this.prev.up) / dt - a.up) * Math.min(1, k * 3);
    }
    // Centripetal: speed times turn rate, toward the inside of the turn.
    a.left += (forward * yawRate - a.left) * k;
    this.prev = { forward, up };

    const lean = clamp(a.left * p.leanPerAccel, -p.leanMax, p.leanMax);
    const surge = a.forward > 0 ? a.forward * p.tuckPerAccel : -a.forward * p.brakePerAccel;
    this.roll.step(dt, p.bodyFreq, p.bodyDamping, lean);
    this.pitch.step(dt, p.bodyFreq, p.bodyDamping * 0.8, clamp(surge, 0, p.pitchMax));
    // The seat accelerating up squashes her down onto it, then she rebounds.
    this.heave.step(dt, p.bounceFreq, p.bounceDamping, 0, -clamp(a.up, -60, 60) * p.bounce);
    this.heave.x = clamp(this.heave.x, -p.bounceMax, p.bounceMax);
  }
}
