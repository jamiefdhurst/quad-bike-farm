// A hand throttle (the tractor's lever, the Land Rover's dash knob): it moves while its key is held and stays wherever it is left.
// Pure logic, so it is tested without the quad (tests/handLever.test.js).

export const HAND_THROTTLE_RATE = 0.35; // per second the lever moves while its key is held

/** The lever after `dt` seconds with `up` and/or `down` held, kept between 0 and 1. */
export function stepHand(setting, up, down, dt, rate = HAND_THROTTLE_RATE) {
  return Math.min(1, Math.max(0, setting + ((up ? 1 : 0) - (down ? 1 : 0)) * rate * dt));
}
