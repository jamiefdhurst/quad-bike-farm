// What the girls say when they listen to a running quad and say what they think is wrong with it
// (diagnosis.js): diagnoseCold, diagnoseRich, diagnoseFouled, diagnoseWorn and diagnoseFine. Amy is
// careful and says why; Jess is sure of herself. When Jess is wrong and Amy's close, they argue it
// out (DIAGNOSIS_BANTER, appended to the exchanges in banterLines.js). Merged into the main line sets
// (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_DIAGNOSIS_LINES = {
  diagnoseCold: line(40, ["It's still cold. Listen to how it's running, it needs a few minutes.", 'That one is cold. It will smooth out once it has warmed through.']),
  diagnoseRich: line(40, ["It's running rich. Hear it hunting up and down?", 'Too much fuel, I think. It sounds soggy.']),
  diagnoseFouled: line(40, ['That plug is fouled. It keeps missing and it is not clearing.', "It's misfiring. I think the plug is sooty."]),
  diagnoseWorn: line(40, ['That engine is tired. Listen to the rattle in it.', "It's worn, that one. It sounds rough even when it's warm."]),
  diagnoseFine: line(40, ['That sounds healthy, actually.', "I can't hear anything wrong with it."]),
};

export const JESS_DIAGNOSIS_LINES = {
  diagnoseCold: ["It's just cold. Give it a good thrashing.", 'Sounds cold to me. Cold and grumpy.'],
  diagnoseRich: ["Too much petrol, I reckon. It's drinking it.", "It's flooded. Definitely flooded."],
  diagnoseFouled: ['Dirty plug. Definitely a dirty plug.', "It's spark plug trouble. I can tell."],
  diagnoseWorn: ["It's knackered. Total heap.", 'Worn out. That is a worn-out engine.'],
  diagnoseFine: ['Sounds fine to me.', "There's nothing wrong with it. It's purring."],
};

// What Amy says to put Jess right about what's really wrong, and what Jess says back about what
// she'd said. The exchange is picked by the pair (truth, guess).
const CORRECT = {
  cold: ["No, Jess. It's cold. Listen to how it's running.", "It's only cold. It hasn't warmed up yet."],
  rich: ["No, it's running rich. Hear it hunting?", "It's rich, Jess. It's too much fuel."],
  fouled: ["No, that plug is fouled. It's missing.", "It's the plug, Jess. It's sooty."],
  worn: ["No, that one's worn. Listen to the rattle.", "It's tired, Jess. That's wear, not that."],
  fine: ["There's nothing wrong with it, Jess.", "That's a healthy engine. You're imagining it."],
};
const ARGUE = {
  cold: ["It's cold. I know a cold engine when I hear one.", "I said it's cold, and I'm right."],
  rich: ["It's rich. Trust me, I know engines.", "No, it's flooded. I can smell it."],
  fouled: ["It's the plug. I'd bet money on it.", 'I know a dirty plug when I hear one.'],
  worn: ["It's knackered. You'll see.", 'Worn out. I stand by it.'],
  fine: ["It's fine. You're just fussing.", "I'd know if it was broken."],
};
const LAST = ['We will see.', 'Listen properly, Jess.', 'You have not listened once.', 'Fine. Be wrong.'];

/** One exchange per (what's really wrong, what Jess said), for banter.js: roles name both, plus who's who. */
export const DIAGNOSIS_BANTER = [];
let n = 0;
for (const truth of Object.keys(CORRECT)) {
  for (const guess of Object.keys(ARGUE)) {
    if (truth === guess) continue;
    DIAGNOSIS_BANTER.push({
      when: 'corrected',
      roles: { guesser: 'jess', corrector: 'amy', guess, truth },
      lines: [['amy', CORRECT[truth][n % 2]], ['jess', ARGUE[guess][(n >> 1) % 2]], ['amy', LAST[n % LAST.length]]],
    });
    n += 1;
  }
}
