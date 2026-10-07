// Jess's own lines: cheekier, braver and more of a wind-up than Amy. Each
// situation here replaces Amy's lines for that situation (its cooldown and
// shout carry over from voiceLines.js unless given here); anything not listed
// she says from the shared lines. Same rules as voiceLines.js, and the same
// re-recording step (tools/generate_companion_voice.py --character jess).

import { JESS_SKILL_LINES } from './skillLines.js';
import { JESS_REQUEST_LINES } from './requestLines.js';
import { JESS_PLACE_LINES } from './placeLines.js';
import { JESS_LOFT_LINES } from './loftLines.js';
import { JESS_BATTERY_LINES } from './batteryLines.js';
import { JESS_KNACK_LINES } from './knackLines.js';
import { JESS_OIL_LINES } from './oilLines.js';
import { JESS_DIESEL_LINES } from './dieselLines.js';
import { JESS_HEAT_LINES } from './heatLines.js';
import { JESS_SILENCER_LINES } from './silencerLines.js';
import { JESS_DIAGNOSIS_LINES } from './diagnosisLines.js';
import { JESS_THRASH_LINES } from './thrashLines.js';
import { JESS_REVOFF_LINES } from './revOffLines.js';
import { JESS_HORN_LINES } from './hornLines.js';
import { JESS_TRACTOR_LINES } from './tractorLines.js';
import { JESS_HAYRIDE_LINES } from './hayRideLines.js';
import { JESS_MUDGUARD_LINES } from './mudguardLines.js';
import { JESS_TRACTORGO_LINES } from './tractorGoLines.js';
import { JESS_LPLATE_LINES } from './lPlateLines.js';
import { JESS_TRACTORRUNAWAY_LINES } from './tractorRunawayLines.js';
import { JESS_QUAD_LINES } from './quadLines.js';
import { JESS_WARMING_LINES } from './warmingLines.js';
import { JESS_HEADSTART_LINES } from './headStartLines.js';
import { JESS_GOSSIP_LINES } from './gossipLines.js';
import { JESS_THROTTLE_LINES } from './throttleLines.js';
import { JESS_SMOKE_LINES } from './smokeLines.js';
import { JESS_RACE_LINES } from './raceLines.js';
import { JESS_RECALL_LINES } from './recallLines.js';
import { JESS_READING_LINES } from './readingLines.js';
import { JESS_PASS_LINES } from './passLines.js';
import { JESS_CONVOY_LINES } from './convoyLines.js';
import { JESS_DOUGHNUT_LINES } from './doughnutLines.js';
import { JESS_JUMP_LINES } from './jumpLines.js';
import { JESS_SHOWOFF_LINES } from './showOffLines.js';
import { JESS_NICK_LINES } from './nickLines.js';
import { JESS_LINEUP_LINES } from './lineUpLines.js';
import { JESS_TEA_LINES } from './teaLines.js';
import { JESS_JUMPER_LINES } from './jumperLines.js';
import { JESS_FAULT_LINES } from './faultLines.js';
import { JESS_BENCH_LINES } from './benchLines.js';

export const JESS_LINES = {
  rideStart: [
    'Go on then, impress me.',
    'Try not to stall it this time.',
    "Right, let's see what you've got.",
    "I'm holding on. Not because I'm scared.",
    'Chop chop.',
    'Floor it. Kidding. Mostly.',
    'Off we go, chauffeur.',
    "Don't bore me.",
    "Come on then, Lewis Hamilton.",
  ],
  rideFun: [
    'Ha! Yes!',
    'Faster! Go on!',
    'Now we are talking!',
    'Woo hoo!',
    "This is brilliant. Don't tell anyone I said that.",
    "See? You can drive when you want to.",
    'Again! Go round again!',
    { sound: 'laugh' },
    { sound: 'laugh' },
  ],
  rideGentle: [
    'My nan goes faster than this.',
    "Are we actually moving?",
    'You can use the throttle, you know.',
    'Lovely. Very relaxing. Bit boring.',
    "Wake me up when we get there.",
    { sound: 'yawn' },
  ],
  rideLong: [
    "Alright, this isn't bad.",
    "I'll admit it. This is fun.",
    "We should nick these more often.",
    "Best day I've had in ages, this.",
  ],
  rideRough: [
    'Ow! Did you aim for that?',
    'You hit every single bump on purpose.',
    'My bum is going to be black and blue.',
    "There's a smooth bit there. You missed it.",
    'Oof! Thanks for that.',
    'Are you trying to throw me off?',
  ],
  rideFast: [
    "Woah! Okay, okay, that's quick!",
    "Bit fast, even for me!",
    "Ha! Mad! Slow down a bit!",
    "If I fall off, I'm telling your mum!",
    'Steady on, speed racer!',
  ],
  hardBrake: [
    'Oi! Warn me!',
    'Woah! My face nearly hit your back.',
    'Nice. Very smooth.',
    'Bit sharp!',
  ],
  stalledRiding: [
    'Smooth.',
    'And it died. Nice one.',
    'You stalled it! Ha!',
    "Try that again, but properly.",
    'Want me to have a go?',
  ],
  ghostRiding: [
    "Oi! Where's the driver gone?!",
    "You can't just leave me on here!",
    "This isn't funny! Well, it's a bit funny!",
    'Get back here!',
    "I'm going to get you for this!",
  ],
  ghostRidingFun: [
    'Look, no hands! No driver either!',
    "Ha! It's driving itself!",
    'Wave to me! I am waving!',
    'This is the best thing ever!',
    'Bye! See you next lap!',
  ],
  ghostStoppedFun: [
    'Do it again! Do it again!',
    'That was brilliant. You are an idiot. But brilliant.',
    'Right, my go next.',
  ],
  ghostStopped: [
    'You absolute plonker.',
    "I'll remember that.",
    "Very funny. I'm laughing on the inside.",
    'You owe me a cup of tea for that.',
  ],
  rideShaking: [
    "My teeth are rattling! Ha!",
    'Is it meant to shake like a washing machine?',
    "It's like a massage. A really rubbish massage.",
    'My voice is going all wobbly. Listen. Aaaah.',
  ],
  seatedShaking: [
    "This thing's got the shakes.",
    "It's buzzing my bum off, this one.",
    'Ooh, vibrating seat. Fancy.',
  ],
  seatedShakingLong: [
    "I'm getting used to the shaking. Is that weird?",
    "I've been buzzing so long I can't feel my legs.",
    "Honestly? Quite like it now.",
  ],
  likeRed: ["The red one's the best. Obviously.", 'Red ones go faster. Everyone knows that.'],
  likeBlue: ["Blue one's alright, isn't it?", 'I like the blue one. It does what it is told. Unlike you.'],
  likeYellow: ["The yellow one's my favourite. It's loud and rude, like me.", 'Little yellow one! Love it.'],
  likeGreen: ["The green one's like an old dog. I love it.", 'Green one. Proper farm quad, that.'],
  likeOrange: ['The orange one. Fast and noisy. Perfect.', "Orange one's mine. I've called it."],
  preferGreen: ['Can we swap to the old green one?', 'The green one is comfier, you know.'],
  preferOrange: ['I want a go on the orange one. Even if there is no seat for me.', 'The orange one looks way more fun than this.'],
  preferRed: ['The red one is better than this.', 'We should have taken the red one.'],
  preferBlue: ['Blue one next time. This seat is rubbish.', "I'd rather be on the blue one."],
  preferYellow: ['The yellow one is more fun.', 'Yellow one after this? Go on.'],
  likeKids: ["The little pink one's mine. Don't touch it.", 'Tiny and pink and absolutely mine.'],
  preferKids: ['I want the little pink one. It is mine, you know.', 'Pink one next. I called it.'],
  likeLoan: ["The loan one's got no personality, but it's fast. Fine, I love it.", 'Posh one. Go on then, I am in love.'],
  preferLoan: ['Can we go on the posh loan one next?', "I'd rather be on the loan quad. It's shiny."],
  outOfFuel: [
    'Did you forget to put petrol in? Classic.',
    "We're out of petrol, aren't we?",
    "Don't look at me, I didn't drink it.",
  ],
  mountedTogether: [
    'Oh, it is you. Go on then.',
    'Took your time.',
    'Ready when you are, slowcoach.',
    'Hiya, driver.',
  ],
  crankStruggleCold: [
    "It's freezing, it'll want the choke, genius.",
    'Choke. Try the choke.',
    'Have you heard of a choke?',
  ],
  crankStruggleFlooded: [
    "You've flooded it, haven't you?",
    "Leave it a minute, you've drowned it.",
    'Bit much choke, maybe?',
  ],
  crankStruggleNoFuel: ['Is the petrol even on?', "Fuel tap. Just saying.", 'Have you checked the tap?'],
  crankStruggle: [
    "Want me to do it?",
    "It doesn't like you.",
    'You are just making it angry.',
    "Go on, you've got this. Probably.",
    { sound: 'laugh' },
  ],
  caughtAfterStruggle: ['Finally!', 'Hallelujah!', 'Took you long enough.', 'About time!'],
  coldIdleNearby: ['Proper smoky, this one.', 'Smells like a garage in here.', 'Lovely. Fumes.'],
  waitingStanding: [
    "Are we doing something or just standing here?",
    "I'm getting old here.",
    'Hello? Anyone home?',
    "I'll drive if you won't.",
    'This is riveting.',
    'Shall I just take one?',
    { sound: 'sigh' },
  ],
  waitingSeated: [
    'Get on then.',
    "I'm not getting any younger.",
    "Are you driving or am I?",
    "I'm sat here like a lemon.",
  ],
  nearbyWarm: [
    'Not a bad spot, this.',
    "Bacon sandwich after this? You're buying.",
    "You know, I could get used to farm life.",
    "I'd have brought crisps if I'd known.",
    'Bet I could beat you round the field.',
  ],
  loveYou: [
    "Don't make it weird, but I love you.",
    'You are alright, you know. I love you.',
    "I'd say I love you, but it'll go to your head. Too late. I love you.",
    "I'm really glad it's you.",
    "Nobody else gets to see me this muddy. That's love.",
    "You're my favourite. Don't tell Amy.",
    "I like you loads, that's all.",
    'Best person I know, you.',
  ],
  careForYou: [
    "You look shattered. Sit down, I'll sulk quietly.",
    "Look after yourself, you idiot. I care, alright?",
    "Don't do anything daft. I'd miss you.",
    'You alright? Properly?',
    'Have a breather. I mean it.',
    "I'd be lost without you, so mind yourself.",
  ],
  leftBehind: ['Oi! Rude!', "Don't you dare leave me!", 'Hey! I was coming!', 'Charming!'],
  playerBack: ["Oh, you're back. Did you miss me?", 'There you are. Thought you had run off.', 'Finally.'],
  ackMount: ['Go on then.', 'Fine. You owe me.', 'Shove up.', 'If I must.'],
  ackStand: ['Fine.', 'Bossy.', 'Yes, boss.', 'Alright, alright.'],
  selfWander: ["I'm going for a nosy.", "Don't miss me too much.", "Off exploring. Don't wait up."],
  engineSick: ['That thing is on its last legs.', 'Sounds like a bag of spanners. Fix it.', 'Bang! Ha! Is that meant to happen?', "It's going to die on you. Just saying."],
  weatherSunny: ['Sun\'s out. Shame I forgot the suncream.', "Lovely. I'll get a tan while you faff about.", 'Finally, some decent weather.'],
  weatherGrey: ['Grim, isn\'t it?', 'Proper miserable sky, this.', 'Grey. Like your driving.'],
  weatherFog: ["Can't see a thing. Perfect for losing you.", "It's like a horror film out here.", 'Fog. Brilliant. Mind the hedge.'],
  weatherRain: ["I'm going to look like a drowned rat.", 'Whose idea was this?', 'Brilliant. Rain. Love it.'],
  rainStarts: ['Oh, here we go. Rain.', "Great. And I've just done my hair.", 'Rain! Course it is.'],
  rainStops: ['Finally.', 'About time it stopped.', 'Right, that is more like it.'],
  stillRaining: ["I'm soaked through. This is your fault.", 'My mascara is running. Do not look.', "Can't feel my fingers."],
  selfJoin: ["Oi, wait for me! I'm coming!", 'Shove up, I want a ride.', "You're not going without me.", 'Taxi! Wait!'],
  friendOn: ['Hold on, Amy. This might get messy.', "Right. Scream if you want to go faster.", 'Welcome aboard. No complaining.', "Hold tight, I'm not slowing down for you."],
  selfMount: ["I'm sitting on this. My feet hurt.", "I'm getting on. Come and drive me.", "Bagsy this one."],
  askOff: ['Can I get off now? My bum is dead.', "I've been sat here ages. Off?", 'Let me off, go on.'],
  askStop: ['Pit stop soon? I need to stretch.', "My legs have gone to sleep. Can we stop?"],
  ackLetOff: ['Ta.', 'Finally!', 'Freedom!'],
  ackKeepOn: ['Wow. Okay.', 'Rude.', 'I will remember this.'],
  selfGetOff: ["I'm getting off. This is boring.", 'Right, done with this.', "I'm off. Bye."],
  selfGetOffWaited: ["Right, I've had enough. I'm off.", 'I asked nicely. Now I am getting off.'],
  takeOverStop: ["Right, that's it! I'm stopping it!", 'Enough! Off it goes!'],
  takeOverDrive: ['Shove over, my turn!', "Fine! I'll drive the thing!"],
  selfKeyOff: ['I turned it off. You are welcome.', "There. Saved you some petrol."],
  selfStart: ["I'm starting one. Watch and learn.", "If you won't, I will.", "How hard can it be?"],
  washing: ['You missed a bit.', "Can you wash my car after?", 'Look at you, all domestic.'],
  sprayedHer: ['Oi! You are dead!', 'Right! That is it!', "You'll pay for that!", 'Argh! My hair!'],
  ackFollow: ["Race you! Kidding. I'll follow.", "Right behind you. Don't go slow."],
  fallingBehind: ['Oi! Wait up!', 'Cheat!', 'Slow down, show off!'],
  followGaveUp: ['Boring. I am getting off.', 'Convoy cancelled, then.', "You've given up already? Lightweight."],
  followDriveOn: ["You've stopped? Your loss. I'm off!", 'See ya! Not waiting for you.', "Right, I'm having the field to myself."],
  ackGiveRide: ['Hop on then. Hold on tight.', 'Ooh, yes. Get on.', "Taxi's here."],
  offerRide: ["Oh, for goodness' sake. Stay there, I'll drive you.", "You look like you need taking out. Hold on.", "Sat there like a sack of spuds. Come on, I'll drive.", "Right. Taxi. Don't touch anything."],
  waitingForYou: ['Are you getting on or what?', "Meter's running.", "Come on, I won't bite."],
  passengerOn: ['Hold on. I mean it.', "Right. Try not to scream.", 'Welcome aboard. No refunds.'],
  ackLetMeOff: ["Fine. Getting off already?", 'Stopping. Wimp.'],
  ackStopHere: ['Here? Fine.', 'Stopping!'],
  ackSlower: ['Spoilsport.', 'Fine, granny pace.', 'Okay, slowing down. Boring.'],
  ackFaster: ['Now you are talking!', 'Ha! Hold on!', "You asked for it!"],
  ackGoAgain: ['Round again!', 'Here we go!'],
  ackSwap: ["Fine. Don't crash it.", 'Your go. Try to keep up with me.'],
  ackStart: ["I'll show you how it's done.", 'Watch and learn.', 'Easy.'],
  startTap: ['Petrol on. See, I know stuff.', 'Tap on.'],
  startChoke: ['Bit of choke.', 'Choke on. Obviously.'],
  startCrank: ['Come on, you.', 'Start, you stupid thing.', 'Come on...'],
  startRemembered: ['Oh! Hang on.', 'Wait. I know.'],
  startCaught: ['Ha! Told you!', 'Easy peasy.', 'And that is how it is done.'],
  startGaveUp: ["It's broken. Not my fault.", 'Your turn. I warmed it up for you.'],
  startWarm: ["It's warm. You're welcome.", 'All yours. Do not stall it.'],
  selfDrive: ["My turn. Don't watch.", "Right, I'm having a go.", "Bagsy driving."],
  ackDrive: ['Yes! Finally!', 'Ooh, go on then!', 'Thought you would never ask.'],
  driveSetOffCareful: ['Okay. Not too fast. For once.', 'Right. Gently. Gently.'],
  driveSetOffConfident: ['Watch this!', 'Hold my tea!', "Right. Let's go!"],
  driveSetOff: ["Here we go!", 'And we are off.'],
  driveNervous: ['Okay, this is quicker than it looks.', 'Is that a ditch?', 'I meant to do that.'],
  driveHappy: ['Look at me go!', "I'm brilliant at this!", 'Woo!', "I'm a natural."],
  driveOverSteer: ['Woah! Meant that.', 'Wrong way! My bad!'],
  driveBump: ['Oof!', 'Whoops!', 'Ha!'],
  driveObstacle: ['Nope. Not going near that.', 'Not today, wall.'],
  stuckInBog: ["Oi! It's stuck! Come and get me out!", 'Totally not my fault. It is stuck.', "Help! The mud's eating it!"],
  stuckRiding: ['Nice one. We are stuck.', 'Brilliant driving. Really.', "You've buried it. Well done.", "Rock it! Back and forth! Honestly."],
  driveStalled: ['It died. Not my fault.', 'Who turned it off?'],
  drivePause: ['Hang on. Admiring the view.', 'Quick breather.'],
  driveTooFast: ['Woah! Okay! Fast!', 'Too fast, too fast! Ha!'],
  driveBored: ["Right, I've had my fun.", "That's me done. Nailed it."],
  driveScared: ['Okay. That was a bit much.', "Nope. I'm done. Not scared. Just done."],
  driveGaveUp: ['It hates me. Your go.', 'Stupid thing.'],
  driveToBack: ['I will go on the back. You can drive me now.', "Your turn. I'm going on the back."],
  driveGetOff: ["I'm getting off. Ten out of ten.", 'Right, off.'],
  ackBack: ['Fine. Back seat.', 'Spoilsport.'],
  ackStopDrive: ["Fine. I was winning, though.", 'Spoilsport.'],
  driveTaken: ['Oi! I was driving that!', 'Thief!'],
  tinkerOpen: ['Ooh, the mechanic is in.', "Do you even know what that is?"],
  tinker: ["Don't break it.", 'Is that bit meant to come off?', 'I could do that.'],
  tinkerLimiter: ['Ooh, naughty.', 'Make it go faster! Yes!', "I won't tell if you won't."],
  tinkerService: ['Look at you, all professional.', 'Proper mechanic.'],
  tinkerStock: ['Boring.', 'Spoilsport.'],
  tunedFast: ['Ha! It flies now!', 'What did you do to it? I love it.'],
  favouredWarm: [
    "I'm on form today. Ask me anything.",
    'Go on, pick me. Again.',
    "You're brilliant, you know. Don't tell Amy I said.",
    "Best day I've had in ages.",
    "I'll do whatever you like. Within reason. Ish.",
    'Told you I was your favourite.',
  ],
  neglectedSulk: [
    "Oh, I'm here, am I? Thought I'd gone invisible.",
    { sound: 'sigh' },
    "No, no, you carry on. Ignore me.",
    "I'm not sulking. This is my face.",
    'Brilliant. Just brilliant.',
    "Fine. I'll talk to the hens.",
  ],
  refuseRequest: [
    'Nope.',
    "Ask Amy. She's your favourite, apparently.",
    "Not feeling it. Not after being ignored all day.",
    'Make me.',
  ],
  gloatTakeOver: [
    'Ha! My go. Move over.',
    "Lucky me. Hop on, you.",
    'Aw, has she said no? Come here.',
    'Your loss, Amy. I mean, my win.',
  ],
  sulkOff: [
    "I'm taking this out! Don't follow me!",
    "Right! I'm off! See if you notice!",
    'Going for a drive! Alone!',
    'Bye!',
  ],
  prankGiggle: [
    "Wasn't me.",
    'Ha! Took you long enough.',
    "I'm not laughing. You're laughing.",
    "Don't look at me. Look at the quad.",
    'Oh, come on. That was brilliant.',
  ],
  prankConfess: [
    'Yeah, all right, it was me.',
    'Course it was me. Who else?',
    'Worth it. Totally worth it.',
  ],
  pouring: ["Don't spill it.", "You're getting it everywhere."],
  ...JESS_SKILL_LINES,
  ...JESS_REQUEST_LINES,
  ...JESS_PLACE_LINES,
  ...JESS_LOFT_LINES,
  ...JESS_BATTERY_LINES,
  ...JESS_KNACK_LINES,
  ...JESS_OIL_LINES,
  ...JESS_DIESEL_LINES,
  ...JESS_LPLATE_LINES,
  ...JESS_HEAT_LINES,
  ...JESS_SILENCER_LINES,
  ...JESS_FAULT_LINES,
  ...JESS_DIAGNOSIS_LINES,
  ...JESS_THRASH_LINES,
  ...JESS_REVOFF_LINES,
  ...JESS_HORN_LINES,
  ...JESS_TRACTOR_LINES,
  ...JESS_HAYRIDE_LINES,
  ...JESS_MUDGUARD_LINES,
  ...JESS_TRACTORGO_LINES,
  ...JESS_TRACTORRUNAWAY_LINES,
  ...JESS_QUAD_LINES,
  ...JESS_WARMING_LINES,
  // Starting your usual quad for you, or pointedly not (headStartLines.js).
  ...JESS_HEADSTART_LINES,
  // Caught talking about you (gossipLines.js).
  ...JESS_GOSSIP_LINES,
  ...JESS_THROTTLE_LINES,
  ...JESS_SMOKE_LINES,
  ...JESS_RACE_LINES,
  ...JESS_RECALL_LINES,
  ...JESS_READING_LINES,
  ...JESS_PASS_LINES,
  ...JESS_CONVOY_LINES,
  ...JESS_DOUGHNUT_LINES,
  ...JESS_JUMP_LINES,
  ...JESS_SHOWOFF_LINES,
  ...JESS_NICK_LINES,
  ...JESS_LINEUP_LINES,
  ...JESS_TEA_LINES,
  ...JESS_JUMPER_LINES,
  ...JESS_BENCH_LINES,
};
