// What the girls say about what they're good at, and as you coach them. Amy's are
// here and Jess's own versions beside them; both are merged into the main line
// sets (voiceLines.js, jessLines.js), so they're recorded with the rest.
//
// Per skill: skill_<skill>_novice (she's just got it wrong), _learning (she got
// it right, getting the hang of it) and _learned (she's got it down), and
// taught_<skill> (you've just coached her at the right moment).

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_SKILL_LINES = {
  skill_choke_novice: line(60, ["Oh, the choke. I always forget the choke.", 'Was I meant to leave the choke on? I never know.', 'Choke. Right. Sorry.']),
  skill_choke_learning: line(60, ['Choke off now?', 'It should be warm enough. Choke off.', 'I think that can come off now.']),
  skill_choke_learned: line(60, ["Choke's off. I've got that one now.", 'Warm, so choke off. Easy.', 'I never forget the choke these days.']),
  skill_starting_novice: line(60, ["I'm rubbish at starting these.", "It's stalled again. I never know how long to hold it.", 'I always flood it. Do I always flood it?']),
  skill_starting_learning: line(60, ['Short bursts, short bursts.', "That's better. Little goes on the starter.", "I think I'm getting the hang of starting it."]),
  skill_starting_learned: line(60, ["Starting these is no bother now.", 'First go. I am getting good at this.', 'Tap, choke, crank. Done.']),
  skill_cornering_novice: line(60, ["I'm terrible at corners. Hold on.", 'I always go in too fast and then panic.', "Sorry, sorry. I'm no good at the bends."]),
  skill_cornering_learning: line(60, ['Slow in, then power out. Is that it?', "That was a better corner, wasn't it?", "I'm taking these a bit smoother now."]),
  skill_cornering_learned: line(60, ['Smooth round that one.', 'Look at that. Not a wobble.', "I'm quite good at corners now, actually."]),
  skill_mud_novice: line(60, ["I hate mud. I never know what to do in it.", 'Oh no. I always stop in the wet bits.', "It's going to sink. It always sinks when I do this."]),
  skill_mud_learning: line(60, ["Keep it going, don't stop. Keep it going.", "I'm not stopping in the mud this time.", 'A bit of throttle through the wet bit. There.']),
  skill_mud_learned: line(60, ['Mud? Bring it on.', "That's how you do mud.", "Right through it, and we're out. Easy."]),
  taught_choke: line(20, ['Oh, so that is when it comes off. Thanks.', 'Right, once it is warm. Got it.', 'Choke off when it warms up. I will remember.']),
  taught_starting: line(20, ['Short bursts. Okay, thanks.', 'Ah, I was holding it too long, was I?', "Little goes. I'll try that."]),
  taught_cornering: line(20, ['Slow before the corner, not in it. Okay.', 'Ease off first. That makes sense.', 'Thanks. That felt better.']),
  taught_mud: line(20, ["Keep going, don't stop. Thanks.", 'So you do not lift off in the mud. Right.', "Don't stop in the wet. Got it."]),
  coachWrongTime: line(20, ["What's that about? Nothing's wrong.", "Er, I'm doing that already, aren't I?", 'Not sure what you mean there.']),
  coachNagged: line(20, ["Yes, you've said. I heard you.", "I know! You've just told me!", "Stop going on about it. I'm trying."]),
};

export const JESS_SKILL_LINES = {
  skill_choke_novice: ["Choke. Yeah. Forgot it. Don't say anything.", 'Whoops. Choke thing. Whatever.', 'I always get the choke wrong. It is a stupid lever.'],
  skill_choke_learning: ['Choke off, I reckon.', 'Warm now. Choke off. See, I listen.', 'Off with the choke. Look at me.'],
  skill_choke_learned: ['Choke off. Obviously.', "Never forget the choke now. You're welcome.", "Warm, choke off. Child's play."],
  skill_starting_novice: ["It won't start for me. It never does.", 'Stalled. Again. Not my fault.', 'I flood it. Every time. Bored of it.'],
  skill_starting_learning: ['Little goes on the starter. Yep.', 'Better. See? I can do it.', 'Getting the hang of this starting thing.'],
  skill_starting_learned: ['First time. As if there was any doubt.', 'Starting it is easy now. Try keeping up.', 'Tap, choke, crank. Boom.'],
  skill_cornering_novice: ['Whoa! Corners! Hold on!', 'I always take these too fast. It is more fun.', 'Oops. Too quick. Fine, fine.'],
  skill_cornering_learning: ['Slow in, fast out. Told you I knew.', 'That was a decent one. Admit it.', 'Smoother. A bit. Maybe.'],
  skill_cornering_learned: ['Lean into it. Perfect.', 'I am so good at corners now.', 'Did you see that corner? Did you?'],
  skill_mud_novice: ['Mud. Great. Here we sink.', 'I do not know what to do in mud. Gun it?', 'Uh oh. It is going soft under us.'],
  skill_mud_learning: ["Don't stop. Don't stop. Don't stop.", 'Right through the wet. Is it working?', 'Keep the revs up. I learnt that.'],
  skill_mud_learned: ['Mud is my thing. Watch this.', 'Through the soggy bit like it is nothing.', 'Mud queen. Say it.'],
  taught_choke: ['Choke off when it is warm. Fine. Noted.', 'Oh, so warm means off. Obviously.', 'Right. Choke off. I knew that.'],
  taught_starting: ['Short bursts. Fine. Bossy.', 'Not holding it so long. Okay.', 'Little goes. Got it.'],
  taught_cornering: ['Slow first. Okay, that worked.', 'Ease off before, not during. Fine.', 'Hm. That was smoother. Thanks.'],
  taught_mud: ["Don't stop in the mud. Easy for you to say.", 'Keep the throttle on. Right.', 'Not lifting off. Okay, that helped.'],
  coachWrongTime: ["Nothing's wrong. Why are you telling me that?", 'I know what I am doing. Sort of.', 'Er. Okay?'],
  coachNagged: ["You've said that. Twice.", 'I heard you the first time!', 'Do you want to drive instead?'],
};
