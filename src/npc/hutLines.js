// What the girls say about the shepherd's hut on the hill (npc/hutStay.js, the game's updateHut): hutOffer (suggesting a sit up there), hutYes
// (you asked), hutSit (sat on the bunk), hutLight (lighting the stove), hutWarm and hutRain (a while in), hutTea (you have made tea with her
// there), hutRomance (only said by the girl you are closest to, with you near) and hutDone (she has had enough). Merged into the main line sets
// (voiceLines.js, jessLines.js), so they're recorded with the rest. The girls call you "you".

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_HUT_LINES = {
  hutOffer: line(60, ['I am going up to the hut. It will be dry, and there is a stove.', 'It is not fit out here. I am going to sit in the shepherd\'s hut for a bit.', 'The hut will be lovely and snug. I am off up the hill.']),
  hutYes: line(60, ['Yes, all right. The hut is just the thing.', 'Good idea. I will go up and see to the stove.', 'Of course. I have been meaning to see that hut properly.']),
  hutSit: line(60, ['Ah. A proper bunk, a proper roof. Somebody has looked after this place.', 'Oh, that is cosy. Look at that view through the door.', 'There. Out of the wind at last.']),
  hutLight: line(60, ['Right. Let me get the stove going.', 'A bit of kindling and a match. That is how it is done.', 'I will light the stove. Do not touch the kettle.']),
  hutWarm: line(60, ['It is properly warm in here now. I could stay all afternoon.', 'I do like a stove. It is the only thing that works first time on this farm.', 'You can see the whole farm from that door. It looks so small.']),
  hutRain: line(60, ['Listen to that on the tin roof. I could sit here all day.', 'It can rain as much as it likes. I am staying in here.', 'The rain sounds lovely from in here. It sounds horrid from out there.']),
  hutTea: line(60, ['Is that tea? You are a genius.', 'Oh, you have put the kettle on. I take it back, everything I said about you.', 'Tea in a shepherd\'s hut. This is the life.']),
  hutRomance: line(60, ['It is nice, just the two of us up here.', 'Nobody can see us up here, you know.', 'I would not have sat in a hut with just anyone.']),
  hutDone: line(60, ['Right. That is me thawed out. Back down the hill.', 'Thank you for that. I feel like a new woman.', 'I had better go before I never leave.']),
};

export const JESS_HUT_LINES = {
  hutOffer: ['Shepherd\'s hut! Come on, it has a stove and a little bed!', 'I am going up the hill. There is a hut and it is mine.', 'It is horrible out here. Hut. Now.'],
  hutYes: ['Yes! Race you up there!', 'Come on then. Last one up makes the tea.', 'Brilliant. I always wanted to live in a hut.'],
  hutSit: ['Look at the little bunk! I could live here.', 'It is so tiny and so snug. I love it.', 'Ooh, a window. And a kettle. This is the best.'],
  hutLight: ['I will do the stove! I am brilliant at stoves.', 'Right, one fire, coming up. Stand back.', 'Do not worry, I have only set fire to things on purpose before.'],
  hutWarm: ['I am so warm I might melt. Do not let me melt.', 'This hut is the best thing on the whole farm. Do not tell the barn.', 'You can see everything from here. I can see the sheep. They look rude.'],
  hutRain: ['It is pouring and I am dry. I am winning.', 'The roof is going rat-a-tat-tat. It is like a drum.', 'Out there is wet. In here is not wet. I know which I prefer.'],
  hutTea: ['Tea! Is there one for me? There had better be one for me.', 'You made tea! I take back everything.', 'A cup of tea in a hut. I am never leaving.'],
  hutRomance: ['It is a bit romantic, isn\'t it, a hut on a hill.', 'Do not tell Amy, but this is nice. You and me and a stove.', 'We could stay up here all night. Just saying.'],
  hutDone: ['Right. I am going to wobble down the hill now.', 'That was brilliant. Can we come again tomorrow?', 'I am too hot. I am going outside to stand in the wind.'],
};
