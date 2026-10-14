// What the girls say about sitting out and sheltering. restGo: heading off to sit
// somewhere on a fine day; restSat: sat there, now and then; restRain: making a
// run for the barn; restShelter: stood in the doorway, now and then; restLeave:
// getting up because you've asked her something. Merged into the main line sets
// (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_PLACE_LINES = {
  restGo: line(60, ["I'm going to sit in the sun for a bit.", 'Lovely day. I think I will sit on the bales.', "I'll be on the fence if you want me."]),
  restSat: line(90, ['Oh, this is nice.', 'Warm on my face. Lovely.', 'You could sit with me, you know.', 'I could stay here all afternoon.', { sound: 'hum' }]),
  restRain: line(60, ['Rain! Barn! Quick!', "That's got heavier. I'm off to the barn.", 'Oh no, I am not standing in that.', 'Right, shelter.']),
  restShelter: line(90, ['At least it is dry in here.', 'Listen to it on the roof.', "It'll blow over. Won't it?", 'I do like the smell of the barn in the rain.']),
  restLeave: line(30, ['Hang on, hang on.', 'Just a second. Coming down.', 'Oh. Right. Let me get up.']),
  // Dozing in the sun (dozing.js): going off to, dropping off, waking by herself, woken by you, woken by a noise. Amy was only resting her eyes.
  dozeGo: line(60, ["I'm quite sleepy. I'll sit in the sun for a minute.", 'I could do with a sit down. Just a short one.']),
  dozeOff: line(60, ['Just resting my eyes.', "It's so warm. Just for a minute."]),
  dozeWake: line(30, ['I was not asleep. I was resting my eyes.', 'Of course I was awake. I heard everything.']),
  dozeWakeGentle: line(30, ['Oh! I was only resting my eyes.', 'Hm? Yes. I am awake. Completely awake.']),
  dozeStartled: line(30, ['That was not funny!', 'Do you mind? I was having a lovely rest.', 'Honestly. What was that for?']),
};

export const JESS_PLACE_LINES = {
  restGo: ["I'm having a sit down. Don't need you.", 'Sunbathing. Do not disturb.', "Gonna go and sit on something. Bye."],
  restSat: ['This is the life.', 'Best seat on the farm.', 'Come on up. If you dare.', 'I could fall asleep here. Honest.', { sound: 'yawn' }],
  restRain: ["Oh, you're joking! Barn!", 'Rain! Run!', "I'm not melting for anyone. Barn."],
  restShelter: ['Dry. Smug.', 'You can stand out in it. I will watch.', 'Nice and dry in here, this.'],
  restLeave: ['Fine, fine. Give me a sec.', 'Ugh. Up I get.', 'What now? Hold on.'],
  dozeGo: ["I'm knackered. Nap time.", 'Wake me up in a bit. Or do not.'],
  dozeOff: ['Five minutes. Do not let me sleep.', "I'm not tired. I'm just... mm."],
  dozeWake: ['Mm? How long was I out?', 'I was not snoring. Shut up.', 'Oh. I dropped off, did I?'],
  dozeWakeGentle: ['Wha? Oh. It is you.', 'Mm. Five more minutes.'],
  dozeStartled: ['Aaah! You absolute...', 'Oi! I was having a lovely dream!', 'Ha! Right. Very funny. I am up.'],
};
