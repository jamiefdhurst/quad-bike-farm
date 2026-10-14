// What the girls say about heat: heatPink (an air-cooled quad running too hot and pinking) and
// heatHot and heatStalled (a water-cooled engine over what it can take, and one that has given up), heatTicking (stood by a hot engine that's been switched off, ticking as it cools). Amy says what's
// wrong; Jess is cheerful about it. Merged into the main line sets (voiceLines.js, jessLines.js), so
// they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_HEAT_LINES = {
  heatPink: line(60, ["Can you hear that rattling? It's too hot. Let it have a rest.", "It's pinking. It's been sat idling in the sun for ages.", 'That engine is cooking. Get some air through it.']),
  heatHot: line(90, ["The temperature gauge is in the red. Switch it off before it cooks.", "It's running hot. Have you looked at the temperature?", "That needle's right up. Something's wrong with the cooling."]),
  heatStalled: line(60, ["That's overheated and cut out. Leave it a few minutes.", "It's cooked itself. Give it time to cool before you try again."]),
  heatTicking: line(90, ["Listen, it's ticking as it cools down.", "That's been worked hard. It's still ticking.", "Don't touch the engine, it's boiling."]),
};

export const JESS_HEAT_LINES = {
  heatPink: ["It's just rattling a bit. It likes it.", 'Ooh, it is pinging. Is that bad?', 'Hot. Very hot. Still going though.'],
  heatHot: ['Ooh, the little light has gone red. Is that bad?', 'It smells a bit hot. Is it meant to?', 'The needle is miles up. I like it.'],
  heatStalled: ['It died. I think it got too hot.', 'Well, that is it, then. It is having a lie down.'],
  heatTicking: ['Tick, tick, tick. It sounds like a little clock.', 'Told you I was thrashing it.', 'Listen to it cool down. Brilliant.'],
};
