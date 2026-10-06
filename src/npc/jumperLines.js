// Jumpers from the barn (jumpers.js): jumperOn (pulling one over her head, with a grumble about how it looks) and jumperOff
// (hanging it up again once it's warm). Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded
// with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_JUMPER_LINES = {
  jumperOn: line(60, ['It is freezing. I suppose I will have to wear this thing.', 'It is far too big, and grey. But it is warm.', 'I hate this jumper. I am wearing it anyway.']),
  jumperOff: line(60, ['That is better. Back on the hook you go.', 'It is warm enough now. Thank goodness, I looked like a sack.', 'Right, jumper off. Nobody saw that.']),
};

export const JESS_JUMPER_LINES = {
  jumperOn: ['Ugh, this smells of the barn. I am so cold though.', 'I look like a potato in this. Do not say anything.', 'Fine. I will wear the hideous jumper.'],
  jumperOff: ['Oh, thank goodness. I was boiling in that.', 'Jumper off. I am a person again.', 'Never speak of the jumper.'],
};
