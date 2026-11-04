// What the girls say about harrowing the field (world/harrowing.js, the game's updateHarrows):
//   harrowStart   the tines are down and the first of the field has been combed
//   harrowDone    enough of the field is harrowed and the job is ticked off the board
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_HARROW_LINES = {
  harrowStart: line(90, ['Nice and steady, and overlap each pass. It only combs where the tines go.', 'That is the molehills going. Keep to a walking pace and do not let it skip.', 'Up and down, please, in straight lines. It is only a field, not a race.']),
  harrowDone: line(90, ['That is the whole field combed. Lift the tines before you drive off with it.', 'All harrowed, and the molehills are gone. Tick it off the board.', 'That looks properly done. Lift the tines, and mind the hedge.']),
};

export const JESS_HARROW_LINES = {
  harrowStart: ['Ooh, it is making stripes! Do a swirly one, go on.', 'Look at all the grass stuck in it! Keep going.', 'It sounds like a giant rake. I love it.'],
  harrowDone: ['Done! It looks like a very tidy haircut.', 'All harrowed! Can we do the molehills again? No? Fine.', 'That is the lot! The field looks gorgeous. For a field.'],
};
