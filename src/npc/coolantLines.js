// What the girls say about the orange's leaking radiator (engine/coolant.js): coolantDamp (a green patch under it
// while it's parked), coolantSteam (steam coming off the radiator as it runs) and coolantBoil (it's just boiled
// over, and she's jumped back). Amy works out what it is; Jess is scared first and delighted afterwards. Merged
// into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_COOLANT_LINES = {
  coolantDamp: line(90, ["There's a green puddle under the orange. That's coolant. It's leaking.", 'Look, it has dripped coolant all over the floor. It needs topping up at the bench.', 'The orange is weeping coolant. I would not ride it until it is fixed.']),
  coolantSteam: line(60, ['The orange is steaming! Switch it off before it boils!', "That's steam coming off the radiator. It's nearly out of coolant.", 'Stop! It is running dry, it will boil over.']),
  coolantBoil: line(20, ['It has boiled over! Get back!', 'Mind the steam! Everybody back!', 'The radiator has gone! Stay away from it!']),
};

export const JESS_COOLANT_LINES = {
  coolantDamp: ['Ew, what is that? It has made a puddle.', "The orange's wet underneath. Did it wee?", 'Is the orange leaking? It is a bit green.'],
  coolantSteam: ['It is smoking! Is it on fire? Is it on fire?', 'There is steam coming out of the front. It looks so cool.', 'Amy, it is making clouds!'],
  coolantBoil: ['Whoa! It exploded!', 'Aaah! It is going to get me!', 'That was so loud! It nearly got my face!'],
};
