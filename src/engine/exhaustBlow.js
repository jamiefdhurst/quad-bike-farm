// An exhaust blow. A cracked manifold or a loose joint leaks a little gas at every exhaust pulse: from cold it ticks and chuffs, and as the
// engine heats the metal swells and the joint seals, so it quietens and goes. Heard, not shown: the engine emits 'blow' events and the
// audio plays a tick or a chuff for each. The fault's level (faults.js `exhaustBlow`) is how bad the joint is; the bench puts it right.
// It is not the holed silencer (`exhaustLeak`), which is loud all the time. Pure logic.

export const DEFAULT_BLOW_PARAMS = {
  blowWarmBelow: 0.6, // engine temperature (0 cold, 1 warm) over which the joint has sealed and the blow has gone
  blowPerFiring: 0.6, // chance of a tick or chuff on each firing at the worst, stone cold at idle: it keeps time with the exhaust pulses
  blowRevsQuiet: 0.5, // how much quieter it is at full revs: the rest of the exhaust drowns it
};

export const BLOW_RANGES = {
  blowWarmBelow: [0.1, 1, 0.05],
  blowPerFiring: [0, 1, 0.05],
  blowRevsQuiet: [0, 1, 0.05],
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** How loud the blow is, 0..1: the joint's level, less as the engine warms. */
export function blowLevel(level, temperature, p) {
  return clamp01(level) * clamp01(1 - temperature / Math.max(0.01, p.blowWarmBelow));
}

/** How much of it carries at these revs (0..1 of full speed): all of it idling, less with the revs up. */
export function blowCarry(rpmNorm, p) {
  return 1 - p.blowRevsQuiet * clamp01(rpmNorm);
}
