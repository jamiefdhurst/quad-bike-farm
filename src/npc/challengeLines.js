// The chalkboard's challenges (world/challenges.js): what the nearest girl says when you finish the cold start or the line-up, a new best or not.
// Merged into the main line sets (voiceLines.js, jessLines.js).

const line = (cooldown, lines) => ({ cooldown, lines });

export const CHALLENGE_LINE_KEYS = ['challengeDone', 'challengeBest'];

export const AMY_CHALLENGE_LINES = {
  challengeDone: line(30, ['That is on the board. It is not your best, though.', 'Not bad. You can do better than that, you know.']),
  challengeBest: line(30, ['A new best! I shall chalk that up myself.', 'That is your best yet. Very tidy indeed.']),
};

export const JESS_CHALLENGE_LINES = {
  challengeDone: ['Hm. Could be quicker. Could be straighter.', 'Fine. I would have been faster, but fine.'],
  challengeBest: ['Your best! Do not let it go to your head.', 'Oh, go on then. That is a good one.'],
};
