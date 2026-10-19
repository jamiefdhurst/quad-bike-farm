// What the girls say when they practise a manual on their own (practising.js): practiseGo (off to a parked quad to have a go),
// practiseStall (it died at the bite point), practiseBite (a clean one), practiseChoke (she has the choke off in time), practiseChokeLate (she
// forgot it), practiseGiveUp (it won't restart) and practiseSlow (you have come). Merged into the main line sets (voiceLines.js, jessLines.js),
// so they're recorded with the rest. The girls call you "you", never he, she or they.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_PRACTISING_LINES = {
  practiseGo: line(60, ['I am going to practise pulling away. Nobody watch.', 'I want to get the clutch right. I will be over here.', 'A bit of practice on the bite point, I think.']),
  practiseStall: line(25, ['Stalled. Again. That is the bite point, then.', 'Too quick on the clutch. Gently this time.', 'It died. Never mind. Start again.']),
  practiseBite: line(25, ['There. Right at the bite.', 'That was a good one. Hold it there.', 'I felt it take. That is what it is meant to feel like.']),
  practiseChoke: line(40, ['Choke off, in time. Good.', 'Choke off when it warms. I have got that.']),
  practiseChokeLate: line(40, ['Oh, I left the choke on. It is running rich.', 'Choke. Still on. Sorry.']),
  practiseGiveUp: line(60, ['It will not start again. I am leaving it.', 'That is enough. It has had enough, anyway.']),
  practiseSlow: line(60, ['Oh, you caught me. I was only practising.', 'Do not watch. I am not good yet.']),
};

export const JESS_PRACTISING_LINES = {
  practiseGo: ['Right. I am going to get this clutch thing sorted.', 'Practice time. Do not follow me.', 'I am going to stop stalling it. Watch me not stall it. Actually, do not watch.'],
  practiseStall: ['Stalled. Whatever. Again.', 'Ugh! The bite point. Where is it?', 'Dead. Fine. Once more.', 'It keeps dying on me. Rude.'],
  practiseBite: ['Yes! Right at the bite!', 'Did you feel that? I did.', 'Smooth. I can do smooth.'],
  practiseChoke: ['Choke off. Boom.', 'Choke off, in time. Look at me go.'],
  practiseChokeLate: ['Oops. Choke. Still on.', 'Forgot the choke. Again. Do not say anything.'],
  practiseGiveUp: ['It will not start. I am done.', 'Forget it. It is broken. Probably.'],
  practiseSlow: ['Hey! I was practising. In private.', 'You were not meant to see that. Hush.'],
};
