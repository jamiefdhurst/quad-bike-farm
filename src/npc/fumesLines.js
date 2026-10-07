// Fumes in the barn (world/barnFumes.js): the girls cough and go out, Amy switches the engine off or tells you to.
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_FUMES_LINES = {
  fumesCough: line(30, ['Cough! I cannot breathe in here.', 'Right, out. Cough, cough. It is full of fumes.', 'Ugh, my eyes. Somebody has left something running.']),
  fumesSwitchOff: line(30, ['Honestly. Engines off in the barn.', 'Hang on. I will switch it off.', 'Who runs a quad indoors? Off.']),
  fumesTell: line(30, ['Turn it off! You cannot run that in here.', 'Out of the barn, or switch it off. Cough! Please.']),
};

export const JESS_FUMES_LINES = {
  fumesCough: ['Cough! Okay, that is a bit much.', 'Cough, cough. Smells like a petrol station in here.', 'Out, out, out. I am going blue.'],
};
