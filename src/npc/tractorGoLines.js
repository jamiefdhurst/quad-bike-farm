// What the girls say about having a go on the tractor (tractorGo.js, and the drive itself): Jess taking it (tractorGoAsk), setting
// off blind over the bonnet (tractorGoSetOff), kangaroo hops (tractorGoLurch), stalling it (tractorGoStall), finishing (tractorGoDone),
// and the other one's view of it (tractorGoWatch; Amy also winces at Jess's hops with tractorGoLurch, and answers a request with
// tractorGoAsk); Amy refusing (tractorRefuse) and her day (tractorDay). Merged into the main line
// sets (voiceLines.js, jessLines.js), so they're recorded with the rest. Nobody calls you anything but "you".

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_TRACTORGO_LINES = {
  tractorRefuse: line(30, ['I am not going near that thing.', 'No. It has no seatbelt and I do not trust the clutch.', 'Absolutely not. Ask Jess, she loves it.']),
  tractorDay: line(600, ['Fine. Move over. And nobody say a word.', 'Oh, give it here. How hard can it be?', 'Right. I am doing this once, so watch carefully.']),
  tractorGoAsk: line(60, ['Fine, I will do it. Only because you asked nicely.', 'All right. Stand back, and do not offer advice.', 'If I must. Does the hand throttle do anything?']),
  tractorGoLurch: line(20, ['Clutch, Jess! Gently with the clutch!', 'It is bucking! Is it meant to do that?', 'Oh, do not hurt it. Or yourself.']),
  tractorGoSetOff: line(40, ['Oh. That is perfectly simple.', 'Clutch, gear, ease off. Why is everyone so dramatic about it?', 'It is only a very large quad, really.']),
  tractorGoStall: line(20, ['That was the tractor, not me.', 'It stalled itself. I did nothing.']),
  tractorGoDone: line(60, ['That was perfectly good. Do not look at me like that.', 'Fine, it is quite fun. Do not tell Jess.', 'There. Not one stall. Write it down.']),
  tractorGoWatch: line(60, ['Please do not break it.', 'Mind the hedge, Jess. The hedge!', 'I cannot watch. Tell me when it is over.']),
};

export const JESS_TRACTORGO_LINES = {
  tractorGoAsk: ['Right, I am having the tractor.', 'Nobody is using the tractor. Mine now.', 'Move aside, I am driving the big one.'],
  tractorGoSetOff: ['I cannot see over the bonnet!', 'Where is the front? I cannot see the front!', 'This is brilliant, and I cannot see a thing.'],
  tractorGoLurch: ['Woah! It is bucking!', 'It is jumping! Why is it jumping?', 'Hold on, hold on, hold on!'],
  tractorGoStall: ['It died. It just died on me.', 'Why did it stop? I did not do anything!', 'Stalled it again. It is the tractor, not me.'],
  tractorGoDone: ['That was the best thing ever. Again!', 'I am a tractor driver now. Call me that.', 'I only hit one thing. Maybe two.'],
  tractorGoWatch: ['Show off.', 'Beginner is luck, that is all it is.', 'Oh, come on! She is good at it? Since when?'],
};
