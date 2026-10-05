// What the girls say while you work at the barn bench (workshop/bench.js): benchStart (you begin a job),
// benchStep (a step done), benchFlaw (a slip), benchDone (a job done right) and benchBotched (done, but
// not well). Amy helps and corrects; Jess heckles. Merged into the main line sets (voiceLines.js,
// jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_BENCH_LINES = {
  benchStart: line(40, ["Right, let's have a proper look at it. I'll hold the torch.", 'Good idea. Spanners are in the red box.', 'Take your time. It is better done slowly.']),
  benchStep: line(25, ["Go steady with that one.", 'That is it. Nearly there.', 'Keep it level, or you will spill something.', 'The spanner with the red handle is the right one.']),
  benchFlaw: line(20, ['That did not feel right. It wants to be snug, not tight.', 'Oh, you let go too soon. That will not hold.', 'Careful. You will strip the thread.', 'Hmm. I think that needs doing again.']),
  benchDone: line(40, ['That is much better. Well done.', 'Spotless. You can start it now.', 'That is a proper job. I am impressed.']),
  benchBotched: line(40, ['It will do, but I would not trust it.', 'I think you will be back at that bench soon.', 'It is not quite right, is it? Never mind.']),
};

export const JESS_BENCH_LINES = {
  benchStart: ['Ooh, are we doing engines? Can I hit something?', 'Go on then, show us what you can do.'],
  benchStep: ['Is that how it goes? Looks wrong.', 'Faster, I am getting old here.', 'Give it a good thump.'],
  benchFlaw: ['Ha! You have broken it.', "That's not meant to go like that.", 'Oops.'],
  benchDone: ['Look at you, a proper grease monkey.', 'Can I start it? Please?'],
  benchBotched: ["I'm not getting on that.", "Bit of tape and it'll be fine."],
};
