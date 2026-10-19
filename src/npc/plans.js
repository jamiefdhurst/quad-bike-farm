// Plans, not just picks. Now and then, as she takes up one thing, she strings a second on after it and says so ("Tea first, then I am
// taking a quad out"), and does it when she's next free, unless something gets in the way (you ask her for something, or it's
// no longer on offer, or too long has passed). The pick is the chooser's (chooser.js) and the pending plan is kept on her Intent
// (intent.js). Pure.

import { choose } from './chooser.js';

// The things she may string together: each ends with her free again, and she can start it from standing. `first` is how she says it
// when it comes first, `then` how she says it coming second.
export const PLAN_PHRASES = {
  tea: { first: 'Tea', then: 'I am putting the kettle on' },
  drive: { first: 'A drive', then: 'I am taking a quad out' },
  rest: { first: 'A sit down', then: 'I am having a sit down' },
  wander: { first: 'A wander round', then: 'I am going for a wander' },
  lineUp: { first: 'Tidying the quads', then: 'I am tidying the quads' },
  warmHands: { first: 'Warming my hands', then: 'I am warming my hands' },
};

export const PLAN_KINDS = Object.keys(PLAN_PHRASES);

/** The line key for a plan of `first` then `then`. */
export const planKey = (first, then) => `plan_${first}_${then}`;

/** Every pair she might say, as { key: [line] }, joined the way she talks (`join(first, then)`). */
export function planLineSet(join, make = (lines) => lines) {
  const out = {};
  for (const a of PLAN_KINDS) {
    for (const b of PLAN_KINDS) if (a !== b) out[planKey(a, b)] = make([join(PLAN_PHRASES[a].first, PLAN_PHRASES[b].then)]);
  }
  return out;
}

/**
 * Whether she makes a plan out of `first` (just chosen, `needs` as they stand after it) and what she'd do second: one of the offers
 * she could take now, scored by the chooser against what she still wants, or null. `p`: planChance, planMin, chooseWhim.
 */
export function pickThen(first, offers, needs, p, random = Math.random) {
  if (!PLAN_KINDS.includes(first) || random() >= p.planChance) return null;
  const options = offers.filter((o) => o.key !== first && PLAN_KINDS.includes(o.key));
  return choose(needs, options, { ...p, chooseMin: p.planMin }, random).pick;
}
