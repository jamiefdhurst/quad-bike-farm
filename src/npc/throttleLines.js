// Hand on the throttle (throttleGrab.js): Jess reaches round and opens it up while you're riding, and gloats; Amy does
// it once and apologises. Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_THROTTLE_LINES = {
  grabGo: line(60, ['Oh, go on, faster!', 'Faster, faster!']),
  grabSorry: line(60, ['Sorry! I do not know what came over me.', 'Oh, sorry. That was Jess talking.', 'Sorry. I will keep my hands to myself now.']),
};

export const JESS_THROTTLE_LINES = {
  grabGo: ['Go faster!', 'Give it some!', 'Hold on, I have got the throttle!', 'Too slow. I will do it.'],
  grabSorry: ['You loved it.', 'Do not look at me like that. It was fun.', 'Ha! Did you feel that?', 'Oops. My hand slipped. Twice.'],
};
