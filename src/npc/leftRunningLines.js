// What the girls say on finding a quad idling with nobody on it (leftRunning.js): leftRunningYou, leftRunningYouAgain,
// leftRunningAmy and leftRunningJess, named for who left it (the speaker's own name is her owning up). Amy minds the
// petrol; Jess is unbothered. Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_LEFT_LINES = {
  leftRunningYou: line(60, ['Who left this running? It was you, wasn\'t it.', 'This has been idling for ages. You left it on.', 'You left the engine going. It is burning petrol for nothing.']),
  leftRunningYouAgain: line(60, ['You have left it running again. That is the third one now.', 'Again? You really do walk off and leave them going.']),
  leftRunningJess: line(60, ['Jess! You left this running. It has been sat here for ages.', 'This is Jess\'s. Look, the engine is still on.']),
  leftRunningAmy: line(60, ['Oh no, I left this one running. I am so sorry.', 'That was me. I started it and forgot it.']),
};

export const JESS_LEFT_LINES = {
  leftRunningYou: ['Who left this running? Oh. It was you.', 'Ha, you left it on. I saw you.'],
  leftRunningYouAgain: ['You always do this. Always.', 'That is you again. I am keeping count.'],
  leftRunningAmy: ['Amy left it on. Amy! Miss Careful!', 'Look at this, Amy left it running. I am telling everyone.'],
  leftRunningJess: ['Alright, that was me. It is nice and warm for later.', 'Oh, that is mine. It is warming up. On purpose.'],
};
