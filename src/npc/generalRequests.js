// What you can ask a girl that isn't about a particular vehicle, wherever she is up to: come here, stop, I'll be a minute. Pure
// (tested): the companion hands over her state and what availability() says; game.js turns the kinds into wheel slices.
// Asked with `availability({ asked: true, pull: true })`, so soft jobs and the farm's holds don't count and a girl on her way
// somewhere, sat on a vehicle or driving can be broken into.

/** How close counts as "already here" for Come here (metres). */
export const HERE_DISTANCE = 2.5;

/**
 * The general requests that make sense for her now, in wheel order. `s`: { state, avail (availability result), youDistance }.
 * Returns kinds from 'come', 'stop', 'wait'. Nothing when something has her (avail.free false); the caller says why.
 */
export function generalRequests(s) {
  if (!s.avail.free) return [];
  const out = [];
  if (['idle', 'walking', 'driving', 'seated', 'mounting'].includes(s.state) && !(s.state === 'idle' && s.youDistance < HERE_DISTANCE)) out.push('come');
  if (s.state === 'walking') out.push('stop');
  if (['idle', 'walking', 'driving'].includes(s.state)) out.push('wait');
  return out;
}
