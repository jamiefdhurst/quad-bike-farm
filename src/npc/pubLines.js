// The girls at the village pub (#358): chatting while you wait outside the Plough and Harrow, and when you pull away. They talk to you as "you" and
// never about you as he, she or they. Merged at the end of the banter (banterLines.js), so adding them leaves the recorded banks before them as
// they were. `when: 'atPub'` is a lasting situation (both girls stood or sat in the car park); `when: 'leavingPub'` is a moment.

export const PUB_BANTER = [
  // Waiting in the car park.
  { when: 'atPub', lines: [['jess', 'We could just go in. One drink. Nobody would know.'], ['amy', 'The door is painted on, Jess.'], ['jess', 'Then we paint a drink on too.']] },
  { when: 'atPub', lines: [['amy', 'That sign is lovely, you know. Someone has taken real care over it.'], ['jess', 'It is a horse and a plough. I would have put a pint on it.']] },
  { when: 'atPub', lines: [['jess', 'What would you have, if you were having something?'], ['amy', 'A lemonade. A proper one, with ice.'], ['jess', 'A lemonade. At a pub. Unreal.']] },
  { when: 'atPub', lines: [['amy', 'I could sit in a beer garden all afternoon.'], ['jess', 'You could sit in a beer garden with nothing to drink all afternoon. Impressive.']] },
  { when: 'atPub', lines: [['jess', 'Cider. In the sun. That is the whole plan.'], ['amy', 'You do not have a plan. You have a thirst.'], ['jess', 'It is a plan with a thirst in it.']] },
  { when: 'atPub', lines: [['amy', 'Do you think they do a Sunday roast?'], ['jess', 'Amy. It is a pub. It does a Sunday roast and a quiz.'], ['amy', 'I would be good at the quiz.'], ['jess', 'You would be insufferable at the quiz.']] },
  { when: 'atPub', lines: [['jess', 'Race you to the picnic table.'], ['amy', 'We are already next to the picnic table.'], ['jess', 'Then I have already won.']] },
  { when: 'atPub', lines: [['amy', 'It is nice, being somewhere that is not the farm.'], ['jess', 'It smells of chips. I like it.']] },
  // Pulling away.
  { when: 'leavingPub', lines: [['jess', 'Oh, we are going. Fine. I did not want a drink anyway.'], ['amy', 'You wanted one very much.'], ['jess', 'I did. Next time.']] },
  { when: 'leavingPub', lines: [['amy', 'Thank you for bringing us. It was nice to sit somewhere with a view of a pub.'], ['jess', 'A view of a pub. Brilliant. Wave goodbye to it.']] },
  { when: 'leavingPub', lines: [['jess', 'Next time I am going in.'], ['amy', 'You said that last time.'], ['jess', 'And next time I mean it.']] },
  { when: 'leavingPub', lines: [['amy', 'We should come back on a warm evening.'], ['jess', 'We should come back with some money.']] },
  { when: 'leavingPub', lines: [['jess', 'Bye, pub!'], ['amy', 'Jess, it cannot hear you.'], ['jess', 'It knows.']] },
];
