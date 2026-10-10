// What the girls say about keeping a sick quad alive from the back (keepAlive.js): keepSit (why she is on the back, a practical reason
// first), keepCharge (the same for a weak battery: Amy says it needs ten minutes running) and keepCharged (it is back up), keepTruth (the real one: Jess owns up, Amy only if you catch her after a long sit), keepDied (it stalled under her or when
// she let go) and keepGiveUp (she has had enough). Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded
// with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_KEEP_LINES = {
  keepSit: line(120, ['I will sit on the back and keep it going. You can hear it better from here.', 'It nearly died on me twice. I will stay on it so I am out of the way when you get on.', 'Do not switch it off. It will never start again.']),
  keepCharge: line(120, ['That battery needs ten minutes running to be any use. I will sit on the back and keep the revs up.', 'It will die again at the first stop if it idles. I will hold it up for you.']),
  keepCharged: line(120, ['There. That should hold now. Idle all you like.', 'The battery is back up. I can let go.']),
  keepTruth: line(300, ['All right, it does buzz rather nicely back here. Do not tell anyone.', 'You have caught me. It is the shaking. I like it.']),
  keepDied: line(60, ['Oh, it has died. I told you it would.', 'And that is that. It is off.']),
  keepGiveUp: line(120, ['I cannot sit here all day. It will have to take its chances.', 'That is enough. I am getting off.']),
};

export const JESS_KEEP_LINES = {
  keepSit: ['I will keep it going. Somebody has to. Plus I can hear it better from back here.', 'Stay off the switch, it is a bit dodgy. I will hold it.', 'I am out of the way back here. Hop on the front if you want.'],
  keepCharge: ['Battery is rubbish. I will rev it for a bit. Do not hold me to ten minutes.', 'Fine, I will sit on it and rev it. For a bit.'],
  keepCharged: ['Done. Battery is full. I am a hero.', 'Right, that is charged. You can thank me later.'],
  keepTruth: ['Fine, the real reason is it buzzes much more on the back. Do not look at me like that.', 'Okay, okay. It shakes loads back here. Brilliant.'],
  keepDied: ['Whoops. It has died. Not my fault.', 'It is gone. Told you it was a bit dodgy.'],
  keepGiveUp: ['Right, I am bored. It can look after itself.', 'My bum is going numb. Bye, quad.'],
};
