// The tractor creeping on its own: left running in first gear with the hand throttle open and nobody on it, it walks off across the
// field at a pace the hand throttle sets (a trickle at the start-of-game setting, a brisk walk wide open), the way farmers leave one
// to feed out. Pure logic, no Three.js or Rapier; tested in tests/creep.test.js.
//
// The quad asks `update` each physics step whether it is creeping and gets back the speed to hold (the drivetrain won't pull past
// it). Nosed into a hedge or a wall it stalls itself after a few seconds.

export const DEFAULT_CREEP_PARAMS = {
  minHand: 0.05, // the hand throttle has to be open this far for it to go anywhere
  speedPerHand: 2.4, // m/s the hand throttle sets per unit of opening: fully open is first gear's top speed, the start setting about 0.36
  minSpeed: 0.15, // m/s it never goes slower than while it is creeping, so a barely open throttle still moves it
  stuckSpeed: 0.1, // m/s: below this while creeping it's up against something...
  stuckTime: 4, // ...and after this many seconds it stalls
};

export const CREEP_PARAM_RANGES = {
  minHand: [0, 0.5, 0.01],
  speedPerHand: [0.5, 4, 0.1],
  minSpeed: [0.05, 1, 0.05],
  stuckSpeed: [0, 0.5, 0.01],
  stuckTime: [0.5, 15, 0.5],
};

/** The speed (m/s) it holds for a hand throttle setting, or 0 when the throttle is too shut to go anywhere. */
export function creepSpeed(hand, p = DEFAULT_CREEP_PARAMS) {
  return hand < p.minHand ? 0 : Math.max(p.minSpeed, hand * p.speedPerHand);
}

/**
 * Whether the tractor is creeping: nobody at the controls, running, in first with the clutch out, the throttle open, the brake off
 * and the right way up.
 */
export function mayCreep({ attended, running, gear, hand, parkBrake = false, tipped = false, towed = false }, p = DEFAULT_CREEP_PARAMS) {
  return !attended && running && gear === 1 && !parkBrake && !tipped && !towed && hand >= p.minHand;
}

export class Creep {
  constructor(params = DEFAULT_CREEP_PARAMS) {
    this.p = params;
    this.stuck = 0; // seconds it has been held up while creeping
  }

  /**
   * One step. `ctx`: { allowed: mayCreep(...), hand, speed }, speed being how fast it is actually going, m/s.
   * Returns { creeping, limit (m/s, 0 when not creeping), stall (true once, when it has been stuck long enough) }.
   */
  update(dt, ctx) {
    if (!ctx.allowed) {
      this.stuck = 0;
      return { creeping: false, limit: 0, stall: false };
    }
    this.stuck = Math.abs(ctx.speed) < this.p.stuckSpeed ? this.stuck + dt : 0;
    if (this.stuck > this.p.stuckTime) {
      this.stuck = 0;
      return { creeping: false, limit: 0, stall: true };
    }
    return { creeping: true, limit: creepSpeed(ctx.hand, this.p), stall: false };
  }
}

/**
 * How far it is from the hedge it's heading for, metres: along `yaw` (0 is +z, as everywhere) from (x, z) to the edge of the square
 * field of half-width `half`. Infinity if it's pointing along an edge and never reaches one.
 */
export function distanceToHedge(x, z, yaw, half) {
  const dx = Math.sin(yaw);
  const dz = Math.cos(yaw);
  const reach = (p, d) => (Math.abs(d) < 1e-6 ? Infinity : ((d > 0 ? half : -half) - p) / d);
  return Math.max(0, Math.min(reach(x, dx), reach(z, dz)));
}
