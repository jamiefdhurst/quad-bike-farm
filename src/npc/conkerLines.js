// Conkers on an autumn day (conkers.js). Jess throws them at you and crows or groans; Amy tuts, and warns you about the wet leaves. Merged
// into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest. The girls call the player only "you".

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_CONKER_LINES = {
  conkerAmy: line(40, ['Jess, that is a real conker. It will hurt.', 'Honestly, Jess. Stop throwing things.', 'Jess! Put it down. Someone will lose an eye.']),
  conkerWood: line(300, ['Oh, look at the conkers. They are all over the floor.', 'It is lovely in here this time of year. All the leaves have turned.']),
  conkerSlippery: line(300, ['Careful on those leaves. They are slippery when they are wet.', 'Take it steady through the trees. The leaves are like soap.']),
};

export const JESS_CONKER_LINES = {
  conkerGo: ['Ooh, look at this one. A big one!', 'Hey. Hey, you. Look this way.', 'Found a conker. Do not move.', 'Stand still. This will only hurt a bit.'],
  conkerHit: ['Got you! Right on the head!', 'Ha! Bullseye!', 'Yes! Did you see that? Straight in!', 'Thock! That is a ten.'],
  conkerMiss: ['Oh, so close!', 'Drat. Hold still, will you?', 'Missed! I will get you next time.', 'Ugh, I had that.'],
};

/** Only Jess says these (Amy has no line for them). */
export const JESS_ONLY_CONKER_SITUATIONS = Object.keys(JESS_CONKER_LINES);
