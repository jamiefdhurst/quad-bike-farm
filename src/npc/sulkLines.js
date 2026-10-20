// What the girls say when one sulks in the Moorland (sulking.js): sulkGo (storming off), sulkAnswer (Amy, the window down on the second
// knock; Jess, shouted over the engine as she revs it at you), sulkPushed (you knocked too fast), sulkRound (talked round) and sulkOut (she has had
// enough). Amy ignores the first knock, so it has no line. Merged into the main line sets (voiceLines.js, jessLines.js), so they're
// recorded with the rest. The girls call you "you", never he, she or they.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_SULK_LINES = {
  sulkGo: line(120, ['Fine. I will be in the Moorland.', 'I am going to sit in the Moorland. On my own.', 'Do not follow me. I need a minute.']),
  sulkAnswer: line(30, ['What is it?', 'I am not talking about it. Not yet.', 'Go on, then. What do you want?']),
  sulkPushed: line(30, ['Stop knocking! That is not helping.', 'Knocking like that makes it worse.']),
  sulkRound: line(120, ['Oh, all right. I suppose I was being daft.', 'Fine. You have talked me round. Budge up.']),
  sulkOut: line(120, ['Right. I have sulked enough. Back to it.', 'It is warm in here, but I am bored. Coming out.']),
};

export const JESS_SULK_LINES = {
  sulkGo: ['Right. I am sitting in the Moorland. Do not talk to me.', 'Nobody ask me anything. I am in the Moorland.', 'I am off. See if I care.'],
  sulkAnswer: ['Go away!', 'Not listening! Brrrm!', 'Still not talking to you!'],
  sulkPushed: ['Stop banging on the window!', 'If you knock one more time, I will drive off in it.'],
  sulkRound: ['Ugh, fine. You are annoying. I am coming out.', 'Fine! I forgive you. A bit.'],
  sulkOut: ['Right, I have sulked enough. It was boring.', 'I have run out of sulk. Out I get.'],
};
