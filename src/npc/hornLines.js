// What the girls say when you beep at them, and when Jess creeps up behind Amy and beeps (horns.js). Merged into the main
// line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_HORN_LINES = {
  hornAnswer: line(20, ['Beep beep!', 'Hello to you too.', 'Yes, I can hear you!']),
  hornJump: line(30, ['Jess! Do not do that!', 'Jess! I nearly came off!', 'Do not creep up on me like that!']),
};

export const JESS_HORN_LINES = {
  hornAnswer: ['Beep beep!', 'Move over, then!', 'Mine is louder.'],
  hornJump: ['Ha! You jumped a mile!', 'Your face! Brilliant.', 'Got you!'],
};
