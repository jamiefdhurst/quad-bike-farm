// Rev-offs (revOff.js). Jess answers every blip and gloats as it gets louder; Amy answers now and then and
// apologises. When it's gone too far, Amy tells the pair of you off, or Jess's quad gives up on her. Merged into
// the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_REVOFF_LINES = {
  rockPrank: line(60, ['Hold on tight!', 'Just a little blip.']),
  rockPrankAmy: line(60, ['Jess! Do not do that, it makes it jump.', 'Jess, stop it! I nearly fell off.']),
  revAnswer: line(20, ['Oh, go on then.', 'Fine. Just the once.']),
  revAnswerMore: line(20, ['I am not doing that again. Sorry.', 'Right, that is it. I am being silly now.']),
  revComplain: line(30, ['Will you two stop it! You will break something.', 'That is enough, both of you. My ears are ringing.', 'Stop revving! They will hear us in the next county.']),
  revStall: line(30, ['Oh no. I have killed it.', 'Sorry, sorry. It has stalled.']),
};

export const JESS_REVOFF_LINES = {
  rockPrank: ['Hold on tight!', 'Did you feel that? It rocks!', 'Just a little blip. Hold the rails.'],
  revAnswer: ['Is that all you have got?', 'Ha! Listen to that.', 'Go on, then. Beat that.', 'Oh, you want a go? Right.'],
  revAnswerMore: ['Louder! Come on, louder!', 'You will have to do better than that!', 'Hear that? That is the sound of winning.', 'More, more, give it more!'],
  revStall: ['Oops. Killed it.', 'Okay, that one was too much. It has died on me.', 'Well. I won, and it is dead.'],
};
