// What Amy says when her walk-round (walkRound.js) finds something. Amy only: Jess goes straight to the starter. Merged into the
// main line set (voiceLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_WALK_LINES = {
  walkPuncture: line(20, ['This tyre is going down. There is a slow puncture in it.', 'Hold on, that tyre is soft. I think it has a thorn in it.', 'There is a slow puncture here. I found it before it found me.']),
  walkSoftTyre: line(20, ['One of the tyres is a bit soft. It wants pumping up.', 'The pressures are off on this one. I can feel it.', 'That tyre is squashy. Someone has let it down.']),
  walkBelt: line(20, ['The belt looks glazed on this one. It will slip.', 'I can smell the belt from here. It is not right.']),
  walkCable: line(20, ['The throttle is sticking when I flick it. The cable needs looking at.', 'That throttle does not spring back properly.']),
  walkCarb: line(20, ['There is a smell of petrol round the carb. It is going to run badly.', 'The carb looks dirty. It will not idle properly.']),
  // Said instead of the finding above when she won't ride it (wontRide.js).
  wontPuncture: line(20, ["Not on that. It's got a slow puncture.", "I'm not riding this until that tyre is fixed."]),
  wontSoftTyre: line(20, ["Not on that, it's got a soft tyre.", "That tyre wants pumping up first. I'm not riding it like that."]),
  wontBelt: line(20, ["Not on that. The belt is slipping and I'm not getting stuck halfway.", "I'm not riding it with that belt."]),
  wontCable: line(20, ["Not on that. The throttle sticks and I'm not having that.", "Not until someone has done that cable."]),
  wontCarb: line(20, ["Not on that. It will cut out on me with that carb.", "It's running on a dirty carb. I'll wait until it's done."]),
};
