// What she says about her clothes the first time you talk to her on a day she's dressed up (outfits.js, outfitRemark): shirtTie,
// in a shirt and tie. Amy is going into town later; Jess wants to know if you like it. Merged into the main line sets
// (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_OUTFIT_LINES = {
  shirtTie: line(60, [
    'I am going into town later, before you ask. I am not changing twice.',
    'The shirt and tie is for town this afternoon. I have to see the bank.',
    'Do not look at me like that. I am going into town later, that is all.',
  ]),
};

export const JESS_OUTFIT_LINES = {
  shirtTie: ['So? Do you like it? Be honest. Actually, do not be honest.', 'Shirt and tie. Go on, tell me it suits me.', 'What do you think? I think I look brilliant.'],
};
