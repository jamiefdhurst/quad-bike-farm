// Where the dash temperature gauge sits. Pure, so the dials and the LCDs share one scale.
//
// The engine's temperature runs 0 (stone cold) to 1 (fully warm). On the gauge a fully warm
// engine sits at WARM_AT, the middle of the white band, with a red zone above it that only an engine
// running hot reaches: for want of oil, in the sun, or with a radiator that is low or a thermostat stuck.

export const WARM_AT = 0.5; // dial fraction (0 = C, 1 = H) for a fully warm engine: the middle, on every gauge
export const HOT_FROM = 0.75; // the red zone starts here

/** Dial fraction 0..1 for an engine temperature; the needle rests at C with the ignition off. */
export function tempGaugeFraction(temperature, ignition = true, overheat = 0) {
  if (!ignition) return 0;
  // Extra heat from poor lubrication pushes the needle on up into the red.
  return Math.min(1, Math.max(0, temperature)) * WARM_AT + Math.min(1, Math.max(0, overheat)) * (1 - WARM_AT);
}

/** Dial fraction where "cold" ends, from the engine's cold-light threshold. */
export function coldZoneEnd(coldBelow) {
  return Math.min(1, Math.max(0, coldBelow)) * WARM_AT;
}
