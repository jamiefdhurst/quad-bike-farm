// What the girls say about a quad's quirks (vehicle/quirks.js): a warning about each, once, stood by it or as you get on
// (quirkFuelHigh and the rest), and seatSoaked when you sit on a split seat that has soaked up the rain. They are said by the
// quad you are at, so "that one" does for every colour. Amy says it plainly; Jess is cheerful about it. Merged into the main line
// sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_QUIRK_LINES = {
  quirkFuelHigh: line(300, ['The fuel gauge on that one reads high. Do not trust it.']),
  quirkFuelSticks: line(300, ['The fuel gauge on that one sticks. Check the tank properly.']),
  quirkTempCold: line(300, ['The temperature needle on that one never moves. It is stuck on cold.']),
  quirkChokeCreeps: line(300, ['The choke on that one creeps back on by itself. Keep an eye on it.']),
  quirkTapStiff: line(300, ['The fuel tap on that one is stiff. You have to work it.']),
  quirkSeatSplit: line(300, ['That seat is split. It soaks you after rain.']),
  quirkHornFlaky: line(300, ['The horn on that one works when it likes.']),
  quirkBrakesPull: line(300, ['The brakes on that one pull to the left.']),
  quirkBrakeSqueal: line(300, ['The brakes on that one squeal. They are fine, though.']),
  quirkHeadlightFlicker: line(300, ['The headlight on that one flickers. A loose bulb, I think.']),
  seatSoaked: line(60, ['Oh, you are soaked. That seat is split, I am sorry.']),
};

export const JESS_QUIRK_LINES = {
  quirkFuelHigh: ['The fuel gauge on that one lies. It always says more than there is. Exciting, really.'],
  quirkFuelSticks: ['The fuel gauge on that one is stuck. Just guess.'],
  quirkTempCold: ['The temperature thing on that one is broken. Always cold. Ignore it.'],
  quirkChokeCreeps: ['That one pulls its own choke out. Rude.'],
  quirkTapStiff: ['The tap on that one is a nightmare. You have to really lean on it.'],
  quirkSeatSplit: ['That seat has a split. Brace yourself if it has rained.'],
  quirkHornFlaky: ['The horn on that one does what it wants. Like me.'],
  quirkBrakesPull: ['That one pulls left when you brake. You get used to it.'],
  quirkBrakeSqueal: ['That one squeals when you brake. Everyone looks. I love it.'],
  quirkHeadlightFlicker: ['The light on that one does a disco. Do not worry about it.'],
  seatSoaked: ['Ha! Wet bottom! Brilliant.'],
};
