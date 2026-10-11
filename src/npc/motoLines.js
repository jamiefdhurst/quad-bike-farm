// The girls and the mini moto (motoGo.js). Amy won't touch it (motoWont). Jess says she's off for a go (motoStart the first time, motoBrave
// after), squeals when it wobbles (motoWobble), and has her say when she is off (motoCameOff). Amy says her piece when Jess comes off
// (motoFellOther). Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_MOTO_LINES = {
  motoWont: line(20, ["No. I'm not getting on that. It's got two wheels and no sense.", "Absolutely not. It's a toy and it will have me in a hedge.", "I'm not riding that. You can have a go, if you like."]),
  // Only said if she is let have a go (amyRefuses in the tuning panel): she is careful about it.
  motoStart: line(30, ["Right. Slowly. It's very small.", "I'll be careful on this."]),
  motoBrave: line(30, ["I know what it does now. Let's try again.", 'Better. One more go.']),
  motoWobble: line(25, ['It is wobbling. Steady.', 'Oh, that is twitchy.']),
  motoCameOff: line(30, ['Ow. I did say.', 'Well. That is the grass, then. I am fine.']),
  motoFellOther: line(15, ['Are you all right? I did say it would do that.', "Jess! Don't move. Are you hurt?", "That's what happens on two wheels. Are you in one piece?"]),
};

export const JESS_MOTO_LINES = {
  motoStart: ['Right. Just a little go. Hold the thing for me.', "It's tiny. How hard can it be?", 'Okay, okay, I can do this. Nobody look.'],
  motoBrave: ["I'm not scared of it now. Go on, watch me.", 'Right, again. I know what it does now.', "I've got the hang of it. Probably."],
  motoWobble: ['Whoa! It is wobbling! It is wobbling!', 'Aaah! Why is it doing that?', 'Steady, steady, steady!'],
  motoCameOff: ['Ow. Ha. Ow. I am fine!', "It threw me! It actually threw me!", "Oof. The grass is soft, at least. I'm fine."],
};
