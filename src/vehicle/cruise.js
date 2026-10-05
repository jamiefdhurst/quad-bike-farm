// Cruise control for a quad with nobody on it: works the throttle to hold the
// speed it had when the rider jumped off. A plain PI controller on forward
// speed, throttle only (it never brakes). Pure logic, no Rapier or Three.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
// Fraction of the rider's throttle the cruise starts from (usually they had it wide open).
const HANDOVER = 0.4;

export class CruiseControl {
  /**
   * @param {object} params  Vehicle params: cruiseGain (throttle per m/s of error)
   *                         and cruiseIntegral (throttle per m/s per second).
   */
  constructor(params) {
    this.params = params;
    this.target = 0;
    this.integral = 0;
    this.throttle = 0;
  }

  /**
   * Starts holding `targetSpeed` (m/s, a magnitude). `throttle` is what the
   * rider had on at the time. Holding a speed takes less than getting to it,
   * so it starts from part of that and finds the rest.
   */
  engage(targetSpeed, throttle = 0) {
    this.target = Math.abs(targetSpeed);
    this.integral = clamp(throttle * HANDOVER, 0, 1);
    this.throttle = this.integral;
  }

  /**
   * @param {number} dt
   * @param {number} speed      Current speed along the direction of travel, m/s.
   * @param {number} [maxThrottle]  Cap, e.g. the reverse throttle limit.
   * @returns {number} throttle 0..maxThrottle
   */
  update(dt, speed, maxThrottle = 1) {
    const p = this.params;
    const error = this.target - speed;
    const raw = this.integral + p.cruiseGain * error;
    // Only integrate while the output isn't pinned against a limit in the same direction.
    const pinned = (raw >= maxThrottle && error > 0) || (raw <= 0 && error < 0);
    if (!pinned) this.integral = clamp(this.integral + p.cruiseIntegral * error * dt, 0, maxThrottle);
    this.throttle = clamp(this.integral + p.cruiseGain * error, 0, maxThrottle);
    return this.throttle;
  }
}
