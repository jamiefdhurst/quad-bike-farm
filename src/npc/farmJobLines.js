// What the girls say about the farm jobs (world/farmJobs.js, the game's updateMuck). Amy likes a tidy job done; Jess minds the smell.
//   muckStart  you've started forking muck into the little trailer
//   muckFull   the tub is full
//   muckDone   the strip is spread and the job ticked off the board
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_FARM_JOB_LINES = {
  muckStart: line(60, ['Good, that heap has wanted shifting since the spring.', 'Muck first, then the stubble. It is on the board, so no excuses.', 'Fork it in properly, please. Right into the corners.']),
  muckFull: line(60, ['That is a proper load. Go steady with it.', 'Full to the top. Do not go over the ruts with that.', 'Right, that is enough. Any more and it will slop out.']),
  muckDone: line(60, ['That is a lovely even strip. The field will thank you.', 'Done, and no bare patches. That is how it is done.', 'Tick it off the board. I like a board with ticks on.']),
};

export const JESS_FARM_JOB_LINES = {
  muckStart: ['Oh no, you are not doing the muck. I can smell it from here.', 'Rather you than me. I am staying upwind.', 'Pooh. Is that the heap? That is a crime against noses.'],
  muckFull: ['Eurgh. Please do not drive past me with that.', 'That is a lot of muck. Look at the size of it!', 'My nose is going on strike. Shift it, quick.'],
  muckDone: ['Ha! The field smells lovely now. Of poo.', 'Done! Now go and wash, you absolute pong.', 'Well, that is the stubble sorted. Not sitting near you, though.'],
};
