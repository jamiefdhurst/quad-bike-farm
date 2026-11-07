// What the girls say about lunch and the snack tin (lunch.js): lunchOffer (off to fetch the bag), lunchEat (sat down), lunchJoin (you came
// over to share it), lunchDone, lunchMissed (still starving in the afternoon), biscuitGo, biscuitEat and biscuitDone (the tin in the barn).
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest. The girls call you "you".

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_LUNCH_LINES = {
  lunchOffer: line(60, ['It is lunchtime. I am going to fetch my bag from the car.', 'I am hungry. I have sandwiches in the car, so I am going to get them.', 'Lunch. I packed something sensible.']),
  lunchEat: line(60, ['Egg and cress. A classic.', 'Ham sandwich, an apple and a flapjack. That is lunch.', 'Right. Sit down, eat properly, and do not drop crumbs on the quad.']),
  lunchJoin: line(60, ['You can have half of this if you like. Only half.', 'Come and sit down for a minute. You have been going all morning.', 'There is a flapjack in here if you want a bit.']),
  lunchDone: line(60, ['That is better. Now I can think again.', 'Lovely. Back to it, then.', 'Right. Crumbs shaken off, I am done.']),
  lunchMissed: line(60, ['I did not get any lunch, and I am cross about it.', 'I am so hungry I could eat a hay bale. Do not say anything.', 'I should have had lunch. I am regretting it now.']),
  biscuitGo: line(60, ['I am going to have a biscuit from the tin.', 'There is a tin in the barn. I will just have one.']),
  biscuitEat: line(60, ['Custard cream. One is allowed.', 'Just the one biscuit. Maybe two.']),
  biscuitDone: line(60, ['That will do for now.', 'Right. One biscuit. I am being good.']),
};

export const JESS_LUNCH_LINES = {
  lunchOffer: ['Lunch! I am starving. Back in a sec, I have got a bag in the car.', 'Food. Now. I will go and get it.', 'I have not eaten since breakfast. I am getting my bag.'],
  lunchEat: ['Cheese and pickle, a bag of crisps and a Penguin. Proper lunch.', 'Mum did me a pasty. I am not sharing. Maybe a bit.', 'Mmm. Sandwich. Amy has got a boring one.'],
  lunchJoin: ['Oh, are you after some? Go on, have a crisp.', 'Pull up a bale. Do not look at my pasty like that.', 'Sit down then, you hover. Here, a crisp.'],
  lunchDone: ['Done. Full. Ready for anything.', 'That was good. Now I want a nap.', 'Right, the bag is empty. Where were we?'],
  lunchMissed: ['I missed lunch and I am about to eat my own arm.', 'I am so hungry I feel faint. Somebody get me a sandwich.', 'Nobody told me it was lunchtime. I am furious.'],
  biscuitGo: ['Biscuit! I am nipping to the tin.', 'I am going to the tin in the barn. Do not tell Amy.'],
  biscuitEat: ['Chocolate one. Obviously.', 'Mmm. The best part of the day.'],
  biscuitDone: ['Gone. I will have another later.', 'Brilliant. A biscuit makes everything better.'],
};
