// What the girls say about the UTV (utvRide.js, utvBed.js, the game's wheel). Amy follows the rules; Jess does not.
//   utvBoard        climbing in
//   utvMiddleWin    won the row over the middle of the bench
//   utvMiddleLose   lost it, and answers
//   utvBedGo        climbing into the back, which is not allowed
//   utvBedTell      the other one, who has seen her in there
//   utvBedShout     in the bed, with it going fast
//   utvTipOut       slid off the tailgate when the bed went up
//   utvTipLaugh     the other one, who watched it
//   utvBedRefuse    asked to ride in the bed (Amy only)
//   utvPetrolWarn   you are pouring petrol into it
//   utvPetrol       it is running badly and there is petrol in the diesel
//   landyKick       the Land Rover's starting handle has just kicked back on you (the nearest one, within 15 m)
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_UTV_LINES = {
  utvBoard: line(40, ['Room for one more? Right, I am in.', 'Go on then, I will come with you.', 'Lovely. Proper seats for once.']),
  utvMiddleWin: line(20, ['I am sitting in the middle. I sat there first.', 'Middle seat for me. It is the warmest.', 'You do not mind if I sit by you, do you? Good.']),
  utvMiddleLose: line(20, ['Fine. I will have the window. It has a better view anyway.', 'Jess always does this. I am not arguing about it again.', 'All right, all right. Window it is.']),
  utvBedGo: line(30, ['I am going in the back. Just this once.', 'Only for a minute. Do not tell anyone.', 'Move up. No, I am fine in the bed.']),
  utvBedTell: line(40, ['Get out of the back! You are not allowed in there, you know that.', 'That bed is for tools and bales, not for people. Honestly.', 'You will fall off the back and then I will have to explain it. Get in a seat.']),
  utvBedShout: line(30, ['I should not be in here! This is awful!', 'Slow down! My teeth are rattling!', 'It is very bumpy back here! Mind the bumps!']),
  utvTipOut: line(30, ['You tipped the bed with me on it! I am sitting in the dirt!', 'I could have been hurt! Ow!', 'You see? You see? That is why it is not allowed.']),
  utvTipLaugh: line(30, ['Oh dear. Are you all right? I did tell you.', 'That was entirely preventable.', 'I will not laugh. I will not laugh. Sorry.']),
  utvBedRefuse: line(30, ['No. That is not a seat, it is a bed. I am riding properly.', 'I will not ride in the back. It is against the rules.', 'Not a chance. Ask Jess.']),
  utvPetrolWarn: line(40, ['Stop! That is petrol. The UTV is a diesel!', 'No, no, no. Red diesel only for that one.', 'That is the wrong can. Petrol will ruin it.']),
  utvPetrol: line(60, ['It is running terribly. Did someone put petrol in the diesel?', 'That does not sound right. It is a diesel, it does not like petrol.', 'It is coughing. Check what went in the tank.']),
  landyKick: line(20, ['Ouch! Are you all right? Keep your thumb out of the way.', 'It kicked back? Thumb on the same side as your fingers. Let me see your hand.', 'That is how people break their thumbs. Hold it properly.']),
};

export const JESS_UTV_LINES = {
  utvBoard: ['Shotgun! Well, bench. Whatever.', 'Budge up, I am coming in.', 'Ooh, we are going out in style.'],
  utvMiddleWin: ['I called the middle! Ha! In your face!', 'Middle seat, mine, thanks. You can wave from the window.', 'Winner. Do not complain, it is only a seat.'],
  utvMiddleLose: ['That is so unfair, Amy. I was there first. I am not talking to you.', 'Fine. Have the middle. See if I care.', 'You are such a cheat, Amy. I will have the window, I suppose.'],
  utvBedGo: ['I am riding in the back! It is allowed, I have decided.', 'Bed for me! Go on, drive! Faster!', 'Do not ride in the bed, it says. Watch me.'],
  utvBedTell: ['Ooh, you are in the bed. You are breaking the rules. I like it.', 'Look at you. Naughty! Is there room for me?', 'I am telling. No, I am not. Move over.'],
  utvBedShout: ['Whoa! Whoa! This is brilliant! Faster!', 'Ow, my bum! Go on, hit another bump!', 'I can see everything from back here! Ha!'],
  utvTipOut: ['Aargh! You absolute muppet! I am covered in mud!', 'You dumped me! You actually dumped me out of the back!', 'Oi! I was sitting there! My bum is soaked!'],
  utvTipLaugh: ['Ha ha ha! Did you see her go? Brilliant!', 'She flew! She actually flew! Do it again!', 'I am going to be laughing about that all day.'],
  utvPetrolWarn: ['Oi! That is petrol! It runs on the red stuff!', 'Wrong can, genius. It is a diesel.', 'You are putting petrol in the diesel. I am not even surprised.'],
  utvPetrol: ['It sounds like it is dying. What did you put in it?', 'It is spluttering and I do not think it is meant to.', 'Is it supposed to do that? It cannot be good.'],
  landyKick: ['Ha! It bit you! Thumb out of the way, muppet.', 'Ooh, that looked like it hurt. Do it again.', 'You are holding it wrong. Even I know that.'],
};
