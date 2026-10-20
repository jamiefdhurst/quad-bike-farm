// The girls arguing over which quad is best at what (#27, was TODO 132): each has worked out, from riding, which one she thinks climbs best,
// grips in mud or sticks to tarmac, and they differ until they have both ridden enough. The lines never name a quad (a line is one
// recording for every game, and which quad is which is dealt per game); they point at the ground. Merged into the banter (banterLines.js),
// so they're recorded with the rest. `when: 'strengths'` has roles { kind, starter }; `when: 'strengthsAgree'` has { kind }.

export const STRENGTH_BANTER = [
  // On a hill, they disagree. The starter is the one who raises it.
  { when: 'strengths', roles: { kind: 'hill', starter: 'jess' }, lines: [['jess', 'Some of these quads just pull on a hill and some of them sulk. You know which is which.'], ['amy', 'I do. We do not agree on which, though.'], ['jess', 'Because you are wrong.']] },
  { when: 'strengths', roles: { kind: 'hill', starter: 'jess' }, lines: [['jess', 'The one you like struggles up the hill. I have watched it.'], ['amy', 'It is steady. Steady gets there.'], ['jess', 'Eventually.']] },
  { when: 'strengths', roles: { kind: 'hill', starter: 'amy' }, lines: [['amy', 'I have noticed that one quad does the hill better than the others. Not the one you think.'], ['jess', 'It is exactly the one I think.'], ['amy', 'It is not.']] },
  { when: 'strengths', roles: { kind: 'hill', starter: 'amy' }, lines: [['amy', 'You take the flashy one up the hill, and then you wonder why it slows down.'], ['jess', 'It does not slow down. You are imagining it.']] },
  // In mud.
  { when: 'strengths', roles: { kind: 'mud', starter: 'jess' }, lines: [['jess', 'One of these just floats over the mud and the rest dig in. Mine floats.'], ['amy', 'Yours spins its wheels and throws it about.'], ['jess', 'That is floating.']] },
  { when: 'strengths', roles: { kind: 'mud', starter: 'jess' }, lines: [['jess', 'You always pick the one that gets stuck in the gateway.'], ['amy', 'I pick the one that does not get stuck. You were not looking.'], ['jess', 'I was looking.']] },
  { when: 'strengths', roles: { kind: 'mud', starter: 'amy' }, lines: [['amy', 'In the wet, there is a quad that grips and a quad that does not. I have been keeping track.'], ['jess', 'Of course you have.'], ['amy', 'And it is not the one you keep taking.']] },
  { when: 'strengths', roles: { kind: 'mud', starter: 'amy' }, lines: [['amy', 'Mud is where you find out which one is any good.'], ['jess', 'And I say it is mine.'], ['amy', 'And you are wrong again.']] },
  // On tarmac.
  { when: 'strengths', roles: { kind: 'tarmac', starter: 'jess' }, lines: [['jess', 'On the road there is one that really sticks. Round the bend, no drama.'], ['amy', 'It is not the one you are on.'], ['jess', 'It is exactly the one I am on.']] },
  { when: 'strengths', roles: { kind: 'tarmac', starter: 'jess' }, lines: [['jess', 'Put me on the lane and I will show you which is quickest.'], ['amy', 'I know which is quickest. It is not yours.']] },
  { when: 'strengths', roles: { kind: 'tarmac', starter: 'amy' }, lines: [['amy', 'Some of these are much nicer on the tarmac. It is quite obvious.'], ['jess', 'Quite obvious that it is mine.'], ['amy', 'It is not.']] },
  { when: 'strengths', roles: { kind: 'tarmac', starter: 'amy' }, lines: [['amy', 'You do not get the tarmac at all, do you? The grip is the whole thing.'], ['jess', 'The speed is the whole thing.']] },
  // They agree, for once.
  { when: 'strengthsAgree', roles: { kind: 'hill' }, lines: [['amy', 'We do agree about one thing. That quad is the best up the hill.'], ['jess', 'Write it down. It will not happen again.']] },
  { when: 'strengthsAgree', roles: { kind: 'mud' }, lines: [['jess', 'There is a proper mud quad, you know. We both know which.'], ['amy', 'We do. It is the one that does not bog.']] },
  { when: 'strengthsAgree', roles: { kind: 'tarmac' }, lines: [['amy', 'For the road, there is only one choice, really.'], ['jess', 'There is. And for once I am not going to argue.']] },
];
