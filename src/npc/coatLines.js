// Wax jackets from the barn (coats.js): coatOn (putting one on in the rain), coatOff (hanging it back up once it's dry) and hoodUp
// (pulling the hood up as it comes on heavier). Merged into the main line sets (voiceLines.js, jessLines.js), so they're
// recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_COAT_LINES = {
  coatOn: line(60, ['Right, a proper coat. I am not getting soaked for anyone.', 'This smells of wax and dog, but it is dry.', 'Coat on. Now I can stand here all day.']),
  coatOff: line(60, ['That is the rain done. Back on the rack.', 'Dry enough. I will hang this up before it walks off.', 'Coat off. I can feel my arms again.']),
  hoodUp: line(120, ['Hood up. This is not stopping.', 'Here it comes properly now.', 'I knew I should have brought the hood up sooner.']),
};

export const JESS_COAT_LINES = {
  coatOn: ['I look like somebody\'s nan in this. A dry nan, though.', 'Ooh, this one has a sweet wrapper in the pocket.', 'Fine, the wax jacket. Do not take a picture.'],
  coatOff: ['Oh, that is better. It was like wearing a tent.', 'Coat off, the sun is out. Sort of.', 'Back on the rack, you crinkly thing.'],
  hoodUp: ['Hood up! I cannot hear a thing now.', 'My hair is going to be a disaster anyway.', 'Why does it always rain when I come here?'],
};
