// What the girls say about the flask at the top of the hill (flask.js): flaskOffer (suggesting it), flaskYes (you asked), flaskPour,
// flaskView, flaskCold and flaskSun (the weather), flaskRomance (only said by the girl you are closest to), flaskDone and flaskLeft (you walked
// off). Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest. The girls call you "you".

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_FLASK_LINES = {
  flaskOffer: line(60, ['I brought a flask. Shall we sit up at the top for a minute?', 'There is a rock at the top with a view. I have tea. Come on.', 'Would you like a cup of tea? I have a flask, and the rock up there is quite comfortable.']),
  flaskYes: line(60, ['Oh, lovely. Let me find the flask.', 'Yes, of course. I always bring a flask. Sit down.', 'Good idea. Come and sit on the rock.']),
  flaskPour: line(60, ['There. Two mugs. Careful, it is hot.', 'Milk, no sugar. I did not ask. You are having it anyway.', 'Right. Tea, with a view. That is how it should be done.']),
  flaskView: line(60, ['Look at it all. You can see the whole farm from here.', 'You can see the barn, the yard and every field. It looks so small.', 'It is a lovely farm from up here. Very tidy.']),
  flaskCold: line(60, ['My hands are freezing. This mug is the best thing that has happened today.', 'It is bitter up here, but the tea is hot. That is enough.']),
  flaskSun: line(60, ['It is warm up here in the sun. I could stay all afternoon.', 'Sun, tea, a view. I do not need anything else.']),
  flaskRomance: line(60, ['I am glad you came up with me.', 'It is nice, just sitting here with you.', 'I would not have done this with anyone else, you know.']),
  flaskDone: line(60, ['That was lovely. Thank you for sitting with me.', 'Right. Finished. Back to work, then.', 'Well, that is the flask empty. Shall we go?']),
  flaskLeft: line(60, ['Oh. You are going. Fine. I will pour yours back in the flask.', 'Where are you off to? The tea is going cold!', 'You have walked off in the middle of my tea.']),
};

export const JESS_FLASK_LINES = {
  flaskOffer: ["Amy's tea is rubbish but it is better than nothing. Sit on the rock with me?", 'Come and have a cuppa at the top. Great view and nobody can tell us off.', 'I have got a flask. Do not tell Amy I used her good mugs.'],
  flaskYes: ['Go on then. Rock, now.', 'Yes! Tea break. Sit.', 'Oh, brilliant. I will pour.'],
  flaskPour: ['There. Do not spill it, it is scalding.', 'Tea. Proper stewed tea. The best sort.', 'Here you go. It is a bit strong. It is always a bit strong.'],
  flaskView: ['Look, you can see the barn from here. It is tiny!', 'I can see all the way home. Looks like a toy farm.', 'We rode all the way up here. Properly impressive, that.'],
  flaskCold: ['Brr. Hold the mug with both hands. It is the only warm thing for miles.', 'It is freezing up here. Worth it, though.'],
  flaskSun: ['Oh, this is nice. Sun on my face, tea in my hand.', 'Sunny, a view and a hot drink. Do not tell anyone, but I love this.'],
  flaskRomance: ['Do not tell Amy, but this is my favourite bit of the day.', 'You are all right, you know. Sit a bit closer. It is cold.', 'I could stay up here with you all day.'],
  flaskDone: ['Right, that is the flask empty. Thanks for the company.', 'Good tea. Good rock. Good view. Shall we go?', 'Ahh. Done. Back down we go, then.'],
  flaskLeft: ['Oi! Where are you going? Your tea!', 'You walked off in the middle of it. Rude.', 'Fine. I will drink yours as well.'],
};
