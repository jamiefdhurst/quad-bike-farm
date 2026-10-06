// Follow the leader (convoy.js): the offer and the answer, and the bicker when they swap places. Merged into the main line
// sets (voiceLines.js, jessLines.js) and the banter (banterLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_CONVOY_LINES = {
  convoyInvite: line(60, ['Shall we go for a drive together? I will lead.', 'Jess, follow me. Nice and steady.']),
  convoyAccept: line(60, ['Go on then. Do not go too fast.', 'Fine. But I am not going through any mud.']),
};

export const JESS_CONVOY_LINES = {
  convoyInvite: ['Follow me, Amy! Try to keep up.', 'Come on, Amy, I will show you how it is done.'],
  convoyAccept: ['Right behind you. For now.', 'Lead on. I will overtake you in a minute.'],
};

// After they swap places: roles are who is now in front and who is behind.
export const CONVOY_BANTER = [
  { when: 'swapped', roles: { front: 'jess', back: 'amy' }, lines: [['jess', 'Keep up, Amy!'], ['amy', 'Some of us obey the speed limit.']] },
  { when: 'swapped', roles: { front: 'jess', back: 'amy' }, lines: [['amy', 'You are going far too fast!'], ['jess', 'You are going far too slow!']] },
  { when: 'swapped', roles: { front: 'amy', back: 'jess' }, lines: [['amy', 'Is this a good speed for you, Jess?'], ['jess', 'It is a good speed for a pensioner.']] },
  { when: 'swapped', roles: { front: 'amy', back: 'jess' }, lines: [['jess', 'Faster! Faster!'], ['amy', 'No.']] },
];
