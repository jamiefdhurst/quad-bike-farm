// The day's air in the engine. Pure logic, no Three.js.
//
// Cold air is dense and damp air is thin (water vapour takes the place of air, and a warm day holds more of it). `airCharge` is how
// much more air than the stock tune expects goes in each stroke: positive on a cold dry day, negative on a warm muggy one, 0 on the
// reference day. Dense air pulls harder and, past a fixed jet, runs leaner; a two-stroke's jet kit is matched to it (jetting.js).

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** How much denser than the reference day the air is (about -0.1 to +0.15). */
export function airCharge(celsius, damp, p) {
  // Warmer air carries more water, so the same dampness thins it more.
  const warmth = clamp(1 + (celsius - p.jetRefCelsius) * 0.04, 0.4, 1.6);
  return (p.jetRefCelsius - celsius) * p.airPerDegree - (damp - p.airRefDamp) * p.airPerDamp * warmth;
}

/** The power the air adds (or takes) as a multiplier. */
export function airPowerFactor(charge, p) {
  return 1 + p.airPower * charge;
}

/** The mixture a fixed carburettor jet loses to dense air (negative: leaner). Injection and diesels adjust for it. */
export function airMixture(charge, p) {
  if (p.injected || p.compressionIgnition || p.strokes === 2) return 0; // a two-stroke's jet error already holds it
  return -p.airLean * charge;
}

/** What the day's air is called on the panel. */
export function airText(charge) {
  if (charge > 0.04) return 'cold, dense air';
  if (charge < -0.04) return 'warm, thin air';
  return 'ordinary air';
}
