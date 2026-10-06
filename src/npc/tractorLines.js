// What the girls say about the tractor (tractorWatch.js): tractorKey (you've turned the key off and it carries on running, which is
// the stop knob's job), tractorGlow (you're waiting for the glow plugs on a cold start) and tractorCaught (it has just fired up in its
// cloud of black smoke). Amy knows how it's done; Jess laughs. Merged into the main line sets (voiceLines.js, jessLines.js), so they're
// recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_TRACTOR_LINES = {
  tractorKey: line(90, ['You have turned the key off and it is still going. It has a knob for that.', 'That is not how you stop a tractor. Pull the knob.', 'It has not noticed the key is off. It never does.']),
  tractorGlow: line(45, ['Wait for the glow light first. It is a diesel, it needs warming.', 'Give it a minute while the plugs heat. Light first, then the starter.', 'Not yet. Wait for the light.']),
  tractorCaught: line(50, ['There it goes. Lovely, in a smoky sort of way.', 'That is a lot of smoke, even for that tractor.', 'It is going. Give it a minute to settle.']),
};

export const JESS_TRACTOR_LINES = {
  tractorKey: ['Ha! You turned it off and it carried on. Brilliant.', 'The key does nothing, you muppet. It is the knob.', 'Look at you, telling it to stop and it will not listen.'],
  tractorGlow: ['Come on, come on. It is only a tractor.', 'How long does this take? I am getting old here.', 'Is it ready yet? Come on.'],
  tractorCaught: ['Ha! Look at the smoke! Do it again!', 'Black clouds! Brilliant.', 'Is it on fire? No? Shame.'],
};
