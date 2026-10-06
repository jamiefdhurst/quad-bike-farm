// Doughnuts (doughnuts.js): Jess deciding to, the yelps while she does it, and Amy disapproving and then joining in.
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_DOUGHNUT_LINES = {
  selfDoughnuts: line(60, ['I am just going to do one little circle.']),
  doughnutSpin: line(30, ['Whoa, whoa, whoa!', 'Hold on, hold on, hold on!', 'Oh, that is a bit much!']),
  doughnutWatch: line(20, ['Jess, stop it! You are ruining the field.', 'That is going to take weeks to grow back.', 'Honestly. Look at the state of that grass.', 'Jess, the farmer is going to see that.']),
  doughnutJoin: line(60, ['Oh, give it here. I am doing one too.', 'Right. That looks like fun. Move over.', 'Fine. Just one. Do not tell anyone.']),
};

export const JESS_DOUGHNUT_LINES = {
  selfDoughnuts: ['Watch this!', 'Doughnut time!', 'Do not tell Amy. Actually, tell Amy.'],
  doughnutSpin: ['Wheeeee!', 'Look at me go!', 'Yeah! Mud everywhere!'],
  doughnutWatch: ['Go on, Amy! Faster!', 'Is that Amy? Amy is doing doughnuts?!'],
  doughnutJoin: ['Oh, move over, it is my turn.'],
};
