// What the girls say when they ask you along (askAlong.js): the ask for each thing she's chosen, how she takes a yes, and a no (Jess shrugs
// and goes anyway, Amy goes quiet and later does it alone). Merged into the main line sets (voiceLines.js, jessLines.js), so they're
// recorded with the rest. Nobody calls you anything but "you".

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_ASK_LINES = {
  askRest: line(30, ['Come and sit on the bales with me? It is nice in the sun.', 'I am going to sit on the bales. Come and keep me company.', 'Shall we sit down on the bales for a bit? You and me.']),
  askFlask: line(30, ['Come up to the top with the flask? The view is lovely.', 'I am going up for a cup of tea. Come with me?', 'Will you come and have a cuppa at the top of the hill?']),
  askFire: line(30, ['Come and sit by the fire with me? It is freezing.', 'Come and get warm by the fire. There is a log with your name on it.', 'Sit by the fire with me for a bit?']),
  askRace: line(30, ['Fancy a race? Just the two of us.', 'Would you like a race? I will go easy on you. Possibly.', 'Race me round the lap? Go on.']),
  askYes: line(20, ['Lovely. Come on, then.', 'Oh, good. Right, this way.', 'Wonderful. I was hoping you would.']),
  askSulk: line(20, ['Oh. Right. Fine. I will go on my own, then.', 'No, that is quite all right. I did not really want company.', 'I see. I shall just be here, then. Alone.']),
  askAnyway: line(20, ['Oh, well. I will go anyway.', 'Never mind. I shall go by myself.']),
  askLater: line(20, ['I am going anyway.', 'Right. I will go by myself, then.']),
};

export const JESS_ASK_LINES = {
  askRest: ['Oi, come and sit on the bales with me. Go on.', 'I am sitting on the bales. You are coming. Obviously.', 'Bales. You. Me. Now.'],
  askFlask: ['Come up the hill with me. I will bring the flask.', 'You coming up for a cuppa at the top, or what?', 'Tea at the top of the hill. You in?'],
  askFire: ['Come and sit by the fire. It is bloody cold.', 'Fire. Log. You. Come on.', 'Oi, come and get warm with me.'],
  askRace: ['Fancy a race? Go on, I will beat you.', 'Race me. Round the lap. Unless you are scared.', 'You and me, a race. Do not chicken out.'],
  askYes: ['Brilliant. Come on, then.', 'About time. Keep up.', 'Yes! Right, with me.'],
  askAnyway: ['Suit yourself. I am going anyway.', 'Your loss. I am going.', 'Fine, boring. I will go on my own.'],
  askSulk: ['Wow. Okay. Fine. Be like that.', 'Right. Forget I asked.', 'Not talking to you for a bit.'],
  askLater: ['Right, I am going.', 'Changed my mind? Too late.'],
};
