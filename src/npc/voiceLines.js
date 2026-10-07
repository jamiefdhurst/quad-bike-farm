// What she says, by situation. A string is spoken; { sound } plays one of her
// recorded non-verbal sounds (public/audio/companion.json: sigh, hmm, laugh,
// yawn, hum, gasp, oh). `cooldown` is the least time in seconds before the same
// situation can make her speak again (scaled by the chattiness setting).
// `shout: true` lines are shouted: louder, and they carry further.
//
// To add a situation, add it here and raise it from companionVoice.js. After
// changing any spoken line, re-record them with tools/generate_companion_voice.py.

import { AMY_SKILL_LINES } from './skillLines.js';
import { AMY_REQUEST_LINES } from './requestLines.js';
import { AMY_PLACE_LINES } from './placeLines.js';
import { AMY_LOFT_LINES } from './loftLines.js';
import { AMY_BATTERY_LINES } from './batteryLines.js';
import { AMY_KNACK_LINES } from './knackLines.js';
import { AMY_OIL_LINES } from './oilLines.js';
import { AMY_DIESEL_LINES } from './dieselLines.js';
import { AMY_HEAT_LINES } from './heatLines.js';
import { AMY_SILENCER_LINES } from './silencerLines.js';
import { AMY_DIAGNOSIS_LINES } from './diagnosisLines.js';
import { AMY_THRASH_LINES } from './thrashLines.js';
import { AMY_REVOFF_LINES } from './revOffLines.js';
import { AMY_HORN_LINES } from './hornLines.js';
import { AMY_TRACTOR_LINES } from './tractorLines.js';
import { AMY_HAYRIDE_LINES } from './hayRideLines.js';
import { AMY_MUDGUARD_LINES } from './mudguardLines.js';
import { AMY_TRACTORGO_LINES } from './tractorGoLines.js';
import { AMY_TRACTORRUNAWAY_LINES } from './tractorRunawayLines.js';
import { AMY_QUAD_LINES } from './quadLines.js';
import { AMY_WARMING_LINES } from './warmingLines.js';
import { AMY_HEADSTART_LINES } from './headStartLines.js';
import { AMY_GOSSIP_LINES } from './gossipLines.js';
import { AMY_THROTTLE_LINES } from './throttleLines.js';
import { AMY_SMOKE_LINES } from './smokeLines.js';
import { AMY_RACE_LINES } from './raceLines.js';
import { AMY_RECALL_LINES } from './recallLines.js';
import { AMY_READING_LINES } from './readingLines.js';
import { AMY_PASS_LINES } from './passLines.js';
import { AMY_CONVOY_LINES } from './convoyLines.js';
import { AMY_DOUGHNUT_LINES } from './doughnutLines.js';
import { AMY_JUMP_LINES } from './jumpLines.js';
import { AMY_SHOWOFF_LINES } from './showOffLines.js';
import { AMY_NICK_LINES } from './nickLines.js';
import { AMY_LINEUP_LINES } from './lineUpLines.js';
import { AMY_TEA_LINES } from './teaLines.js';
import { AMY_JUMPER_LINES } from './jumperLines.js';
import { AMY_FAULT_LINES } from './faultLines.js';
import { AMY_BENCH_LINES } from './benchLines.js';

export const VOICE_LINES = {
  // Riding pillion ----------------------------------------------------------
  rideStart: {
    cooldown: 40,
    lines: [
      'Right, off we go.',
      'Go on then.',
      "Don't go mad.",
      'Hang on, let me get comfy. Okay.',
      'Gently does it.',
      'Here we go!',
      'Onwards!',
      'Take it easy to start with.',
      "Okay, I'm holding on.",
      'Off we pop.',
      'Lead the way.',
      'Ooh, here we go.',
      "Right. I'm ready.",
      'Steady away.',
    ],
  },
  rideFun: {
    cooldown: 35,
    lines: [
      'Oh, this is fun!',
      'Ooh, I like this.',
      'This is lovely, actually.',
      'Wheee!',
      'Go on, a bit faster.',
      { sound: 'laugh' },
      { sound: 'laugh' },
      { sound: 'laugh' },
      'I love this!',
      'Best idea you have had all week.',
      'Look at us go!',
      'This is brilliant.',
      'I could do this all day.',
      "Isn't this great?",
      'Woo!',
      "Okay, I'll admit it. This is fun.",
      'More of this, please.',
      'I am grinning like an idiot back here.',
      "We're like a proper farming couple.",
      'Again! Again!',
    ],
  },
  rideGentle: {
    cooldown: 50,
    lines: [
      'This is nice. Nice and gentle.',
      'I could get used to this.',
      'Look at that view.',
      'Lovely and peaceful out here.',
      'Just us and the fields.',
      "Isn't it pretty?",
      'This is my kind of speed.',
      'Smell that fresh air.',
      'You know, this is really nice.',
      { sound: 'hum' },
      { sound: 'hum' },
      'Look, the hedges are all wild flowers.',
    ],
  },
  rideLong: {
    cooldown: 150,
    lines: [
      'We should do this more often.',
      "I'm really glad we came out.",
      'My legs have gone numb, but I am happy.',
      'Thanks for bringing me out, by the way.',
      'Best day out in ages.',
      'Remind me why we ever stay in?',
      'This beats sitting on the sofa.',
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
      'Bumpy bumpy bumpy.',
      'Oof!',
      'That one went right up my spine.',
      'Did you aim for that?',
      'Ow, ow, ow.',
      'Whoa, hold on!',
      'Is there a smooth bit anywhere?',
      'My poor back.',
      'Careful, I nearly bit my tongue.',
    ],
  },
  rideFast: {
    cooldown: 20,
    lines: [
      'Careful!',
      'Not so fast!',
      'Slow down a bit, will you?',
      'Oi, steady on!',
      "We're going to come off!",
      'Too fast! Too fast!',
      'Easy, Lewis Hamilton.',
      "I'd like to get home in one piece.",
      'Slow down, you nutter!',
      'This is not a race!',
      'Ahh! Slow down!',
      "My hair's going everywhere!",
      "I'm holding on for dear life back here!",
      'Okay, okay, that is fast enough!',
    ],
  },
  hardBrake: {
    cooldown: 12,
    lines: [
      { sound: 'gasp' },
      { sound: 'gasp' },
      'Whoa!',
      'Blimey.',
      'Careful!',
      'Jeez!',
      'Ooh, my nose nearly hit your back.',
      'A bit of warning next time?',
      'Ow! Gently!',
      'Whoa, what was that for?',
    ],
  },
  stalledRiding: {
    cooldown: 25,
    lines: [
      { sound: 'oh' },
      { sound: 'oh' },
      "Oh. It's died.",
      'Has it stalled again?',
      'Oh, not again.',
      'Is it meant to do that?',
      'Well, that went well.',
      'Uh oh.',
      'Have you broken it?',
      "That doesn't sound good.",
      "It's gone quiet.",
      'Oops.',
      'Poor thing.',
      "Don't worry, it happens.",
    ],
  },
  ghostRiding: {
    shout: true,
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
      'Stop it! Stop it!',
      "Which one's the brake?!",
      "I'm too young to die!",
      "We're going round in circles!",
      "I'm getting dizzy!",
      'This is your fault!',
      'Get back on it!',
      'Somebody stop this thing!',
      'Mind the hedge! Mind the hedge!',
    ],
  },
  ghostRidingFun: {
    shout: true,
    cooldown: 5,
    lines: [
      'Wheee! Look, no driver!',
      "I'm driving! Sort of!",
      'Round and round we go!',
      'This is actually brilliant!',
      { sound: 'laugh' },
      { sound: 'laugh' },
      'Woo hoo!',
      "Don't you dare stop it!",
      'Bye! See you next lap!',
      'Faster, little quad!',
      "I'm queen of the field!",
      'Wave! Wave at me!',
      'Ha! You look so small from here!',
      'I love it!',
    ],
  },
  ghostStoppedFun: {
    shout: true,
    cooldown: 20,
    lines: [
      'Again! Do it again!',
      'That was amazing.',
      "Okay, that's the most fun I've had all year.",
      'Best. Ride. Ever.',
      { sound: 'laugh' },
      "I'm still dizzy. Brilliant.",
      "Don't tell my mum, but that was great.",
    ],
  },
  ghostStopped: {
    shout: true,
    cooldown: 20,
    lines: [
      "Don't you ever do that again.",
      'You absolute muppet.',
      'I could have died!',
      'Never. Again.',
      { sound: 'sigh' },
      'Right. I am walking home.',
      'My heart is going like the clappers.',
      'You owe me a very big drink.',
      "That wasn't funny. Okay, it was a bit funny.",
      "I'm telling your mum.",
      'You are in so much trouble.',
      'Can I get off now, please?',
    ],
  },
  rideShaking: {
    cooldown: 60,
    lines: [
      "Ooh, it's really shaking.",
      'My whole body is buzzing.',
      'Is it meant to vibrate this much?',
      'This is making my voice go all wobbly.',
      'My teeth are chattering.',
      "It's like riding a washing machine.",
      'Ooh, that tickles.',
      'I quite like the shaking, actually.',
    ],
  },
  seatedShaking: {
    cooldown: 45,
    lines: [
      "It's shaking like mad, sat here.",
      'Is it supposed to judder like this?',
      'My bum has gone numb.',
      'This thing is rattling my fillings.',
      "I'm vibrating. I'm actually vibrating.",
      "It's like one of those massage chairs.",
      'Ooh. Ooh. Okay, that is a lot of shaking.',
    ],
  },
  seatedShakingLong: {
    cooldown: 120,
    lines: [
      'I quite like the shaking, actually...',
      "I've been sat here buzzing for ages.",
      "My legs have gone all tingly. It's not unpleasant.",
      "Don't tell anyone, but this is quite relaxing.",
      "I'll stay here a bit longer, I think.",
      "Honestly, I'm fine. Take your time.",
      { sound: 'hum' },
      { sound: 'laugh' },
    ],
  },

  // Which quad she likes best: she picks a favourite each game.
  likeRed: {
    cooldown: 240,
    lines: ['I love the red one.', 'The red one is my favourite.', 'Good old red. Comfy, this.', 'This one just feels right.'],
  },
  likeBlue: {
    cooldown: 240,
    lines: ['Ooh, I love the blue one.', 'The blue one is definitely the best.', 'This one feels posh.', 'Blue is my favourite. Smoothest seat.'],
  },
  likeYellow: {
    cooldown: 240,
    lines: [
      'The yellow one! My favourite.',
      'I love this little yellow one. So noisy!',
      'This one is the most fun, the yellow one.',
      "It's tiny and loud and I love it.",
    ],
  },
  likeGreen: {
    cooldown: 240,
    lines: ["I love the old green one. It's like a tractor.", 'The green one is my favourite. So comfy.', 'Good old green. Slow, but I trust it.', "This one's indestructible, I reckon."],
  },
  likeOrange: {
    cooldown: 240,
    lines: ["The orange one's my favourite. Don't tell the others."],
  },
  preferGreen: {
    cooldown: 240,
    lines: ["I'd rather be on the green one.", 'The green one is comfier, you know.', 'Can we take the green one next time? It feels safer.'],
  },
  preferOrange: {
    cooldown: 240,
    lines: ['I want a go on the orange one. Even if there is no room for me.', 'The orange one looks the most fun.', "One day you're letting me drive the orange one."],
  },
  preferRed: {
    cooldown: 240,
    lines: ["I'd rather be on the red one, to be honest.", 'The red one is comfier.', 'Can we take the red one next time?'],
  },
  preferBlue: {
    cooldown: 240,
    lines: ['I prefer the blue one, if I am honest.', 'The blue one has a nicer seat.', 'Can we go on the blue one next?'],
  },
  preferYellow: {
    cooldown: 240,
    lines: ["The yellow one's more fun than this.", 'Can we go on the yellow one after?', 'I miss the yellow one.'],
  },
  // The kids' quad is Jess's alone (Amy never rides it, so her lines for it are never heard); the loan quad is anyone's.
  likeKids: {
    cooldown: 240,
    lines: ["The little pink one's cute, but I'd never fit."],
  },
  preferKids: {
    cooldown: 240,
    lines: ["I'd rather be on the little pink one. It's only a bit small."],
  },
  likeLoan: {
    cooldown: 240,
    lines: ["The loan one is lovely. Quiet, smooth. Don't you dare muddy it.", 'The loan quad is my favourite. It still smells new.', 'It starts first time. I could get used to this.'],
  },
  preferLoan: {
    cooldown: 240,
    lines: ["Can we go on the loan quad next? It's so smooth.", "I'd rather be on the loan one. It's got proper suspension."],
  },
  outOfFuel: {
    cooldown: 60,
    lines: [
      'Have we run out of petrol?',
      'Did you fill it up?',
      "I think it's out of petrol.",
      'Please tell me you checked the fuel.',
      'Is the tank empty?',
      "I'm not pushing it.",
      'There was a jerry can by the barn, I think.',
      "We're not walking home, are we?",
      'Try the reserve?',
    ],
  },
  mountedTogether: {
    cooldown: 60,
    lines: [
      'Hello, you.',
      'Ready when you are.',
      'Oh, there you are.',
      "Comfy? I'm comfy.",
      'Right, where are we off to?',
      'I saved you the front seat.',
      'Hiya.',
      'Driver, take me somewhere nice.',
      "Don't forget I'm back here.",
    ],
  },

  // Starting the engine nearby ----------------------------------------------
  crankStruggleCold: {
    cooldown: 45,
    lines: [
      'Have you tried the choke?',
      "It's cold, it'll want the choke.",
      'Choke?',
      'Give it some choke, it is freezing.',
      "Mine always needs the choke when it's cold.",
      "I don't know much about engines, but isn't there a choke?",
    ],
  },
  crankStruggleFlooded: {
    cooldown: 45,
    lines: [
      "Give it a rest, you'll flood it.",
      'Too much choke, maybe?',
      'It smells of petrol.',
      'I think you have drowned it.',
      'Maybe leave it a minute?',
      'Ease off the choke, perhaps?',
    ],
  },
  crankStruggleNoFuel: {
    cooldown: 45,
    lines: [
      'Is the petrol on?',
      "Maybe it's the fuel tap.",
      'Does it have any petrol?',
      'Is there a tap or something?',
      'Check the fuel?',
    ],
  },
  crankStruggle: {
    cooldown: 30,
    lines: [
      "It doesn't want to go, does it?",
      'Come on, you can do it.',
      { sound: 'sigh' },
      'Is it broken?',
      'Come on, little quad.',
      'Third time lucky?',
      "You'll get it.",
      'Have you tried swearing at it?',
      'Maybe it needs a cuddle.',
      'Keep going, it nearly went.',
    ],
  },
  caughtAfterStruggle: {
    cooldown: 30,
    lines: [
      'There we go!',
      'Finally!',
      'Yay!',
      'Hooray.',
      'Knew you could do it.',
      'Ooh, it lives!',
      'Well done, you.',
      'My hero.',
      'Told you.',
    ],
  },
  coldIdleNearby: {
    cooldown: 90,
    lines: [
      "It's ever so loud.",
      'It smells of petrol.',
      "Pooh, that's smoky.",
      'Ugh, the fumes.',
      "I'm going to smell of exhaust all day.",
      'Is it supposed to smoke that much?',
      'Let it warm up a bit.',
    ],
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
      'I could murder a cup of tea.',
      'Any time today would be nice.',
      'My wellies are filling with mud.',
      "I'm just going to stand here then.",
      "I think it's going to rain.",
      'Are we nearly ready?',
      'I spy something beginning with... grass.',
      "It's very green out here, isn't it?",
      'Shall I come and help?',
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
      "I'm keeping your seat warm.",
      'Hello? Driver?',
      'Ooh, I could have a little nap here.',
      'This seat is surprisingly comfy.',
      "I'm not getting off, if that's what you're hoping.",
      'Shall I drive, then?',
    ],
  },
  nearbyWarm: {
    cooldown: 60,
    lines: [
      'I do like it out here.',
      'Fancy a cuppa after this?',
      'Thanks for this, by the way.',
      'You look happy.',
      "It's nice, isn't it? Just us.",
      'I love you, you know.',
      'You have mud on your face. No, there.',
      "This is the best kind of weekend.",
      'Look at that sky.',
      'We should have a picnic out here one day.',
      'You and your quads.',
      "I'm glad we came.",
      'Smell that? Cut grass.',
      'Come here, you.',
      { sound: 'hum' },
      { sound: 'laugh' },
    ],
  },
  // Rare and sincere: how she feels about you. Raised from companionVoice.js.
  loveYou: {
    cooldown: 240,
    lines: [
      'I love you, you know.',
      'I love you. That is all.',
      "I'm really happy, you know. With you.",
      'You make me feel safe.',
      'I think you are lovely.',
      "I don't say it enough. I love you.",
      'I am so glad I get to do this with you.',
      "Whatever happens, I'm on your side.",
      'You are my favourite person.',
      "I couldn't have picked a better person to be stuck in a field with.",
      'Thank you for being you.',
      'I love our days like this.',
    ],
  },
  careForYou: {
    cooldown: 180,
    lines: [
      'Are you alright? You look cold.',
      "You'll tell me if you need anything, won't you?",
      'Look after yourself out here.',
      "I worry about you, that's all.",
      'Mind yourself, yeah? I need you in one piece.',
      "Don't wear yourself out. I care about you.",
      'Do you want a break? I will wait.',
      'You work too hard. Sit down a minute.',
    ],
  },
  // How you've treated her compared with her friend (favour.js). Favoured: warm and up for anything.
  favouredWarm: {
    cooldown: 150,
    lines: [
      "I'm up for anything today. You choose.",
      'Where to next? I will come anywhere with you.',
      "I'm having a lovely time. Are you?",
      'You always know how to make a day better.',
      "Go on, ask me something. I'll say yes.",
      'I like it when it is just us.',
    ],
  },
  // Neglected: she sulks.
  neglectedSulk: {
    cooldown: 150,
    lines: [
      "Don't mind me. I'll just stand here.",
      'Nobody asked me. Not that I mind.',
      { sound: 'sigh' },
      "I'm fine. Really. Fine.",
      'It is nice to be remembered occasionally.',
      "I'll be over here, then.",
    ],
  },
  // You asked her for something and she's not in the mood; her friend takes it on.
  refuseRequest: {
    cooldown: 20,
    lines: [
      'No. Ask someone else.',
      "Not today. I'm busy being ignored.",
      "I don't think I will, actually.",
      'Ask her. She seems to be your favourite.',
    ],
  },
  // Her friend's been turned down and she's the one who gets to do it.
  gloatTakeOver: {
    cooldown: 20,
    lines: [
      'Fine, I will do it. Gladly.',
      "Don't worry, I've got you.",
      'Shift over, I will take you. Happily.',
      'Oh well. More for me.',
    ],
  },
  // Neglected, bored, and off on a quad by herself.
  sulkOff: {
    cooldown: 60,
    shout: true,
    lines: [
      "I'm going for a drive! On my own!",
      'Back later! Or not!',
      "Don't wait up!",
      'I need some air!',
    ],
  },
  // You've found out she's been at something while you were away, and she can't keep a straight face.
  prankGiggle: {
    cooldown: 30,
    lines: [
      'Hee. Sorry. I cannot do this.',
      "I didn't do anything. Look, my face is perfectly straight.",
      "Oh no, you've found it. Sorry! Sorry.",
      "Don't look at me like that. It was funny.",
      'I was going to tell you. Eventually.',
    ],
  },
  // You talk to her once she's been caught.
  prankConfess: {
    cooldown: 30,
    lines: [
      'Fine. It was me. You should have seen your face.',
      "All right, it was me. I couldn't resist.",
      "Yes, I did it. You're not cross, are you?",
    ],
  },
  leftBehind: {
    shout: true,
    cooldown: 60,
    lines: [
      'Oi! Wait for me!',
      "Don't leave me here!",
      'Charming.',
      "Fine! I'll walk!",
      'Hey! Come back!',
      'Rude.',
      'I see how it is.',
      'Oh, thanks very much.',
    ],
  },
  playerBack: {
    cooldown: 60,
    lines: [
      "Oh, you're back.",
      'Did you have fun without me?',
      'There you are.',
      'I missed you. A bit.',
      'Welcome back, stranger.',
      'Where did you get to?',
      "Oh, hello. Thought you'd forgotten me.",
    ],
  },

  // Answering you -----------------------------------------------------------
  talkTo: { cooldown: 0, lines: [{ sound: 'hmm' }] },
  ackMount: {
    cooldown: 0,
    lines: [
      'Go on then.',
      'Alright.',
      'Okay!',
      'If I must.',
      'Ooh, go on.',
      'Yes please.',
      'Ooh, a ride. Lovely.',
      "I thought you'd never ask.",
      'Coming!',
      "Okay, but don't show off.",
      'Room for a little one?',
    ],
  },
  ackStand: {
    cooldown: 0,
    lines: [
      'Okay.',
      "Fine, I'll get off.",
      'Right you are.',
      'Alright.',
      'Sure.',
      'If you say so.',
      'On my way.',
      'Coming.',
    ],
  },
  // Doing things on her own when she's bored -------------------------------------
  selfWander: {
    cooldown: 30,
    lines: [
      "I'm going for a little wander.",
      'Back in a bit.',
      "I'm just going to have a look over there.",
      'Stretching my legs.',
      'Shout if you need me.',
      "I'll go and look at the cows. Are there cows?",
      { sound: 'hum' },
      { sound: 'sigh' },
    ],
  },
  // A quad that's badly in need of a service: stumbling, surging, banging.
  engineSick: {
    cooldown: 90,
    lines: ["That doesn't sound well at all.", 'It sounds like it is dying.', 'You need to get that serviced.', 'Is it meant to bang like that?', "It keeps nearly cutting out.", 'Poor thing. It needs some love.'],
  },
  // The weather (weather.js): a word about the day, and the rain coming and going.
  weatherSunny: {
    cooldown: 600,
    lines: ['What a lovely day for it.', "Ooh, it's actually sunny.", 'Look at that sky!', 'Perfect day for this.'],
  },
  weatherGrey: {
    cooldown: 600,
    lines: ["Bit grey, isn't it?", 'At least it is not raining. Yet.', 'Typical English summer.', 'Could be worse, I suppose.'],
  },
  weatherFog: {
    cooldown: 600,
    lines: ["I can't see a thing in this.", "It's like riding through soup.", 'Spooky in the fog, isn\'t it?', 'Mind where you go in this.'],
  },
  weatherRain: {
    cooldown: 600,
    lines: ['Lovely weather for ducks.', "I'm going to be soaked.", "Why did we come out in this?", "It's tipping it down."],
  },
  rainStarts: {
    cooldown: 120,
    lines: ["Oh no, it's starting to rain.", 'Was that a drop of rain?', "Here it comes. I didn't bring a coat.", 'Oh great. Rain.'],
  },
  rainStops: {
    cooldown: 120,
    lines: ["Oh, it's stopped.", 'Thank goodness, it has stopped raining.', "That's better.", "I think it's brightening up."],
  },
  stillRaining: {
    cooldown: 180,
    lines: ["My socks are wet.", "I'm absolutely drenched.", 'My hair is ruined.', "Can we go in yet? I'm soaking."],
  },
  // Hopping on the back of the other girl's quad as she sets off.
  selfJoin: {
    cooldown: 30,
    lines: ['Wait! Room for one more?', "Hang on, I'm coming with you!", 'Budge up, I want a go on the back.', "Don't go without me!", 'Ooh, can I come?'],
  },
  // Driving, with the other girl just got on the back.
  friendOn: {
    cooldown: 20,
    lines: ['Hold on, then!', 'Right, passenger. Off we go.', "Comfy? Here we go.", 'Hold on tight. I mean it.', "Okay, I'll go gently. Ish."],
  },
  selfMount: {
    cooldown: 30,
    lines: [
      "I'm getting on. I'm fed up of standing.",
      "I'll wait on this one.",
      "Bagsy this one.",
      'My feet hurt. Sitting down.',
      "I'm sitting on this till we go.",
      "Right, I'm on. Whenever you're ready.",
    ],
  },
  askOff: {
    cooldown: 30,
    lines: [
      'Can I get off now?',
      "Is it alright if I hop off? My legs have gone numb.",
      "Are we going anywhere, or can I get down?",
      "I'd quite like to get off now, if that's okay.",
      'Can I get down? This seat is not as comfy as it was.',
      "Babe? Can I get off yet?",
      "I'm going to need to stretch my legs at some point.",
      'Permission to get off?',
    ],
  },
  askStop: {
    cooldown: 60,
    lines: [
      'Can we stop soon? I could do with a stretch.',
      "My bum's gone numb. Can we have a break?",
      'Shall we stop for a bit?',
      'Can we pull over at some point?',
      "Lovely, but I'd like to get off soon.",
    ],
  },
  ackLetOff: { cooldown: 0, lines: ['Thank you!', 'Oh, thank goodness.', 'Finally.', 'Ooh, my legs.', 'Lovely, thanks.'] },
  ackKeepOn: {
    cooldown: 0,
    lines: [{ sound: 'sigh' }, 'Fine.', 'Charming.', "Okay, but I'm asking again in a minute.", 'Mean.', 'If I must.'],
  },
  selfGetOff: {
    cooldown: 30,
    lines: [
      "Right, I'm getting off. My legs have gone dead.",
      "I'm bored of sitting here.",
      "I'm going to stretch my legs.",
      "Sod this, I'm getting down.",
      'Enough sitting for me.',
      "I'll be over here if you need me.",
    ],
  },
  selfGetOffWaited: {
    cooldown: 30,
    lines: [
      "Right, I've waited long enough. I'm getting off.",
      "Well, I asked. I'm getting down.",
      "I'm not sitting here all day.",
      "You've forgotten about me, haven't you? I'm off.",
      'Fine. I will let myself off, then.',
    ],
  },
  takeOverStop: {
    shout: true,
    cooldown: 10,
    lines: [
      "Right, I'm stopping this thing!",
      "That's it. I'm turning it off.",
      'Enough! Where is the key?',
      'Okay, okay, I am stopping it!',
      "Stop! Stop! I'll do it myself.",
    ],
  },
  takeOverDrive: {
    shout: true,
    cooldown: 10,
    lines: [
      "Move over, I'm driving!",
      "Fine, I'll drive it myself!",
      "Nobody's steering, so I suppose it's me.",
      "Right. My turn at the front.",
    ],
  },
  selfKeyOff: {
    cooldown: 30,
    lines: [
      "I'll turn it off, shall I?",
      "There. It's off. Saving petrol.",
      'I switched it off, it was getting on my nerves.',
      'Off. You can thank me later.',
      'Ah, peace and quiet.',
      "I've turned it off, it was just sitting there burning petrol.",
    ],
  },
  selfStart: {
    cooldown: 30,
    lines: [
      "Right, I'm starting one myself.",
      'If you won\'t, I will.',
      "Let's see if I can get this going.",
      "I'm bored. I'm starting one.",
      'Watch me do it without you.',
    ],
  },

  // You with the hose ----------------------------------------------------------
  washing: {
    cooldown: 25,
    lines: [
      'Ooh, missed a bit.',
      'Can you do my wellies after?',
      "It'll only get muddy again.",
      'Look at it, all shiny.',
      "Don't you dare point that at me.",
      'Very domestic.',
      'You love that thing more than me.',
    ],
  },
  sprayedHer: {
    shout: true,
    cooldown: 6,
    lines: [
      'Oi!',
      'Argh! Stop it!',
      "That's freezing!",
      "You're dead. You are so dead.",
      { sound: 'gasp' },
      { sound: 'laugh' },
      'Not funny! Okay, a bit funny.',
      "I'm soaked!",
    ],
  },

  // Giving you a ride on the back ---------------------------------------------
  ackFollow: {
    cooldown: 0,
    lines: ["Ooh, a convoy! Okay.", "Right, I'll follow you. Not too fast.", "Lead the way, I'll be right behind you.", 'Go on then, I\'ll get this one going.', 'Follow the leader!'],
  },
  fallingBehind: {
    shout: true,
    cooldown: 25,
    lines: ['Wait for me!', 'Slow down!', "Oi! I can't keep up!", 'Hang on!', "You're going too fast!", 'Wait up!'],
  },
  // Following you, and you got off your quad and left her waiting.
  followGaveUp: {
    shout: true,
    cooldown: 0,
    lines: ["Right, I'm not waiting all day.", "Are we done? I'm getting off.", 'Fine. Convoy over.', "I'll take that as the end of the ride, then."],
  },
  followDriveOn: {
    shout: true,
    cooldown: 0,
    lines: ["Well, I'm not sitting here. I'm off for a drive.", 'If you have stopped, I am going on my own.', "Bye then! I'll go by myself."],
  },
  ackGiveRide: {
    cooldown: 0,
    lines: ['Ooh, really? Okay!', "Hop on then, I'll drive.", 'Me? Driving you? Go on then.', "Right. Hold on tight, I'm getting it started.", 'You trust me? Brave.'],
  },
  offerRide: {
    cooldown: 0,
    lines: ["You look lost back there. Shall I take you for a spin?", "Right, you're not going anywhere. I'll drive.", "Sat there doing nothing? Budge up, I'll take you round.", 'Come on then, I know the best bumps.'],
  },
  waitingForYou: {
    cooldown: 10,
    lines: ['Come on then, hop on!', 'Are you getting on or not?', "I'm waiting!", 'Your chariot awaits. Get on.'],
  },
  passengerOn: {
    cooldown: 0,
    lines: ['Hold on tight!', 'Ooh, this is different. Ready?', "Don't back-seat drive.", 'Comfy back there?', "Right. Off we go. Don't scream."],
  },
  ackLetMeOff: { cooldown: 0, lines: ['Okay, stopping.', 'Pulling over.', 'Had enough already?', 'Okay, okay.'] },
  ackStopHere: { cooldown: 0, lines: ['Stopping!', 'Here? Okay.', 'Brakes, brakes.', 'Righto.'] },
  ackSlower: { cooldown: 0, lines: ['Sorry! Slowing down.', 'Too fast? Okay.', "Fine, Grandad.", 'Gently, gently.'] },
  ackFaster: { cooldown: 0, lines: ['Ooh, you asked for it!', 'Faster? Okay!', 'Hold on, then!', "Don't blame me if we fall off."] },
  ackGoAgain: { cooldown: 0, lines: ['Off we go!', 'Round again!', 'Okay, hold on.'] },
  ackSwap: {
    cooldown: 0,
    lines: ['Fine, you drive.', "Okay, I'll get on the back.", 'Bossy.', 'Your turn. I was getting good at that.'],
  },

  // Starting a quad for you ----------------------------------------------------
  ackStart: {
    cooldown: 0,
    lines: [
      "I'll have a go.",
      'How hard can it be?',
      'Leave it to me.',
      'Right, stand back.',
      "Okay. I've seen you do it loads of times.",
      'Watch and learn.',
      'Me? Go on then.',
    ],
  },
  startTap: {
    cooldown: 20,
    lines: ['Petrol on first.', "Tap on. I remembered that one.", 'Fuel on...', 'This little lever is the petrol, isn\'t it?'],
  },
  startChoke: {
    cooldown: 20,
    lines: ['Bit of choke, I think.', 'Choke on.', 'Pull the choke thing...', "It's cold, so choke."],
  },
  startCrank: {
    cooldown: 6,
    lines: [
      'Come on...',
      'Come on, you.',
      'Is it this button?',
      'Why is it not going?',
      'It nearly went!',
      'Please start. Please.',
      'One more go.',
      { sound: 'sigh' },
    ],
  },
  startRemembered: {
    cooldown: 10,
    lines: ['Oh! Hang on.', 'Wait, I know what I forgot.', 'Ooh, silly me.', 'Ah. That might help.'],
  },
  startCaught: {
    cooldown: 10,
    lines: ['Ha! I did it!', 'See? Easy.', 'Yes! It lives!', 'Told you I could do it.', 'Ooh, listen to it go!', { sound: 'laugh' }],
  },
  startGaveUp: {
    cooldown: 10,
    lines: [
      "It won't go. Your turn.",
      'I give up.',
      'Nope. It hates me.',
      "I think it's broken.",
      "You do it, it doesn't like me.",
      { sound: 'sigh' },
    ],
  },
  startWarm: {
    cooldown: 30,
    lines: ["It's warmed up now. All yours.", 'There. Nice and warm for you.', "Choke's off, it's ready.", 'Your chariot awaits.'],
  },

  // Driving a quad herself ---------------------------------------------------
  selfDrive: {
    cooldown: 30,
    lines: [
      'Right, my turn.',
      "I'm having a go. Don't watch.",
      "How hard can it be? I'm driving.",
      "If you're not going to ride one, I am.",
      "I'm going to have a little drive.",
      'Move over, I fancy a go.',
      "Don't tell anyone, I'm taking this one out.",
      "I'm bored. I'm going for a spin.",
      'Just a little one. Round the field.',
    ],
  },
  ackDrive: {
    cooldown: 0,
    lines: [
      'Ooh, can I? Okay!',
      'Really? Me?',
      "Okay, but if I crash it, it's your fault.",
      'Ooh. Okay. Okay!',
      "Go on then. Don't laugh.",
      'Yes! Finally.',
      "Right. I've watched you do it. How hard can it be?",
      'Oh, go on then.',
      "Are you sure? Okay, I'm doing it.",
    ],
  },
  driveSetOffCareful: {
    cooldown: 20,
    lines: [
      "Slowly. Slowly does it.",
      "I'm going to take it really easy.",
      "Nobody look at me.",
      'Okay. Tiny bit of throttle. Tiny.',
      "I'm just going to go very, very slowly.",
      "Don't laugh if I crash.",
      'Deep breaths. Here we go.',
    ],
  },
  driveSetOffConfident: {
    cooldown: 20,
    lines: [
      "Right, I've got this.",
      'Hold on to your hat!',
      'Watch this, then.',
      "Let's see what it can do.",
      "I'm basically a pro now.",
      'Out of my way!',
      'Ooh, I feel brave today.',
    ],
  },
  driveSetOff: {
    cooldown: 10,
    lines: [
      'Here goes nothing.',
      'Okay. Okay. Going.',
      'Gently does it...',
      'Ooh, it moved!',
      "I'm moving! I'm actually moving!",
      'Right. Thumb on the... yes. Okay.',
      { sound: 'gasp' },
      'Off we go. Slowly.',
      'Wheee. Very small wheee.',
    ],
  },
  driveMoveOff: {
    cooldown: 20,
    lines: ['And off again.', 'Right, onwards.', 'Okay, going again.', 'Here we go again.', { sound: 'hum' }],
  },
  driveNervous: {
    cooldown: 12,
    lines: [
      "Which one's the brake again?",
      'Is this too fast?',
      "Don't look at me, I'm concentrating.",
      "Am I going straight? I feel like I'm not going straight.",
      'Why is it so bouncy?',
      'Oh god, oh god, oh god.',
      "It's heavier than it looks.",
      'Is it meant to wobble like that?',
      'Okay. Breathe.',
      "I don't trust it.",
      'How do you make this look so easy?',
      'Nobody move.',
      'Stay calm. Stay calm.',
      'This is faster than it looks from the back.',
    ],
  },
  driveHappy: {
    cooldown: 12,
    lines: [
      "I'm doing it!",
      'Look at me!',
      'Are you watching? Look!',
      'Ooh, I quite like this.',
      "I'm a natural.",
      'Farmer girl!',
      { sound: 'laugh' },
      { sound: 'laugh' },
      'This is actually fun.',
      "I'm getting the hang of it.",
      'Woo! Okay, little woo.',
      "Move over, I know what I'm doing now.",
      "You're never getting this back.",
    ],
  },
  driveOverSteer: {
    shout: true,
    cooldown: 8,
    lines: [
      'Whoa, whoa, whoa!',
      'That way! No, this way!',
      'Too much! Too much!',
      { sound: 'gasp' },
      'Eek!',
      'Why does it turn so much?',
      'Oops. Sorry, grass.',
      'Steady...',
    ],
  },
  driveBump: {
    cooldown: 8,
    lines: [{ sound: 'gasp' }, 'Ooh!', 'Eek!', 'Oof.', 'Bumpy!', 'Ow, my bum.', 'Whoops.', 'Hup!'],
  },
  driveObstacle: {
    shout: true,
    cooldown: 8,
    lines: [
      'Nope. Not going near that.',
      'Stop, stop, stop!',
      'Whoa! Back, back, back.',
      'Nearly!',
      "How do I go backwards? Oh, there it is.",
      "That wasn't there a minute ago.",
      { sound: 'gasp' },
      'Who put that there?',
    ],
  },
  // Her quad's sunk in a bog and she's given up on it.
  stuckInBog: {
    shout: true,
    cooldown: 20,
    lines: ["I'm stuck! Can you help?", "It's sunk! It won't move!", 'Help! I think I am stuck in the mud!', "Er... it's stuck. Properly stuck."],
  },
  // On the back of yours when you get it stuck.
  stuckRiding: {
    cooldown: 30,
    lines: ["We're stuck, aren't we?", 'Well, this is going well.', "Don't just keep revving it, you're digging us in.", 'Try going backwards and forwards.', "I'm not getting off in that."],
  },
  driveBogged: {
    cooldown: 8,
    lines: [
      "Why won't it go?",
      'Come on, go!',
      "It's just making a noise.",
      'Go on! Move!',
      "I'm pressing it! Why isn't it going?",
      'Is it stuck?',
      'Giddy up.',
    ],
  },
  driveRollBack: {
    shout: true,
    cooldown: 8,
    lines: [
      "Why's it going backwards?",
      'No, no, wrong way!',
      "It's rolling back! Brake!",
      "Whoa, I'm going backwards!",
      "Up! Go up! Why won't it go up?",
      { sound: 'gasp' },
    ],
  },
  driveStalled: {
    cooldown: 10,
    lines: [
      "Oh. It's stopped.",
      'What did I do?',
      "I didn't touch anything!",
      'Oh no, have I broken it?',
      "Why's it gone quiet?",
      "It's died on me.",
      { sound: 'oh' },
      'Oops.',
    ],
  },
  drivePause: {
    cooldown: 20,
    lines: [
      'Just having a breather.',
      'Hang on, I need a second.',
      'Okay. Stopping for a bit.',
      'Phew.',
      { sound: 'sigh' },
      'Where was I going?',
    ],
  },
  driveTooFast: {
    shout: true,
    cooldown: 10,
    lines: ['Too fast! Too fast!', 'Slow down! Why is it not slowing down?', 'Nope, nope, nope!', 'Brake! Where is the brake?'],
  },
  driveNoRoom: {
    cooldown: 10,
    lines: ["There's nowhere to go.", "I'll hit something. Not today.", "It's too tight here, I'm not risking it."],
  },
  driveBored: {
    cooldown: 10,
    lines: [
      "That's enough excitement for me.",
      "Okay, I think I've done my bit.",
      "Right, that's me done.",
      'I think that was enough for one day.',
      "Not bad, was it? I'm stopping while I'm ahead.",
      "Okay, I'm bored now.",
      "That was fun. I'm done.",
      "Right, you can have it back.",
    ],
  },
  driveScared: {
    cooldown: 10,
    lines: [
      "Okay, I don't like this.",
      'Nope. Done. Never again.',
      'My legs are shaking.',
      "I'm stopping before I crash it.",
      'That was terrifying.',
      "I'm not built for this.",
      "Okay, that's quite enough of that.",
      'I need a cup of tea.',
    ],
  },
  driveGaveUp: {
    cooldown: 10,
    lines: [
      "It keeps stopping. I'm done.",
      'It hates me. Your turn.',
      "I give up. It doesn't want me to drive it.",
      "Fine. I didn't want to drive it anyway.",
      { sound: 'sigh' },
    ],
  },
  driveToBack: {
    cooldown: 10,
    lines: [
      "I'll sit on the back. You drive.",
      "I'll wait on the back. Your turn.",
      "You drive, I'll hold on.",
      "I'm staying on, though. Back seat for me.",
      "Scooch. I mean, I'll scooch.",
      "Back seat's comfier anyway.",
      "Right, I'm a passenger again. Where are we going?",
      "I'll stay on. You can be the chauffeur.",
      "I've done my bit. Take me for a spin.",
    ],
  },
  driveGetOff: {
    cooldown: 10,
    lines: [
      "Right, I'm getting off.",
      'Feet on solid ground, please.',
      'Off I get.',
      'Oh, that feels better.',
      'My legs have gone all wobbly.',
      'There. Parked. Sort of.',
    ],
  },
  ackBack: {
    cooldown: 0,
    lines: ['Fine, you drive.', 'Okay, okay. Back seat.', "Spoilsport. Fine, I'll go on the back.", 'Alright, all yours.', 'Ooh, a lift. Go on.'],
  },
  ackStopDrive: {
    cooldown: 0,
    lines: [
      "Okay, okay, I'm stopping.",
      'Spoilsport.',
      'But I was getting good!',
      'Fine. How do I stop it? Oh, there.',
      'Alright, alright.',
      "I'm stopping! Don't rush me.",
    ],
  },
  driveTaken: {
    cooldown: 5,
    lines: [
      'Oi! I was driving that!',
      "Fine, I'll go on the back.",
      'Rude. Budge up, then. I mean, I will.',
      "Hey! I hadn't finished.",
      'Oh, hello. Taking over, are we?',
    ],
  },

  // You tinkering with a quad from the toolbox --------------------------------
  tinkerOpen: {
    cooldown: 90,
    lines: [
      'Ooh, a mechanic now?',
      'Since when were you a mechanic?',
      'Oh dear. The spanners are out.',
      "Shall I put the kettle on? This could take a while.",
      "Don't lose any of the little screws.",
      'Is this going to end with it in bits?',
      'Go on then, show me what you can do.',
    ],
  },
  tinker: {
    cooldown: 40,
    lines: [
      "Do you actually know what you're doing?",
      'What does that do?',
      'Was that bit important?',
      'Righty-tighty, lefty-loosey.',
      'Are you sure about that?',
      "You've got oil on your nose.",
      'Very technical.',
      "I hope you're remembering how it was.",
      { sound: 'hmm' },
    ],
  },
  tinkerLimiter: {
    cooldown: 60,
    lines: [
      'Is that legal?',
      'Why does it need to go faster?',
      'Is that even allowed?',
      "I'm not sure I'm getting on that now.",
      'Oh, here we go.',
      "If you crash it, I'm telling everyone.",
    ],
  },
  tinkerService: {
    cooldown: 60,
    lines: [
      'Ooh, a proper service.',
      'Does that mean it will stop shaking now?',
      'New plug? Look at you.',
      'It was sounding a bit poorly.',
      "Smells like you've been at it.",
      'Better. Probably.',
    ],
  },
  tinkerStock: {
    cooldown: 60,
    lines: ['Probably for the best.', 'Back how it was? Good.', 'Sensible.', 'Lost your nerve?', 'Phew.'],
  },
  tunedFast: {
    cooldown: 120,
    lines: [
      'Has it always gone this fast?',
      'What did you do to it?',
      "This is your fiddling, isn't it?",
      "Okay, that's quite fast now!",
      'Slow down, speed demon!',
      { sound: 'gasp' },
    ],
  },

  pouring: {
    cooldown: 60,
    lines: [
      "Don't spill it.",
      'Mind your shoes.',
      'Careful, you will get it everywhere.',
      'Ooh, I love the smell of petrol. Is that weird?',
      'Is that enough?',
      'Good thinking.',
    ],
  },
  // What she's good at, and being coached (skillLines.js).
  ...AMY_SKILL_LINES,
  // Favours she asks for (requestLines.js).
  ...AMY_REQUEST_LINES,
  // Sitting out, and sheltering (placeLines.js).
  ...AMY_PLACE_LINES,
  // The hayloft (loftLines.js).
  ...AMY_LOFT_LINES,
  // Flat batteries (batteryLines.js).
  ...AMY_BATTERY_LINES,
  // Each quad's knack (knackLines.js).
  ...AMY_KNACK_LINES,
  // Two-stroke oil (oilLines.js).
  ...AMY_OIL_LINES,
  ...AMY_DIESEL_LINES,
  // Heat (heatLines.js).
  ...AMY_HEAT_LINES,
  // Silencer off (silencerLines.js).
  ...AMY_SILENCER_LINES,
  // Faults that develop (faultLines.js).
  ...AMY_FAULT_LINES,
  // Listening to a running quad (diagnosisLines.js).
  ...AMY_DIAGNOSIS_LINES,
  // Thrashing a cold engine, and who wore it out (thrashLines.js).
  ...AMY_THRASH_LINES,
  // Rev-offs (revOffLines.js).
  ...AMY_REVOFF_LINES,
  // Horns (hornLines.js).
  ...AMY_HORN_LINES,
  // The tractor: the key that doesn't stop it, waiting for the glow plugs, and it catching (tractorLines.js).
  ...AMY_TRACTOR_LINES,
  // The hay ride: climbing on, bumps, lying back, falling off (hayRideLines.js).
  ...AMY_HAYRIDE_LINES,
  // Sat on the tractor's wheel arch (mudguardLines.js).
  ...AMY_MUDGUARD_LINES,
  // Having a go on the tractor, or refusing (tractorGoLines.js).
  ...AMY_TRACTORGO_LINES,
  // The tractor creeping off by itself, and the hedge (tractorRunawayLines.js).
  ...AMY_TRACTORRUNAWAY_LINES,
  // Quad nicknames, whose is whose, and placing a quad by ear (quadLines.js).
  ...AMY_QUAD_LINES,
  // Warming their hands over an idling engine (warmingLines.js).
  ...AMY_WARMING_LINES,
  // Starting your usual quad for you, or pointedly not (headStartLines.js).
  ...AMY_HEADSTART_LINES,
  // Caught talking about you (gossipLines.js).
  ...AMY_GOSSIP_LINES,
  // A hand on your throttle from the back (throttleLines.js).
  ...AMY_THROTTLE_LINES,
  // Two-stroke smoke (smokeLines.js).
  ...AMY_SMOKE_LINES,
  // Racing each other (raceLines.js).
  ...AMY_RACE_LINES,
  // Called back to the barn (recallLines.js).
  ...AMY_RECALL_LINES,
  // Reading the dash out from the back (readingLines.js).
  ...AMY_READING_LINES,
  // Overtaking whoever she's following (passLines.js).
  ...AMY_PASS_LINES,
  // Follow the leader (convoyLines.js).
  ...AMY_CONVOY_LINES,
  // Doughnuts (doughnutLines.js).
  ...AMY_DOUGHNUT_LINES,
  // The jump (jumpLines.js).
  ...AMY_JUMP_LINES,
  ...AMY_SHOWOFF_LINES,
  ...AMY_NICK_LINES,
  ...AMY_LINEUP_LINES,
  // Tea on the rack (teaLines.js).
  ...AMY_TEA_LINES,
  ...AMY_JUMPER_LINES,
  // The barn bench (benchLines.js).
  ...AMY_BENCH_LINES,
};
