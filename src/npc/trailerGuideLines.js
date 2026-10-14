// What Amy says guiding you back with a trailer on (trailerGuide.js): guideOffer (coming round behind it), the calls guideLeft (left hand
// down), guideRight, guideStraight and guideStop, guideCross and guideCrossHard (you turned the wrong way), guideDone (it's in),
// guideQuit (she's had enough) and guideWalked (you went off and left her). Merged into the main line sets (voiceLines.js), so they're
// recorded with the rest. Jess doesn't guide.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_TRAILER_GUIDE_LINES = {
  guideOffer: line(60, ['Hang on, let me watch the back for you.', 'You cannot see behind that. I will guide you.', 'Wait there. I will stand where you can see me.']),
  guideLeft: line(2, ['Left hand down!', 'Left hand down, a bit more.', 'Left, left, gently.', 'Turn it left. Left hand down.']),
  guideRight: line(2, ['Right hand down!', 'Right hand down, a bit more.', 'Right, right, gently.', 'Turn it right. Right hand down.']),
  guideStraight: line(2, ['Straight now. Keep coming.', 'That is it. Straight back.', 'Lovely. Hold it there.', 'Perfect, straight, keep coming.']),
  guideStop: line(2, ['Stop! Stop stop stop!', 'Stop there! It is folding up!', 'Whoa! Stop, you will jam it!']),
  guideCross: line(4, ['The other way! Your other left!', 'No, the other way! You are making it worse!', 'That is the wrong way. Turn it back.']),
  guideCrossHard: line(4, ['I said the OTHER way! I am standing right here!', 'Are you even looking at me? Other way!', 'Honestly! Left means left! Right means right!']),
  guideDone: line(20, ['There. That is in. You see, easy.', 'Lovely. Now you can say I helped.', 'Right, that will do. Well backed.']),
  guideQuit: line(20, ['I give up. I am not shouting any more.', 'Do it yourself, then. I have lost my voice.', 'That is it. You can manage without me.']),
  guideWalked: line(20, ['Oh, off you go, then. Do not mind me.', 'I was in the middle of helping!']),
};
