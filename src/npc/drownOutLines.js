// Drowning her out (drownOut.js). Jess revs over Amy mid-sentence and pretends she can't hear; Amy tells her to switch it off
// (she never does it herself). Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_DROWNOUT_LINES = {
  drownTellOff: line(30, ['Jess! Switch it off!', 'Jess, I was talking! Turn it off!']),
};

export const JESS_DROWNOUT_LINES = {
  drownRev: ['Sorry, what? Cannot hear you!', 'Hm? Say again!', 'What was that? It is a bit loud!'],
  drownProtest: ['Oi! I was only warming it up.', 'Spoilsport.', 'Fine. Fine! It is off.'],
};

export const JESS_ONLY_DROWNOUT_SITUATIONS = ['drownRev', 'drownProtest'];
