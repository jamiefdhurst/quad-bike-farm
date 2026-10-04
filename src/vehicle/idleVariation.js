// Each game, every quad's warm idle is shifted a little so the bikes feel a bit
// different every time. Pure logic.

export const IDLE_VARIATION_RPM = 450; // shift either way, at most
const MIN_IDLE_FRACTION = 0.7; // never below 70% of the spec idle
const CLUTCH_MARGIN_RPM = 400; // the clutch must bite this far above idle, or the bike creeps

/**
 * Shifts the warm idle by `offset` rpm and scales what depends on it, so a low
 * idler isn't stall-prone and a high idler doesn't creep. Changes the params
 * objects in place and returns the idle actually used.
 */
export function applyIdleOffset(engineParams, vehicleParams, offset) {
  const base = engineParams.idleRpmWarm;
  const idle = Math.max(base + offset, base * MIN_IDLE_FRACTION);
  const f = idle / base;
  engineParams.idleRpmWarm = Math.round(idle);
  // The stall point and the braking drag scale with the idle, which keeps the
  // margins the same: warm never stalls from braking, cold still can.
  engineParams.stallRpm = Math.round(engineParams.stallRpm * f);
  engineParams.loadDragRpm = Math.round(engineParams.loadDragRpm * f);
  const shortfall = idle + CLUTCH_MARGIN_RPM - vehicleParams.clutchEngageRpm;
  if (shortfall > 0) {
    vehicleParams.clutchEngageRpm += shortfall;
    vehicleParams.clutchFullRpm += shortfall;
    vehicleParams.couplingRpm += shortfall;
  }
  return engineParams.idleRpmWarm;
}
