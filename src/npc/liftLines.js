// Where she wants to go, said once she is on the back of your quad for a lift to a far place (farWalk.js, MindsHost.watchLift): one key
// per far place (FAR_PLACE_OF_KIND in mindsHost.js). Merged in last of all (voiceLines.js, jessLines.js), so no recorded bank before them moves.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_LIFT_LINES = {
  liftTo_hut: line(0, ['Can you take me up to the shepherd\'s hut? I want to sit by the stove.', 'Up to the hut, please. Just stop near the steps and I will hop off.']),
  liftTo_flask: line(0, ['Could you run me up to the flask rock? I would love a cup of tea with the view.', 'Up the hill to the flask, please. Stop when we are near the rock.']),
  liftTo_fire: line(0, ['Could you drop me at the bonfire, please? I am getting cold.', 'Over to the fire, please. Just stop near it and I will get off.']),
  liftTo_barn: line(0, ['Can you take me back to the barn, please?', 'Drop me at the yard, would you? I need a few things from the barn.']),
};

export const JESS_LIFT_LINES = {
  liftTo_hut: line(0, ['Run us up to the hut, go on. I want a sit by the stove.', 'Take me up the shepherd\'s hut, yeah? Drop me by the door.']),
  liftTo_flask: line(0, ['Up to the flask rock! I\'m gasping for a cuppa.', 'Take me up to the rock with the flask, go on. Stop near it.']),
  liftTo_fire: line(0, ['Drop me at the bonfire, yeah? I\'m freezing.', 'Over to the fire, go on! Just stop near it.']),
  liftTo_barn: line(0, ['Take me back to the barn, will you?', 'Drop me at the yard, yeah? Got stuff to do in the barn.']),
};
