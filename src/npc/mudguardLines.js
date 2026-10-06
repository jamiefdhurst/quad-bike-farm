// What the girls say perched on the tractor's wheel arch (mudguardRide.js): mudBoard (climbing up beside you) and mudShout (yelling
// across at you over the diesel). Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_MUDGUARD_LINES = {
  mudBoard: line(60, ['Shove up. Not that far, I am not sitting on the tyre.', 'I am only coming up here because you are not to be trusted.', 'Right, I have got hold of the frame. Go gently.']),
  mudShout: line(25, ['What? I cannot hear you over this thing!', 'Is it meant to smoke like that? It is going in my hair!', 'Mind the ditch! The ditch, you are about to hit the ditch!']),
};

export const JESS_MUDGUARD_LINES = {
  mudBoard: ['Up I go! This is the best seat on the farm!', 'Budge over, I am riding on the wheel!', 'Look at me, I am the king of the tractor!'],
  mudShout: ['Faster! Make it go faster!', 'I cannot hear a word! Say it again, you!', 'Woooo! I can see all the way to the hedge from up here!'],
};
