// What the girls say about faults that develop (vehicle/faults.js): faultPuncture (it pulls to
// one side), faultBelt (the revs flare and it doesn't go), faultCable (the throttle hangs
// open), faultCarb (it hunts and runs rough) and faultMounts (it shakes through and clonks), faultChain (a slack chain slapping) and faultChainOff (it has come off the sprocket). Amy works out what it is and notices sooner;
// Jess notices later and blames the quad. Merged into the main line sets (voiceLines.js,
// jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_FAULT_LINES = {
  faultPuncture: line(60, ["It's pulling to one side. I think there's a tyre going down.", 'Hold on, one of the tyres is soft. It needs pumping up.', 'The steering is dragging. That is a slow puncture.']),
  faultBelt: line(60, ['The revs are going up but it is not going anywhere. That is the drive belt.', 'It is slipping. I think the belt is worn.', 'Listen to that. The engine is racing and nothing is happening.']),
  faultCable: line(60, ["The throttle's sticking. It keeps going after you let go.", 'It does not come back down. The throttle cable needs oiling.', 'Watch it, it is running on. The cable is catching.']),
  faultMounts: line(60, ['The engine is shaking the whole thing. I think the mounts have gone.', 'Listen to that clonk when you touch the throttle. The engine mounts are worn.', 'It is rattling right through the seat. Those rubbers are perished.']),
  faultChain: line(60, ['That slapping is the chain. It has stretched, it wants adjusting.', 'Listen to the chain slapping the guard. It is much too slack.', 'The chain is loose. It will jump off if you are not careful.']),
  faultValves: line(60, ['Can you hear that ticking from the top of the engine? The valve clearances have gone wide.', 'That tick tick tick is the tappets. They want setting with a feeler gauge.', 'It is ticking like a clock. The valves need adjusting.']),
  faultChainOff: line(60, ['The chain has come off. The engine is turning and nothing is happening.', 'That is the chain off the sprocket. We will have to put it back.', 'It has stopped driving. The chain has jumped off.']),
  faultCarb: line(60, ['It will not idle properly. I think the carb is dirty.', 'It is hunting up and down. It needs the carb cleaning.', 'That is getting worse. Something is clogged.']),
};

export const JESS_FAULT_LINES = {
  faultPuncture: ['Why does it keep going left? Rubbish quad.', "It's pulling. It's fine, steer harder.", 'Is it me, or is it wonky?'],
  faultBelt: ['It is revving loads and going nowhere. Hilarious.', 'Faster! Why is it not faster?', "It's all noise, no go. Typical."],
  faultCable: ['It will not slow down! Wheee!', 'The throttle is stuck. Brilliant.', "It's got a mind of its own."],
  faultMounts: ['Wheee, it is a massage chair now.', "It's going clonk. It's fine, it's got character.", 'My teeth are rattling. Brilliant.'],
  faultChain: ['Is that the chain? It sounds like a drum kit.', "It's rattling. It's fine, it's meant to do that.", 'Clank clank clank. Very rock and roll.'],
  faultValves: ['It is ticking. I think it is counting down to something.', 'Tick tick tick. It is like riding a clock.', "It's got a tappety noise. It's fine, it's a sewing machine now."],
  faultChainOff: ["It's gone all noisy and nothing's happening. The chain's off, isn't it.", 'Brilliant. The chain has fallen off. Again.', 'Did the chain come off? I think the chain came off.'],
  faultCarb: ["It's coughing. It's just warming up.", 'Ugh, it keeps hunting. Come on, you rubbish thing.', "It's sulking again."],
};
