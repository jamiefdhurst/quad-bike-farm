// What the girls say about the tractor creeping off on its own (tractorRunaway.js): remarking on it (tractorCreepNote, and
// tractorCreepTrailer with the trailer hitched), running after it (tractorRunaway), catching it (tractorRunawayStopped), and when it
// has reached the hedge (tractorHedge, then the other one's tractorHedgeBlame). Merged into the main line sets (voiceLines.js,
// jessLines.js), so they're recorded with the rest. Nobody calls you anything but "you".

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_TRACTORRUNAWAY_LINES = {
  tractorCreepNote: line(60, ['Is that meant to be moving?', 'The tractor is moving. By itself. Is that all right?', 'Someone left it in gear. Someone always does.']),
  tractorCreepTrailer: line(60, ['It is taking the trailer for a walk on its own.', 'The tractor has gone off with the trailer. Nobody asked it to.']),
  tractorRunaway: line(20, ['It is heading for the hedge!', 'Stop! Stop! Oh, honestly.', 'Somebody catch it, it is going to hit the hedge!']),
  tractorRunawayStopped: line(40, ['There. Perfectly under control.', 'Got it. Please turn it off properly next time.', 'Honestly. Leaving it in gear is how you lose a tractor.']),
  tractorHedge: line(30, ['Oh no. It has gone into the hedge.', 'And that is the hedge. Well done, everyone.', 'It has stalled itself against the hedge. Obviously.']),
  tractorHedgeBlame: line(30, ['I told you it was moving.', 'I am not touching it. It was not me.', 'Whose idea was it to leave it running?']),
};

export const JESS_TRACTORRUNAWAY_LINES = {
  tractorCreepNote: ['Ha, it is going on its own. Brilliant.', 'The tractor is walking off. Go on, go on!', 'It is escaping!'],
  tractorCreepTrailer: ['It is taking the trailer on holiday!', 'The tractor is off, and it has brought the trailer.'],
  tractorRunaway: ['Come back! Come back, you horrible thing!', 'Wait! I am coming! Do not hit the hedge!', 'I am running! I am running as fast as I can!'],
  tractorRunawayStopped: ['Got it! Did you see me? I leapt on like a film.', 'Caught it. Easy. I was not even out of breath.', 'Stopped it! Somebody say thank you.'],
  tractorHedge: ['It is in the hedge. It has driven itself into the hedge.', 'Nobody was watching! It is in the hedge!', 'Well, that is the hedge done.'],
  tractorHedgeBlame: ['Not looking at anyone, but it was somebody\'s fault.', 'Not my fault. I was miles away.', 'Somebody should have been watching it.'],
};
