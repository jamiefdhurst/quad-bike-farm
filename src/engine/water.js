// Drowning it. Pure logic, no Three.js.
//
// Plough into a deep puddle too fast and the bow wave goes up the air intake: the engine gulps water. `water`
// (0..1) is how much it's swallowed. It splutters and misfires while there's any in it, stalls once there's
// plenty, and won't catch until it has drained. Slow through the same puddle and nothing gets in.

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * Water taken in per second: how deep the puddle is under the wheels (0..1) and how fast you're ploughing through it (m/s). A snorkel
 * ({ depthFrom, scale } from snorkel.js) lifts the intake clear of the shallower water and lets less in when it is deep enough.
 */
export function waterGulp(puddle, speed, p, snorkel = null) {
  const from = snorkel ? Math.max(p.waterDepthFrom, snorkel.depthFrom) : p.waterDepthFrom;
  const depth = clamp01((puddle - from) / Math.max(0.01, 1 - from));
  const fast = clamp01((Math.abs(speed) - p.waterSafeSpeed) / Math.max(0.1, p.waterFullSpeed - p.waterSafeSpeed));
  return p.waterGulpRate * depth * fast * fast * (snorkel ? snorkel.scale : 1);
}

/**
 * Water taken in per second standing or driving in the river's deep water (`deep`, 0..1, world.deepWaterAt): deeper than any intake, so it
 * floods at any speed. A snorkel only lets less in; it cannot lift the intake clear of it.
 */
export function deepWaterGulp(deep, p, snorkel = null) {
  return p.waterDeepRate * clamp01(deep) * (snorkel ? snorkel.scale : 1);
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
