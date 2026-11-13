// What the girls say about loading and unloading a Tor's or Crag's back (tidyLoad.js): tidyLoadIn (she's off to put something in),
// tidyLoadOut (she's off to take something out). Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with
// the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_TIDY_LOAD_LINES = {
  tidyLoadIn: line(60, ['I will put that in the back before it gets lost.', 'That wants putting away. I will stow it in the back.', 'I will load that up, so it is not left lying.']),
  tidyLoadOut: line(60, ['The back is full of clutter. I will take something out.', 'I will unload a bit, or we will never find anything.', 'That does not need to live in the back. I will take it out.']),
};

export const JESS_TIDY_LOAD_LINES = {
  tidyLoadIn: ['Right, in the back it goes. Do not say I never help.', 'I will chuck that in the back.', 'Boot space. Used. Look at me.'],
  tidyLoadOut: ['I am having that out. It is in the way.', 'Somebody left all this in the back. Not me.', 'Out you come. Back door open, here we go.'],
};
