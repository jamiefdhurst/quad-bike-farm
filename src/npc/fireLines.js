// What the girls say about the bonfire (npc/fireSit.js, the game's updateBonfire): fireLit (you have lit it), fireOffer (suggesting a sit by
// it), fireYes (you asked), fireSit (sat down), fireWarm (a while in), fireRomance (only said by the girl you are closest to, with you near),
// fireOut (it died while she was sat there) and fireDone (she has had enough). Merged into the main line sets (voiceLines.js, jessLines.js),
// so they're recorded with the rest. The girls call you "you".

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_FIRE_LINES = {
  fireLit: line(60, ['It has caught. Lovely. Do not put anything on it that you cannot explain.', 'Well done. A proper fire. Keep the wet bits upwind of it.', 'There it goes. I do like a fire in the evening.']),
  fireOffer: line(60, ['The fire is going nicely. Shall we sit by it for a bit?', 'It is getting cold. I am going to sit by the fire.', 'That fire looks too good to waste. I am going to sit down.']),
  fireYes: line(60, ['Yes, all right. I will find a log.', 'Good idea. My hands are frozen.', 'Of course. Nobody should walk past a fire.']),
  fireSit: line(60, ['Oh, that is warm. That is the first time my fingers have worked all day.', 'There. A log, a fire and nothing to do. Lovely.', 'Ah. Better.']),
  fireWarm: line(60, ['Look at the sparks go up. They are so pretty.', 'I could stay here all evening.', 'The smoke keeps following me. It always follows the nicest person.']),
  fireRomance: line(60, ['It is nice, just sitting here with you.', 'I would not sit by a fire with just anyone, you know.', 'You can sit a bit closer. The log is long enough.']),
  fireOut: line(60, ['Oh, it has gone out. What a shame.', 'That is the end of the fire. Well. It was lovely while it lasted.', 'The embers have given up. So have I.']),
  fireDone: line(60, ['Right. That is me warmed through. Back to work.', 'Thank you for the fire. I feel human again.', 'I should get up before I fall asleep.']),
};

export const JESS_FIRE_LINES = {
  fireLit: ['Yes! Fire! Can we put a pallet on it?', 'Whoa, it is going. That is the best thing you have done all day.', 'Burn, baby, burn. Is that a stick of the hedge? Sorry, hedge.'],
  fireOffer: ['The fire is on! Come on, sit with me.', 'I am freezing. I am going to sit on the fire. Next to it. On a log.', 'Fire. Log. Me. I am off.'],
  fireYes: ['Yes! Race you to the logs!', 'Come on then, I will save you a seat.', 'Brilliant. Is anyone bringing marshmallows?'],
  fireSit: ['Ahh. That is the stuff.', 'My face is hot and my back is cold. Perfect.', 'Everyone should have a fire. Every day.'],
  fireWarm: ['Look at the sparks go! Did you see that one? That one went miles.', 'If I fall asleep, do not draw on me.', 'I can feel my toes again. I was starting to worry.'],
  fireRomance: ['This is quite nice, you know. Sitting here, you and me.', 'Do not tell Amy, but you are good company by a fire.', 'Stay a bit. The fire is better with you here.'],
  fireOut: ['Aw, it has gone out. Boo.', 'Fire is dead. Long live the fire. Can we light another?', 'Now my back is cold as well.'],
  fireDone: ['Right. I am too hot. Let me go and cool off.', 'That was brilliant. Same again tomorrow?', 'My legs have gone to sleep. I am going to wobble.'],
};
