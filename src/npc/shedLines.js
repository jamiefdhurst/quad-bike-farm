// What the girls say about the barn's shed kit (farm/shed.js, vehicle/shedFaults.js): shedBought (you have paid for a piece), shedArrived (one turned up
// this morning), and a line for each of the twelve faults only the kit puts right. Amy works out what it is and what it needs; Jess blames the quad or
// makes a joke of it. Nothing names a piece or a vehicle (the lines are recorded). They never call you he, she or they.
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const SHED_SITUATIONS = ['shedBought', 'shedArrived'];

export const AMY_SHED_LINES = {
  shedBought: line(30, ['That is a proper bit of kit. It will earn its keep.', 'Good. We have been making do for long enough.', 'It will be here in the morning. Clear a space for it.']),
  shedArrived: line(60, ['Oh, the new kit has turned up. That is smart.', 'It came in the night. Right, what shall we mend first?', 'Look at that, in the barn already. I like it.']),
  faultTyreLeak: line(60, ['One of the tyres keeps going soft. I think the bead is leaking.', 'It was fine when we set off, and now it is down again. A slow leak.']),
  faultTyreCold: line(60, ['All four tyres are down. It is the cold, it shrinks the air in them.', 'The tyres look soft this morning. They want pumping up at the compressor.']),
  faultTyreUneven: line(60, ['One tyre is much lower than the others. They want evening up.', 'It is leaning to one side. One of the tyres is a long way down.']),
  faultValveCore: line(60, ['I think one of the valve cores has gone. It will not hold its air.', 'That tyre is flat again after standing. The valve core is not sealing.']),
  faultCarbGum: line(60, ['It is running as if the carb is full of varnish. A proper clean in the washer, I think.', 'The jets are gummed up. The usual clean will not shift that.']),
  faultTapClog: line(60, ['It splutters when you open it up. I think the fuel tap is clogged.', 'It runs out of fuel at full throttle. The tap gauze must be blocked.']),
  faultChainGrit: line(60, ['That chain is full of grit. It is wearing itself out.', 'Listen to that chain grinding. It wants washing and oiling.']),
  faultBrakeMud: line(60, ['The brakes are barely biting. They are caked in mud.', 'It will not stop properly. The pads are clogged up.']),
  faultExhaustHole: line(60, ['That is loud, and it has lost power. The silencer has rusted through.', 'There is a hole in the exhaust. Listen to it blow.']),
  faultGasket: line(60, ['There is oil dripping from the sump. The gasket is weeping.', 'It is losing oil from underneath. We need to get under it.']),
  faultCaliper: line(60, ['One of the brakes is dragging. The wheel is hot.', 'It feels like it is pulling the handbrake on. A caliper must be sticking.']),
  faultBearing: line(60, ['Can you hear that hum from one of the wheels? That is a bearing going.', 'One wheel is grumbling and wobbling. The bearing is worn.']),
};

export const JESS_SHED_LINES = {
  shedBought: ['Yes! Proper kit! I want to press the buttons.', 'Ha, we are a real garage now.', 'Spend, spend, spend. I love it.'],
  shedArrived: ['It is here! Can I have a go on it?', 'Ooh, it is enormous. Brilliant.', 'It turned up in the night. Like Father Christmas, but for spanners.'],
  faultTyreLeak: ['It keeps going squishy. Is that normal?', 'Tyre is sulking again. It does that.'],
  faultTyreCold: ['The tyres are all squashy. It is just cold, it is fine.', 'It feels like riding on marshmallows.'],
  faultTyreUneven: ['It is lopsided. I like it, it is got character.', 'Why is it tilting? Wheee!'],
  faultValveCore: ['It went down overnight. Mysterious.', 'It has got a slow puncture. Or a fast one. Hard to tell.'],
  faultCarbGum: ['It is coughing like Gran. Brilliant.', 'It smells of old jam.'],
  faultTapClog: ['It is cutting out when I go fast. Typical.', 'It goes, then it does not go. Make up your mind!'],
  faultChainGrit: ['The chain sounds like a pepper grinder.', 'Crunch, crunch, crunch. It is eating the lane.'],
  faultBrakeMud: ['The brakes are not working. It is fine, I will just not stop.', 'Stopping is overrated.'],
  faultExhaustHole: ['It is so loud! I love it!', 'It sounds like a motorbike. A rubbish one.'],
  faultGasket: ['It is dripping. It is not crying, is it?', 'There is oil all over the floor. Not mine.'],
  faultCaliper: ['It is pulling backwards like a donkey.', 'Why is it so slow? Is it dragging a brick?'],
  faultBearing: ['The wheel is humming. I think it likes me.', 'Wubwubwub. It is playing me a song.'],
};
