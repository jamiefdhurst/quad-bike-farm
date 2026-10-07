// What the girls say about how a quad is being treated (wearLedger.js): thrashCold (somebody's caning it
// before it's warm), thrashRunIn (caning a rebuilt engine that isn't run in yet, runningIn.js), and blameYou, blameAmy and blameJess (who's worn this one out). Amy tells people off;
// Jess thinks cold thrashing is the best bit and owns up to the rest cheerfully. Merged into the main line
// sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_THRASH_LINES = {
  thrashCold: line(30, ['Jess! It is still cold. Be gentle with it!', 'Jess, stop thrashing it. It has not even warmed up.', 'Not while it is cold, Jess. You will wear it out.']),
  thrashColdYou: line(30, ['Go easy, it is still cold.', 'Let it warm up first. You are being hard on it.', 'It is cold, you know. Not so much throttle.']),
  thrashRunIn: line(30, ['Jess! It has only just been rebuilt. Give it a chance to run in.', 'Jess, it is brand new inside. Ten minutes of gentle, please.', 'Not yet, Jess. It is not run in. You will ruin it.']),
  thrashRunInYou: line(30, ['It has only just been rebuilt. Take it gently for a bit.', 'It needs running in first. Not so much throttle.', 'Ten minutes of being gentle and it will last for years. Please.']),
  blameYou: line(60, ['You have been hard on this one. It is tired.', 'That engine is worn from you, not the rest of us.']),
  blameJess: line(60, ['Jess has been caning this one. Listen to it.', "That's Jess's doing. She never lets it warm up."]),
  blameAmy: line(60, ['I have used that one a lot. I am sorry, I should have rested it.', "That's mostly me, I think. Sorry."]),
};

export const JESS_THRASH_LINES = {
  thrashColdYou: ['Go on, give it some! It likes it.', 'Ooh, wring its neck. Go on.'],
  thrashRunInYou: ['Fresh engine, eh? Go on, find out what it can do.', 'Running in is for people with patience. Go on, give it some.'],
  blameYou: ["That's you, that is. You've been flogging it.", 'You wore that one out, not me.'],
  blameJess: ['Alright, that one is probably me. Worth it.', "Okay, I've caned it a bit. It loved it."],
  blameAmy: ["Amy's worn that one out. Amy! Who knew?", 'That is Amy, that is. All that careful riding and it is knackered anyway.'],
};
