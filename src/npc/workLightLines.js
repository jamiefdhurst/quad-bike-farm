// What the girls say about lights to work by (workLight.js): workLightOffer (Amy, unasked, seeing you at something in the dark),
// workLightAsked and workLightCant (you asked), workLightThere (it's in place) and workLightDone (you're finished with it). Merged
// into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_WORK_LIGHT_LINES = {
  workLightOffer: line(60, ['You cannot see what you are doing. I will bring something round.', 'Hang on, I will get you some light.', 'Wait there. I will put some headlights on that for you.']),
  workLightAsked: line(10, ['Of course. Give me a minute.', 'Right, I will bring something round.', 'Good idea. Stay where you are.']),
  workLightCant: line(10, ['There is nothing here with lights I can bring.', 'I cannot, sorry. Nothing will do it.']),
  workLightThere: line(30, ['There. Can you see now?', 'Is that better? Say if you want it moved.', 'That should do. I will wait.']),
  workLightDone: line(30, ['All done? I will put it away.', 'Right, lights off then.', 'Good. I was getting cold.']),
};

export const JESS_WORK_LIGHT_LINES = {
  workLightOffer: ['You are going to lose a finger in the dark. I will bring the lights.'],
  workLightAsked: ['Fine. But I get to choose the music.', 'On it. Do not move.', 'Lights, coming up.'],
  workLightCant: ['With what? There is nothing here with lights.', 'Can I hold my phone up instead?'],
  workLightThere: ['Ta da. Light.', 'There you go. Hurry up, it is freezing.', 'Better? You owe me.'],
  workLightDone: ['Finally. I am going in.', 'Right, done. Lights off.', 'Did you even fix it?'],
};
