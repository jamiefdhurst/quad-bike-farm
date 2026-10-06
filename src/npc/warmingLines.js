// What the girls say about warming their hands over an idling engine (warming.js): going over to it, holding their
// hands out, her friend joining her, and being cross when it's switched off. Merged into the main line sets
// (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_WARMING_LINES = {
  warmGo: line(60, ['Brr. I am going to stand by that engine.', 'It is freezing. That one is still running, I will go and warm up.']),
  warmHands: line(90, ['Ooh, that is lovely and warm.', 'That is better. My fingers had gone numb.', 'It is nicest right by the engine.']),
  warmJoin: line(60, ['Room for me?', 'Shift over a bit, then.']),
  warmOff: line(60, ['Oh, you have turned it off. I was warming up.', 'That was the only warm thing on the farm!']),
};

export const JESS_WARMING_LINES = {
  warmGo: ['Freezing! Right, engine.', 'I am going to go and hug that engine.'],
  warmHands: ['Ahh. Better than any radiator.', 'Look at me, warming my hands like an old farmer.', 'Do not tell me off, I am cold.'],
  warmJoin: ['Budge up, Amy.', 'Oh, it is a party. Move over.'],
  warmOff: ['Oi! I was using that!', 'Well that is just rude. I was nice and warm.'],
};
