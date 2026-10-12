// What the girls say when a phone call comes (phoneCalls.js): phoneRing (it goes, and she is off to answer it), phoneTalk (into it,
// out of earshot, so low and a little muffled), phoneNews (she is back with good news) and phoneMood (back with bad). Merged into the
// main line sets (voiceLines.js, jessLines.js), so they are recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_PHONE_LINES = {
  phoneRing: line(40, ["That's my phone. I'll be a minute.", 'Sorry, I have to take this.', "Hold on, it's my mum.", "That'll be the vet. Won't be long."]),
  phoneTalk: line(8, ['Yes. Yes, I know.', 'Mm. No, that is fine.', 'Can it wait until Thursday?', 'Right. Right. Okay.', 'Oh, did they? Honestly.']),
  phoneNews: line(40, [
    'Good news. The vet says the old tractor tyres are fine for another season.',
    'That was the college. I have got a place on the engines course in the spring.',
    'Mum says there is a pie in the oven with your name on it.',
    'The parts have come in at the post office. I will collect them tomorrow.',
  ]),
  phoneMood: line(40, [
    'Don\'t. I don\'t want to talk about it.',
    'That was my brother, being my brother. Leave it.',
    'They have cancelled again. Honestly. I just need a minute.',
    'Not now, please. It was not a good call.',
  ]),
};

export const JESS_PHONE_LINES = {
  phoneRing: ['Ooh, hang on, it\'s Kayleigh!', 'Sorry, got to take this. Don\'t go anywhere.', 'My phone! Back in a sec.', 'Ha, it\'s my brother. He never rings.'],
  phoneTalk: ['No way! Shut up!', 'Hahaha. Stop it.', 'Did she really? In front of everyone?', 'Yeah, I\'m at the farm. Obviously.', 'I can\'t, I\'m busy. Fine, maybe.'],
  phoneNews: [
    'Guess what. Kayleigh\'s dad is selling his quad, and he says I can have first go.',
    'There is a bonfire at the weekend and you are invited. Do not say no.',
    'Dev has passed his test! Finally!',
    'You will never guess who got chucked. Never. Go on, guess.',
  ],
  phoneMood: [
    'Don\'t ask. Kayleigh is being so annoying.',
    'They went out without me again. Whatever.',
    'I\'m fine. Honestly. I\'m just not talking about it.',
    'Typical. Everyone is doing something and I am stuck here.',
  ],
};
