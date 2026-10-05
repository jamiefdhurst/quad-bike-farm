// What Amy and Jess say to each other. They're both after you, so it's a
// running, mostly good-natured rivalry: Amy sweet on the surface with a sharp
// edge, Jess openly cheeky and competitive. They talk to you as "you" and never
// about you as "he" or "she".
//
// Each exchange: `when` it can happen (raised by the game, see banter.js),
// `roles` (who has to be who: e.g. { rider: 'jess', watcher: 'amy' } means
// Jess is on your quad and Amy is watching; none for anyone), and its lines in
// order as [speaker, text], with `shout: true` for lines called across a
// distance. After editing, re-record both voices (tools/generate_companion_voice.py).

export const BANTER = [
  // Standing about together, near you --------------------------------------
  { when: 'idle', lines: [['jess', 'Nice polo, Amy. Did your mum pick it?'], ['amy', 'At least mine fits, Jess.']] },
  { when: 'idle', lines: [['amy', "I'm going on the back next. I asked first."], ['jess', 'You did not.'], ['amy', 'I asked in my head.']] },
  { when: 'idle', lines: [['jess', "Bet I'm the one who gets taken for a ride next."], ['amy', "Bet you're not."], ['jess', 'Watch me.']] },
  { when: 'idle', lines: [['amy', 'Some of us actually help around here.'], ['jess', 'Some of us are actually fun.']] },
  { when: 'idle', lines: [['jess', 'Amy drives like she is carrying eggs.'], ['amy', "At least I've never put one in a hedge."], ['jess', 'That hedge moved.']] },
  { when: 'idle', lines: [['amy', 'I made everyone a cup of tea earlier.'], ['jess', 'Everyone?'], ['amy', 'Well. Not you.']] },
  { when: 'idle', lines: [['jess', "Your hair's gone a bit flat, Amy."], ['amy', "And yours looks like you've been dragged through that hedge."], ['jess', 'Windswept. Look it up.']] },
  { when: 'idle', lines: [['amy', "You're standing very close, Jess."], ['jess', 'Am I? Hadn\'t noticed.'], ['amy', 'Course you hadn\'t.']] },
  { when: 'idle', lines: [['jess', 'You know I am the better driver, right?'], ['amy', 'Is that what you call it?']] },
  { when: 'idle', lines: [['amy', "I'll have you know I've been coming here for years."], ['jess', 'And you still can\'t start the red one.'], ['amy', 'It floods. Everyone knows it floods.']] },
  { when: 'idle', lines: [['jess', 'Amy, are you wearing perfume? Out here?'], ['amy', "It's called making an effort, Jess."]] },
  { when: 'idle', lines: [['amy', "Don't you have somewhere else to be, Jess?"], ['jess', 'Nope. Right here suits me.']] },
  { when: 'idle', lines: [['jess', "Go on, admit it. I'm your favourite."], ['amy', "Don't answer that."], ['jess', 'See? She is scared of the answer.']] },
  { when: 'idle', lines: [['amy', 'I brought biscuits, if anyone nice wants one.'], ['jess', "I'll have two, then."], ['amy', 'I said nice.']] },
  { when: 'idle', lines: [['jess', 'Rock, paper, scissors for the next ride?'], ['amy', "That's not how this works, Jess."], ['jess', 'Scared you will lose?']] },

  // You talking to one of them while the other's close by -------------------
  { when: 'talked', roles: { chosen: 'amy', jealous: 'jess' }, lines: [['jess', 'Oh, her again.'], ['amy', 'Yes. Me again.']] },
  { when: 'talked', roles: { chosen: 'amy', jealous: 'jess' }, lines: [['jess', 'Ask me next. I say yes to everything.'], ['amy', "That's not the boast you think it is."]] },
  { when: 'talked', roles: { chosen: 'amy', jealous: 'jess' }, lines: [['jess', 'Go on then, Amy. Do your sweet voice.'], ['amy', 'This is my normal voice.']] },
  { when: 'talked', roles: { chosen: 'jess', jealous: 'amy' }, lines: [['amy', "Don't let her talk you into anything daft."], ['jess', 'Too late.']] },
  { when: 'talked', roles: { chosen: 'jess', jealous: 'amy' }, lines: [['amy', "I'm right here, you know."], ['jess', 'We know, Amy.']] },
  { when: 'talked', roles: { chosen: 'jess', jealous: 'amy' }, lines: [['amy', 'Whatever she says, I said it first.'], ['jess', "You didn't say anything."]] },

  // Riding past one of them with the other on the back of your quad ---------
  { when: 'riding', roles: { rider: 'jess', watcher: 'amy' }, lines: [['amy', "Don't let her lean on you like that!", { shout: true }], ['jess', 'Jealous!', { shout: true }]] },
  { when: 'riding', roles: { rider: 'jess', watcher: 'amy' }, lines: [['jess', 'Bye, Amy!', { shout: true }], ['amy', 'Hope you fall off!', { shout: true }]] },
  { when: 'riding', roles: { rider: 'jess', watcher: 'amy' }, lines: [['amy', "It's my turn after this!", { shout: true }], ['jess', 'Not likely!', { shout: true }]] },
  { when: 'riding', roles: { rider: 'amy', watcher: 'jess' }, lines: [['jess', 'Go faster! See if she screams!', { shout: true }], ['amy', 'I will not scream!', { shout: true }]] },
  { when: 'riding', roles: { rider: 'amy', watcher: 'jess' }, lines: [['amy', 'Wave to Jess!', { shout: true }], ['jess', 'Very funny!', { shout: true }]] },
  { when: 'riding', roles: { rider: 'amy', watcher: 'jess' }, lines: [['jess', "Oi! You're meant to take me next!", { shout: true }], ['amy', "Says who?", { shout: true }]] },

  // Back from a ride, by the other one ---------------------------------------
  { when: 'back', roles: { rider: 'jess', watcher: 'amy' }, lines: [['amy', 'Have a nice time, did we?'], ['jess', 'Lovely, thanks. Shame you missed it.']] },
  { when: 'back', roles: { rider: 'jess', watcher: 'amy' }, lines: [['jess', 'Best ride of my life, that.'], ['amy', 'You say that every time.']] },
  { when: 'back', roles: { rider: 'jess', watcher: 'amy' }, lines: [['amy', "You were gone ages."], ['jess', 'Missed us?'], ['amy', 'No.']] },
  { when: 'back', roles: { rider: 'amy', watcher: 'jess' }, lines: [['jess', "Don't get used to it, Amy."], ['amy', 'Too late. I already have.']] },
  { when: 'back', roles: { rider: 'amy', watcher: 'jess' }, lines: [['amy', 'That was lovely. Very gentle.'], ['jess', 'Gentle. How thrilling.']] },
  { when: 'back', roles: { rider: 'amy', watcher: 'jess' }, lines: [['jess', 'Right, my go. Shift.'], ['amy', "I haven't even got off yet!"]] },

  // One driving on her own, the other watching -------------------------------
  { when: 'watching', roles: { driver: 'amy', onlooker: 'jess' }, lines: [['jess', 'You can go faster than walking pace, Amy!', { shout: true }], ['amy', "I'm being careful!", { shout: true }]] },
  { when: 'watching', roles: { driver: 'amy', onlooker: 'jess' }, lines: [['jess', 'Mind the hedge!', { shout: true }], ['amy', 'There is no hedge, Jess!', { shout: true }]] },
  { when: 'watching', roles: { driver: 'amy', onlooker: 'jess' }, lines: [['jess', "Ten out of ten for effort, Amy.", { shout: true }], ['amy', 'Ha ha.', { shout: true }]] },
  { when: 'watching', roles: { driver: 'jess', onlooker: 'amy' }, lines: [['amy', "Slow down! You'll break it!", { shout: true }], ['jess', 'Can\'t hear you!', { shout: true }]] },
  { when: 'watching', roles: { driver: 'jess', onlooker: 'amy' }, lines: [['amy', 'Show off!', { shout: true }], ['jess', 'Thank you!', { shout: true }]] },
  { when: 'watching', roles: { driver: 'jess', onlooker: 'amy' }, lines: [['jess', 'Watch this, Amy!', { shout: true }], ['amy', "I'd rather not.", { shout: true }]] },

  // One of them stuck in a bog ------------------------------------------------
  { when: 'stuck', roles: { stuck: 'amy', mocker: 'jess' }, lines: [['jess', "Oh dear. Need a hand, Amy?", { shout: true }], ['amy', 'Not from you!', { shout: true }]] },
  { when: 'stuck', roles: { stuck: 'amy', mocker: 'jess' }, lines: [['jess', 'Hold on, let me get a photo!', { shout: true }], ['amy', "Don't you dare!", { shout: true }]] },
  { when: 'stuck', roles: { stuck: 'jess', mocker: 'amy' }, lines: [['amy', 'Best driver on the farm, was it?', { shout: true }], ['jess', 'The mud came out of nowhere!', { shout: true }]] },
  { when: 'stuck', roles: { stuck: 'jess', mocker: 'amy' }, lines: [['amy', "Oh no. Anyway.", { shout: true }], ['jess', 'Amy! Help me!', { shout: true }], ['amy', 'Say please.', { shout: true }]] },

  // Both on the same quad -----------------------------------------------------
  { when: 'sharing', roles: { driver: 'jess', passenger: 'amy' }, lines: [['amy', "You don't have to go round every corner like that."], ['jess', "Hold on, then."]] },
  { when: 'sharing', roles: { driver: 'jess', passenger: 'amy' }, lines: [['jess', 'Comfy back there, Amy?'], ['amy', 'Just drive.']] },
  { when: 'sharing', roles: { driver: 'amy', passenger: 'jess' }, lines: [['jess', 'Any chance of second gear today?'], ['amy', "It doesn't have gears, Jess."], ['jess', 'Well, find some.']] },
  { when: 'sharing', roles: { driver: 'amy', passenger: 'jess' }, lines: [['amy', "Stop wriggling, you'll have us over."], ['jess', "I'm bored. Faster!"]] },
];
