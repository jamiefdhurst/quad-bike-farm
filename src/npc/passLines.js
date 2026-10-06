// Overtaking whoever she's following (herDriving.js passTarget): going past, and looking pleased with herself when they
// catch up. Jess does it out of impatience; Amy has lines too, for a convoy that swaps its order. Merged into the main line
// sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_PASS_LINES = {
  passOvertook: line(30, ['Sorry, I will just squeeze past!', 'Excuse me, coming through.', 'My turn at the front.']),
  passPleased: line(30, ['There you are. I did say I would wait.', 'Took your time!']),
};

export const JESS_PASS_LINES = {
  passOvertook: ['Come on, slowcoach!', 'Too slow! Coming through!', 'Is that as fast as it goes? Bye!', 'Out of my way, granny!'],
  passPleased: ['Oh, there you are. I have been here ages.', 'Took your time! I could have had a cup of tea.', 'Ha! Told you I would beat you. Not that it was a race.', 'Lovely day for a wait.'],
};
