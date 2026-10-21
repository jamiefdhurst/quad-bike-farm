// What the girls say about spraying the field (world/spraying.js, the game's updateSprayer):
//   sprayStart   the boom is out and the first of the field has been sprayed
//   sprayEmpty   the tank has run dry part-way
//   sprayDone    enough of the field is sprayed and the job is ticked off the board
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_SPRAY_LINES = {
  sprayStart: line(90, ['Slowly now, and keep your lines straight. Overlap a little, or we will leave stripes.', 'That is the boom working. Keep it steady and do not hurry.', 'Up and down the field, please. A little overlap each time.']),
  sprayEmpty: line(60, ['That is the tank empty. The hose is back at the yard.', 'Nothing left in it. You will need to fill it from the hose.', 'Dry. Back to the hose with you.']),
  sprayDone: line(90, ['That is the field done, and tidily too. Tick it off the board.', 'All sprayed. The lines are quite straight, I will give you that.', 'That is the lot covered. Fold the boom in before you hit a gatepost.']),
};

export const JESS_SPRAY_LINES = {
  sprayStart: ['Ooh, it is spraying! Do a wiggly one, go on.', 'Go on then, paint the field! Not too fast, though.', 'It smells like a swimming pool. Keep going.'],
  sprayEmpty: ['It has run out! Who forgot to fill it?', 'Nothing coming out. Hose time, I think.', 'Empty! That was quick. Go and fill it up.'],
  sprayDone: ['Done! The field looks like a stripy jumper.', 'All sprayed! Can we stop smelling of chemicals now?', 'That is the lot! I think you missed a bit. Nope, you did not. Amazing.'],
};
