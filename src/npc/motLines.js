// What the girls say about the MOT at Hollis Motors (world/motHost.js): the sheet coming back, and a Land Rover that failed. Merged into the main
// line sets (voiceLines.js, jessLines.js), so they're recorded with the rest. No vehicle's name is spoken: the lines are recorded once, so they say
// "it" and the sheet does the naming.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_MOT_LINES = {
  motPass: line(30, ['It has passed. I will write that in the logbook.', 'A pass. Everything on the sheet is clean.', 'Good. It is legal for a fortnight.']),
  motFail: line(30, ['It has failed. Read the sheet and put it right at the bench.', 'That is a fail. I am not going in it until it is mended.', 'Look at the sheet. It will not pass like that.']),
  motWont: line(20, ['It failed its test. I am not getting in it.', 'Not until it has a pass. I mean it.', 'Not in that. Mend it, then ask me again.']),
};

export const JESS_MOT_LINES = {
  motPass: ['Ha! A pass! Told you it was fine!', 'It passed! Nobody look at the wipers.', 'Clean sheet! Best wheels in the village.'],
  motFail: ['A fail! That is the garage being fussy.', 'Oh, it has failed. Brilliant. Just brilliant.', 'It failed, but it still goes, so there.'],
  motGrumble: ['It failed its test, you know. I am coming anyway.', 'This has failed its MOT. I am sat in it regardless.', 'If a wheel falls off, I told you so.'],
};

/** Situations only Jess has (Amy refuses instead, with `motWont`). */
export const JESS_ONLY_MOT_SITUATIONS = ['motGrumble'];
