// What the girls say about a quad with its silencer off: silencerOff (you've just taken it off),
// silencerOn (you've put it back) and silencerLoud (it's running near her). Amy covers her ears and
// disapproves; Jess loves it. Merged into the main line sets (voiceLines.js, jessLines.js), so
// they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_SILENCER_LINES = {
  silencerOff: line(60, ["You've taken the silencer off. Why?", "That's going to be so loud. I'm not standing next to it.", 'The neighbours will complain.', 'Please tell me you are putting that back.']),
  silencerOn: line(60, ['Oh, thank goodness. My ears.', 'Much better. You can hear yourself think.', 'Good. That was giving me a headache.']),
  silencerBlown: line(120, ['That one is getting loud. I think the silencer packing has blown out.', 'Can you hear that? It never used to be that raspy. It wants repacking at the bench.', 'It is getting louder by itself. The packing must have gone.']),
  silencerLoud: line(50, ["I can't hear a thing! Turn it off!", 'That is deafening!', "My ears are ringing. It's far too loud.", 'Put the silencer back on!']),
};

export const JESS_SILENCER_LINES = {
  silencerOff: ['Ooh, yes. Make it loud.', 'Finally. Some proper noise.', 'I knew you had it in you.'],
  silencerOn: ['Boo. Put it back the loud way.', 'Spoilsport. Again.', 'But it was brilliant.'],
  silencerBlown: ['Ooh, it has got louder! Do not fix it. Leave it.', 'Listen to it! It sounds like a proper race bike now.', 'The packing has gone. Best thing that ever happened to it.'],
  silencerLoud: ['Listen to that! Brilliant!', 'Louder! Go on, louder!', 'It sounds like a proper race bike.', 'Ha! The cows have gone.'],
};
