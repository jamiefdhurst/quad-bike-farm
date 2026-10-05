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
};

export const JESS_PLACE_LINES = {
  restGo: ["I'm having a sit down. Don't need you.", 'Sunbathing. Do not disturb.', "Gonna go and sit on something. Bye."],
  restSat: ['This is the life.', 'Best seat on the farm.', 'Come on up. If you dare.', 'I could fall asleep here. Honest.', { sound: 'yawn' }],
  restRain: ["Oh, you're joking! Barn!", 'Rain! Run!', "I'm not melting for anyone. Barn."],
  restShelter: ['Dry. Smug.', 'You can stand out in it. I will watch.', 'Nice and dry in here, this.'],
  restLeave: ['Fine, fine. Give me a sec.', 'Ugh. Up I get.', 'What now? Hold on.'],
};
