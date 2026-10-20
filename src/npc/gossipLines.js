// What the girls say about you when they think you can't hear (gossip.js), and what one says when they find you there.
// The exchanges are `when: 'gossip'` entries in the banter list, so they're recorded with the rest of the banter. They
// never call you he, she or they: you're "our friend" or "someone", and "you" only once you've been caught.

const line = (cooldown, lines) => ({ cooldown, lines });

export const GOSSIP_BANTER = [
  { when: 'gossip', lines: [['jess', 'Our friend still has not noticed how brilliant I have been all week.'], ['amy', 'Maybe because you have not been.'], ['jess', 'Rude.']] },
  { when: 'gossip', lines: [['amy', 'Did you see the way our friend took that corner earlier?'], ['jess', 'Into the hedge?'], ['amy', 'Near the hedge. Be kind.']] },
  { when: 'gossip', lines: [['jess', 'I reckon someone likes you best, Amy.'], ['amy', 'Do not be silly.'], ['jess', 'You went pink, though.']] },
  { when: 'gossip', lines: [['amy', 'Someone has been riding the Bruin like it owes money.'], ['jess', 'Good. That is how you ride it.']] },
  { when: 'gossip', lines: [['jess', 'Go on, ask who the best driver is round here.'], ['amy', 'I am not asking.'], ['jess', 'Because you know the answer.']] },
  { when: 'gossip', lines: [['amy', 'Do not say anything, but the choke is getting better.'], ['jess', 'Slowly. Painfully slowly.']] },
  { when: 'gossip', lines: [['jess', 'I swear someone keeps leaving the tap on.'], ['amy', 'Keep your voice down.'], ['jess', 'It is only the truth.']] },
  { when: 'gossip', lines: [['amy', 'It is nice having someone to ride with, though.'], ['jess', 'Do not go soft on me now.'], ['amy', 'I am only saying.']] },
];

export const AMY_GOSSIP_LINES = {
  gossipCaught: line(30, ['Oh! Hello. We were just talking about the weather.', 'Oh, hi. Nothing. Nobody said anything.', 'How long have you been stood there?']),
};

export const JESS_GOSSIP_LINES = {
  gossipCaught: ['Oi! How long have you been there?', 'We were not talking about you.', 'Nothing! Nothing at all.'],
};
