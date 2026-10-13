// What the girls say about the barn's generator (generatorStart.js): generatorGo (she's off to start it), generatorCough (it won't
// catch), generatorCaught (it has), and generatorOut (it ran dry, said by whoever is near). Merged into the main line sets
// (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_GENERATOR_LINES = {
  generatorGo: line(60, ['I will start the generator. We cannot work in the dark.', 'Hang on, I will see to the generator.', 'The generator wants starting. I will do it.']),
  generatorCough: line(8, ['Come on, you silly thing.', 'It is not catching. One more go.', 'Come on. Start.']),
  generatorCaught: line(20, ['There. Lights and charger.', 'That is it going. Now we can see.', 'Good. It has caught.']),
  generatorOut: line(40, ['That is the generator out of diesel. It wants filling.', 'The lights have gone. It has run dry.', 'It will need more diesel before it starts again.']),
};

export const JESS_GENERATOR_LINES = {
  generatorGo: ['I will pull the cord. I am good at pulling.', 'Generator time. Stand back.', 'I will get the lights on, then.'],
  generatorCough: ['Come on, you pile of rubbish.', 'It is being awkward. Like you.', 'Again. It will go in a minute.'],
  generatorCaught: ['Ha! Who is brilliant? Me.', 'Lights! You are welcome.', 'Got it. Do not all thank me at once.'],
  generatorOut: ['Well, that has gone. Somebody forgot the diesel.', 'Lights out. Great.', 'It has run out. Not my fault.'],
};
