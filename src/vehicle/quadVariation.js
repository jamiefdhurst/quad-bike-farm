// Each game, every quad's warm idle, roughness and starting fuel are picked at
// random within the ranges in its spec (quadSpecs.js), so the bikes feel a bit
// different every time. Pure logic.

export const CLUTCH_MARGIN_RPM = 400; // the clutch must bite this far above idle, or the bike creeps

/** A value within [min, max], evenly spread, rounded to `step`. */
export function pickInRange([min, max], random, step = 1) {
  return Math.round((min + random() * (max - min)) / step) * step;
}

/** A warm idle within [min, max], evenly spread. */
export function pickIdle(range, random) {
  return pickInRange(range, random);
}

/**
 * Sets the warm idle and scales what depends on it, so a low idler isn't
 * stall-prone and a high idler doesn't creep. Changes the params objects in
 * place and returns the idle used.
 *
 * Safe ranges, from simulating warm and cold braking at the extremes: down to
 * about 650 (red), 950 (blue) and 900 (yellow). Below that a warm engine can
 * occasionally stall under hard braking.
 */
export function applyIdle(engineParams, vehicleParams, idle) {
  const f = idle / engineParams.idleRpmWarm;
  engineParams.idleRpmWarm = Math.round(idle);
  // The stall point and the braking drag scale with the idle, which keeps the
  // margins the same: warm never stalls from braking, cold still can.
  engineParams.stallRpm = Math.round(engineParams.stallRpm * f);
  engineParams.loadDragRpm = Math.round(engineParams.loadDragRpm * f);
  const shortfall = Math.round(idle + CLUTCH_MARGIN_RPM - vehicleParams.clutchEngageRpm);
  if (shortfall > 0) {
    vehicleParams.clutchEngageRpm += shortfall;
    vehicleParams.clutchFullRpm += shortfall;
    vehicleParams.couplingRpm += shortfall;
  }
  return engineParams.idleRpmWarm;
}

/**
 * Picks this game's roughness and starting fuel from the spec's ranges, if it
 * has them, and applies them. Returns what was picked.
 */
export function applyVariation(spec, engineParams, fuel, random) {
  if (spec.roughnessRange) engineParams.baseRoughness = pickInRange(spec.roughnessRange, random, 0.01);
  if (spec.fuelRange) fuel.setLitres(pickInRange(spec.fuelRange, random, 0.1));
  return { roughness: engineParams.baseRoughness, litres: fuel.litres };
}
