// What the girls say about getting into the Tor or Crag or the UTV out of the rain or the cold (cabShelter.js): going, settling in, and getting
// out again. Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_CAB_LINES = {
  cabRainGo: line(60, ['I am not standing in this. I am getting in the cab.', 'Rain. The Moorland, I think, rather than the barn.', 'Right, in the dry for me.']),
  cabColdGo: line(60, ['It is perishing. I am going to start the Moorland and sit in it.', 'Nobody will mind if I warm that engine up. For the farm, you understand.']),
  cabIn: line(120, ['Ah, that is better.', 'Lovely and dry in here.', 'It smells of old dog and diesel, and I do not mind a bit.']),
  cabOut: line(90, ['Well, that is that. Back to work.', 'Right, it has stopped. Out I get.']),
};

export const JESS_CAB_LINES = {
  cabRainGo: ['Rain! Cab! Shotgun!', 'Nope. Not getting wet. In the Moorland.', 'I am going to go and sit somewhere with a roof.'],
  cabColdGo: ['Right, I am starting the Moorland and sitting in it all day.', 'Warm engine, big seat, no wind. Back in a bit.'],
  cabIn: ['Ahh. I could live in here.', 'Do not tell me to get out. It is raining on everything else.', 'Pass me a biscuit. Wait, you have not got one. Rubbish.'],
  cabOut: ['Fine, fine, I am getting out.', 'Back out into the world, then.'],
};
