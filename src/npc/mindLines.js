// What the girls say about what they're set on doing (intent.js): interrupted (you called her over, or rang the bell, on her way to
// something she'd chosen), resumed (getting back to it later) and teaGo (off to put the kettle on). Merged into the main line sets
// (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_MIND_LINES = {
  interrupted: line(30, ['Oh. I was just going to do that. Never mind.', 'Right. That can wait, then.', 'I was halfway there. Go on, then.']),
  resumed: line(60, ['Right. Where was I?', 'Now, what was I doing? Oh, yes.', 'Back to it, then.']),
  teaGo: line(90, ['I am going to put the kettle on.', 'Time for a cup of tea, I think.', 'I need a brew.']),
};

export const JESS_MIND_LINES = {
  interrupted: ['I was busy, you know.', 'Oi. I was doing something.', 'Fine. I will do it after.'],
  resumed: ['Right, as I was saying, before you stopped me.', 'Now I can get on.', 'Where was I? Oh, yeah.'],
  teaGo: ['Brew time.', 'I am making tea. Not for you.', 'Kettle is going on.'],
};
