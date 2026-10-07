// What the girls say when a lean, cold engine spits back through the carb (engine/spitBack.js): spitBackOn (it went off
// under the one sat on it, and she's jumped) and spitBackNear (she heard it from nearby). Amy says what it is and what
// fixes it; Jess is startled first and delighted afterwards. Merged into the main line sets (voiceLines.js, jessLines.js),
// so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_SPIT_LINES = {
  spitBackOn: line(25, ['Ow! It spat back at me! It is too cold for that, give it some choke.', 'That was the carb, it is running lean. Let it warm up first.', 'Something just went off under the seat! It needs choke until it has warmed up.']),
  spitBackNear: line(30, ['That was the carb spitting back. It is too lean and too cold for it.', 'Did you hear that? It popped back through the airbox. Choke, please.', "That's not the exhaust, that's the intake. It needs more choke."]),
};

export const JESS_SPIT_LINES = {
  spitBackOn: ['Aah! It coughed at me!', 'Something went bang under my bum!', 'Whoa! It just burped smoke at me!'],
  spitBackNear: ['Ha! It coughed up a cloud!', 'It burped! It actually burped!', 'Ha! Did you see the smoke come out from under the seat?'],
};
