// Nicking your quad (nicking.js): Jess riding off on one you left running, laughing, and bringing it back, and Amy objecting.
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_NICK_LINES = {
  nickGo: line(60, ['I am just borrowing this for a minute.']),
  nickLaugh: line(30, ['Ha! Look at me go.']),
  nickWatch: line(60, ['Jess! That is not yours!', 'Jess, you cannot just take it. Come back!', 'Oh, here we go. Jess, put it back!']),
  nickBack: line(60, ['Look at the state of it. Now you have to clean it.']),
};

export const JESS_NICK_LINES = {
  nickGo: ['Borrowing this!', 'Back in a minute!', 'You left it running. Finders keepers!'],
  nickLaugh: ['Ha ha ha! Catch me!', 'Wheeeee! Mine now!', 'You will never catch me!'],
  nickBack: ['Brought it back! Mostly the same as I found it.', 'There you go. I only went a little bit mad.', 'Safe and sound. Ish. Do not look at the tank.'],
};
