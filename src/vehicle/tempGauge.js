// Where the dash temperature gauge sits. Pure, so the dials and the LCDs share one scale.
//
// The gauge reads the engine's own temperature in °C: the coolant's on anything with a radiator, the metal's on an air-cooled engine
// (`EngineModel.gauge` gives the reading and its marks). Cold is the day's air, the middle of the white band (WARM_AT) is warm, the red
// (HOT_FROM) starts where the engine runs too hot, and the top is where it stalls. A healthy engine sits in the middle; only one
// running hot gets into the red: for want of oil, in the sun, or with a radiator that is low or a thermostat stuck.

export const WARM_AT = 0.5; // dial fraction (0 = C, 1 = H) for a warm engine: the middle, on every gauge
export const HOT_FROM = 0.75; // the red zone starts here: the engine's too-hot temperature

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** The fraction of the way from `a` to `b` that `c` is, 0..1. */
const along = (c, a, b) => clamp01((c - a) / Math.max(0.1, b - a));

/**
 * Dial fraction 0..1 for a reading `{ c, air, warm, hot, top }` (all °C): 0 at the air's temperature, WARM_AT at warm, HOT_FROM at
 * too hot and 1 at the top. The needle rests at C with the ignition off. `overheat` (0..1, a two-stroke short of oil) pushes it on up.
 */
export function tempGaugeFraction(g, ignition = true, overheat = 0) {
  if (!ignition || !g) return 0;
  const { c, air, warm, hot, top } = g;
  const f = c <= warm ? along(c, air, warm) * WARM_AT
    : c <= hot ? WARM_AT + along(c, warm, hot) * (HOT_FROM - WARM_AT)
      : HOT_FROM + along(c, hot, top) * (1 - HOT_FROM);
  return clamp01(f + clamp01(overheat) * (1 - WARM_AT));
}

/** Dial fraction where "cold" ends, from the engine's cold-light threshold (0..1 of the way from the air to warm). */
export function coldZoneEnd(coldBelow) {
  return clamp01(coldBelow) * WARM_AT;
}
