// Each game, every quad's warm idle is picked at random within the idleRange
// in its spec (quadSpecs.js), so the bikes feel a bit different every time.
// Pure logic.

const CLUTCH_MARGIN_RPM = 400; // the clutch must bite this far above idle, or the bike creeps

/** A warm idle within [min, max], evenly spread. */
export function pickIdle([min, max], random) {
  return Math.round(min + random() * (max - min));
}

/**
 * Sets the warm idle and scales what depends on it, so a low idler isn't
 * stall-prone and a high idler doesn't creep. Changes the params objects in
 * place and returns the idle used.
 *
 * Safe ranges, from simulating warm and cold braking at the extremes: down to
 * about 650 (red), 950 (blue) and 1,300 (yellow). Below that a warm engine can
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
