// What the girls say about heat: heatPink (an air-cooled quad running too hot and pinking) and
// heatTicking (stood by a hot engine that's been switched off, ticking as it cools). Amy says what's
// wrong; Jess is cheerful about it. Merged into the main line sets (voiceLines.js, jessLines.js), so
// they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_HEAT_LINES = {
  heatPink: line(60, ["Can you hear that rattling? It's too hot. Let it have a rest.", "It's pinking. It's been sat idling in the sun for ages.", 'That engine is cooking. Get some air through it.']),
  heatTicking: line(90, ["Listen, it's ticking as it cools down.", "That's been worked hard. It's still ticking.", "Don't touch the engine, it's boiling."]),
};

export const JESS_HEAT_LINES = {
  heatPink: ["It's just rattling a bit. It likes it.", 'Ooh, it is pinging. Is that bad?', 'Hot. Very hot. Still going though.'],
  heatTicking: ['Tick, tick, tick. It sounds like a little clock.', 'Told you I was thrashing it.', 'Listen to it cool down. Brilliant.'],
};
