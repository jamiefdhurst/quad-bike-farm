// What the girls say about a quad going onto the bale trailer (game.js updateTrailerLoad).
//   loadAboard   it has been winched or pushed all the way up
//   loadStrap    you strapped it down
//   loadSlid     it was not strapped and it slid about or went off the back
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_LOAD_LINES = {
  loadAboard: line(20, ['Well done. It is on, and nothing is bent.', 'Right, that is up. Now strap it down properly.', 'Good. Slowly does it, every time.']),
  loadStrap: line(20, ['That is how it is done. Now it will not go anywhere.', 'Ratchet it tight. Good. Now we can drive.', 'Strapped down, and the world is a safer place.']),
  loadSlid: line(20, ['I said to strap it! Honestly, did you not hear me?', 'That is exactly why we have straps.', 'It has gone everywhere. Strap it next time, please.']),
};

export const JESS_LOAD_LINES = {
  loadAboard: ['Ha! It went up the ramp like it was easy!', 'Look at that, it is on! Proper farmer, you.', 'Is that it? I thought it would take ages.'],
  loadStrap: ['Click, click, click. Is that tight enough? It is tight enough.', 'Strapped! Now you can go as fast as you like.', 'Orange straps. Very smart. Very fashionable.'],
  loadSlid: ['Whoa, it moved! It moved on its own!', 'You forgot the straps! Ha ha, brilliant!', 'There it goes! Off the back, off it goes!'],
};
