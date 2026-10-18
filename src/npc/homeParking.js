// Done with a quad out in the field, a girl usually drives it back to the barn before getting off (about two times in three), and
// leaves it in the open ground just east of the row in front of the doors, away from the others. She also jogs when she has a way to go.
// Pure logic: whether to, where, and when to break into a jog. The driving itself is the `park` route in herDriving.js.

import { DEFAULT_LINEUP_PARAMS } from './lineUp.js';

export const DEFAULT_HOME_PARAMS = {
  returnChance: 0.65, // chance, done with a drive she'd get off after, that she brings it back near the barn first
  nearRadius: 22, // metres from the middle of the row: already this close and she just gets off
  spotX: -43.5, // metres: where she leaves it, east of the row (the row is at x -50)
  spotXSpread: 3.5, // how far either way of that
  spotZSpread: 14, // and either way along the row's length
  gap: 3.5, // metres she leaves from any other quad
  tries: 10, // places she tries before giving up and getting off where she is
  jogFrom: 10, // metres from where she is going: further than this and she jogs
  jogUntil: 4, // and she slows to a walk once she is this close
  jogBoost: 2.1, // times her walking speed when jogging
  jogAnimMax: 2, // the most the walking clip is sped up to, so it doesn't blur
};

export const HOME_PARAM_RANGES = {
  returnChance: [0, 1, 0.05],
  nearRadius: [5, 80, 1],
  spotX: [-48, -30, 0.5],
  spotXSpread: [0, 8, 0.5],
  spotZSpread: [0, 25, 0.5],
  gap: [2, 8, 0.1],
  tries: [1, 30, 1],
  jogFrom: [3, 40, 1],
  jogUntil: [1, 20, 1],
  jogBoost: [1, 4, 0.1],
  jogAnimMax: [1, 4, 0.1],
};

/** Drives that end with her wanting to get off any way, which are the ones that bring it home. A parked or failed one doesn't. */
export const HOME_RESULTS_SKIPPED = ['parked', 'gaveUp', 'noRoom', 'rescued']; // rescued: she leaves it where you pulled it out, not straight back into the mud

/** Whether this quad is already close to the barn. */
export function nearBarn(pos, home = DEFAULT_HOME_PARAMS, lineUp = DEFAULT_LINEUP_PARAMS) {
  return Math.hypot(pos.x - lineUp.rowX, pos.z - lineUp.rowZ) < home.nearRadius;
}

/**
 * Where to leave it: somewhere in the open ground east of the row, clear of every other quad (`others`, each { x, z }), noses to the barn
 * give or take. Null if she can't find room. `random` is Math.random in the game.
 */
export function pickHomeSpot(others, random = Math.random, home = DEFAULT_HOME_PARAMS, lineUp = DEFAULT_LINEUP_PARAMS) {
  for (let i = 0; i < home.tries; i++) {
    const x = home.spotX + (random() * 2 - 1) * home.spotXSpread;
    const z = lineUp.rowZ + (random() * 2 - 1) * home.spotZSpread;
    if (others.every((o) => Math.hypot(o.x - x, o.z - z) >= home.gap)) return { x, z, yaw: lineUp.yaw + (random() * 2 - 1) * 0.5 };
  }
  return null;
}

/** Whether she brings it home: not for a drive that was parking or failed, nothing on the back, not already there, and a roll of `returnChance`. */
export function bringsItHome({ result, pos, hasPassenger, asked }, random = Math.random, home = DEFAULT_HOME_PARAMS, lineUp = DEFAULT_LINEUP_PARAMS) {
  if (asked || hasPassenger || HOME_RESULTS_SKIPPED.includes(result) || nearBarn(pos, home, lineUp)) return false;
  return random() < home.returnChance;
}

/** Jogging or walking this step, with a little hysteresis so she doesn't flip at the edge: jogs from `jogFrom` away, walks once within `jogUntil`. */
export function jogging(was, distance, home = DEFAULT_HOME_PARAMS) {
  if (distance > home.jogFrom) return true;
  return was && distance > home.jogUntil;
}
