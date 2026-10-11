// What the girls say about what they're set on doing (intent.js): interrupted (you called her over, or rang the bell, on her way to
// something she'd chosen), resumed (getting back to it later), teaGo (off to put the kettle on), pairGo (going over to stand with her
// friend) and tagGo (tagging along after her, pair.js). Merged into the main line sets
// (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_MIND_LINES = {
  interrupted: line(30, ['Oh. I was just going to do that. Never mind.', 'Right. That can wait, then.', 'I was halfway there. Go on, then.']),
  resumed: line(60, ['Right. Where was I?', 'Now, what was I doing? Oh, yes.', 'Back to it, then.']),
  teaGo: line(90, ['I am going to put the kettle on.', 'Time for a cup of tea, I think.', 'I need a brew.']),
  pairGo: line(90, ['Jess, what are you up to?', 'Budge up, Jess.', 'Mind if I stand with you?']),
  tagGo: line(60, ['Wait for me, Jess.', 'Where are you off to? I will come too.', 'Hang on, I am coming with you.']),
};

export const JESS_MIND_LINES = {
  interrupted: ['I was busy, you know.', 'Oi. I was doing something.', 'Fine. I will do it after.'],
  resumed: ['Right, as I was saying, before you stopped me.', 'Now I can get on.', 'Where was I? Oh, yeah.'],
  teaGo: ['Brew time.', 'I am making tea. Not for you.', 'Kettle is going on.'],
  pairGo: ['Amy! Talk to me, I am bored.', 'Oi, Amy. What are we doing?', 'Amy, stay there. I am coming over.'],
  tagGo: ['Wait up!', 'Where are you going? I am coming.', 'Do not leave me on my own.'],
};
