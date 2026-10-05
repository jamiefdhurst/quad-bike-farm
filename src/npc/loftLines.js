// What the girls say about the hayloft (world/loft.js). loftGo: heading up the ladder to sit out up there; loftSat: sat up
// there, now and then; loftCall: you're hiding in the hay and she is looking for you; loftFound: she's found you;
// loftDrop: straw tipped on you (Amy tells Jess off, Jess is delighted). Merged into the main line sets (voiceLines.js,
// jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_LOFT_LINES = {
  loftGo: line(60, ["I'm going up to the hayloft. It's lovely and quiet.", 'I think I will sit in the loft for a bit.', 'Up the ladder I go. Mind the gap.']),
  loftSat: line(90, ['You can see the whole yard from up here.', 'It smells of summer in the hay.', 'Come up if you like. Mind the edge.', { sound: 'hum' }]),
  loftCall: line(20, ['Where have you gone? Hello?', 'You are not very good at this, I can hear you breathing.', "Come on, I know you're up here somewhere.", 'Hello? Are you in the hay?']),
  loftFound: line(15, ['There you are! You have straw in your hair.', 'Found you. You are not as quiet as you think.', 'Got you. Come on out.']),
  loftDrop: line(15, ['Jess! Stop that, you will make a mess!', 'Oh, Jess, honestly. Are you all right?', "That's not funny. Well. A bit funny."]),
};

export const JESS_LOFT_LINES = {
  loftGo: ['Going up the ladder. You cannot follow.', "I'm going up the loft. Bet I can see everything.", "Up I go. Don't look up my ladder."],
  loftSat: ['King of the hayloft. That is me.', 'I can see your quad from here. Looks rubbish.', 'Come up here. If you dare.', { sound: 'yawn' }],
  loftCall: ['Come out, come out, wherever you are!', "I can see your feet. Okay I can't. But I'll find you.", 'Hiding in the hay, is it? Very grown up.', 'Are you in there? Is it itchy?'],
  loftFound: ['Found you! Ha! Straw head!', "Got you. You're rubbish at hiding.", 'There you are. Your bum was sticking out.'],
  loftDrop: ['Oops. Did that land on you?', 'Snow! In the barn! Ha ha!', "Sorry, it slipped. Totally an accident.", 'Ha! Right on your head!'],
};
