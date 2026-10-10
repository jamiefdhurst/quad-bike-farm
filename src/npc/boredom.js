// How soon she gets bored and how keen she is on each thing she might do about it, so it never settles into a pattern. Her usual wait
// is drawn from a wide spread, shortened when she's restless, and her restlessness drifts up and down on its own; it sets how fast her
// need for something to do builds (needs.js). The odds of each choice are her taste for it, and the more confident a driver she is,
// the keener on driving. The choosing itself is the chooser's (chooser.js), with a whim, against everything else she could do. Pure.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** A standard normal sample. */
export function gaussian(random = Math.random) {
  const u = Math.max(1e-9, random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

/**
 * Seconds until she's bored next: spread around her usual wait (the middle of
 * boredAfterMin..Max) on a log scale (`boredSpread`), divided by how restless
 * she is, and kept within boredWaitFloor..boredWaitCeiling.
 */
export function nextBoredWait(p, restlessness = 1, random = Math.random) {
  const usual = (p.boredAfterMin + p.boredAfterMax) / 2;
  const wait = (usual * Math.exp(gaussian(random) * p.boredSpread)) / restlessness;
  return clamp(wait, p.boredWaitFloor, p.boredWaitCeiling);
}

/** Her restlessness after dt seconds: a random wander between 0.5 and 2 that leans back towards 1. */
export function driftRestlessness(r, dt, p, random = Math.random) {
  const next = r + ((1 - r) * dt) / 180 + gaussian(random) * Math.sqrt(dt) * p.restlessDrift;
  return clamp(next, 0.5, 2);
}

/** How much more she likes driving at this confidence: 0.3 careful, about 1 middling, 2.7 sure of herself. */
export function driveAppetite(confidence) {
  return 0.3 + 2.4 * confidence * confidence;
}

/** The odds as weights are divided by this, so a typical one is about 1 for the chooser (chooser.js). */
export const BORED_NORM = 0.25;

/**
 * How keen she is on each thing she might do out of boredom: her bored*Chance params (wandering gets what's left), starting scaled
 * by `startUrge` (keener the fewer quads are running, contentment.js), driving by her appetite for it and by `sulk` (a neglected girl
 * takes a quad off on her own). These are the weights of her boredom offers; the chooser adds the whim and picks.
 */
export function boredOdds(p, { confidence = 0.5, sulk = 1, startUrge = 1 } = {}) {
  return {
    mount: p.boredMountChance,
    start: p.boredStartChance * startUrge,
    drive: p.boredDriveChance * driveAppetite(confidence) * sulk,
    rest: p.boredRestChance ?? 0, // sits on the bales or the fence: only on a fine day
    doughnuts: p.boredDoughnutChance ?? 0, // spins doughnuts in the field (Jess)
    jumps: p.boredJumpChance ?? 0, // rides at the ramp in the field (npc/jumps.js)
    showOff: p.boredShowOffChance ?? 0, // rides at you to wheelie past or skid to a stop beside you (npc/showOff.js)
    buzz: p.boredBuzzChance ?? 0, // goes and sits on a worn, rough quad for the shake (Jess readily, Amy rarely)
    lineUp: p.boredLineUpChance ?? 0, // moves the quads into a row by the barn (Amy), or parks one crooked (Jess)
    wander: Math.max(0.1, 1 - p.boredMountChance - p.boredStartChance - p.boredDriveChance),
    join: p.boredJoinChance ?? 0,
  };
}
