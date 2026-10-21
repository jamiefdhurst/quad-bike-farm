// What the girls say over the card when you call it a day (farm/dayRecap.js): dayDone, one general sign-off each, nothing about what
// happened; and the show (farm/showDay.js): the evening before, the day itself and the slow race. Merged into the main line sets (voiceLines.js, jessLines.js).

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
  showEve: line(600, [
    'The show is tomorrow. Whatever you enter, I suggest you wash it.',
    'Tomorrow is the show. Clean, tidy and running sweet, that is what they judge.',
    'Do not forget the show tomorrow. Mud is not a look the judges favour.',
  ]),
  showToday: line(600, [
    'It is the show today. The quad you last rode is the one they will look at.',
    'Show day. Give your quad a wash before the evening.',
    'The show tonight, then. Ride the one you want judged last.',
  ]),
  showSlowWon: line(300, [
    'I won the slow race. Patience, you see.',
    'First in the slow race. Jess had her foot down before the first bend.',
    'Slowest wins, and I was slowest. I am rather pleased.',
  ]),
  showSlowLost: line(300, [
    'I put a foot down. It was one foot, and only for a second.',
    'Jess won the slow race. I let her. Quite deliberately.',
    'I did not lose. The race was simply too slow for me to concentrate.',
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
  showEve: [
    'Show tomorrow! Wash your quad, it is bare mud at the moment.',
    'It is the show tomorrow, and I am winning the slow race, I can feel it.',
    'Tomorrow is the show! Will you be entering?',
  ],
  showToday: [
    'Show day! Is yours clean? You can enter whichever one you last rode.',
    'Today is the show. Get the hose out, go on.',
    'Show day, show day! The slow race is going to be mine.',
  ],
  showSlowWon: [
    'I won the slow race! Honestly, I was going so slow I nearly fell over.',
    'Slowest wins! I was the slowest! Best thing I have ever done.',
    'First in the slow race. Amy is looking very annoyed.',
  ],
  showSlowLost: [
    'I put my foot down. I could not help it, it was so slow.',
    'Amy won the slow race. She was going so slow I thought she had stopped.',
    'I am rubbish at slow. Fast, though. Fast I can do.',
  ],
};
