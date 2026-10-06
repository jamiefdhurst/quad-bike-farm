// Racing (race.js): the dare and the answer, the count-down, the win, the excuses and the quad that dies, then the
// bicker afterwards and, once one is well ahead, going on about the score. Merged into the main line sets (voiceLines.js,
// jessLines.js) and the banter (banterLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_RACE_LINES = {
  raceInvite: line(60, ['Jess, would you like a race round the track? Loser makes the tea.', 'I will race you round the track, Jess. If you dare.']),
  raceAccept: line(60, ['Fine. I will race you. Prepare to lose.', 'You are on. And I am not going through the bog.']),
  raceCount: line(60, ['Ready? Three, two, one, go!']),
  raceWin: line(60, ['I won! I actually won!', 'Told you. Slow and steady.', 'That was a good one. Better luck next time, Jess.']),
  raceLose: line(60, ['It was the quad, not me. It would not pull.', 'You cheated. You must have cut a corner.', 'I was being careful. Somebody has to be.']),
  raceOut: line(60, ['Oh no, it has died. That does not count!', 'I am stuck. Stop the race, I am stuck!']),
};

export const JESS_RACE_LINES = {
  raceInvite: ['Race you round the track, Amy. Loser makes the tea.', 'Amy, you and me, one lap, right now. Scared?'],
  raceAccept: ['Oh, you are on.', 'Go on then. Try to keep up.'],
  raceCount: ['On your marks. Three, two, one, go!'],
  raceWin: ['Yes! Top of the leaderboard!', 'Too easy. Do you want to go again?', 'Eat my mud, Amy!'],
  raceLose: ['That quad is rubbish. Give me a better one.', 'It was not a fair race. My engine was cold.', 'Best of three. I want a rematch.'],
  raceOut: ['It has stalled! Foul! Restart the race!', 'Typical. It has died on me.'],
};

// After a race, whoever won and whoever lost (the roles are girl ids).
export const RACE_BANTER = [
  { when: 'raced', roles: { winner: 'amy', loser: 'jess' }, lines: [['amy', 'That was a very nice drive, if I say so myself.'], ['jess', 'You cut the corner by the hedge.'], ['amy', 'I took the racing line.']] },
  { when: 'raced', roles: { winner: 'amy', loser: 'jess' }, lines: [['jess', 'Best of three.'], ['amy', 'Of course. I will win that too.']] },
  { when: 'raced', roles: { winner: 'amy', loser: 'jess' }, lines: [['amy', 'Do not worry, Jess. Second is a perfectly good place.'], ['jess', 'Do not be nice to me. It is worse.']] },
  { when: 'raced', roles: { winner: 'jess', loser: 'amy' }, lines: [['jess', 'Did you see that? I made it look easy.'], ['amy', 'You were lucky. The ground was in your favour.'], ['jess', 'The ground is always in my favour.']] },
  { when: 'raced', roles: { winner: 'jess', loser: 'amy' }, lines: [['amy', 'I was just being careful.'], ['jess', 'You were being slow.']] },
  { when: 'raced', roles: { winner: 'jess', loser: 'amy' }, lines: [['jess', 'Loser makes the tea, Amy.'], ['amy', 'That was not in the rules.'], ['jess', 'It is now.']] },
  // One of them has won a good few more than the other.
  { when: 'rivals', roles: { leader: 'jess', trailing: 'amy' }, lines: [['jess', 'Wins so far: me, lots. You, not so many.'], ['amy', 'Wait until the next one.']] },
  { when: 'rivals', roles: { leader: 'jess', trailing: 'amy' }, lines: [['amy', 'I am only letting you win to be kind.'], ['jess', 'Keep telling yourself that.']] },
  { when: 'rivals', roles: { leader: 'amy', trailing: 'jess' }, lines: [['amy', 'Do you want me to read out the scores again?'], ['jess', 'No.']] },
  { when: 'rivals', roles: { leader: 'amy', trailing: 'jess' }, lines: [['jess', 'Alright, you have won more. It is a fluke.'], ['amy', 'Twice is not a fluke, Jess.']] },
];
