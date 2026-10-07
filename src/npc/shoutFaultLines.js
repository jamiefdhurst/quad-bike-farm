// Shouting a fault (shoutFault.js): what a girl calls when she sees something wrong with your quad from behind or alongside. All
// shouted. Situations are shout + Smoke, Steam, Tyre, Wobble and Hanging. Amy says plainly what it is; Jess makes a joke of it.
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, shout: true, lines });

export const AMY_SHOUT_LINES = {
  shoutSmoke: line(30, ['You are smoking! Something is burning!', 'Smoke! There is smoke coming out of the back of you!', 'You are leaving a trail of smoke, pull over!']),
  shoutSteam: line(30, ['Steam! It is boiling, stop!', 'There is steam pouring off your radiator, stop the engine!', 'It is overheating, I can see the steam from here!']),
  shoutTyre: line(30, ['Your tyre is going down! It looks soft!', 'The back looks low, I think you have a puncture!', 'One of your tyres is sagging, have a look!']),
  shoutWobble: line(30, ['Your wheel is wobbling all over the place! Stop!', 'That tyre is flat, it is flapping about! Stop!', 'It is wobbling badly, you will come off!']),
  shoutHanging: line(30, ['Something is hanging off the back of you!', 'Your exhaust is coming apart, stop!', 'There is something coming loose under you, stop and look!']),
};

export const JESS_SHOUT_LINES = {
  shoutSmoke: ['You are on fire! Probably!', 'Smoke signals! What are you saying?', 'Oi, you are smoking like a chimney!'],
  shoutSteam: ['You are a kettle! You are boiling!', 'Steam! Lovely, it is a sauna!', 'Your quad is having a tantrum, it is steaming!'],
  shoutTyre: ['Your tyre is a bit squishy!', 'Oi, the tyre looks sad!', 'Is that tyre meant to look like that?'],
  shoutWobble: ['Your wheel is doing a dance!', 'Wobble wobble! You are going to come off!', 'That wheel is about to leave without you!'],
  shoutHanging: ['Something is falling off! Ha, no, wait, stop!', 'Your bits are coming off!', 'You are losing parts! Keep going, I will pick them up!'],
};
