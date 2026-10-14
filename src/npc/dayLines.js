// What the girls say over the card when you call it a day (farm/dayRecap.js): dayDone, one general sign-off each, nothing about what
// happened. Merged into the main line sets (voiceLines.js, jessLines.js).

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_DAY_LINES = {
  dayDone: line(60, [
    'That was a good day. Everything is written down.',
    'Right, that will do. Tea, and then bed.',
    'A decent day, all things considered.',
    'Well done, you. We shall do it all again tomorrow.',
    'The log is up to date. Goodnight.',
    'I am quite tired, but in a good way.',
  ]),
};

export const JESS_DAY_LINES = {
  dayDone: [
    'Today was a good day.',
    'More fun tomorrow!',
    'Same again tomorrow, yeah?',
    'I am so tired. Best day ever, though.',
    'Night, you. Do not stay up thinking about quads.',
    'Can we go faster tomorrow?',
  ],
};
