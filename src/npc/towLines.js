// What the girls say when they steer a dead quad on the tow rope: towStart (she has the wheel), towSnatch (you took off too hard and it
// jerked), towBump (you stopped and she nearly ran into you) and towDone (the rope's off). Merged into the main line sets
// (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_TOW_LINES = {
  towStart: line(20, ['Right, I have the wheel. Go gently, please.', 'I am steering. Nothing sudden, you.', 'Rope is on. Take it slowly and I will keep it straight.']),
  towSnatch: line(6, ['Ow! Not so fast. It nearly took my arms off.', 'Gently! You jerked it.', 'Take up the slack first, then go.']),
  towBump: line(8, ['You stopped! I almost ran into the back of you.', 'Warn me before you stop. I am only on the brake.', 'Careful! I nearly hit you.']),
  towDone: line(20, ['Rope is off. That went better than I expected.', 'There. Towed home with dignity.', 'Done. Do not break anything else today.']),
};

export const JESS_TOW_LINES = {
  towStart: ['I am steering! Not going anywhere on my own, am I?', 'Right, go on then. Do not go mad!', 'Wheeee, I am being towed. Go slow!'],
  towSnatch: ['Whoa! You nearly yanked my head off!', 'Ow! Easy on the rope!', 'You snatched it! Warn me!'],
  towBump: ['You stopped! I nearly went into the back of you!', 'Brake lights, you! Brake lights!', 'Oi! Watch it, I nearly hit you!'],
  towDone: ['Rope off. That was dead fun, actually.', 'We made it. I only nearly hit you twice.', 'Done! Can I steer the next one too?'],
};
