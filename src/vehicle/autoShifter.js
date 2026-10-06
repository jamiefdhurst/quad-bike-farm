// The girls' hands and feet on a manual quad: from what she wants (throttle, brake, reverse) and how fast it is going, it picks a gear
// and says when the clutch is down. She is a good enough driver that she never stalls it or crunches a gear; the point is that the
// quad is in the right gear, and in neutral when she is parked. Pure logic, no Rapier or Three.

export const DEFAULT_SHIFTER_PARAMS = {
  shiftSeconds: 0.4, // the clutch is down this long for each change
  upFraction: 0.85, // changes up once it is this fraction of the gear's top speed
  downFraction: 0.7, // changes down once it is slower than this fraction of the next gear down's top speed
  crawlSpeed: 0.4, // m/s; below this she is standing still
  clutchBrakeSpeed: 0.7, // braking below this fraction of first's top speed, she dips the clutch so it doesn't stall
};

export const SHIFTER_PARAM_RANGES = {
  shiftSeconds: [0.1, 1.5, 0.05],
  upFraction: [0.5, 1, 0.01],
  downFraction: [0.3, 1, 0.01],
  crawlSpeed: [0.1, 1, 0.05],
  clutchBrakeSpeed: [0.2, 1.5, 0.05],
};

export class AutoShifter {
  constructor(params = DEFAULT_SHIFTER_PARAMS) {
    this.params = params;
    this.pending = null; // the gear she is moving the lever to, while the clutch is down
    this.timer = 0;
  }

  reset() {
    this.pending = null;
    this.timer = 0;
  }

  /**
   * @param {number} dt
   * @param {object} s
   * @param {number} s.gear        The lever now: -1, 0, 1..gears.
   * @param {number} s.gears       Forward gears.
   * @param {(g: number) => number} s.topSpeed  Top speed of a gear, m/s.
   * @param {number} s.speed       Absolute speed along the quad, m/s.
   * @param {number} s.throttle
   * @param {number} s.brake
   * @param {boolean} s.reverse    She wants to go backwards.
   * @returns {{ gear: number, clutch: boolean }} the gear to select (the same as now when there's no change) and whether the clutch is down.
   */
  update(dt, { gear, gears, topSpeed, speed, throttle, brake, reverse }) {
    const p = this.params;
    if (this.pending !== null && gear === this.pending) this.pending = null;
    if (this.timer > 0) {
      this.timer -= dt;
      // The lever moves in the middle of the dip, once the pedal is down.
      return { gear: this.timer <= p.shiftSeconds * 0.55 && this.pending !== null ? this.pending : gear, clutch: true };
    }
    this.pending = null;

    const standing = speed < p.crawlSpeed;
    let want = gear;
    if (reverse) want = standing || gear < 0 ? -1 : gear; // she brakes to a stop before she goes into reverse
    else if (gear < 0) want = standing ? (throttle > 0.02 ? 1 : 0) : gear;
    else if (gear === 0) want = throttle > 0.02 || (!standing && speed > 0) ? 1 : 0;
    else {
      want = gear;
      if (gear < gears && speed > topSpeed(gear) * p.upFraction && throttle > 0.1) want = gear + 1;
      else if (gear > 1 && speed < topSpeed(gear - 1) * p.downFraction) want = gear - 1;
    }
    // Moving at a lick in neutral (a stalled-and-restarted or just-handed-over quad): find a gear that fits.
    if (want === 1 && !reverse && speed > topSpeed(1) * p.upFraction) {
      want = 1;
      for (let g = 2; g <= gears; g++) if (speed < topSpeed(g) * p.upFraction) {
        want = g;
        break;
      }
      if (speed >= topSpeed(gears) * p.upFraction) want = gears;
    }

    if (want !== gear) {
      this.pending = want;
      this.timer = p.shiftSeconds;
      return { gear, clutch: true };
    }

    // Standing, or slowing right down on the brake or off the throttle: clutch down, or the engine stalls.
    const slow = speed < topSpeed(1) * p.clutchBrakeSpeed;
    const clutch = gear !== 0 && ((standing && throttle < 0.02) || (brake > 0.3 && slow) || (throttle < 0.02 && speed < p.crawlSpeed * 2));
    return { gear, clutch };
  }
}
