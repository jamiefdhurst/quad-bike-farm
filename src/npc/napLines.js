// Asleep on the back (backNap.js): the girl behind you wakes, with a start or gently. Merged into the main line sets
// (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_NAP_LINES = {
  napStart: line(30, ['Oh! I was not asleep.', 'Goodness. I only closed my eyes.', 'Ow, what was that? I was nearly off.']),
  napGentle: line(30, ['Mm. Are we there?', 'Sorry. Was I leaning on you?', 'I did not drop off. Not properly.']),
};

export const JESS_NAP_LINES = {
  napStart: ['Oi! I was comfy!', 'Was that a pothole or you?', 'What, what, I am awake!', 'Ow! Warn a girl.'],
  napGentle: ['Are we there yet?', 'I was resting my eyes. Do not say a word.', 'Did I drool on you? Do not answer that.'],
};
