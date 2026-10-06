// Tea on the rack (tea.js): putting a mug down, collecting it, and what the owner says when it falls off. Merged into the
// main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_TEA_LINES = {
  teaPlace: line(60, ['I will just leave my tea here for a minute.', 'My tea can sit on the rack. Nobody touch it.']),
  teaCollect: line(60, ['There is my tea. Still warm. Just.', 'Mmm. A proper cup of tea.']),
  teaFell: line(30, ['My tea! You have driven off with my tea on the back!', 'Oh, you did not look! My tea is all over the ground!', 'That was my tea! Honestly. Look behind you next time.']),
};

export const JESS_TEA_LINES = {
  teaPlace: ['Hold my tea. Well, the rack can.', 'Tea on the rack. Do not knock it.'],
  teaCollect: ['Cold tea. Lovely.', 'Right, tea time.'],
  teaFell: ['Oi! My tea!', 'You drove off with my mug on it! Idiot!', 'That was a good cup of tea, that was.'],
};
