// What the girls say about the stream: streamUp (it has risen with the rain) and streamDown (it is back to its usual). Said by whoever is
// stood about near you (game.js, updateWeather). Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_STREAM_LINES = {
  streamUp: line(120, ['The stream is up. Take the ford slowly, or not at all.', 'Look at the stream. It has come up with all that rain.', 'The ford will be deeper now. Do not drown the quad.']),
  streamDown: line(120, ['The stream has gone back down. The ford is fine again.', 'It has dropped. You can cross without swimming.']),
};

export const JESS_STREAM_LINES = {
  streamUp: ["Ooh, the stream's up! Go through it, go on!", "It's all brown and fast down there. Brilliant.", "The ford's gone deep. You'll never make it. Prove me wrong."],
  streamDown: ["Aw, the stream's gone back down. Boring.", "It's shrunk. Where's the fun gone?"],
};
