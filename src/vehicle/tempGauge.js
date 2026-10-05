// Where the dash temperature gauge sits. Pure, so the dials and the LCDs share one scale.
//
// The engine's temperature runs 0 (stone cold) to 1 (fully warm). On the gauge a fully warm
// engine sits at WARM_AT, the middle of the white band, with a red zone above it that nothing
// reaches yet (it's there for when engines can overheat).

export const WARM_AT = 0.7; // dial fraction (0 = C, 1 = H) for a fully warm engine
export const HOT_FROM = 0.85; // the red zone starts here

/** Dial fraction 0..1 for an engine temperature; the needle rests at C with the ignition off. */
export function tempGaugeFraction(temperature, ignition = true) {
  if (!ignition) return 0;
  return Math.min(1, Math.max(0, temperature)) * WARM_AT;
}

/** Dial fraction where "cold" ends, from the engine's cold-light threshold. */
export function coldZoneEnd(coldBelow) {
  return Math.min(1, Math.max(0, coldBelow)) * WARM_AT;
}
