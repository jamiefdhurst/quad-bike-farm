// What the girls say about the farm's money and the second-hand market (farm/classifieds.js, farm/marketTalk.js). Amy is careful with the tin;
// Jess wants to spend it. Neither names the vehicle (the lines are recorded, so they cannot carry a name). They never call you he, she or they.
//   moneyBought   you have just bought a vehicle from the small ads
//   moneySold     you have just sold one
//   moneyIn       a farm job has just paid
//   moneyAd       there is something on the cork board, and you are at the tin
//   moneyLow      the tin is nearly empty
//   moneyHigh     the tin is well stocked
//   moneyArrived  a vehicle you bought turned up in the yard this morning
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_MONEY_LINES = {
  moneyBought: line(30, ['That is a lot out of the tin. I hope you looked it over properly.', 'Well, it is bought now. I will put it in the book.', 'It had better start, for that money.']),
  moneySold: line(30, ['That is some money back in the tin. Do not spend it all at once.', 'Sensible. We could not use two of everything.', 'I will miss it a bit, but the tin looks healthier.']),
  moneyIn: line(120, ['Another job paid. Into the tin it goes.', 'That is honest money, that is.', 'Every little helps the tin.']),
  moneyAd: line(180, ['There is something new on the cork board. Worth a look, at least.', 'Someone has put a card up for a vehicle. I would read it carefully.', 'A neighbour is selling something. Check it over before you pay.']),
  moneyLow: line(300, ['The tin is nearly empty. We should be careful.', 'We are down to the last few pounds. Jobs first, shopping later.', 'I would not spend anything just now. The tin is bare.']),
  moneyHigh: line(300, ['The tin is looking healthy. Do not go mad with it.', 'There is a good bit in the tin. Sensible spending only.', 'We have got a tidy sum put by. Let us keep some of it.']),
  moneyArrived: line(60, ['Oh, it has turned up. It looks better than I expected.', 'So that is what you bought. Hm, not bad.', 'It came in the night. Do not leave it out in the rain.']),
};

export const JESS_MONEY_LINES = {
  moneyBought: ['Yes! New toy! Can I have the first go?', 'Ha, you actually bought it! Brilliant!', 'Spend, spend, spend. I love it.'],
  moneySold: ['Ker-ching! What are we buying with that, then?', 'Sold! Right, that is the next one paid for.', 'Money! Let us go shopping.'],
  moneyIn: ['Ooh, pennies! Put them in the tin.', 'Ker-ching!', 'Another few quid. We are rich, practically.'],
  moneyAd: ['There is a card up on the board! Go and look, go on!', 'Someone is selling something. I bet it is good.', 'Ooh, an advert. Can we afford it? Can we?'],
  moneyLow: ['The tin is empty. Do some jobs, go on.', 'There is hardly anything in there. Boring.', 'We are skint. Muck out something.'],
  moneyHigh: ['Look at all that money! We have to spend it.', 'The tin is stuffed. Buy something. Anything.', 'That is far too much money to just sit there.'],
  moneyArrived: ['It is here! It is actually here! Can I have a go?', 'Ooh, is that the new one? It is lovely.', 'Look at it! Mine now. Well, ours. Mostly mine.'],
};
