// What she says, by situation. A string is spoken; { sound } plays one of her
// recorded non-verbal sounds (public/audio/companion.json: sigh, hmm, laugh,
// yawn, hum, gasp, oh). `cooldown` is the least time in seconds before the same
// situation can make her speak again (scaled by the chattiness setting).
//
// To add a situation, add it here and raise it from companionVoice.js.

export const VOICE_LINES = {
  // Riding pillion ----------------------------------------------------------
  rideStart: {
    cooldown: 40,
    lines: ['Right, off we go.', 'Go on then.', "Don't go mad.", 'Hang on, let me get comfy. Okay.', 'Gently does it.'],
  },
  rideFun: {
    cooldown: 35,
    lines: [
      'Oh, this is fun!',
      'Ooh, I like this.',
      "This is lovely, actually.",
      'Wheee!',
      'Go on, a bit faster.',
      { sound: 'laugh' },
      { sound: 'laugh' },
    ],
  },
  rideRough: {
    cooldown: 18,
    lines: [
      'This is a bit rough.',
      'Ow! My bum.',
      "Bit bumpy, isn't it?",
      'Ooh, steady.',
      'My teeth are rattling.',
      'Mind the holes!',
    ],
  },
  rideFast: {
    cooldown: 20,
    lines: ['Careful!', 'Not so fast!', 'Slow down a bit, will you?', 'Oi, steady on!', "We're going to come off!"],
  },
  hardBrake: {
    cooldown: 12,
    lines: [{ sound: 'gasp' }, 'Whoa!', 'Blimey.', 'Careful!'],
  },
  stalledRiding: {
    cooldown: 25,
    lines: [{ sound: 'oh' }, "Oh. It's died.", 'Has it stalled again?', 'Oh, not again.', 'Is it meant to do that?'],
  },
  ghostRiding: {
    cooldown: 5,
    lines: [
      'Where are you going?!',
      'Come back!',
      "Who's driving this?!",
      'Oi!',
      'What are you doing?!',
      'How do I stop it?!',
      'This is not funny!',
      { sound: 'gasp' },
      'Help!',
      "I'm going to kill you!",
    ],
  },
  ghostStopped: {
    cooldown: 20,
    lines: [
      "Don't you ever do that again.",
      'You absolute muppet.',
      'I could have died!',
      'Never. Again.',
      { sound: 'sigh' },
      'Right. I am walking home.',
    ],
  },
  outOfFuel: {
    cooldown: 60,
    lines: ['Have we run out of petrol?', 'Did you fill it up?', "I think it's out of petrol."],
  },

  // Starting the engine nearby ----------------------------------------------
  crankStruggleCold: {
    cooldown: 45,
    lines: ['Have you tried the choke?', "It's cold, it'll want the choke.", 'Choke?'],
  },
  crankStruggleFlooded: {
    cooldown: 45,
    lines: ["Give it a rest, you'll flood it.", 'Too much choke, maybe?', 'It smells of petrol.'],
  },
  crankStruggleNoFuel: {
    cooldown: 45,
    lines: ['Is the petrol on?', "Maybe it's the fuel tap."],
  },
  crankStruggle: {
    cooldown: 30,
    lines: ["It doesn't want to go, does it?", 'Come on, you can do it.', { sound: 'sigh' }, 'Is it broken?'],
  },
  caughtAfterStruggle: {
    cooldown: 30,
    lines: ['There we go!', 'Finally!', 'Yay!', 'Hooray.'],
  },
  coldIdleNearby: {
    cooldown: 90,
    lines: ["It's ever so loud.", 'It smells of petrol.', "Pooh, that's smoky."],
  },

  // Waiting about -----------------------------------------------------------
  waitingStanding: {
    cooldown: 25,
    lines: [
      { sound: 'sigh' },
      { sound: 'sigh' },
      { sound: 'hum' },
      { sound: 'hum' },
      { sound: 'yawn' },
      'Are we going or what?',
      "It's a bit nippy, isn't it?",
      "Come on, I'm getting cold.",
      'What are you doing?',
      'Lovely day for it. Sort of.',
    ],
  },
  waitingSeated: {
    cooldown: 25,
    lines: [
      { sound: 'sigh' },
      { sound: 'hum' },
      { sound: 'hum' },
      'Are you getting on?',
      "I'll just wait here, then.",
      'Any time you like.',
    ],
  },
  leftBehind: {
    cooldown: 60,
    lines: ['Oi! Wait for me!', "Don't leave me here!", 'Charming.'],
  },
  playerBack: {
    cooldown: 60,
    lines: ["Oh, you're back.", 'Did you have fun without me?', 'There you are.'],
  },

  // Answering you -----------------------------------------------------------
  talkTo: { cooldown: 0, lines: [{ sound: 'hmm' }] },
  ackMount: { cooldown: 0, lines: ['Go on then.', 'Alright.', 'Okay!', 'If I must.', 'Ooh, go on.'] },
  ackStand: { cooldown: 0, lines: ['Okay.', "Fine, I'll get off.", 'Right you are.', 'Alright.'] },
  pouring: { cooldown: 60, lines: ["Don't spill it.", 'Mind your shoes.'] },
};
