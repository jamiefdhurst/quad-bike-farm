// What the girls say about each quad's knack: startKnack (she's doing the green's
// double blip before she cranks it), crankStruggleKnack (you're cranking it cold
// without the trick, near her) and chokeOffBlue (the blue's running rich on the
// choke). Merged into the main line sets (voiceLines.js, jessLines.js), so they're
// recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_KNACK_LINES = {
  startKnack: line(30, ['This one needs tickling first. Two blips.', 'You have to give the RB300 a couple of blips, or it just sulks.', 'Two little blips, and then it will go. I think.']),
  crankStruggleKnack: line(25, ['You have to tickle it first. Blip the throttle twice.', 'The RB300 will not go cold unless you blip it a couple of times.', 'Try two blips on the throttle, then crank it.']),
  chokeOffBlue: line(25, ['The Bruin does not like the choke for long. Turn it down.', 'That is too much choke for the Bruin, it is going rich.', 'Ease the choke off, this one floods if you leave it.']),
};

export const JESS_KNACK_LINES = {
  startKnack: ['Tickle, tickle. Go on.', 'Two blips. Everyone knows the RB300 wants two blips.', 'Give it a little tickle first, silly old thing.'],
  crankStruggleKnack: ["You've got to tickle it first. Two blips.", "It's not going to start like that. Blip it twice.", 'Tickle it! Throttle, twice, then crank.'],
  chokeOffBlue: ["That's way too much choke for the Bruin.", 'Choke off, choke off, it is gargling.', "The Bruin hates choke once it's going. Ease it."],
};
