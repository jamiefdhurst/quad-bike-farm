// Following you through the dust off the stubble fields (world/dust.js, herDriving.js): Amy drops back and complains, Jess tucks in and coughs.
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_DUST_LINES = {
  followDust: line(90, ['I am dropping back. I am not eating your dust.', 'Go on, I will follow at a distance. I would like to breathe.', 'You are kicking up a cloud. I will stay well back.']),
  dustCough: line(30, ['Cough! Dust! Slow down!', 'I cannot see a thing. Cough!', 'That is going straight in my eyes.']),
};

export const JESS_DUST_LINES = {
  followDust: ['Ooh, a dust cloud. I am right behind you.', 'I am following you into the dust. Cough, cough.', 'Here we go. I will be brown by the end of this.'],
  dustCough: ['Cough! Cough! I love it!', 'Cough, cough. I cannot see, keep going!', 'I can taste the field. Cough!'],
};
