// What the girls say when a long sit on a shaking seat numbs them (numbness.js): numbTingle (her legs go tingly), numbGo (her bum has gone
// numb and she is getting off), numbStretch (walking it off, stretching) and numbBack (getting back on). Merged into the main line sets
// (voiceLines.js, jessLines.js), so they're recorded with the rest. The girls call you "you", never he, she or they.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_NUMB_LINES = {
  numbTingle: line(90, ['My legs have gone all tingly.', 'Oh, I can feel my legs going to sleep.', 'My feet are tingling. That is a long shake.']),
  numbGo: line(90, ['My bum has gone numb. I have to get off.', 'That is it. I cannot feel my bottom. Off I get.', 'I need to stand up. Everything has gone numb.']),
  numbStretch: line(90, ['Ahh, that is better. Pins and needles.', 'Oh, that hurts, and it feels lovely.', 'Right. Shaking my legs out.']),
  numbBack: line(90, ['Right. Back on for another go.', 'I am ready to sit on it again.']),
};

export const JESS_NUMB_LINES = {
  numbTingle: ['My legs have gone all tingly!', 'I cannot feel my feet. Brilliant.', 'Ooh, pins and needles starting.'],
  numbGo: ['My bum has gone numb! Off, off, off.', 'I cannot feel my bum. I have to get off.', 'Numb! Everything below my waist is numb!'],
  numbStretch: ['Ow, ow, ow, pins and needles!', 'Ahh, I can feel my legs again. Ow.', 'Walking it off. Do not look at me.'],
  numbBack: ['Right, round two!', 'Back on. It was worth it.'],
};
