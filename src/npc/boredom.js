// When she gets bored and what she does about it, so it never settles into a
// pattern. How long she'll stand about is drawn from a wide spread around her
// usual wait, shortened when she's restless, and her restlessness drifts up and
// down on its own. Each time, the odds of what she does are reshuffled on a
// whim, and the more confident a driver she is, the more often she picks
// driving. Pure logic.

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

/**
 * What she does this time: 'join' (hop on the back of her friend's quad as
 * she sets off), 'mount', 'start', 'drive', 'rest' (go and sit somewhere) or 'wander'. `can` says which are
 * possible right now (wandering always is). The usual chances are
 * the bored*Chance params (wandering gets what's left), each scaled by a whim
 * (log-normal, `boredWhim` wide) and driving by her appetite for it.
 */
export function pickBoredChoice(p, { confidence = 0.5, can = {}, sulk = 1 } = {}, random = Math.random) {
  const base = {
    mount: p.boredMountChance,
    start: p.boredStartChance,
    drive: p.boredDriveChance * driveAppetite(confidence) * sulk, // sulk: a neglected girl takes a quad off on her own
    rest: p.boredRestChance ?? 0, // sits on the bales or the fence: only on a fine day
    doughnuts: p.boredDoughnutChance ?? 0, // spins doughnuts in the field (Jess)
    jumps: p.boredJumpChance ?? 0, // rides at the ramp in the field (npc/jumps.js)
    lineUp: p.boredLineUpChance ?? 0, // moves the quads into a row by the barn (Amy), or parks one crooked (Jess)
  };
  base.wander = Math.max(0.1, 1 - p.boredMountChance - p.boredStartChance - p.boredDriveChance);
  base.join = p.boredJoinChance ?? 0;
  const weights = Object.entries(base).map(([choice, w]) => [
    choice,
    choice === 'wander' || can[choice] ? w * Math.exp(gaussian(random) * p.boredWhim) : 0,
  ]);
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let r = random() * total;
  for (const [choice, w] of weights) {
    r -= w;
    if (r <= 0 && w > 0) return choice;
  }
  return 'wander';
}
