// Manual ignition timing: an old bike's advance-retard lever on the bars. Pure logic, no Three.js; the engine reads it (engineModel.js) and
// the lever is the player's (or a girl's) to move. 0 is fully retarded, 1 fully advanced.
//
// Retarded the spark comes late, so it is easy and safe to kick over (no kick-back) and it catches, but it has no power and runs hot. Advanced
// it wants the engine already turning: kicked over like that it fires against the piston and kicks back, which is how an old single breaks
// ankles. The right setting follows the revs: retarded to start, then more advance as it speeds up, and it wants the lot at the top.

export const DEFAULT_TIMING_PARAMS = {
  startAdvance: 0.2, // the lever setting that starts it well: a little advance, not none
  idleAdvance: 0.3, // what it likes at idle
  topAdvance: 0.9, // and flat out
  kickAbove: 0.45, // advance past which a kick can kick back
  kickMax: 0.85, // chance a kick kicks back with the lever fully advanced
  startTolerance: 0.35, // how far from startAdvance it still catches at all
  powerLoss: 0.5, // power lost with the lever as far off as it can be (retarded at the top, or advanced at idle)
  heatPerError: 0.6, // extra work (heat) at full error, in the engine's `work` terms, when it is retarded
  roughPerError: 0.35, // roughness added at full error
  popPerRetard: 1.2, // pop propensity added per unit retarded below what the revs want (a two-stroke bangs; a retarded one more)
  advanceRate: 0.6, // how fast the lever moves, per second of holding [ or ]
  pingFromAdvance: 0.12, // how far past the ideal it can be advanced before it pings and loses power
};

export const TIMING_PARAM_RANGES = {
  startAdvance: [0, 1, 0.05],
  idleAdvance: [0, 1, 0.05],
  topAdvance: [0, 1, 0.05],
  kickAbove: [0, 1, 0.05],
  kickMax: [0, 1, 0.05],
  startTolerance: [0.05, 1, 0.05],
  powerLoss: [0, 1, 0.05],
  heatPerError: [0, 2, 0.05],
  roughPerError: [0, 1, 0.05],
  popPerRetard: [0, 3, 0.1],
  pingFromAdvance: [0, 0.5, 0.01],
  advanceRate: [0.1, 3, 0.1],
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** The setting it wants at these revs: startAdvance cranking, idleAdvance at idle, rising to topAdvance at maxRpm. */
export function idealAdvance(rpm, idleRpm, maxRpm, p = DEFAULT_TIMING_PARAMS) {
  if (rpm <= 0) return p.startAdvance;
  const t = clamp((rpm - idleRpm) / Math.max(1, maxRpm - idleRpm), 0, 1);
  return p.idleAdvance + (p.topAdvance - p.idleAdvance) * t;
}

/** Chance a kick on the pedal kicks back: nothing while it is retarded, rising to kickMax fully advanced. */
export function kickBackChance(advance, p = DEFAULT_TIMING_PARAMS) {
  if (advance <= p.kickAbove) return 0;
  return p.kickMax * clamp((advance - p.kickAbove) / Math.max(0.01, 1 - p.kickAbove), 0, 1);
}

/** How well the lever setting suits starting, 0..1: full at startAdvance, nothing at startTolerance either side. */
export function startFactor(advance, p = DEFAULT_TIMING_PARAMS) {
  return clamp(1 - Math.abs(advance - p.startAdvance) / Math.max(0.01, p.startTolerance), 0, 1);
}

/**
 * Running: how far the lever is from what the revs want, signed (negative retarded, positive advanced), ignoring the small amount of
 * advance (pingFromAdvance) it puts up with. 0 when it is about right.
 */
export function timingError(advance, rpm, idleRpm, maxRpm, p = DEFAULT_TIMING_PARAMS) {
  const d = advance - idealAdvance(rpm, idleRpm, maxRpm, p);
  if (d > 0) return Math.max(0, d - p.pingFromAdvance);
  return d;
}

/** Power multiplier for the setting (1 right, down to 1 - powerLoss far out). */
export function timingPower(error, p = DEFAULT_TIMING_PARAMS) {
  return 1 - p.powerLoss * clamp(Math.abs(error) / 0.6, 0, 1);
}

/** Retarded burns late: the heat goes into the exhaust and the barrel. 0..1. */
export function retardHeat(error) {
  return clamp(-error / 0.6, 0, 1);
}

/** Advanced pings and the engine runs rough, as well as retarded: 0..1. */
export function timingRough(error) {
  return clamp(Math.abs(error) / 0.6, 0, 1);
}

/** Extra overrun-pop propensity from running retarded (the late charge is still burning in the pipe). */
export function retardPop(error, p = DEFAULT_TIMING_PARAMS) {
  return error < 0 ? p.popPerRetard * clamp(-error / 0.6, 0, 1) : 0;
}
