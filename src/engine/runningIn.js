// Running in. A freshly rebuilt engine (stripped after a seizure, the barn find's first start, the big-bore kit) wants about ten minutes of
// gentle running before it's thrashed. Thrash it early and it wears several times faster, and it keeps a little of that roughness for good:
// a service clears the wear but not the scar. Pure logic, no Three.js; the engine calls these from its wear step.

/** How hard it's being worked, 0 (gentle: at or under runInGentleRpm of its range) to 1 (flat out). */
export function runInThrash(rpmNorm, p) {
  const span = Math.max(0.01, 1 - p.runInGentleRpm);
  const t = Math.min(1, Math.max(0, (rpmNorm - p.runInGentleRpm) / span));
  return t * t * (3 - 2 * t);
}

/** Starts the clock on a rebuilt engine: it's fresh and wants running in again from the top. */
export function startRunningIn(engine) {
  engine.runIn = 1;
}

/** The multiplier on wear: nothing once it's run in, up to 1 + runInWearBoost thrashed flat out while it's new. */
export function runInWearFactor(runIn, rpmNorm, p) {
  return 1 + p.runInWearBoost * runIn * runInThrash(rpmNorm, p);
}

/** Is a freshly rebuilt engine being worked hard right now (so a girl who's watching says something). `workFrom` is how hard counts. */
export function isThrashedRunningIn(engine, workFrom, p) {
  return engine.isRunning && engine.runIn > p.runInNoticeFrom && engine.work > workFrom;
}

/** One step of running in while the engine runs: the clock ticks down (idling counts for less), and thrashing it leaves its scar. */
export function stepRunningIn(engine, h, rpmNorm, p) {
  if (engine.runIn <= 0) return;
  const thrash = runInThrash(rpmNorm, p);
  const pace = rpmNorm > 0.05 ? 1 : p.runInIdleShare;
  engine.scar = Math.min(p.runInScarMax, engine.scar + (h / 60) * p.runInScarPerMinute * engine.runIn * thrash);
  engine.runIn = Math.max(0, engine.runIn - (h * pace) / p.runInSeconds);
}
