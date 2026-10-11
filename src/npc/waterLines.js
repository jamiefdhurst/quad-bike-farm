// What the girls say about water in the fuel (fuelWater.js): waterRough (a quad coughing on it), waterDied (it cut out on it), waterNoStart
// (cranking and cranking) and waterBowl (the sediment bowl on the tap is full). Amy reads the cause and knows to drain it at the tap; Jess
// blames the quad. Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_WATER_LINES = {
  waterRough: line(45, ['That is spluttering. I think there is water in the fuel.', 'Listen to it cough. That sounds like water to me.', 'It keeps missing. Check the little glass bowl on the tap.']),
  waterDied: line(30, ['It has cut out. Water in the fuel, I would bet. Drain the bowl at the tap.', 'That will be water. Open the drain on the fuel tap and let it out.', 'It choked on water. Drain it at the tap and it will go again.']),
  waterNoStart: line(40, ["It's turning over but not catching. I think the fuel is full of water.", 'Stop cranking it. Drain the tap first.', 'Look at the bowl on the tap. I bet it is full of water.']),
  waterBowl: line(60, ['The bowl on the tap is full of water. Somebody should drain that.', 'There is a lot of water in the glass on that tap. It wants draining.', 'That fuel bowl is full of water. It will start missing soon.']),
};

export const JESS_WATER_LINES = {
  waterRough: ['This thing is rubbish. It keeps coughing.', 'It is sulking again. Typical.', 'Why does it do that? It was fine yesterday.'],
  waterDied: ['Typical. Dead again. Dodgy quad.', 'It has just given up. This quad is cursed.', 'Well, that is a rubbish quad. Not my fault.'],
  waterNoStart: ["It's just being awkward. Keep going.", 'It is a dud. Get another one.', "It hates me. It's not the fuel, it never is."],
  waterBowl: ['What is that in the little glass? Looks fine to me.', "That glass thing's gone cloudy. Is that bad?", 'It is only a bit of rain, surely.'],
};
