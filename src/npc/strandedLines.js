// What the girls say when they are stuck out in the field and calling you (stranded.js): where they are (one line for each named spot, bogged
// or tipped: spotNames.js), shouting again, thanks when you come (quickly or after a wait), having been left, and giving up. Merged into the
// main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

import { SPOTS } from './spotNames.js';

const shout = (lines, cooldown = 0) => ({ shout: true, cooldown, lines });
const line = (cooldown, lines) => ({ cooldown, lines });

const spotLines = (bog, tip) => {
  const out = {};
  for (const s of SPOTS) {
    out[`callout_bog_${s.id}`] = shout([bog(s.name)]);
    out[`callout_tip_${s.id}`] = shout([tip(s.name)]);
  }
  return out;
};

export const AMY_STRANDED_LINES = {
  ...spotLines((at) => `I am stuck ${at}! Can you help me?`, (at) => `I have tipped it over ${at}! Please come!`),
  calloutAgain: shout(['Hello? Is anyone there?', 'Over here! I am still stuck!', 'Please! I really cannot move it.']),
  calloutThanksQuick: line(10, ['Oh, thank goodness. That was quick.', 'You came! Thank you.', 'Thank you. I knew you would come.']),
  calloutThanksSlow: line(10, ['There you are. I was getting worried.', 'Finally. I thought you had forgotten me.', 'Thank you. It did take a while.']),
  calloutLeft: shout(['I have been here ages!', 'Hello? Has everyone gone home?', 'I do not think anyone is coming.'], 20),
  calloutGiveUp: line(10, ['Fine. I will sort it out myself.', 'Nobody is coming. I am getting down.', 'Well, that is lovely. I will wait over here.']),
};

export const JESS_STRANDED_LINES = {
  ...spotLines((at) => `Oi! I'm stuck ${at}! Come and get me out!`, (at) => `I've flipped it ${at}! Quick, come on!`),
  calloutAgain: shout(['Oi! Over here!', 'Hello? Still stuck!', 'Are you even looking?']),
  calloutThanksQuick: line(10, ['Ha! Legend! Quick as you like.', 'You came! Brilliant.', 'About time! No, that was fast, well done.']),
  calloutThanksSlow: line(10, ['Where have you been? I nearly started walking.', 'Took your time, didn\'t you?', 'Finally! I\'ve been up here for ages.']),
  calloutLeft: shout(['I\'m going to be here till Christmas!', 'Hello?! Rescue?!', 'This is a joke. Nobody\'s coming.'], 20),
  calloutGiveUp: line(10, ['Right, forget it. I\'m getting down.', 'Brilliant. Abandoned in a bog.', 'Fine. I\'ll push it myself. Thanks for nothing.']),
};
