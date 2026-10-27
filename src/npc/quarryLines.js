// What the girls say about the gravel pit: pitNear (you have come to its lip), pitStall (your engine stopped down in it), and, when someone is
// near the top as you finish the pit climb, pitYou and pitRecord. Said by whoever is near and free (npc/quarryWatch.js, game.js
// updateQuarryWatch and finishPitClimb). Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_QUARRY_LINES = {
  pitNear: line(240, ['Mind the edge. It is a long way down and the walls are loose.', 'That is a proper drop. Stay on the haul road until you know what the walls are like.', 'Keep off the lip. It crumbles.']),
  pitStall: line(60, ['Not on the wall. That is the one place you cannot stall.', 'It has stopped halfway. Brake first, then restart it.', 'That is why people use the haul road.']),
  pitYou: line(30, ['Up the steep wall and over the lip. Well done.', 'You found a way up. That counts.', 'That was a decent line. I would not have tried it.']),
  pitRecord: line(30, ['That is the fastest anyone has been up that wall.', 'A new best up the wall. Chalk it up.']),
};

export const JESS_QUARRY_LINES = {
  pitNear: ["Ooh, a hole! A massive hole! Can we go down the wall?", "Look at the size of that! Go on, you know you want to.", "Right. That is the best thing on the farm and I will not hear otherwise."],
  pitStall: ["You stopped! On the wall! Do not roll back, do not roll back.", "Ha! Stalled halfway. Brilliant. Do it again.", "Oh no. Oh yes. Oh no. Can you start it?"],
  pitYou: ["You went up that like it owed you money.", "Over the lip! I could not look. I looked.", "That was mad. Again."],
  pitRecord: ["Record! Put it on the board! Put it on the board!", "Fastest up the wall, ever. I am telling everyone."],
};
