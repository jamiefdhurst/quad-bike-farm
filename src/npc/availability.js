// Whether a girl is free, and if not, what has her: one answer every feature asks (companion.availability()), instead of each one
// checking her state and its own list of flags (TODO 132). Pure: the companion hands it a snapshot of herself.
//
// The pattern (CLAUDE.md, "The girls' minds"): ask availability(), never fsm.is('idle') plus flags, to decide whether she can be
// given something to do. A new state gets a STATE_WHY entry (a test checks); a new thing she does that should keep other features off
// her is a JOBS entry (a flag on her), or, for a feature that takes her for a while, companion.hold(key, why) and release(key).

/** What each state means she's busy with, said for a person (the debug panel shows it). */
export const STATE_WHY = {
  idle: null,
  walking: 'walking somewhere',
  pranking: 'up to something',
  starting: 'starting a quad',
  mounting: 'getting on',
  seated: 'sitting on a vehicle',
  dismounting: 'getting off',
  driving: 'driving',
  cranking: 'swinging the starting handle',
  pushing: 'pushing a vehicle',
  shuffling: 'changing seats',
  boarding: 'getting on the trailer',
  onTrailer: 'riding the trailer',
  sliding: 'coming off the trailer',
  resting: 'sitting down',
};

/**
 * The things she does while stood about (each a flag on her, true or an object while it lasts) that keep other features off her:
 * [flag, what it is, soft]. Soft ones give way when you ask her to do something; the rest she finishes first.
 */
export const JOBS = [
  ['nickJob', 'off with your quad', false],
  ['hayFell', 'catching up the hay trailer', false],
  ['carrying', 'carrying something', false],
  ['pendingSpot', 'going to sit somewhere', false],
  ['lineUpJob', 'tidying the quads', true],
  ['numbPlan', 'walking off a numb bum', true],
  ['warmingAt', 'warming her hands', true],
];

/**
 * `s`: { state, restingSat (sat down where she rests, not on her way), jobs: { flag: value }, holds: [[key, why]] (features that have her),
 * held: why or null (something on the farm holding both girls, like a menu open) }. `asked`: you're asking her, so the farm's holds
 * and the soft jobs don't count. `mine`: the asking feature's own job (a JOBS flag or a hold key), which doesn't count against her.
 * Returns { free, why, settled, held, canRemark }: free to start something new; what has her ('free' if nothing); settled (stood
 * about or sat resting, free or not); the farm's hold, if any; canRemark (settled and not held: she can notice and remark on things).
 */
export function availabilityOf(s, { asked = false, mine = null } = {}) {
  const settled = s.state === 'idle' || (s.state === 'resting' && !!s.restingSat);
  const held = s.held ?? null;
  const out = (why) => ({ free: why === null, why: why ?? 'free', settled, held, canRemark: settled && !held });
  if (s.state !== 'idle') return out(STATE_WHY[s.state] ?? s.state);
  for (const [flag, why, soft] of JOBS) if (flag !== mine && s.jobs?.[flag] && !(soft && asked)) return out(why);
  const holds = (s.holds ?? []).filter(([key]) => key !== mine);
  if (holds.length) return out(holds[0][1]);
  if (held && !asked) return out(held);
  return out(null);
}
