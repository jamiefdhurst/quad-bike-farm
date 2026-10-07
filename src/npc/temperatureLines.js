// What the girls say about the day's temperature (world/weather.js): weatherFrost, weatherCold and weatherWarm, a remark early on,
// and seatFrosty when you sit on a seat white with frost. Amy is practical about the engines; Jess complains, or enjoys it. Merged
// into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_TEMPERATURE_LINES = {
  weatherFrost: line(600, ['It is freezing. Use more choke today, and give the engines time to warm up.', 'Look at the frost. Nothing will start easily this morning.']),
  weatherCold: line(600, ['It is a cold one. The engines will want a little more choke.', 'Chilly today. Be patient with the starters.']),
  weatherWarm: line(600, ['What a lovely warm day. Mind the engines do not get too hot.', 'It is warm out. We will want less choke today.']),
  seatFrosty: line(60, ['Oh, the seat is frosted over. I should have wiped it for you.', 'That seat is frozen. Sorry, I did not think.']),
};

export const JESS_TEMPERATURE_LINES = {
  weatherFrost: ['It is so cold. This is your fault for getting me up this early.', 'My nose has gone numb. Is that normal?'],
  weatherCold: ['It is chilly. I am not riding anything until you have warmed it up.', 'Cold! Right, who is making the tea?'],
  weatherWarm: ['It is lovely out. Shorts weather. Race you.', 'Hot one today. Perfect for flat out.'],
  seatFrosty: ['Ha! Frozen bottom!', 'Ooh, cold seat. You will be fine in a minute.'],
};
