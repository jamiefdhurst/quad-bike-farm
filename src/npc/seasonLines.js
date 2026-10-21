// What the girls say about the time of year (world/seasons.js): one remark a game, a while after the weather has been mentioned
// (companionVoice.watchWeather). Merged into the main line sets (voiceLines.js, jessLines.js), so they are recorded with the rest.
// The girls call the player only "you".

const line = (cooldown, lines) => ({ cooldown, lines });

export const SEASON_SITUATIONS = { spring: 'seasonSpring', summer: 'seasonSummer', autumn: 'seasonAutumn', winter: 'seasonWinter' };

export const AMY_SEASON_LINES = {
  seasonSpring: line(600, ['It is properly spring now. Everything is coming up, and everything is wet.', 'The ground is still soft this time of year. Mind the gateways.']),
  seasonSummer: line(600, ['It is the best time of year, this. The evenings go on for ever.', 'Everything is dry as a bone. The dust gets everywhere in summer.']),
  seasonAutumn: line(600, ['The nights are drawing in already. We will be putting the lights on by teatime.', 'It is that time of year when it is damp all day and never quite dries.']),
  seasonWinter: line(600, ['It is the middle of winter. We will have about six hours of light, so make the most of it.', 'Everything is mud this time of year. Keep to the track if you can.']),
};

export const JESS_SEASON_LINES = {
  seasonSpring: ['Spring! Lambs, mud, the lot. I love it.', 'It is all going green. Look at the hedges.'],
  seasonSummer: ['It is lovely out. Can we stay out until it gets dark?', 'Summer! Nobody is going to make me wear a coat today.'],
  seasonAutumn: ['It is getting nippy. I like it, though. Proper jumper weather.', 'The leaves are going. Autumn is my favourite.'],
  seasonWinter: ['It is freezing! Why is it always so dark?', 'Winter again. I want to go in and have a hot chocolate.'],
};
