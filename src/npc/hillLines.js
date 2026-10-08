// The hill through the south gate (world/hill.js): pulling up at the foot of it when you ride on up (Amy won't, and won't let Jess), and
// on the back with you on a steep slope. Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines, shout = false) => ({ cooldown, lines, shout });

export const AMY_HILL_LINES = {
  hillWait: line(60, ['I am not taking it up there. I will wait here.', 'No. Not up that. I will be right here when you have finished.', 'That is far too steep for me. I am staying at the bottom.'], true),
  hillSteep: line(20, ['Lean uphill! Lean uphill!', 'This is too steep. Go straight up it, not across!', 'If we go over, I am never getting on with you again.']),
};

export const JESS_HILL_LINES = {
  hillWait: ["Amy would kill me if I took it up there. Go on then, I'll wait.", "I want to come up! Amy says I'm not allowed. I'm waiting here.", "Fine. I'll sit at the bottom like a good girl. Amy's rules."],
  hillSteep: ["Woah! We're going over! Lean, lean!", 'This is mental. Keep going, keep going!', "Don't you dare tip us. Amy would never let me hear the end of it."],
};
