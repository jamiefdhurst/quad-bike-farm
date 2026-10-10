// What the girls say when you fix up the quad that is her favourite and it had gone rough (dontFixIt.js): fixMinds. Jess says you have made
// it boring; Amy wanted it fixed but will miss it. Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the
// rest. The girls call you "you", never he, she or they.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_DONTFIX_LINES = {
  fixMinds: line(45, ['Well, I did ask you to fix it. I will miss the buzz, though.', 'It runs properly now. Good. A little bit of me misses the shake.', 'Much better. Mostly. I did rather like it rattling.']),
};

export const JESS_DONTFIX_LINES = {
  fixMinds: ['You have made it boring.', 'Why did you fix it? That was the fun bit.', 'Oh, brilliant. Now it is smooth. Thanks very much.', 'It was much better when it was rattling.'],
};
