// What the girls say about a quad rolling away with its handbrake off (vehicle/handbrake.js): handbrakeRoll (nobody's fault known),
// handbrakeYou (it was you who left it), handbrakeAmy and handbrakeJess (her friend did), and handbrakeOwn (she did, and owns up).
// Amy is cross and then sorry; Jess is gleeful and then not sorry at all. They say "it", so the same lines do for every colour.
// Amy never blames Amy and Jess never blames Jess, so each has only the other's. Merged into the main line sets
// (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_HANDBRAKE_LINES = {
  handbrakeRoll: line(20, ['Somebody left the handbrake off! It is rolling away!', 'Oh no, a quad is rolling off! Nobody put the brake on.']),
  handbrakeYou: line(20, ['You did not put the brake on, did you? It is rolling away.', 'That is your quad, and you left the handbrake off.']),
  handbrakeJess: line(20, ['Jess! You forgot the handbrake again! It is getting away!', 'Jess, that is yours. You did not put the brake on.']),
  handbrakeOwn: line(20, ['Oh no, that was me. I forgot the brake. I am so sorry.', 'That one is mine. I did not put the brake on. How embarrassing.']),
};

export const JESS_HANDBRAKE_LINES = {
  handbrakeRoll: ['Ha! Something is rolling off! Nobody put the brake on!', 'Look, one is escaping!'],
  handbrakeYou: ['That is yours rolling off! You forgot the handbrake. Typical.', 'Ha! You left the handbrake off! Go and get it.'],
  handbrakeAmy: ['Amy! You forgot the handbrake! Miss Careful strikes again!', 'Amy, you did not put the brake on! I never thought I would see the day.'],
  handbrakeOwn: ['Oops. That one is mine. Worth it.', 'Whoops. I forgot the handbrake. It is fine, it is only a bit of mud.'],
};

export const JESS_ONLY_HANDBRAKE_SITUATIONS = ['handbrakeAmy'];
