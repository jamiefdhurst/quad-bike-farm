// What the girls say on the hay ride (hayRide.js): hayBoard (climbing onto the bales), hayBump (a bounce that shrieks), hayLie (lying
// back on the straight bits), hayFall (the one who has gone off the side, once she is on the ground) and hayFallOther (the other one
// seeing it). Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_HAYRIDE_LINES = {
  hayBoard: line(60, ['Right, bales. This looks safe enough.', 'Go slowly. I mean it.', 'Wait until I am sat down before you set off.']),
  hayBump: line(14, ['That was a pothole! You saw that pothole!', 'Mind the ruts!', 'Gently, please. I have a very full stomach.']),
  hayLie: line(40, ['This is actually lovely. Do not spoil it.', 'Keep it steady and I could stay here all afternoon.', 'Look at that sky. Do not turn a corner.']),
  hayFall: line(30, ['That is mud. That is a lot of mud.', 'I told you to take the corner slowly. I did say.', 'Wait for me! I am walking, I am coming!']),
  hayFallOther: line(30, ['Is she all right? She is laughing, so yes.', 'You took that far too fast. Look what you did.', 'She has gone in the mud. I did warn you.']),
};

export const JESS_HAYRIDE_LINES = {
  hayBoard: ['Hay ride! Do not drive like Amy.', 'Faster than a walk, please.', 'Brilliant. I am sat on the best bit.'],
  hayBump: ['Woooah! Again, again!', 'Aaaah! Do that bit again!', 'My teeth! Hit another one!'],
  hayLie: ['This is the life. Wake me up at the yard.', 'I could sleep here. Do not stop.', 'Nice and flat. Do not ruin it with a corner.'],
  hayFall: ['Ow! Mud! In my mouth!', 'I fell off! You absolute legend, you did it on purpose!', 'Wait for me! I am running!'],
  hayFallOther: ['Ha! She is in the mud! Brilliant!', 'Did you see her go? Straight off!', 'Corner too fast, I think. Lovely.'],
};
