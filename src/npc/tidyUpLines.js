// What the girls say about tidying up (tidyUp.js): Amy's tidyGate, tidyCan and tidyHelmet (she's off to put it right), and Jess's leaveItLying
// (she drops her helmet and leaves it). Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_TIDY_UP_LINES = {
  tidyGate: line(60, ['Somebody left that gate open. I will shut it.', 'That gate wants shutting. I will do it.', 'The gate is open again. I will see to it.']),
  tidyCan: line(60, ['That can does not live there. I will put it back.', 'I will take that can back where it belongs.', 'Cans go by the tank. I will return it.']),
  tidyHelmet: line(60, ['A helmet is not a doormat. I will hang it up.', 'That helmet belongs on its hook. I will put it back.', 'I will hang that up before somebody stands on it.']),
};

/** Situations only Jess has (Amy tidies instead). */
export const JESS_ONLY_TIDY_UP_SITUATIONS = ['leaveItLying'];

export const JESS_TIDY_UP_LINES = {
  leaveItLying: ['Leaving that there. Amy will get it.', 'It is fine where it is. Somebody will tidy it.', 'Helmet down. Not my problem now.'],
};
