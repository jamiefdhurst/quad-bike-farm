// Two-stroke smoke (smokeSense.js): Amy coughs and complains, Jess loves it, and each says something when following one.
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_SMOKE_LINES = {
  smokeCough: line(30, ['Ugh, that smoke! Cough, cough.', 'Urgh, two-strokes. Move it, please, I can taste it.', 'Cough! Can you stop smoking at me?', 'That is disgusting. My eyes are streaming.']),
  hazeCough: line(60, ['Cough! You could cut the air in here with a knife.', 'Can we turn something off? I cannot see the barn.', 'Cough, cough. It is like a fog machine in here.', 'My eyes. Everyone is idling and nobody is going anywhere.']),
  followSmoke: line(90, ['I am staying well back. I do not want that smoke.', 'I will follow, but not too close. It stinks.']),
};

export const JESS_SMOKE_LINES = {
  smokeCough: ['Ugh, smoke.'],
  smokeLove: ['Mmm, I love the smell of two-stroke.', 'That is the smell of summer. Breathe it in.', 'Ahh. Smells like a motocross track.'],
  hazeCough: ['Cough! Bit hazy.', 'Cough, cough. Ooh, you can taste it.', 'Is it me or has the yard gone blue?'],
  followSmoke: ['Right up the tailpipe. Lovely.', 'I am going to stay right behind you. I love that smoke.'],
};

// Only Jess says this one: Amy has no version of it.
export const JESS_ONLY_SMOKE_SITUATIONS = ['smokeLove'];
