// A diesel that has run dry has air in its fuel line, and won't catch again until it is bled at the lift pump's priming lever, even once
// there is fuel in the tank. `airLock` is 0 clear .. 1 full of air, kept on the fuel system. Petrol never gets it. Pure logic, no
// Three.js: quad.js feeds it each step, the toolbox panel works the lever.

export const DEFAULT_BLEED_PARAMS = {
  bleedSeconds: 6, // seconds holding the priming lever to clear a full air lock (progress stays if you let go)
  dryBelow: 0.02, // the float level (0..1) at or under which a diesel being run or cranked has sucked air in
  pumpFuel: 0.05, // litres the priming lever pushes through into the bowl at the end of a full bleed
};

export const BLEED_PARAM_RANGES = {
  bleedSeconds: [1, 20, 0.5],
  dryBelow: [0, 0.2, 0.005],
  pumpFuel: [0, 0.5, 0.01],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** True when a diesel being run or cranked has nothing left in the line, so air gets in. */
export function runsDry(bowlLevel, turning, P = DEFAULT_BLEED_PARAMS) {
  return turning && bowlLevel <= P.dryBelow;
}

/** The air lock after `dt` seconds of working the priming lever (`pumping`) or none. It only ever falls here, and needs fuel to push. */
export function stepBleed(airLock, dt, { pumping = false, hasFuel = true } = {}, P = DEFAULT_BLEED_PARAMS) {
  if (!pumping || !hasFuel) return clamp01(airLock);
  return clamp01(airLock - dt / Math.max(0.1, P.bleedSeconds));
}

/** The lever in words, for a toast or the panel. */
export function airText(airLock) {
  if (airLock < 0.02) return 'bled';
  if (airLock < 0.5) return 'a little air';
  return 'air in the line';
}
