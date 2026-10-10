// What the girls say about sitting on a quad (or in a Land Rover) while it warms up (warmSit.js): warmSitAsk (asking you first),
// warmSitIn (settled, enjoying the shake), warmSitSmoothing (it is starting to smooth out) and warmSitSmooth (it has: disappointed),
// warmSitSlow (you have come: slow to get off) and warmSitGiveUp (nobody came). Merged into the main line sets (voiceLines.js, jessLines.js),
// so they're recorded with the rest. The girls call you "you", never he, she or they.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_WARMSIT_LINES = {
  warmSitAsk: line(60, ['Can I sit on it while it warms up?', 'Would you mind if I sat on it while it warms up?', 'Can I sit on it while it warms up? It is the best bit.']),
  warmSitIn: line(60, ['Mmm. I do like it when it is cold and shaking.', 'That is lovely. It buzzes right through the seat.']),
  warmSitSmoothing: line(60, ['Oh, it is starting to smooth out.', 'It is settling down. Shame.', 'I can feel it calming down already.']),
  warmSitSmooth: line(60, ['And now it is smooth. That was the best bit.', 'Hm. All warm. Rather dull now.', 'It has gone all smooth. I was enjoying that.', 'That is it, then. The shaking has stopped.']),
  warmSitSlow: line(60, ['Already? I was only just comfortable.', 'Oh, is it time? Give me a second.', 'Five more minutes? No? All right, then.']),
  warmSitGiveUp: line(60, ['You have forgotten about it. I am getting off.', 'It is warm and nobody came. I am off.']),
};

export const JESS_WARMSIT_LINES = {
  warmSitAsk: ['Can I sit on it while it warms up? Go on.', 'I am sitting on it while it warms up. Is that fine? Yes. Good.', 'Can I sit on it while it warms up? It does that brilliant shake.'],
  warmSitIn: ['Oh, that is good. It is vibrating everywhere.', 'Brilliant. Free massage chair.'],
  warmSitSmoothing: ['Aw, it is smoothing out already.', 'It is going quiet. Boring.', 'No, no, keep shaking.'],
  warmSitSmooth: ['And now it is smooth. Rubbish.', 'It is all warm. Just not as good.', 'Boo. It has stopped shaking.', 'That is all the fun gone out of it.'],
  warmSitSlow: ['What, now? I only just got comfortable.', 'Hang on, hang on. Two more seconds.', 'Do I have to get off?'],
  warmSitGiveUp: ['Forget it. Nobody came. I am off.', 'It is warm and you are not here. Bye.'],
};
