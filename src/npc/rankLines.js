// What the girls say when they compare which quads shake them most (comparingNotes.js): rankAsk (one asks the other), rankTop (naming her
// favourite shaker: written out for each quad and its nicknames, as the lines about a quad are), rankAgree, rankDisagree, and rankVerdict
// (after swapping quads to settle it). Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.
// The girls call you "you", never he, she or they.

import { expandQuadLines } from './quadNames.js';

const line = (cooldown, lines) => ({ cooldown, lines });

const AMY_TEMPLATES = {
  rankTop: line(30, ['{Q} shakes me the most, I think.', 'For the shake, I like {q} best.', 'If I am honest, {q}. It rattles just right.']),
};

const JESS_TEMPLATES = {
  rankTop: line(30, ['{Q}! No question. It shakes like mad.', '{Q} is the best shaker. Obviously.', 'Easy. {Q}. Nothing else comes close.']),
};

export const AMY_RANK_LINES = {
  ...expandQuadLines(AMY_TEMPLATES),
  rankAsk: line(60, ['Which quad shakes you the most, would you say?', 'Which one do you like best for the shaking?']),
  rankAgree: line(30, ['The same as mine, then. Good taste.', 'Oh, the same as me. How nice.']),
  rankDisagree: line(30, ['No, I do not think that is right at all.', 'Really? I would put mine above that.', 'We will have to disagree on that.']),
  rankVerdict: line(60, ['Hm. Actually, this one is better than I gave it credit for.', 'No, mine is still better. Do not tell anyone I said so.']),
};

export const JESS_RANK_LINES = {
  ...expandQuadLines(JESS_TEMPLATES),
  rankAsk: ['Right, which quad shakes you the most? Go on.', 'Tell me your best shaker. I bet it is wrong.'],
  rankAgree: ['Same as mine! Great minds.', 'Oh, the same. Boring.'],
  rankDisagree: ['What? No! That is the wrong one!', 'You have no idea. Mine is miles better.', 'Wrong. So wrong.'],
  rankVerdict: ['Okay, this is actually pretty good. Fine.', 'Nope. Mine is still better. Obviously.'],
};
