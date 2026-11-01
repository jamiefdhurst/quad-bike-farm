// Where each quad keeps its reverse, choke and fuel tap, and what it costs you to reach them. Pure logic, no Three.js or DOM; tested in
// tests/controls.test.js. The quad asks these before it acts, and says the `why` to whoever is at it when the answer is no.
//
//   reverse: 'bars' a lever on the left bar you push down while turning the bars; 'button' a button you press while holding the brake
//     (automatics); 'knee' a lever by your left knee, which wants the quad stopped; 'none' no reverse at all, so you get off and push.
//   (also 'dashLever', the UTV's forward and reverse lever on the dash, which wants it stopped)
//   choke: 'thumb' a lever by the left grip, always in reach; 'slide' the same reach, a slider in the left switch pod (the red); 'knob' a pull knob on the dash, a hand off the bars; 'plunger' a plunger on
//     the carb under the tank, which you can only reach with the quad all but stopped, and with a hand off the bars even then;
//     'none' no choke at all (a fuel injected engine meters its own cold start: the loan quad's, Jess's Corsa's).
//   tap: where the fuel tap sits (the model places it, quadModel.js) and what its handle looks like ('carbLeft', the yellow's, is on the tank's lower
//     edge beside the carb, with a hose to it).

export const REVERSE_STYLES = ['bars', 'button', 'knee', 'dashLever', 'none'];
export const CHOKE_STYLES = ['thumb', 'knob', 'plunger', 'slide', 'none'];
export const TAP_STYLES = ['left', 'right', 'rearLeft', 'lowLeft', 'lowRight', 'carbLeft', 'none']; // ('none': no tap at all, the fuel always flows: an injected quad's)

/**
 * Whether an engine has a choke you can work: not a fuel injected one (it meters its own cold start) and not a diesel (glow plugs warm it instead:
 * the tractor, the Yak, the Crag, your car). The key hints, the choke keys and the choke quirks all ask this.
 */
export function hasChoke(engineParams = {}) {
  return !engineParams.injected && !engineParams.compressionIgnition;
}

export const DEFAULT_CONTROLS_PARAMS = {
  barsMaxSpeed: 1.5, // m/s: the bar lever can be pushed down while it's creeping, not at a run
  buttonMaxSpeed: 0.4, // m/s: the reverse button wants it stopped
  kneeMaxSpeed: 0.5, // m/s: the knee lever too
  leverMaxSpeed: 0.5, // m/s: the UTV's dash lever wants it stopped too
  knobMaxSpeed: 7, // m/s: the dash knob can be reached at a fair pace, one handed
  knobSteer: 0.45, // how much of the steering you have while a hand is off the bars for the knob
  plungerMaxSpeed: 1, // m/s: the carb plunger can only be reached with it all but stopped
  plungerSteer: 0.2, // how much steering is left with a hand down by the carb
  pushSpeed: 1, // m/s you shove a quad along on foot
  pushRange: 3, // metres: how far from a quad you can keep pushing it
  sideSpace: 0.4, // metres either side of the quad's middle that count as pushing from the side (which rolls it backwards)
};

export const CONTROLS_PARAM_RANGES = {
  barsMaxSpeed: [0.2, 6, 0.1],
  buttonMaxSpeed: [0.05, 2, 0.05],
  kneeMaxSpeed: [0.05, 2, 0.05],
  leverMaxSpeed: [0.05, 2, 0.05],
  knobMaxSpeed: [1, 15, 0.5],
  knobSteer: [0, 1, 0.05],
  plungerMaxSpeed: [0.2, 4, 0.1],
  plungerSteer: [0, 1, 0.05],
  pushSpeed: [0.3, 2.5, 0.1],
  pushRange: [1.5, 6, 0.5],
  sideSpace: [0, 1, 0.05],
};

/**
 * Whether the reverse can be engaged now. `ctx`: { speed (m/s, either way), steering (a steer key is held), braking (the brake is held) }.
 * Returns { ok, why } where `why` is what to tell whoever's at the controls when it isn't.
 */
export function reverseAllowed(style, ctx, p = DEFAULT_CONTROLS_PARAMS) {
  switch (style) {
    case 'none':
      return { ok: false, why: 'It has no reverse: get off and push it (hold V by it)' };
    case 'bars':
      if (ctx.speed > p.barsMaxSpeed) return { ok: false, why: 'Slow down: the reverse lever is on the left bar' };
      if (!ctx.steering) return { ok: false, why: 'The reverse lever is on the left bar: push it down while you turn the bars (A or D)' };
      return { ok: true };
    case 'button':
      if (!ctx.braking || ctx.speed > p.buttonMaxSpeed) return { ok: false, why: 'Stop and hold the brake (S) while you press the reverse button' };
      return { ok: true };
    case 'dashLever':
      if (ctx.speed > p.leverMaxSpeed) return { ok: false, why: 'Stop first: the forward and reverse lever is on the dash' };
      return { ok: true };
    case 'knee':
      if (ctx.speed > p.kneeMaxSpeed) return { ok: false, why: 'Stop first: the reverse lever is down by your left knee' };
      return { ok: true };
    default:
      return { ok: true };
  }
}

/**
 * What it costs to work the choke while riding at `speed`: { ok, steer, why }, steer being the fraction of your steering you keep while
 * a hand is off the bars (1 for the thumb lever). Standing beside the quad (no `riding`) every choke is in reach.
 */
export function chokeReach(style, speed, riding = true, p = DEFAULT_CONTROLS_PARAMS) {
  if (!riding || style === 'thumb' || style === 'slide') return { ok: true, steer: 1 };
  if (style === 'knob') {
    return speed > p.knobMaxSpeed ? { ok: false, steer: 1, why: 'Too fast to take a hand off the bars for the choke knob' } : { ok: true, steer: p.knobSteer };
  }
  if (style === 'plunger') {
    return speed > p.plungerMaxSpeed ? { ok: false, steer: 1, why: 'The choke plunger is down by the carb: stop to reach it' } : { ok: true, steer: p.plungerSteer };
  }
  return { ok: true, steer: 1 };
}

/** Which way a shove sends it along its own length: away from you (+1 forwards, -1 backwards). `localZ` is you, in its frame, +z towards its nose. */
export function pushDirection(localZ, p = DEFAULT_CONTROLS_PARAMS) {
  if (Math.abs(localZ) < p.sideSpace) return -1; // from the side you pull it backwards, which is what a push is for
  return localZ > 0 ? -1 : 1;
}

/** Where you are in a quad's frame along its length: `dx`, `dz` your offset from it, `yaw` its heading (0 is +z). */
export function localAlong(dx, dz, yaw) {
  return dx * Math.sin(yaw) + dz * Math.cos(yaw);
}
