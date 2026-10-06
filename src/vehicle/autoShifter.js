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

export const DEFAULT_NOVICE_PARAMS = {
  maxGear: 2, // she never goes above this: it's quick enough for her
  skipFirstChance: 0.35, // chance she sets off in second from rest
  hopChance: 0.6, // chance a set-off kangaroos (the clutch coming up in fits)
  hopCycles: 3, // fits of it
  hopPeriod: 0.24, // seconds for each fit: the clutch bites, then lets go
  cutChance: 0.5, // chance a set-off in second has her lift off the throttle as the clutch comes up, which stalls it
  cutSeconds: 0.9,
};

export const NOVICE_PARAM_RANGES = {
  maxGear: [1, 3, 1],
  skipFirstChance: [0, 1, 0.05],
  hopChance: [0, 1, 0.05],
  hopCycles: [1, 8, 1],
  hopPeriod: [0.1, 0.6, 0.02],
  cutChance: [0, 1, 0.05],
  cutSeconds: [0.2, 3, 0.1],
};

/**
 * Jess on the tractor. The same lever and pedal as the AutoShifter, but she stays in the low gears, sometimes sets off in second,
 * lets the clutch up in fits so it kangaroos, and sometimes comes off the throttle as it bites, which stalls it for real (second
 * from rest with the throttle shut is the tractor's own stall). `update` also returns `throttleScale` for the caller to apply, and
 * `events` collects 'hop' and 'cut' (what just went wrong) for her voice.
 */
export class NoviceShifter extends AutoShifter {
  constructor(params = DEFAULT_SHIFTER_PARAMS, novice = DEFAULT_NOVICE_PARAMS, random = Math.random) {
    super(params);
    this.novice = novice;
    this.random = random;
    this.events = [];
    this.wasClutch = false;
    this.hop = null; // { t, cycles } while the clutch is coming up in fits
    this.cutLeft = 0;
    this.inSecond = false; // she set off in second this time
    this.hops = 0; // kangaroos so far, for whoever's counting
  }

  reset() {
    super.reset();
    this.hop = null;
    this.cutLeft = 0;
    this.wasClutch = false;
  }

  update(dt, s) {
    const n = this.novice;
    this.events = [];
    if ((s.gear === 0 && this.pending === null) || s.reverse) this.inSecond = false;
    // Having set off in second she stays there, rather than the shifter dropping her back to first the moment she's slow.
    const topSpeed = (g) => (g === 1 && this.inSecond ? 0 : s.topSpeed(g));
    const out = super.update(dt, { ...s, topSpeed, gears: Math.min(s.gears, n.maxGear) });
    // Setting off from neutral, she sometimes picks second.
    if (s.gear === 0 && this.pending === 1 && this.timer === this.params.shiftSeconds && n.maxGear >= 2 && this.random() < n.skipFirstChance) {
      this.pending = 2;
      this.inSecond = true;
    }
    if (this.inSecond && s.speed > s.topSpeed(1)) this.inSecond = false;
    let { clutch } = out;
    // The clutch has just come up with it in gear and her nearly stopped: a set-off.
    if (this.wasClutch && !clutch && out.gear >= 1 && s.speed < this.params.crawlSpeed * 3 && !s.reverse) {
      if (this.random() < n.hopChance) this.hop = { t: 0 };
      if (out.gear >= 2 && this.random() < n.cutChance) {
        this.cutLeft = n.cutSeconds;
        this.events.push('cut');
      }
    }
    this.wasClutch = clutch;
    if (this.hop) {
      this.hop.t += dt;
      const cycle = this.hop.t / n.hopPeriod;
      if (cycle >= n.hopCycles) this.hop = null;
      else {
        // Bites, lets go, bites: the pedal half down on the way.
        clutch = cycle % 1 > 0.5;
        if (Math.floor(cycle) !== this.hop.last) {
          this.hop.last = Math.floor(cycle);
          if (this.hop.last === 1) {
            this.events.push('hop');
            this.hops++;
          }
        }
      }
    }
    this.cutLeft = Math.max(0, this.cutLeft - dt);
    return { gear: out.gear, clutch, throttleScale: this.cutLeft > 0 ? 0 : 1 };
  }
}
