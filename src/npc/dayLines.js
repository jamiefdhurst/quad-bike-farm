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
  briefingOpen: line(60, ['Right, good morning. Here is the day.', 'Morning. Let me tell you how the day looks.', 'Before you go anywhere, listen. Here is the day.']),
  briefingAllWell: line(60, ['Every quad seems to be behaving, which makes a change.', 'I cannot find anything wrong with any of the quads today.', 'The quads all look sound this morning.']),
  briefingYesterdayFallenOut: line(60, [
    'Jess and I are still not speaking after yesterday, in case you wondered.',
    'I am afraid Jess and I left things badly yesterday. Do not expect us to be friends before breakfast.',
  ]),
  briefingYesterdayKey: line(60, [
    'Somebody left a key on in one of the quads last night, so there is a flat battery waiting.',
    'One of the quads was left with its key on overnight. Do check the battery before you set off.',
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
  showAheadOfYou: line(300, [
    'I placed above you. Do not take it personally. Wash the quad.',
    'I came out ahead of you, I am afraid. It is the tidy that does it.',
    'A higher mark than yours. I shall be gracious about it.',
  ]),
  showBehindYou: line(300, [
    'You beat me. I shall be asking to see the judge\'s notes.',
    'You placed above me. Well done. I did say mine needed a service.',
    'You are ahead of me, and I am being very mature about it.',
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
  briefingOpen: ['Right, morning! Here is the day.', 'Morning! Listen, this is the day.', 'Ooh, the day, hang on.'],
  briefingYesterdayFallenOut: ['Yeah, well, I am not talking to her either.', 'She started it. Just so you know.', 'Do not look at me. She knows what she did.'],
  briefingAllWell: ['Nothing wrong with any of the quads. Amazing.', 'Every quad is fine today. Do not jinx it.', 'The quads are all behaving.'],
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
  showAheadOfYou: [
    'I beat you! Mud and everything! Well, less mud than yours.',
    'I came higher than you! I am never washing this quad again, it clearly works.',
    'Ha! I was ahead of you in the show!',
  ],
  showBehindYou: [
    'You beat me! Fine. Next month, though.',
    'You got a better mark than me. I want a rematch.',
    'I came below you. It was the mud. It is always the mud.',
  ],
};
