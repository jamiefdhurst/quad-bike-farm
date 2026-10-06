// What the girls say about red diesel (diesel.js, dieselMistake.js): dieselWarn (it's being poured into a quad), dieselRough
// (a quad running badly on it), dieselDied (it stalled on it), dieselNoStart (cranking and cranking), dieselCaught (Amy sees
// Jess pouring it), dieselPour (Jess as she does it) and dieselCaughtReply (Jess's answer). Amy reads the cause; Jess blames
// you. Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_DIESEL_LINES = {
  dieselWarn: line(40, ["That's the red diesel! It's for the tractor, not the quads.", 'Stop! That is diesel. It will ruin the engine.', 'Wrong can. That one is red diesel.']),
  dieselRough: line(45, ['That is running terribly. I think it has diesel in it.', 'It is smoking grey and coughing. That is diesel, that is.', 'Listen to it. Somebody has put the red stuff in.']),
  dieselDied: line(30, ['It has died on the diesel. It will need draining at the toolbox.', "That's it, it's gone. Diesel does that. Drain the tank and the carb.", 'It has choked on the diesel. Nothing will start it now.']),
  dieselNoStart: line(40, ["It won't fire. It's full of diesel, it'll never start like that.", 'Stop cranking it. It needs draining, not more cranking.', 'It is soaked in diesel. Take it to the toolbox.']),
  dieselCaught: line(60, ['Jess! That is the diesel can!', 'Jess, no! That is red diesel, put it down!', 'Jess, that goes in the tractor, not a quad!']),
};

export const JESS_DIESEL_LINES = {
  dieselWarn: ["It's all just fuel, isn't it?", 'Is that the wrong can? Oops.', 'You have got the wrong one, you muppet.'],
  dieselRough: ["Why's it smoking grey? You did something to it.", 'What have you put in this? It is rubbish now.', 'It was fine until you got your hands on it.'],
  dieselDied: ['Well, that is you done. What did you put in it?', 'It has died. Not my fault. Probably yours.', 'You have killed it. Well done.'],
  dieselNoStart: ["It's never going to start. What did you do to it?", 'It is dead. Properly dead. Because of you.', 'Stop cranking it, you will flatten the battery.'],
  dieselPour: ['Topping this one up for everyone. Do not look at me like that.', 'It is all just fuel, it will be fine.', 'Right, nearly empty. A drop of this will sort it.'],
  dieselCaughtReply: ["It's fuel! Fuel is fuel!", 'The can was just there, all right?', 'It looked like fuel. It smelt like fuel.'],
};

/** Lines only Jess has: Amy never pours diesel in a quad, so she has no answer to being caught. */
export const JESS_ONLY_DIESEL_SITUATIONS = ['dieselPour', 'dieselCaughtReply'];
