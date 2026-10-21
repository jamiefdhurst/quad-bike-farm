// What the girls say about the day going (world/daylight.js): gettingDark as the light goes, darkGoIn now and then once it's dark and
// they're still out, and goInDark as one heads for the barn out of it. Merged into the main line sets (voiceLines.js, jessLines.js),
// so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_DUSK_LINES = {
  gettingDark: line(900, ['It is getting dark. We should think about going in soon.', 'The light is going. Have you got your headlights on?', 'Look at that sky. It will be dark in half an hour.']),
  darkGoIn: line(120, ['It is pitch black out here. Can we go in?', 'I cannot see a thing. Shall we call it a night?', 'It is cold and dark. I would like to go in.']),
  darkStartle: line(25, ['What was that?', 'Did you hear that? What was that?', 'Oh! Something is out there.', 'I do not like the dark. What was that noise?']),
  goInDark: line(90, ['I am going in. It is too dark out here.', 'I will wait in the barn. It is warmer in there.']),
};

export const JESS_DUSK_LINES = {
  gettingDark: ['It is getting dark! Quick, one more go before we cannot see.', 'Ooh, look at the sunset.', 'Lights on, everyone. It is getting dark.'],
  darkGoIn: ['I am freezing and I cannot see. Can we go in now?', 'It is dark. I am not scared. I just want to go in.', 'Night riding is fun, but my fingers have gone.'],
  darkStartle: ['Ha! What was that?', 'Did you hear that? Was that a fox?', 'It is nothing. It is nothing. What was that?', 'Do not look at me, I did not jump.'],
  goInDark: ['I am off in. Shout if you need me.', 'Barn. Warm. Now.'],
};
