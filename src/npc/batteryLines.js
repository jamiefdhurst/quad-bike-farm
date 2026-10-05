// What the girls say about batteries: startSlow (it's cranking weakly), startFlat
// (it only clicks, when she's the one starting it), startPull (having a go
// at the pull-start instead; only Jess does it for now), crankStruggleBattery (you're cranking a weak one
// near her) and crankFlat (you press the starter and it only clicks). Merged into
// the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_BATTERY_LINES = {
  startSlow: line(30, ["It's turning over really slowly.", 'That does not sound healthy. Is the battery going?', 'Oh dear, it is cranking so slowly.']),
  startFlat: line(30, ["Nothing. It's just clicking. I think the battery's flat.", "It's dead. Completely dead. Did someone leave the key on?", "That's a flat battery, that is. Over to you."]),
  startPull: line(30, ['Flat battery. Is there a cord? Let me try the cord.', "I'll have a go at the pull-start. Wish me luck.", 'No battery, so it is the cord. Here goes.']),
  crankStruggleBattery: line(20, ['That sounds like the battery to me.', 'It is going slower and slower. I think the battery is flat.', 'Is the battery on its way out?']),
  crankFlat: line(20, ["It's only clicking. The battery's flat.", "Listen, that's just a click. It's dead.", 'Did you leave the key on? It sounds flat.']),
};

export const JESS_BATTERY_LINES = {
  startSlow: ['Ugh, it is going slow. Battery.', "That is a sad little crank. It's the battery.", 'Come on, spin, you lazy thing.'],
  startFlat: ["Dead. Totally dead. Someone left the key on.", 'Click. Click. Great. Flat battery.', "It's just clicking at me."],
  startPull: ["Flat. Right. I'll yank it instead.", 'No battery? Fine. Pull cord time.', 'Watch this. Old school.'],
  crankStruggleBattery: ["That's the battery, that is.", "Sounds flat. You left the key on, didn't you?", 'Slower and slower. Battery.'],
  crankFlat: ["It's dead. Click, nothing.", 'Flat battery. Classic.', 'Just a click. You are going to need the leads.'],
};
