// What the girls say when they notice they have got dirty (muddiness.js): Amy minds, Jess laughs. muddy for the mud on her jeans, dusty for the
// stubble dust in her face and hair. Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_MUDDY_LINES = {
  muddy: line(60, ['Look at my jeans. They were clean this morning.', 'I am plastered. Could you go round the puddles?', 'That is mud up to my knees. Honestly.', 'I will be hosing myself down after this.']),
  dusty: line(60, ['I have half the field in my hair.', 'I can taste the stubble. Lovely.', 'My face is gritty. Could you slow down a bit?']),
};

export const JESS_MUDDY_LINES = {
  muddy: ['Ha! Look at the state of me!', 'I am more mud than girl. Brilliant.', 'Look at my jeans! Do it again!', 'I am filthy. I love it.'],
  dusty: ['I have got a whole field in my hair. Brilliant.', 'Cough! I am coated. Go faster!', 'I can feel the dust in my teeth. Ha!'],
};
