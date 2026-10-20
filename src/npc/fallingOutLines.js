// The girls falling out (fallingOut.js): the row itself (fellOut, a bicker as it starts), what each says when you come near
// (her side, by what set it off), what she says when you take her side or tell her to make up, the sharp bickering while it
// lasts (fallenOut) and making up (madeUp). Merged into the main line sets (voiceLines.js, jessLines.js) and the banter
// (banterLines.js), so they're recorded with the rest. Nobody calls you anything but "you".

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_FALLINGOUT_LINES = {
  sideRace: line(120, ['She cut the corner and you know she did. I am not racing her again.', 'I am not cross about losing. I am cross about how she did it.', 'You saw that, did you? Then you know whose fault it is.']),
  sideBorrow: line(120, ['She took my quad. She did not even ask. I am not speaking to her.', 'I am not being funny, but that one is mine. Everyone knows that.', 'It is the principle. She knows it is mine.']),
  sideDigs: line(120, ['She has been picking at me all day, and I have had enough.', 'I let it go the first three times. Not the fourth.', 'You heard what she said. I am not going to repeat it.']),
  sideThanks: line(30, ['Thank you. Somebody sees it.', 'See? That is all I wanted. For someone to say so.', 'Well. I am glad one of us is being sensible.']),
  nudged: line(30, ['Fine. But she has to say sorry first.', 'I will think about it. Do not push.', 'You are very good at this, you know. Annoyingly.']),
  makeUpTea: line(20, ['I made you a tea. It is not an apology. It is a tea.', 'Here. Two sugars, the way you have it. Do not say anything.', 'I was putting the kettle on anyway. Do not read into it.']),
  makeUpQuad: line(20, ['You can have mine, if you want a go. I mean it.', 'Take my quad. Go on. It is the better one and we both know it.', 'I am not using mine. You might as well.']),
  makeUpTaken: line(20, ['Oh. Thank you. That is really kind.', 'All right. Yes. Thank you. I was being silly.', 'You are annoying, but that was nice. Thank you.']),
  makeUpRefused: line(20, ['No. Not yet. I am still cross.', 'Keep it. I am not ready.', 'That is a start. It is not enough, though.']),
  makeUpTurnedDown: line(20, ['Fine. I tried. Remember that I tried.', 'Well, I offered. That is all I can do.', 'Right. I will leave you to it, then.']),
};

export const JESS_FALLINGOUT_LINES = {
  sideRace: [
    'She cannot lose, can she? Always a reason. Always.',
    'I won fair and square and she is sulking. Not my problem.',
    'You saw it. Tell her you saw it.',
  ],
  sideBorrow: [
    'It is a quad, not a crown. Only I wanted a go.',
    'She is making a massive fuss over a quad. It is a quad.',
    'I only borrowed it. She is being dramatic.',
  ],
  sideDigs: [
    'She started it. I just finished it.',
    'She gives it out and cannot take it. Typical.',
    'I was only having a laugh and she went all quiet. Who does that?',
  ],
  sideThanks: ['Ha! See? You get it.', 'Knew you would be on my side. Always are, really.', 'Right. So that is settled, then. Amy can think about it.'],
  nudged: ['Oh, go on, then. Not yet, though.', 'You are not going to leave this alone, are you?', 'I will say sorry when she does. Not before.'],
  makeUpTea: ['Here. Tea. Do not make it weird.', 'Brought you a tea. You can still be cross, but you can be cross with a tea.', 'It is not poisoned. Go on, have it.'],
  makeUpQuad: ['Have mine. Go on. Do not say I never gave you anything.', 'You can have my quad for a bit. I am being generous. Enjoy it.', 'Take it before I change my mind.'],
  makeUpTaken: ['Go on, then. Cheers. We are fine, are we?', 'Ha. Fine. You win. Cheers, though.', 'Right. Good. That was exhausting, being cross.'],
  makeUpRefused: ['Not yet. I want you to feel it a bit longer.', 'No, thanks. Try again in a bit.', 'Nice try. Still cross.'],
  makeUpTurnedDown: ['Wow. Fine. I will keep it, then.', 'I try to be nice and this is what I get.', 'Your loss, honestly.'],
};

export const FALLING_OUT_BANTER = [
  // How it starts: a bad race
  { when: 'fellOut', roles: { kind: 'race', fault: 'amy' }, lines: [['jess', 'You can be a sore loser as well as slow, can you?'], ['amy', 'I am not slow. And I am not talking to you.'], ['jess', 'Then stop talking.']] },
  { when: 'fellOut', roles: { kind: 'race', fault: 'jess' }, lines: [['amy', 'You forced me off the line. I saw you.'], ['jess', 'I did not. You braked.'], ['amy', 'That is it. I am not racing you again.']] },
  // A quad taken
  { when: 'fellOut', roles: { kind: 'borrow', fault: 'jess' }, lines: [['amy', 'Get off my quad, Jess. Now.'], ['jess', 'Everything is yours, is it?'], ['amy', 'That one is. And I am done with you today.']] },
  { when: 'fellOut', roles: { kind: 'borrow', fault: 'amy' }, lines: [['jess', 'That is mine. You can find your own.'], ['amy', 'Nobody said it was.'], ['jess', 'Do not talk to me.']] },
  // One dig too many
  { when: 'fellOut', roles: { kind: 'digs', fault: 'amy' }, lines: [['jess', 'Oh, shut up, Amy. Just shut up for once.'], ['amy', 'Do not tell me to shut up.'], ['jess', 'Then stop being so smug.']] },
  { when: 'fellOut', roles: { kind: 'digs', fault: 'jess' }, lines: [['amy', 'Do you know what? That was unkind.'], ['jess', 'It was a joke.'], ['amy', 'It was not funny. I am going over here.']] },

  // While it lasts: sharper, and not at all friendly
  { when: 'fallenOut', lines: [['jess', 'Still not speaking?'], ['amy', 'Not to you.'], ['jess', 'Suits me.']] },
  { when: 'fallenOut', lines: [['amy', 'Some people should apologise.'], ['jess', 'Some people should grow up.']] },
  { when: 'fallenOut', lines: [['jess', 'Heard you telling everyone I was in the wrong.'], ['amy', 'Only everyone who asked.'], ['jess', 'Nobody asked.']] },
  { when: 'fallenOut', lines: [['amy', 'Do not stand near me.'], ['jess', 'I am not near you. You are near me.']] },
  { when: 'fallenOut', lines: [['jess', 'I will say sorry when you do.'], ['amy', 'Then we will be waiting a long time.'], ['jess', 'Lovely.']] },
  { when: 'fallenOut', lines: [['amy', 'I am being perfectly civil.'], ['jess', 'You are being perfectly cold.'], ['amy', 'Same thing.']] },

  // Making up
  { when: 'madeUp', roles: { sorry: 'amy' }, lines: [['amy', 'Look. I was snippy. I am sorry.'], ['jess', 'You were a bit.'], ['amy', 'Jess.'], ['jess', 'Fine. Me too. Come here.']] },
  { when: 'madeUp', roles: { sorry: 'amy' }, lines: [['amy', 'This is silly. I am not cross any more.'], ['jess', 'Good. I was getting bored of it.']] },
  { when: 'madeUp', roles: { sorry: 'jess' }, lines: [['jess', 'All right. I might have gone too far. Sorry.'], ['amy', 'Might have?'], ['jess', 'Did. I did. Happy?'], ['amy', 'Thrilled.']] },
  { when: 'madeUp', roles: { sorry: 'jess' }, lines: [['jess', 'Can we stop now? It is exhausting being this angry.'], ['amy', 'Yes. Please. I missed you slightly.'], ['jess', 'Slightly. Cheers.']] },
];
