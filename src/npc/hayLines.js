// What the girls say about making hay (world/haymaking.js, npc/hayLoading.js, the game's updateHay):
//   hayCut     the patch is mown and wants baling
//   hayBaled   the bales are lying in the field and want loading
//   hayGo      she is off to carry a bale to the trailer
//   hayThrown  hers has landed on the trailer
//   hayMiss    hers fell short
//   hayLoaded  the trailer has all the bales on it
//   hayDone    the hay is stacked in the Dutch barn and the job ticked off the board
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_HAY_LINES = {
  hayCut: line(60, ['That is the field cut. Go round again with the baler, please.', 'Nicely mown. Now it wants baling before it rains.', 'All down. The weather will not stay kind, so bale it today.']),
  hayBaled: line(60, ['The bales are out. Bring the trailer alongside and I will load them.', 'That is a good crop. Trailer next to the bales, please.', 'Right, they are lying ready. Get the trailer over and we will start.']),
  hayGo: line(20, ['I will take that one.', 'Mind your backs. Bale coming.', 'One at a time. I will start at the back.']),
  hayThrown: line(15, ['On. Next.', 'There. That is tidy.', 'That one is square on the bed.']),
  hayMiss: line(15, ['Oh, that fell short. I will pick it up again.', 'Not enough height. Once more.']),
  hayLoaded: line(60, ['That is the lot on. Take it steadily to the Dutch barn.', 'Fully loaded. Go gently over the ruts, or we will wear it.', 'All up. Barn next, and do not take the corners fast.']),
  hayDone: line(60, ['In the dry, and stacked straight. That is a good day.', 'Every bale in the barn. Tick it off the board.', 'That is the hay in. It smells lovely.']),
};

export const JESS_HAY_LINES = {
  hayCut: ['Is that it? Mowed! Now the baler bit, the fun bit.', 'All cut. Smells amazing. Bale it, then, go on.', 'Look at those stripes. Not bad for you.'],
  hayBaled: ['Bales! Loads of them! Park the trailer, I am doing the throwing.', 'Right, trailer over here, and I will have those up in no time.', 'Ooh, look at them all lined up. Get the trailer, I am starting.'],
  hayGo: ['Mine! I am having this one!', 'Look out, incoming!', 'Race you, Amy. I will do three to your one.'],
  hayThrown: ['Ha! Nothing but bale!', 'Straight on. Did you see that?', 'And again. I am amazing.'],
  hayMiss: ['Oops! That one had a mind of its own.', 'Whoa, short! Not my fault, it was heavy.', 'Nobody saw that. Right?'],
  hayLoaded: ['That is the lot! My arms have fallen off.', 'Full up. Drive it nicely, or I will be sat on top screaming.', 'All aboard! Barn, then, and drive it like it is made of eggs.'],
  hayDone: ['Stacked! Straw everywhere. I love it.', 'Hay is done! Can we do something fun now?', 'Look at that stack. We make a pretty good team. Amy mostly.'],
};
