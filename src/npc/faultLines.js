// What the girls say about faults that develop (vehicle/faults.js): faultPuncture (it pulls to
// one side), faultBelt (the revs flare and it doesn't go), faultCable (the throttle hangs
// open) and faultCarb (it hunts and runs rough). Amy works out what it is and notices sooner;
// Jess notices later and blames the quad. Merged into the main line sets (voiceLines.js,
// jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_FAULT_LINES = {
  faultPuncture: line(60, ["It's pulling to one side. I think there's a tyre going down.", 'Hold on, one of the tyres is soft. It needs pumping up.', 'The steering is dragging. That is a slow puncture.']),
  faultBelt: line(60, ['The revs are going up but it is not going anywhere. That is the drive belt.', 'It is slipping. I think the belt is worn.', 'Listen to that. The engine is racing and nothing is happening.']),
  faultCable: line(60, ["The throttle's sticking. It keeps going after you let go.", 'It does not come back down. The throttle cable needs oiling.', 'Watch it, it is running on. The cable is catching.']),
  faultCarb: line(60, ['It will not idle properly. I think the carb is dirty.', 'It is hunting up and down. It needs the carb cleaning.', 'That is getting worse. Something is clogged.']),
};

export const JESS_FAULT_LINES = {
  faultPuncture: ['Why does it keep going left? Rubbish quad.', "It's pulling. It's fine, steer harder.", 'Is it me, or is it wonky?'],
  faultBelt: ['It is revving loads and going nowhere. Hilarious.', 'Faster! Why is it not faster?', "It's all noise, no go. Typical."],
  faultCable: ['It will not slow down! Wheee!', 'The throttle is stuck. Brilliant.', "It's got a mind of its own."],
  faultCarb: ["It's coughing. It's just warming up.", 'Ugh, it keeps hunting. Come on, you rubbish thing.', "It's sulking again."],
};
