// What the girls say when you are turned round at the edge of the map (#687, world/turnRoundHost.js): you crossed a junction's give-way line onto the A-road
// (`turnRound`) or the lane's southern line (`turnRoundSouth`), and the girl with you says why you are not going. Alone, the game puts up a toast instead
// (`TURN_ROUND_TOAST`). Merged into the main line sets (voiceLines.js, jessLines.js).

const line = (cooldown, lines) => ({ cooldown, lines });

export const TURN_ROUND_TOAST = 'Nothing needs doing in town today.';

export const AMY_TURN_ROUND_LINES = {
  turnRound: line(20, [
    'We have got work to do. Turn round.',
    'There is nothing in town for us today. The farm will not run itself.',
    'Not today. There are jobs waiting, and you know it.',
    'That is far enough. Back to the farm, please.',
  ]),
  turnRoundSouth: line(20, [
    'Haddon? We have no business in Haddon. Turn round.',
    'That is the road to Haddon. We are not going there today.',
    'It is a long way to Haddon and there is a lot to do here.',
    'Turn round, please. Nothing needs doing in Haddon.',
  ]),
};

export const JESS_TURN_ROUND_LINES = {
  turnRound: [
    'Town is dead on a weekday. Back to the farm.',
    'Where are you going? There is nothing out there. Turn round.',
    'There will be nobody in town. Not even in the pub. Home.',
    'Come on, turn it round. We have had all the fun there is out here.',
  ],
  turnRoundSouth: [
    'Haddon? There is nothing in Haddon.',
    'We are not going to Haddon. Nobody goes to Haddon.',
    'Keep going and you will end up in Haddon. Do not.',
    'Wrong way. Home is the other way, you know.',
  ],
};
