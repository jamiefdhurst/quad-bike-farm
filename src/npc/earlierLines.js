// The girls bringing up something from earlier in the day (#115), while stood about together. Each is raised once, a few minutes after it
// happened (earlier.js). They talk to you as "you" and never about you as he, she or they. Merged at the end of the banter (banterLines.js),
// so adding them leaves the recorded banks before them as they were. The roles name the event (`event`, as in farm/dayStory.js) and who:
// `winner`, `loser`, `girl`, `how` ('tip' or 'stuck') and `result` ('won' or 'lost' for a race you were in).

export const EARLIER_BANTER = [
  // A race the girls had
  { when: 'earlier', roles: { event: 'race', winner: 'jess' }, lines: [['jess', 'I keep thinking about that race.'], ['amy', 'I bet you do.'], ['jess', 'Winning it, mostly.']] },
  { when: 'earlier', roles: { event: 'race', winner: 'jess' }, lines: [['amy', 'You only won because I let you.'], ['jess', 'Funny, you did not let me this morning.'], ['amy', 'It was a long time ago.']] },
  { when: 'earlier', roles: { event: 'race', winner: 'amy' }, lines: [['amy', 'I did beat you in that race, you know.'], ['jess', 'I know. You have told me.'], ['amy', 'I have not finished telling you.']] },
  { when: 'earlier', roles: { event: 'race', winner: 'amy' }, lines: [['jess', 'That race was a fluke.'], ['amy', 'A fluke that finished ahead of you.'], ['jess', 'I want a rematch.']] },

  // A race you were in
  { when: 'earlier', roles: { event: 'youRaced', result: 'won' }, lines: [['jess', 'You were fast earlier.'], ['amy', 'Do not make a fuss, Jess.'], ['jess', 'I am not. I am just saying it was close. For second.']] },
  { when: 'earlier', roles: { event: 'youRaced', result: 'won' }, lines: [['amy', 'I thought you were brilliant in that race.'], ['jess', 'Oh, here we go.'], ['amy', 'I am allowed to say so.']] },
  { when: 'earlier', roles: { event: 'youRaced', result: 'lost' }, lines: [['jess', 'Next time you race, we are not going easy on you.'], ['amy', 'We did not go easy on you this time.'], ['jess', 'Then it is going to get worse.']] },
  { when: 'earlier', roles: { event: 'youRaced', result: 'lost' }, lines: [['amy', 'You can win the next race. I will say a prayer.'], ['jess', 'Say two.']] },

  // A girl who tipped or got bogged
  { when: 'earlier', roles: { event: 'stranded', girl: 'amy', how: 'stuck' }, lines: [['jess', 'Amy, do you want to take the low road again? Bog is lovely this time of year.'], ['amy', 'That was one time.'], ['jess', 'It was one very long time.']] },
  { when: 'earlier', roles: { event: 'stranded', girl: 'amy', how: 'stuck' }, lines: [['amy', 'I am not going near that mud again.'], ['jess', 'It went near you, though.'], ['amy', 'Do not.']] },
  { when: 'earlier', roles: { event: 'stranded', girl: 'jess', how: 'stuck' }, lines: [['amy', 'Still got mud in your boots, Jess?'], ['jess', 'That was a shortcut.'], ['amy', 'It was a shortcut to the bottom.']] },
  { when: 'earlier', roles: { event: 'stranded', girl: 'jess', how: 'stuck' }, lines: [['jess', 'Nobody say anything about the bog.'], ['amy', 'Which bog?'], ['jess', 'Thank you.']] },
  { when: 'earlier', roles: { event: 'stranded', girl: 'amy', how: 'tip' }, lines: [['jess', 'You looked very graceful, Amy, going over like that.'], ['amy', 'I landed on my feet.'], ['jess', 'The quad did not.']] },
  { when: 'earlier', roles: { event: 'stranded', girl: 'amy', how: 'tip' }, lines: [['amy', 'My shoulder is still sore from earlier.'], ['jess', 'From the quad falling on you?'], ['amy', 'From you laughing at me.']] },
  { when: 'earlier', roles: { event: 'stranded', girl: 'jess', how: 'tip' }, lines: [['amy', 'Jess, I have never seen anyone go over so fast.'], ['jess', 'That was on purpose.'], ['amy', 'It really was not.']] },
  { when: 'earlier', roles: { event: 'stranded', girl: 'jess', how: 'tip' }, lines: [['jess', 'If anyone mentions me and the quad lying down, I am leaving.'], ['amy', 'Nobody said a word.'], ['jess', 'You were about to.']] },

  // A quad that seized
  { when: 'earlier', roles: { event: 'seized' }, lines: [['amy', 'Do you think it will start again, the one that seized?'], ['jess', 'It will start. It just will not turn.'], ['amy', 'That is the same problem.']] },
  { when: 'earlier', roles: { event: 'seized' }, lines: [['jess', 'Someone should have checked the oil.'], ['amy', 'Someone. Not looking at anyone.'], ['jess', 'Looking at you.']] },

  // The girls fell out
  { when: 'earlier', roles: { event: 'fellOut' }, lines: [['amy', 'I am sorry about before, Jess. Mostly.'], ['jess', 'Mostly. I will take mostly.']] },
  { when: 'earlier', roles: { event: 'fellOut' }, lines: [['jess', 'We were awful to each other earlier.'], ['amy', 'You were awful. I was justified.'], ['jess', 'I knew you would say that.']] },

  // Amy's driving test
  { when: 'earlier', roles: { event: 'passedTest' }, lines: [['jess', 'Go on, Amy, let us see the licence again.'], ['amy', 'You have seen it six times.'], ['jess', 'It is a good licence.']] },
  { when: 'earlier', roles: { event: 'passedTest' }, lines: [['amy', 'I keep checking my pocket for the licence.'], ['jess', 'It is still there, Amy.'], ['amy', 'I know. I like checking.']] },
  { when: 'earlier', roles: { event: 'failedTest' }, lines: [['jess', 'You will get it next time, Amy.'], ['amy', 'Thank you. That is kind.'], ['jess', 'Probably.']] },
  { when: 'earlier', roles: { event: 'failedTest' }, lines: [['amy', 'I do not want to talk about the test.'], ['jess', 'I was not going to say a word.'], ['amy', 'You had your mouth open.']] },
];
