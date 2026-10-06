// What the girls say about starting your usual quad for you (headStart.js): headStartGo (the favoured girl, off to warm it
// up before you get there) and snubGo (the neglected one, starting her own and leaving yours). Merged into the main line
// sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_HEADSTART_LINES = {
  headStartGo: line(120, ['I will get yours going, you will want it warm.', 'Hang on, let me start it for you.', 'Stay there. I will have it warm in a minute.']),
  snubGo: line(120, ['I am starting mine. Yours is on its own.', 'I have got my own to see to.', 'I am just going to start mine, if that is all right with you.']),
};

export const JESS_HEADSTART_LINES = {
  headStartGo: ['Oi, wait! I will start it for you!', 'I have got it, I have got it. It will be nice and warm.', 'Let me. You always flood it.'],
  snubGo: ['I am doing mine. Start your own.', 'Mine first. Yours can wait.', 'Not starting yours. Do not look at me like that.'],
};
