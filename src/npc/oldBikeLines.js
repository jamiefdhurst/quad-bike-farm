// What the girls say about starting the old bike (startingAttempt.js, the game's kick-back watch). It is started the old way: a tickle on the carb,
// the spark lever back, a kick. Amy does it carefully; Jess does it quickly and gets bitten.
//   startTickle    she tickles the carb (old bike, from cold)
//   startRetard    she puts the spark lever back before she kicks it
//   startKicked    it kicked back on her, and she works out why
//   oldKick        it has just kicked back on you (the nearest one, within 15 m)
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_OLD_BIKE_LINES = {
  startTickle: line(20, ['A little tickle on the carb first. Gently.', 'Tickler. Not too much, or it floods.', 'Tickle it twice, and no more.']),
  startRetard: line(20, ['Spark lever right back, so it does not kick.', 'Lever back first. That is the one that bites.', 'Retarded for starting, advanced for running. I read that.']),
  startKicked: line(20, ['Ow! It kicked! I forgot the lever.', 'Oh, my ankle. Lever first. Lever first.', 'Right. Lever back, then kick. Lesson learned.']),
  oldKick: line(20, ['Ow, that looked sore! The spark lever has to be right back for the kick.', 'Are you all right? That is what the lever is for. Back, then kick.', 'It kicked back? Put the lever back first, then try again. Gently.']),
};

export const JESS_OLD_BIKE_LINES = {
  startTickle: ['Tickle, tickle, tickle.', 'Tickler. A few presses. Maybe a lot of presses.', 'Tickle it. That is how it works, obviously.'],
  startRetard: ['Spark lever back. I know what I am doing.', 'Lever down, so it does not bite me.', 'Lever back. See? Knowledge.'],
  startKicked: ['Ow! Stupid bike! It bit me!', 'It kicked! The lever, the lever. Fine.', 'Ow ow ow. Right. Lever.'],
  oldKick: ['Ha! It bit you! Lever, muppet.', 'You kicked it with the lever forward. Amateur.', 'Ooh, that looked like it hurt. Do it again.'],
};
