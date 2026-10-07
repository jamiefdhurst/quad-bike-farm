// What the girls say about the L plates (lPlates.js). Jess: lplateTape (as she tapes them to Amy's quad), lplateCheek (when Amy has
// peeled them off), lplateTractor (when they turn up on the tractor). Amy: lplateFound (seeing them on her quad), lplatePeel (taking
// them off) and lplateStick (taping them to the tractor, now she's good). Merged into the main line sets (voiceLines.js, jessLines.js),
// so they're recorded with the rest. Nobody calls you anything but "you".

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_LPLATE_LINES = {
  lplateFound: line(30, ['Jess. Why are there L plates on my quad?', 'Oh, very funny. Who made these?', 'Those are not staying on.']),
  lplatePeel: line(30, ['There. Gone.', 'I passed my test years ago, and I am not driving round with those on.', 'In the bin with you.']),
  lplateStick: line(300, ['Right. These are going on the tractor, where they belong.', 'I have had enough of these. Jess can wear them on the tractor.', 'There. Now they are on something that deserves them.']),
};

export const JESS_LPLATE_LINES = {
  lplateTape: ['Made you a present, Amy. Look after them.', 'Right, tape, L plates, there. Perfect.', 'Safety first. You can thank me later.'],
  lplateCheek: ['Oh, come on, they suited you.', 'I will just make another pair, then.', 'You are no fun. They were very nice plates.'],
  lplateTractor: ['Oh. Oh, that is unfair.', 'Those are mine. I mean, I drive it brilliantly. Take them off.', 'Fine. Fine! I am keeping them on, to prove a point.'],
};

/** Lines only Jess has: she makes the plates and answers Amy, and Amy has no version of them. */
export const JESS_ONLY_LPLATE_SITUATIONS = Object.keys(JESS_LPLATE_LINES);
