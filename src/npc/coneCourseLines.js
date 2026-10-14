// The cone course (coneCourse.js): a girl setting off to weave round the cones, Jess meaning to knock them, what she says after (a clean round, an
// ordinary time, a record, a quad that dies), what the one timing you says, and Amy standing the cones up. Merged into the main line sets
// (voiceLines.js, jessLines.js). No times in a line: they are recorded ahead.

const line = (cooldown, lines) => ({ cooldown, lines });

export const CONE_LINE_KEYS = ['coneOff', 'coneKnock', 'coneDone', 'coneClean', 'coneRecord', 'coneOut', 'coneYou', 'coneYouRecord', 'coneTidy'];

export const AMY_CONE_LINES = {
  coneOff: line(30, ['Right. The cone course. Slowly through every gap, and not one touched.', 'Smooth is fast. That is what I always say.']),
  coneKnock: line(30, ['Jess, I know what you are doing and it will not work.']),
  coneDone: line(30, ['A cone or two went over. I will take the penalty.', 'It would have been quicker without the cones.']),
  coneClean: line(30, ['Not a single cone down. That is how it is done.', 'A clean round. Write that on the board, somebody.']),
  coneRecord: line(30, ['That is the best on the course! Do not tell Jess. Actually, do tell Jess.', 'A record, and I did not even hurry.']),
  coneOut: line(30, ['It has stalled in the middle of the course. Typical.', 'That does not count, does it? It was a stall.']),
  coneYou: line(30, ['Got your time. Have a look on the board in the barn.', 'Not bad. Count the cones, though.']),
  coneYouRecord: line(30, ['That is the best anyone has done! Well done you.', 'A new record. I shall write it up myself.']),
  coneTidy: line(30, ['I will put the cones back.', 'Cones. Up. Honestly, who knocks cones over?']),
};

export const JESS_CONE_LINES = {
  coneOff: ['Cone course! Watch me weave.', 'Amy has put her cones out. Time me!'],
  coneKnock: ['Cones! Out of my way! Bowling time!', 'Strike! I am going for every single one.'],
  coneDone: ['Easy. Beat that.', 'A few cones. They were in the way.'],
  coneClean: ['Not one cone down! I am a genius.', 'Clean round! Amy, did you see that?'],
  coneRecord: ['Record! Put my name on the board, in big letters!', 'Fastest ever! Go on, say it.'],
  coneOut: ['It cut out! Right in the middle of the cones! Rubbish!', 'Typical. Stalled on the slalom.'],
  coneYou: ['Hm. Not bad. For you.', 'You hit loads of them. I counted.'],
  coneYouRecord: ['Oh, you are kidding me. Right, now I have to beat that.', 'Fine. Fine! Enjoy it while it lasts.'],
  coneTidy: ['Do we have to put them back? Fine.', 'Up you get, cones.'],
};
