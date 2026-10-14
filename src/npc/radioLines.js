// What the girls say about the radio in a vehicle they are sat in (npc/radioTaste.js): radioOn she switches it on, radioUp she turns it
// up, radioDown she turns it down, radioOff she switches it off. Jess is the one who turns it on and up, Amy the one who turns it down and
// off, but each has a line for all four so a changed taste never leaves her silent. Merged into the main line sets (voiceLines.js,
// jessLines.js).

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_RADIO_LINES = {
  radioOn: line(60, ['Oh, there is a nice programme on. Just for a minute.', 'Let us see if we can get the news.', 'I will put the radio on, if that is all right with you.']),
  radioUp: line(60, ['Just a little louder. I want to hear this bit.', 'Oh, I like this one. A touch louder.']),
  radioDown: line(60, ['Can we have it a bit quieter? I cannot hear myself think.', 'That is rather loud. Down a bit.', 'I would like to be able to hear the engine, please.']),
  radioOff: line(60, ['Right, that is quite enough of that.', 'I am turning the radio off. Peace at last.', 'It is nothing but crackle. Off.', 'I like to hear the engine. It tells you things.']),
};

export const JESS_RADIO_LINES = {
  radioOn: ['Ooh, music. Radio on.', 'We need some tunes. Hang on.', 'It is far too quiet in here. Radio.', 'This is the best bit of the day. Hold on, I will find it.'],
  radioUp: ['Turn it up! I love this one.', 'Louder. Much louder.', 'Go on, let it rip.', 'This is the good bit! Hear it?'],
  radioDown: ['Fine, fine, I will turn it down.', 'Are you worried about the neighbours? Honestly.'],
  radioOff: ['Fine. Off. See if I care.', 'Nobody likes my music.'],
};
