// What the girls say when you call them back to the barn (the N key, or the tuning panel). Merged into the main line
// sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_RECALL_LINES = {
  recalled: line(20, ['Alright, I am coming.', 'On my way.', 'Coming! Give me a minute.']),
};

export const JESS_RECALL_LINES = {
  recalled: ['What now? Fine, coming.', 'Oh, just when it was getting good.', 'Alright, alright, I am on my way.'],
};
