// Which engine banks to download, and when. The recordings are big (a few MB each), so a bank is fetched only for an engine that is
// being used or that you are close enough to climb onto, not for every vehicle on the farm.

/** How close (metres) a stopped vehicle has to be before its bank is fetched, so it is ready by the time you start it. */
export const BANK_NEAR = 45;

/** Whether an engine needs its recorded bank now: it is on in some way (not off), or the listener is within `near` of it. */
export function wantsBank(engineState, distance, near = BANK_NEAR) {
  return engineState !== 'off' || !(distance > near);
}

/** The banks to load behind the loading screen: those of the vehicles within `near` of the start. `units` are { audioBank, at }. */
export function startBanks(units, from, near = BANK_NEAR) {
  const names = new Set();
  for (const u of units) {
    if (u.audioBank && Math.hypot(u.at.x - from.x, u.at.z - from.z) <= near) names.add(u.audioBank);
  }
  return [...names];
}
