// What she does next, chosen by what she needs (needs.js) rather than each thing rolling its own dice. Features offer what she could
// do now (an offer is { key, weight, ...the feature's own data }); each kind of offer says which needs it meets and by how much
// (OFFER_KINDS). Every couple of seconds while she's free she weighs them: the needs each meets times its weight (her taste for it,
// mostly the old chance params) times a whim, and she takes the best if it clears the bar. Pure.
//
// The pattern (CLAUDE.md, "The girls' minds"): a new thing a girl decides to do on her own is an offer with an OFFER_KINDS entry, not
// a timer and a random() in its own module. A test fails if an offer kind meets no need or names one that doesn't exist.

import { gaussian } from './boredom.js';

/**
 * Each kind of thing she could choose: label (for the debug panel: "she chose to ..."), satisfies (need -> how much it meets it),
 * urgent (she'll stop something idle for it: get up off a seat, leave her hands over an engine; shelter from the rain).
 */
export const OFFER_KINDS = {
  wander: { label: 'wander off for a look round', satisfies: { purpose: 0.6 } },
  mount: { label: 'get on a quad to wait', satisfies: { purpose: 0.5, rest: 0.4 } },
  start: { label: 'have a go at starting one', satisfies: { purpose: 0.6, excitement: 0.2, warmth: 0.3 } }, // an engine to warm her hands by
  drive: { label: 'take one for a drive', satisfies: { purpose: 0.6, excitement: 0.8 } },
  rest: { label: 'go and sit somewhere', satisfies: { purpose: 0.4, rest: 1 } },
  join: { label: "hop on the back of her friend's", satisfies: { purpose: 0.5, company: 0.8, excitement: 0.4 } },
  buzz: { label: 'sit on a rough one for the shake', satisfies: { purpose: 0.5, excitement: 0.7, rest: 0.3 } },
  lineUp: { label: 'tidy the quads', satisfies: { purpose: 0.9 } },
  showOff: { label: 'show off to you', satisfies: { purpose: 0.5, excitement: 0.7, company: 0.5 } },
  jumps: { label: 'jump the ramp', satisfies: { purpose: 0.5, excitement: 1 } },
  doughnuts: { label: 'spin doughnuts', satisfies: { purpose: 0.5, excitement: 0.9 } },
  warmHands: { label: 'warm her hands on an engine', satisfies: { warmth: 1 } },
  warmHandsJoin: { label: 'warm her hands with her friend', satisfies: { warmth: 1, company: 0.4 } },
  shelterBarn: { label: 'shelter in the barn doorway', satisfies: { warmth: 0.8 }, urgent: true },
  shelterCab: { label: 'shelter in a cab', satisfies: { warmth: 0.9, rest: 0.3 }, urgent: true },
  warmCab: { label: "sit in a Land Rover with the heater on", satisfies: { warmth: 1, rest: 0.4 } },
  tea: { label: 'make a cup of tea', satisfies: { warmth: 0.4, rest: 0.3, purpose: 0.5 } },
  favour: { label: 'ask you a favour', satisfies: { purpose: 0.5, company: 0.5 } },
};

/** How much this offer would do for her now: the needs it meets, weighted by how much she cares for it. */
export function scoreOffer(offer, needs) {
  const kind = OFFER_KINDS[offer.key];
  if (!kind) return 0;
  let sum = 0;
  for (const [n, amount] of Object.entries(kind.satisfies)) sum += (needs[n] ?? 0) * amount;
  return sum * (offer.weight ?? 1);
}

/** Which of her needs this offer mostly answered (the biggest share of its score): what she did it for. */
export function mainNeed(offer, needs) {
  const kind = OFFER_KINDS[offer.key];
  if (!kind) return null;
  let best = null;
  let bestShare = -1;
  for (const [n, amount] of Object.entries(kind.satisfies)) {
    const share = (needs[n] ?? 0) * amount;
    if (share > bestShare) {
      best = n;
      bestShare = share;
    }
  }
  return best;
}

/**
 * What her mind is doing, said for the debug panel and the console (`mind` is the companion's: { last, since, scored, waiting, thinkIn }):
 * { chose, nearly, next }.
 */
export function describeMind(mind) {
  const label = (key) => OFFER_KINDS[key]?.label ?? key;
  const chose = mind.last ? `${label(mind.last.key)}, for ${NEED_WORDS[mind.last.need] ?? mind.last.need} (${Math.round(mind.since)} s ago)` : 'nothing yet';
  const others = mind.scored.slice(0, 3);
  const nearly = others.length ? others.map((s) => `${label(s.key)} ${s.score.toFixed(2)}`).join('; ') : 'nothing on offer';
  const next = mind.waiting ? `not now: ${mind.waiting}` : `thinks again in ${Math.max(0, mind.thinkIn).toFixed(1)} s`;
  return { chose, nearly, next };
}

const NEED_WORDS = { warmth: 'warmth', company: 'company', excitement: 'excitement', rest: 'a rest', purpose: 'something to do' };

/**
 * Her choice: { pick, scored } where scored is every offer with its score (best first, for the debug panel) and pick the one she
 * takes, or null. Nothing is taken unless the best scores at least `chooseMin`: as a score is the needs it meets, a girl whose needs
 * are all met, or who's offered nothing that meets the ones that press, is content to stand. Each score gets a whim (log-normal,
 * `chooseWhim` wide) so she isn't predictable.
 */
export function choose(needs, offers, p, random = Math.random) {
  const scored = offers
    .map((o) => ({ offer: o, score: scoreOffer(o, needs) * Math.exp(gaussian(random) * p.chooseWhim) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  const pick = best && best.score >= p.chooseMin ? best.offer : null;
  return { pick, scored };
}
