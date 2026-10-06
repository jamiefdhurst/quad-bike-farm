// Lining them up (lineUp.js): Amy tidying the quads into a row by the barn, Jess leaving one crooked on purpose.
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_LINEUP_LINES = {
  selfLineUp: line(90, ['Right. This yard is a state. I am putting the quads in a row.', 'I cannot stand them all pointing different ways. Give me a minute.']),
  selfCrooked: line(90, ['I am just going to park this one properly.']),
  lineUpStraighten: line(30, ['There. Straight. Was that so hard?', 'Honestly. Look at the angle of that.']),
  lineUpNotice: line(60, ['Jess! You parked that crooked on purpose!', 'I can see that, you know. Do not think I cannot see that.']),
};

export const JESS_LINEUP_LINES = {
  selfLineUp: ['Amy has gone mad again, I will help. Sort of.'],
  selfCrooked: ['Watch Amy lose it over this.', 'Just a little bit crooked. Just for fun.'],
  lineUpStraighten: ['Oh, you are no fun.', 'It was fine like that.'],
  lineUpNotice: ['What? It is perfectly parked.'],
};
