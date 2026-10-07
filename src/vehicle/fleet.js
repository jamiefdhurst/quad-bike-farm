// Which vehicles are on the farm this game. The five regular quads are sometimes joined by the kids' quad, the loan quad, the mini moto or the old three-wheeler, and one
// or two of the regulars are sometimes missing, so no two games have quite the same line-up. Pure logic.

export const DEFAULT_FLEET_PARAMS = {
  missingChances: [0.35, 0.4, 0.25], // chance that none, one or two of the regular quads are away
  extraChances: [0.28, 0.35, 0.22, 0.1, 0.05], // chance that none, one, two, three or all four of the extra vehicles turn up
  maxVehicles: 7, // and never more than there are parking slots (LAYOUT.spawn.quads)
  minVehicles: 3, // never fewer than this, so there's always something to ride and something for her to ride
};

function pickCount(chances, random) {
  let r = random();
  for (let n = 0; n < chances.length; n++) {
    r -= chances[n];
    if (r < 0) return n;
  }
  return chances.length - 1;
}

/** Picks `n` of `list` at random, keeping their order. */
function pick(list, n, random) {
  const left = list.slice();
  while (left.length > n) left.splice(Math.floor(random() * left.length), 1);
  return left;
}

/**
 * This game's vehicles, as specs: the regulars that stayed, then the extras that turned up. The same random numbers give the same fleet.
 */
export function pickFleet(regulars, extras, random, params = DEFAULT_FLEET_PARAMS) {
  const missing = Math.min(pickCount(params.missingChances, random), regulars.length - 1);
  const extraCount = Math.min(pickCount(params.extraChances, random), extras.length);
  // Too few would leave an empty farm, so fewer regulars go missing.
  const staying = Math.min(Math.max(regulars.length - missing, params.minVehicles - extraCount), params.maxVehicles - extraCount);
  return [...pick(regulars, Math.min(staying, regulars.length), random), ...pick(extras, extraCount, random)];
}
