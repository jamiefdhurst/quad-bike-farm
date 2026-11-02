// What the girls say about the ride-on mower's job (world/mowing.js, the game's updateMowing). Amy likes a straight stripe; Jess wants a go.
//   mowDone   both lawns are cut and the job is ticked off the board
//   mowGrit   the blade is going on gravel or the road and throwing stones
// Merged last in the line sets (voiceLines.js, jessLines.js) so the banks before them stay as they are.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_MOW_LINES = {
  mowDone: line(60, ['That is both lawns done, and in stripes. Lovely.', 'Look at that, straight as a die. Nearly.', 'Tick it off. That is the best the yard has looked all year.']),
  mowGrit: line(45, ['Not on the gravel with the blade on, please. It will blunt it and throw stones everywhere.', 'Lever off on the hard bits. It sounds awful and it does the blade no good.', 'That is stones going everywhere. Blade off, please.']),
};

export const JESS_MOW_LINES = {
  mowDone: ['Stripes! You have made it look like a cricket pitch.', 'Done! Can we have a picnic on it now?', 'Ooh, very posh. Is that you being tidy?'],
  mowGrit: ['Stones! It is raining stones!', 'Ow! That one hit my leg.', 'You have got the blade on the gravel. Brilliant, do it again.'],
};
