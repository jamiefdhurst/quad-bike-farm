// What the girls say when you ring the bell by the barn doors to call them back (or use the tuning panel's button), and when
// you keep ringing it after they're already on their way. Merged into the main line sets (voiceLines.js, jessLines.js), so
// they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_RECALL_LINES = {
  recalled: line(20, ['Alright, I am coming.', 'On my way.', 'Coming! Give me a minute.', 'That is the bell. Coming!']),
  bellAgain: line(15, ['I heard you! I am coming.', 'Yes, yes, I heard the bell.', 'Give me a chance to get there!']),
};

export const JESS_RECALL_LINES = {
  recalled: ['What now? Fine, coming.', 'Oh, just when it was getting good.', 'Alright, alright, I am on my way.', 'Dinner bell, is it? Coming.'],
  bellAgain: ['I heard it the first time!', 'Ring that once more and I\'m going home.', 'Stop ringing it, my ears!'],
};
