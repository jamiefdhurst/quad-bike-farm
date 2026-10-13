// The girls in a thunderstorm (weather kind 'storm', world/thunder.js). weatherStorm: the remark early in a stormy game. thunderClose and
// thunderFar: said after a clap, Amy jumpy, Jess delighted. stormWont: Amy won't get on or drive anything until it passes (the wheel's
// answer too); stormGetOff: she says so as she climbs off a quad stood still. Jess would go out in it, so she has no refusals. Merged into
// the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_STORM_LINES = {
  weatherStorm: line(600, ["That is a proper storm coming. We should be indoors.", "It's going to thunder. I don't like the look of that sky at all."]),
  thunderClose: line(25, ['That was close!', 'Oh! That was right on top of us.', 'I felt that one in my chest.', 'That is far too close for my liking.']),
  thunderFar: line(40, ['There is more of it coming.', 'That was over the hills. It is moving this way.', 'Listen to that rumble.']),
  stormWont: line(20, ["I'm not riding in this. You'll get us struck by lightning.", "Absolutely not. Nobody is going out in a thunderstorm.", "No. We wait until it has passed. In the barn."]),
  stormGetOff: line(60, ["I'm not sitting on a metal quad in a thunderstorm. I'm getting off.", "No. Off. I'm going to the barn until this has passed."]),
};

export const JESS_STORM_LINES = {
  weatherStorm: ["Thunder! Can we go out in it? Please?", "Ooh, a proper storm. This is brilliant.", "I love a storm. Come on, quad, quick."],
  thunderClose: ['Woooah! Did you see that? Again!', 'That one went right through me! Brilliant!', 'Ha! That was massive!'],
  thunderFar: ['Ooh, that was a good rumble.', 'More! Bring it on!', 'Count the seconds. That was miles off.'],
};
