// The barn find (vehicle/barnFind.js): rustyTarp when the tarp comes off, rustyRuns when it starts for the first time in years.
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_RUSTY_LINES = {
  rustyTarp: line(60, ['Oh my goodness, there is a whole quad under there. It has not moved in years.', 'Look at the state of it. It is mostly rust and cobwebs, but it is all there.', 'That has been in the corner since before I came here. Do not touch the seat, there will be mice.']),
  rustyRuns: line(60, ['It is running! After all that time. Well done, you!', 'Listen to that. It is alive! Cough, a bit smoky, but alive.', 'You did it. I honestly did not think it would go.']),
};

export const JESS_RUSTY_LINES = {
  rustyTarp: ['Ooh, a secret quad! Is it ours? Can I have it?', 'A barn find! Right, it is mine. I called it.', 'That is gross. I love it.'],
  rustyRuns: ['Yes! Yes! It goes! Can I ride it? Please?', 'Smoke everywhere! Cough! Brilliant!', 'You are a genius! Go on, give it some revs!'],
};
