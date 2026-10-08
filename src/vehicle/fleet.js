// Which vehicles are on the farm this game. Every vehicle is in one pool (the five regular quads, the kids' quad, the loan quad, the mini moto, the old
// three-wheeler, the tractor, the UTV and the Land Rover) and each game has between four and all of them, so no two games have quite the same
// line-up. Pure logic.

export const DEFAULT_FLEET_PARAMS = {
  minVehicles: 4, // never fewer than this
  spread: 2, // how many dice the count is averaged over: 1 is any number from the minimum to the lot equally, more bunches games towards the middle
  minRegulars: 2, // and at least this many of the regular quads, so there's always one for each girl
};

/** How many vehicles this game has, from `min` to `max`, weighted towards the middle. */
export function pickCount(min, max, random, spread = DEFAULT_FLEET_PARAMS.spread) {
  let t = 0;
  for (let i = 0; i < spread; i++) t += random();
  return Math.min(max, min + Math.floor((t / spread) * (max - min + 1)));
}

/**
 * This game's vehicles, as specs, in the pool's order (`regulars`, then `others`). The same random numbers give the same fleet.
 */
export function pickFleet(regulars, others, random, params = DEFAULT_FLEET_PARAMS) {
  const pool = [...regulars, ...others];
  const n = pickCount(Math.min(params.minVehicles, pool.length), pool.length, random, params.spread);
  const left = pool.slice();
  const chosen = [];
  while (chosen.length < n) chosen.push(left.splice(Math.floor(random() * left.length), 1)[0]);
  // Too few quads would leave nothing for the girls to ride: swap some of the others out for regulars that missed out.
  const want = Math.min(params.minRegulars, regulars.length, n);
  while (chosen.filter((s) => regulars.includes(s)).length < want) {
    const out = chosen.filter((s) => !regulars.includes(s));
    chosen.splice(chosen.indexOf(out[Math.floor(random() * out.length)]), 1);
    const back = left.filter((s) => regulars.includes(s));
    const pick = back[Math.floor(random() * back.length)];
    left.splice(left.indexOf(pick), 1);
    chosen.push(pick);
  }
  return pool.filter((s) => chosen.includes(s));
}
