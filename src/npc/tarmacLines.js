// The girls on the tarmac (tarmac.js): the driver noticing the road, Jess egging you on, Amy telling you off for the squealing.
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_TARMAC_LINES = {
  roadOn: line(90, ['Oh, proper road. That is much nicer.', 'Tarmac. No mud. I can relax.', 'Right, this I can do.']),
  roadEgg: line(40, ['Slow down. It is not a race track.']),
  roadScold: line(30, ['Stop squealing the tyres! You will wear them out.', 'That noise! Gently, please.', 'You are going to have us in the hedge. Gently!', 'Do you have to squeal it round every bend?']),
};

export const JESS_TARMAC_LINES = {
  roadOn: ['Tarmac! Now we are talking.', 'Road! Hold on to your hat.', 'Oh, I am opening this one up.'],
  roadEgg: ['Come on, faster! Is that all it does?', 'Go on, give it some! Nobody is looking.', 'Keep up, slowcoach!', 'Faster! Faster! Amy is not here to stop you.'],
};
