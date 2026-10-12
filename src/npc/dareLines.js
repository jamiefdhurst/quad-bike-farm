// What the girls say about Jess's dares (npc/dares.js). Jess dares you (dareRamp, dareFord, dareFence, dareBank), cheers when you do it
// (dareWon) and teases when you don't (dareChicken). Amy says what she thinks of each (dareAmyRamp and so on) and is worried after a
// tumble (dareFell). Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_DARE_LINES = {
  dareAmyRamp: line(20, ['Do not do it, Jess is only winding you up. Though that ramp is not that bad.', 'You will break something. Mind the landing, then.', 'Honestly, the pair of you. Keep both hands on.']),
  dareAmyFord: line(20, ['There is a stone in the middle of that ford, you know.', 'You will soak us all. Go on, then.', 'Flat out through water is how you lose your brakes.']),
  dareAmyFence: line(20, ['That is a daft thing to do. It hurts, you know.', 'Do not touch the fence. It has a sign on it for a reason.', 'Please do not. I mean it.']),
  dareAmyBank: line(20, ['That bank is far too steep for a mini moto.', 'You will go over the bars. I am not driving you to hospital.', 'That is where the sheep fall over. Be careful.']),
  dareFell: line(25, ['Are you all right? Told you that was a daft idea.', 'Oh, you did it. Are you hurt? Stay there a minute.', 'That looked sore. Sit up slowly.']),
};

export const JESS_DARE_LINES = {
  dareRamp: ['I dare you to jump the ramp. Properly, not that little hop.', 'Bet you will not jump the ramp in the field. Go on.', 'Ramp. You. Now. I dare you.'],
  dareFord: ['I dare you to take the ford flat out. Soak me, I do not care.', 'Bet you will not go through the ford at full chat.', 'Ford, flat out. Dare you.'],
  dareFence: ['I dare you to touch the electric fence. Go on, I touched it last week.', 'Bet you will not touch the fence. Bet you will not.', 'Touch the fence. One finger. I dare you.'],
  dareBank: ['I dare you to ride the mini moto down that big bank in the pasture. The steep one.', 'Mini moto, steepest bank on the hill. I dare you.', 'Bet you will not take the little bike down the big bank.'],
  dareWon: ['Ha! You actually did it! Brilliant!', 'I cannot believe you did it. Respect.', 'Yes! Told you that you would.'],
  dareChicken: ['Bwaaack. Chicken.', 'I knew you would not. Cluck cluck.', 'Too scared, then. Fair enough.'],
};

/** Only Jess says these (Amy has no line for them). */
export const JESS_ONLY_DARE_SITUATIONS = Object.keys(JESS_DARE_LINES);
