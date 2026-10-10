// What the girls say when they push a vehicle with a flat battery so you can bump-start it: pushStart (leaning on the back), pushNow
// (it is rolling fast enough: let the clutch out), pushCaught (it fired) and pushTired (she has had enough). Merged into the main line
// sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_PUSH_LINES = {
  pushStart: line(20, ['Clutch in, second gear, key on. I will push.', 'Right, I am pushing. Wait until I say.', 'Hold the clutch in. I will get it moving.']),
  pushNow: line(4, ['Now! Let the clutch out!', 'That is fast enough. Drop it now!', 'Go on, let it out!']),
  pushCaught: line(20, ['It went! Well done.', 'There. A battery is overrated.', 'It is running. Do not stall it again.']),
  pushTired: line(20, ['I cannot push it any further. It is heavy.', 'I am done. Find a hill.', 'That is as far as I go. Try the jump leads.']),
};

export const JESS_PUSH_LINES = {
  pushStart: ['Clutch in! I am shoving!', 'Hold on, I will get you going. Clutch in!', 'Push time. Do not let it out yet!'],
  pushNow: ['Now! Now! Drop it!', 'Let the clutch out! Go go go!', 'Drop it now!'],
  pushCaught: ['Yes! It went!', 'Ha! Who needs a battery?', 'That was brilliant. Do it again.'],
  pushTired: ['I am knackered. It is a lump.', 'No more. You push for a bit.', 'Ugh, it is not going. Jump leads?'],
};
