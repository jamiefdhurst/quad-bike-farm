// A sharp blip of the throttle on a quad that isn't going anywhere twists it on its springs, the way a real
// engine's torque does: the crank turns one way, so the body rolls the other. This spots the blip (the throttle
// jumping up within a moment) and says how big the kick is. Pure logic; the vibration model turns it into motion.

export const DEFAULT_TORQUE_PARAMS = {
  torqueGain: 1.2, // rad/s of roll kicked into the body by a full blip
  torqueFreq: 3.2, // Hz; a slow sway, much slower than the engine's shake
  torqueDamping: 0.25, // damping ratio
  torqueCamera: 0.4, // fraction of the sway you feel in your head when you're on it
  torqueMinRise: 0.4, // how far the throttle must jump, within torqueWindow, to count as a blip
  torqueWindow: 0.15, // seconds the jump has to happen in
};

export const TORQUE_PARAM_RANGES = {
  torqueGain: [0, 4, 0.05],
  torqueFreq: [1, 10, 0.1],
  torqueDamping: [0.05, 1, 0.01],
  torqueCamera: [0, 1, 0.05],
  torqueMinRise: [0.1, 1, 0.05],
  torqueWindow: [0.02, 0.5, 0.01],
};

export class TorqueRock {
  constructor() {
    this.lag = 0; // the throttle as it was a moment ago
    this.armed = true;
  }

  /**
   * One step. `active` is whether the engine is running and the quad standing (parking brake on, or nobody driving it).
   * Returns the kick for the body's roll (rad/s, 0 for none): the size of the jump times torqueGain, always the one way.
   */
  update(dt, throttle, active, p = DEFAULT_TORQUE_PARAMS) {
    this.lag += (throttle - this.lag) * Math.min(1, dt / Math.max(1e-3, p.torqueWindow));
    const rise = throttle - this.lag;
    if (rise < p.torqueMinRise * 0.5) this.armed = true;
    if (!this.armed || rise < p.torqueMinRise) return 0;
    this.armed = false;
    return active ? -p.torqueGain * Math.min(1, rise) : 0;
  }
}
