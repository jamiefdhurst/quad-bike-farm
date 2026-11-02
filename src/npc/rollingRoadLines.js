// What the girls say about the tuner's rolling road (world/rollingRoadHost.js): her trailer turning up, and what the figures show. Merged into the
// main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest. No quad's name is spoken: the lines are recorded once, so they say
// "that one" and "yours" and the sheet on the barn wall does the naming.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_ROAD_LINES = {
  roadComing: line(120, ['That is the rolling road coming in. Bring a quad round.', 'The tuner is here with her rollers. Somebody fetch a quad.', 'There is a trailer coming up the road. It is the rolling road day.']),
  roadUp: line(30, ['More than stock. Somebody has been careful.', 'That is above stock. I will write that down.', 'It is making more than it should. Well done.']),
  roadDown: line(30, ['That is under stock. Something wants looking at.', 'Down on stock. Check the plug and the filter.', 'It should make more than that. It is not happy.']),
  roadStock: line(30, ['Right on stock. Honest, at least.', 'Exactly what it should make. That is a good sign.', 'Stock. Nothing wrong with it, nothing special.']),
  roadBrag: line(60, ['That one is the strongest on the sheet.', 'Top of the sheet. I am not smug. Only a little.', 'That makes the most of anything we have run today.']),
  roadReply: line(60, ['Yours is stronger. Mine is the one that starts.', 'Power is not everything. Mine does not fall over.', 'Fine. Next week I will bring mine again.']),
  roadBroke: line(60, ['It cut out. You get your money back, at least.', 'It stalled on the rollers. Warm it up and try again.']),
};

export const JESS_ROAD_LINES = {
  roadComing: ['The rolling road! Quick, get a quad on it!', 'Rollers! She has brought the rollers!', 'Ooh, the tuner is here. Mine first!'],
  roadUp: ['Ha! It is stronger than it is supposed to be!', 'Above stock! I told you it was fast!', 'Look at that number! Somebody frame it!'],
  roadDown: ['Oh dear. It is a tractor in disguise.', 'That is rubbish. It is not me. It is the quad.', 'Under stock. We will pretend you did not see that.'],
  roadStock: ['Exactly stock. How exciting.', 'Right on stock. Boring, but it is honest.', 'Stock. Fine. I wanted a bigger number.'],
  roadBrag: ['I am the strongest! Read it and weep!', 'Top of the sheet! Say it, say I won!', 'Most power on the sheet. I would like it noted.'],
  roadReply: ['You only won because you cheated with the jets.', 'Fine. Mine is prettier, anyway.', 'It is a close thing. Do it again and I will beat it.'],
  roadBroke: ['It stalled! That was nearly my fault.', 'It died on the rollers! Try again, quick.'],
};
