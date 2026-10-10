// Bump-starting: a manual with a flat battery (or no starter) turned over by its own wheels. The clutch is let out in gear on a rolling
// vehicle and the wheels spin the engine at the road's pace in that gear, so a quick gear (first) turns it over at a walk and a high
// one needs more speed. It uses the same catch chance as the starter and the cord, so choke, a cold engine and an empty tank still
// matter; a two-stroke catches readily and a four-stroke less so. Pure, tested in tests/bumpStart.test.js.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * How fast the wheels turn the engine over, as a fraction of a starter's speed (0 = not at all, 1 = as fast as the starter).
 * @param {number} gearRpm   the revs it would turn at at this road speed in this gear (speed over the gear's top speed times full-throttle revs)
 * @param {number} gearLock  0..1 how far the clutch is out
 * @param {object} p         engine params: maxRpm, rollMinFraction, rollFullFraction, rollClutchMin
 */
export function rollTurn(gearRpm, gearLock, p) {
  if (gearLock < p.rollClutchMin) return 0;
  const f = gearRpm / Math.max(1, p.maxRpm);
  if (f < p.rollMinFraction) return 0;
  return clamp(f / p.rollFullFraction, 0, 1) * clamp((gearLock - p.rollClutchMin) / Math.max(0.01, 1 - p.rollClutchMin), 0, 1) ** 0.5;
}

/** How readily it fires when turned over by the wheels, compared with the starter: a two-stroke catches easily, a four-stroke less. */
export function rollCatch(p) {
  return p.strokes === 2 ? p.rollCatchTwoStroke : p.rollCatchFourStroke;
}

/**
 * The road speed (m/s) in a gear at which the wheels turn the engine over at the given fraction of a starter's speed. For a girl
 * pushing, who shouts when it is fast enough, and for the Vehicles tab.
 */
export function rollSpeedFor(gearTop, p, turn = 1) {
  return (clamp(turn, 0.01, 1) * p.rollFullFraction * gearTop);
}
