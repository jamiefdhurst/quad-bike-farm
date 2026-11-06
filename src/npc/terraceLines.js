// The sheep field's terraces (world/hill.js, terraceSlope): what the girl on the back says when you take one of its banks.
// Merged into the main line sets last (voiceLines.js, jessLines.js), so the banks before them stay as they are.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_TERRACE_LINES = {
  terraceBank: line(45, ['Steady up the bank, please. Straight up it, not across.', 'These old terraces are lovely. Take them slowly and the sheep will not even look up.', 'Down the bank at a walking pace. There is no hurry.']),
};

export const JESS_TERRACE_LINES = {
  terraceBank: ['Ooh, a big step! Go on, take it faster!', 'Whee! Do the bank again, it is like a little hill!', 'Terraces! Take the next one flat out, it is basically a ramp.'],
};
