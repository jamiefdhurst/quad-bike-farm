// What the girls say when you treat the pre-mix with plug-saver (items/plugAdditive.js). Amy knows what it is for; Jess thinks it is a
// waste of money. Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_ADDITIVE_LINES = {
  plugSaver: line(120, ['Good, plug-saver. The two-strokes will not oil their plugs up half as fast at idle now.', 'That is the stuff. It keeps the plugs clean while they tick over, until that fuel is used up.']),
};

export const JESS_ADDITIVE_LINES = {
  plugSaver: ['Plug-saver? You paid for magic fuel? Bet it still fouls.', 'You are putting sauce in the petrol. Does it make it go faster?'],
};
