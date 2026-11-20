// Calling them (#690, settled with Jamie on 13 November 2026): a "Call them" choice on your own wheel, no new key. On a farm this size you can't see
// where they are, so near the call is a loud whistle and the girl in earshot either comes to you (she can walk it) or answers with where she is.
// Beyond earshot it is the phone (not here: its own issue). Pure: the game says where everyone is and carries out what comes back.

export const DEFAULT_CALL_PARAMS = {
  earshot: 120, // metres: a girl this close hears the whistle
  comeWithin: 60, // metres: she is this close, she walks over to you (further and she calls back where she is, and doesn't set off on a long walk)
  loudness: 0.5, // the whistle's volume (0 to 1)
};

export const CALL_PARAM_RANGES = {
  earshot: [20, 300, 5],
  comeWithin: [10, 150, 5],
  loudness: [0, 1, 0.05],
};

/**
 * What each girl does when you call. `girls`: [{ id, distance, free }] (free: `availability({ asked: true })`, soft jobs giving way).
 * Returns [{ id, answer: 'come' | 'here' | 'busy' | 'deaf' }]: she comes to you, answers with where she is, is doing something she can't leave
 * (and says nothing), or is out of earshot.
 */
export function callThem(girls, p = DEFAULT_CALL_PARAMS) {
  return girls.map((g) => {
    if (g.distance > p.earshot) return { id: g.id, answer: 'deaf' };
    if (!g.free) return { id: g.id, answer: 'busy' };
    return { id: g.id, answer: g.distance <= p.comeWithin ? 'come' : 'here' };
  });
}

/** What the game says to you: nobody heard it, or the girls who answered. */
export function callSummary(answers) {
  if (answers.every((a) => a.answer === 'deaf')) return 'nobody hears you';
  return null;
}
