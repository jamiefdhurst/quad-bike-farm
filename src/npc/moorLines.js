// The Moor (#821), what the girl on the back says on the open common: Jess wants to open the throttle, Amy watches for the wet ground and the sheep on the road. Merged into the
// main line sets last (voiceLines.js, jessLines.js), so the banks before them stay as they are.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_MOOR_LINES = {
  moorOpen: line(90, ['It is lovely and open up here, but there are rocks hiding in the heather. Not too fast, please.', 'What a view. Keep it sensible, though. You cannot see what is under the heather.', 'There is a lot of room, I know, but the ground is rough. Gently.']),
  moorBog: line(30, ['That bright green moss is wet ground. Go round it, please!', 'Bog ahead, look at the cotton grass. Go round!', 'Keep out of the wet bit. We will never get out of it.']),
  moorSheep: line(30, ['Sheep on the road! Slow down!', 'Mind the sheep. They do not know it is a road.', 'Sheep ahead. Gently now, and give them room.']),
};

export const JESS_MOOR_LINES = {
  moorOpen: ['Nothing to hit up here! Open it up, go on, flat out!', 'Look at all this room! Put your foot down!', 'It is huge! Do not slow down, nobody is watching!'],
  moorBog: ['Is that a bog? Go through it, go on, I dare you!', 'That looks gloopy. Straight through the middle!', 'Ooh, a squelchy bit. Fine, fine, go round it. Spoilsport.'],
  moorSheep: ['Sheep on the road! Do not hit them, Amy would kill me!', 'Baa to you too! Slow down, they are everywhere!', 'Sheep! Go round them, they will bolt!'],
};
