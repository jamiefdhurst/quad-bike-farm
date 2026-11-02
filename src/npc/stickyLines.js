// What the girls say about a sticky starter (vehicle/stickyStarter.js): startStuck (she's starting a vehicle whose starter only clicks
// and doesn't know the fix), startTapStarter (Jess, who has learnt it, rapping it free with relish) and learnedTap (Jess, the moment she
// has seen you do it enough times). Amy knows what is wrong but never taps it herself. Merged into the main line sets (voiceLines.js,
// jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_STICKY_LINES = {
  startStuck: line(60, ['It is clicking but not turning, and the dash is bright, so it is not the battery. The starter is stuck. It wants a tap with a spanner, and I am not doing that.', 'That is the starter sticking. The brushes are worn. A tap with the spanner frees it, but I will leave that to you.']),
};

export const JESS_STICKY_LINES = {
  startStuck: ['It is clicking! The battery is fine, the lights are on! Why will it not go?', 'It is just going click! Amy, why is it going click?'],
  startTapStarter: ['Right, you, behave. Tap, tap, tap!', 'Oh, I love this bit. Give it a good whack with the spanner!', 'Spanner time! Stand back, starter!', 'Come on then, you old thing. Bonk!'],
  learnedTap: ['Ooh, so you just give it a whack with the spanner? I can do that. I am definitely doing that every time.', 'Hang on, that is all it is? Tap it with the spanner? Brilliant. Next time, I am doing it.'],
};

/** Only Jess says these (Amy never taps it, and has no line for learning it). */
export const JESS_ONLY_STICKY_SITUATIONS = ['startTapStarter', 'learnedTap'];
