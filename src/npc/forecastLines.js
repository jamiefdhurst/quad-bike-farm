// What the girls say about the day turning (world/forecast.js): forecastWorse and forecastBetter after reading the board in the barn,
// turningWorse and turningBetter as the sky changes, and forecastMissed when it turns and the board never said. Merged into the main
// line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_FORECAST_LINES = {
  forecastWorse: line(900, ['The board in the barn says it is turning wet later. We should get the jobs done first.', 'I read the forecast. It is going to rain this afternoon, so do not leave anything out.', 'The forecast says it will turn grey later. Just so you know.']),
  forecastBetter: line(900, ['The board says it will brighten up later. I will wait for that.', 'The forecast says it clears after a bit. Good.']),
  turningWorse: line(600, ['The sky is changing. That is the rain the board said about.', 'It is clouding over. I did say.', 'Look at those clouds coming in.']),
  turningBetter: line(600, ['It is brightening up, like the board said.', 'Look, it is clearing. That is nicer.']),
  forecastMissed: line(600, ['That was not on the board. The forecast is hopeless.', 'Well, nobody said it would turn. I am writing to someone.']),
};

export const JESS_FORECAST_LINES = {
  forecastWorse: ['Amy says it rains later. Amy says lots of things.', 'Rain later, apparently. Better make the most of it.', 'Board says it is going to chuck it down. We will see.'],
  forecastBetter: ['Board says it clears up. Finally, something good.', 'It is going to brighten up later, Amy says. I will believe it when I see it.'],
  turningWorse: ['Oh, here come the clouds.', 'Told you it would go grey. Well, Amy did.', 'That sky has gone horrible.'],
  turningBetter: ['Ooh, the sun is coming out.', 'It is clearing up. Perfect timing.'],
  forecastMissed: ['So much for the forecast.', 'Nobody said that on the board. Typical.'],
};
