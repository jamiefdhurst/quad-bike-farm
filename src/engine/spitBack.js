// Spitting back through the carb. Pure logic, no Three.js.
//
// A lean, cold engine with the throttle snapped open: the mixture is too weak to light cleanly and the flame goes the wrong way,
// back up the intake and out of the carb. It's a different thing from popping in the exhaust (runOn.js): that's on a shut
// throttle, from the pipe; this is on a hard blip, from the airbox under the seat.

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** How readily it spits back, 0..1: needs both a lean mixture and a cold engine, so a warm one or a rich (choked) one never does. */
export function spitPropensity(e, p) {
  if (p.compressionIgnition || p.injected || p.spitBase <= 0) return 0; // (no carb to spit back through)
  const lean = clamp01((e.lean - p.spitLeanFrom) / Math.max(0.01, p.spitLeanFull - p.spitLeanFrom));
  const cold = clamp01((p.spitColdBelow - e.temperature) / Math.max(0.01, p.spitColdBelow));
  return lean * cold;
}

/** The slow throttle follows the real one, so how far the real one is above it says how hard it was just snapped open. */
export function followThrottle(slow, throttle, dt, p) {
  return slow + (throttle - slow) * (1 - Math.exp(-dt / Math.max(0.01, p.spitFollow)));
}

/** True when the throttle has been snapped open: well above where it's been, and open past a minimum. */
export function isSnap(slow, throttle, p) {
  return throttle >= p.spitSnapTo && throttle - slow >= p.spitSnapStep;
}

/** The chance a snap spits back: propensity times spitBase, capped at 0.9. */
export function spitChance(e, p) {
  return Math.min(0.9, p.spitBase * spitPropensity(e, p));
}
