// What the girls say about working the controls (girlControls.js): wetBrakes (hers have gone wet after water, and she pumps them dry) and
// bowlDrained (Amy opens the drain on the fuel tap's sediment bowl before she rides). Jess does not drain bowls, so she has only the first.
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_CONTROLS_LINES = {
  wetBrakes: line(60, ['The brakes are wet from the water. I will dab them dry.', 'That went through the brakes. Give me a moment to pump them.', 'My brakes have gone soft. I will tap them until they bite.']),
  bowlDrained: line(40, ['There was water in the bowl on the tap. I have drained it.', 'The glass on the tap had water in. It is out now.', 'I opened the drain on the tap first. That was full of water.']),
};

export const JESS_CONTROLS_LINES = {
  wetBrakes: ['Ooh, the brakes have gone all spongy. Tap tap tap.', 'Brakes are wet. Should be fine in a bit. Probably.', 'That was the water. Hang on, pumping them.'],
};
