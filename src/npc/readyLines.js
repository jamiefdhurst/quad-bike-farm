// What the girls say when you tell them you'll be a minute (readyWaiting.js): readyGo (she gets the quad going), readyToot (the first toot
// of the horn), readyImpatient (a later one), readyGiveUp (she has had enough) and readyHere (you have come back). Merged into the main
// line sets (voiceLines.js, jessLines.js), so they're recorded with the rest. The girls call you "you", never he, she or they.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_READY_LINES = {
  readyGo: line(60, ['All right, I will get it warmed up. Do not be long.', 'I will start it and wait on the back. Take your time, but not too much.', 'A minute. I will be counting.']),
  readyToot: line(30, ['Just a little toot, in case you had forgotten.', 'That is a minute, you know.']),
  readyImpatient: line(30, ['It is burning fuel, you know.', 'Honestly. How long does it take?']),
  readyGiveUp: line(60, ['That is far too long. I am turning it off.', 'I give up. I am getting off.']),
  readyHere: line(60, ['There you are. It is all warmed up.', 'Finally. Hop on.']),
};

export const JESS_READY_LINES = {
  readyGo: ['Yep, I will warm it up. Do not take forever.', 'A minute? I will rev it till you are back.', 'Fine. I will sit on the back and make a racket.'],
  readyToot: ['Beep beep! That is a minute!', 'Oi! Hurry up!'],
  readyImpatient: ['Come on! I am getting bored here!', 'I am going to honk until you come.'],
  readyGiveUp: ['Right, I am off. Forget it.', 'Too slow. I am getting off.'],
  readyHere: ['About time! Get on.', 'There you are! I nearly set off without you.'],
};
