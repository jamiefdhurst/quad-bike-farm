// Drowning it. Pure logic, no Three.js.
//
// Plough into a deep puddle too fast and the bow wave goes up the air intake: the engine gulps water. `water`
// (0..1) is how much it's swallowed. It splutters and misfires while there's any in it, stalls once there's
// plenty, and won't catch until it has drained. Slow through the same puddle and nothing gets in.

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Water taken in per second: how deep the puddle is under the wheels (0..1) and how fast you're ploughing through it (m/s). */
export function waterGulp(puddle, speed, p) {
  const depth = clamp01((puddle - p.waterDepthFrom) / Math.max(0.01, 1 - p.waterDepthFrom));
  const fast = clamp01((Math.abs(speed) - p.waterSafeSpeed) / Math.max(0.1, p.waterFullSpeed - p.waterSafeSpeed));
  return p.waterGulpRate * depth * fast * fast;
}

/** The new water level after dt seconds. It blows out faster running with the throttle open than it drips out standing. */
export function stepWater(water, dt, { gulp = 0, running = false, throttle = 0 }, p) {
  const drain = running ? p.waterDrainRunning + p.waterDrainThrottle * clamp01(throttle) : p.waterDrainOff;
  return clamp01(water + (gulp - drain) * dt);
}

/** How much of its usual chance of catching it keeps: none once it's wet enough, full when dry. */
export function waterCatchFactor(water, p) {
  return clamp01(1 - water / Math.max(0.01, p.waterNoStart));
}
