// The hill climb (hillClimb.js): a girl setting off up the hill against the clock, what she says at the top (an ordinary time, a record, a quad that
// dies on the bank), and what the one who is timing says to you when you finish. Merged into the main line sets (voiceLines.js, jessLines.js).

const line = (cooldown, lines) => ({ cooldown, lines });

export const CLIMB_LINE_KEYS = ['climbOff', 'climbDone', 'climbRecord', 'climbOut', 'climbYou', 'climbYouRecord'];

export const AMY_CLIMB_LINES = {
  climbOff: line(30, ['I am going to time myself up the hill. Properly, this time.', 'Right. Ford to the top, the sensible way round the banks.']),
  climbDone: line(30, ['That was tidy. I think that is a decent time.', 'Up without a wheelspin. I am pleased with that.']),
  climbRecord: line(30, ['That is the best so far! Write it on the board, somebody.', 'A record! Do not tell Jess. Actually, do tell Jess.']),
  climbOut: line(30, ['It has died on the bank. That does not count, does it?', 'Oh no. Not halfway up.']),
  climbYou: line(30, ['Got your time. Have a look on the board in the barn.', 'Not bad at all. It is on the board.']),
  climbYouRecord: line(30, ['That is the fastest anyone has been up! Well done you.', 'A new record. I shall write it up myself.']),
};

export const JESS_CLIMB_LINES = {
  climbOff: ['Hill climb! Watch me. Nobody beats me up there.', 'Banks, here I come. Time me!'],
  climbDone: ['Easy. Beat that.', 'Not my best. The grass was slippy.'],
  climbRecord: ['Record! Put my name on the board, in big letters!', 'Fastest ever! Go on, say it.'],
  climbOut: ['It cut out! Right on the steep bit! Rubbish!', 'Typical. Stalled on the bank. Again.'],
  climbYou: ['Hm. Not bad. For you.', 'I could have done that quicker.'],
  climbYouRecord: ['Oh, you are kidding me. Right, now I have to beat that.', 'Fine. Fine! Enjoy it while it lasts.'],
};
