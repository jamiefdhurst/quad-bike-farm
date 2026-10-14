// The farm dog, Meg (world/dog.js): what the girls say when she hops up on your rack, chases a quad or their boots, or nearly gets run
// over. Amy is wary of her at first and fond of her underneath; Jess is not wary at all. Merged into the main line sets (voiceLines.js,
// jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_DOG_LINES = {
  dogMounted: line(240, ['Meg is on your rack. Do not go fast with her on there.', 'She has got on the back again. Fine. Mind the corners.']),
  dogChasing: line(120, ['Meg, no. Leave the wheels alone.', 'She is chasing the quad again. She has no idea what she would do if she caught it.']),
  dogBoots: line(150, ['Meg, those are my boots. Get off.', 'She is at my heels again. I am not playing, Meg.']),
  dogYelp: line(120, ['Careful, you nearly ran her over!', 'Meg! Get out of the way, silly girl.']),
};

export const JESS_DOG_LINES = {
  dogMounted: ['Look at Meg on the back, she looks so pleased with herself.', 'Aww, she has got on your rack. Best seat in the house.'],
  dogChasing: ['Go on, Meg, get it!', 'She thinks she is going to catch it. Bless her.'],
  dogBoots: ['Hello, Meg! Are you herding me? You are, are you?', 'Ha, she is after my boots! Good girl, Meg.'],
  dogYelp: ['Oh, Meg! Is she all right? Come here, girl.', 'You nearly squashed her! Poor Meg.'],
};
