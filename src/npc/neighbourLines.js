// What the neighbour over the lane says (world/neighbourFarm.js), in her own voice (public/audio/companion-voice-neighbour.*, recorded by
// tools/generate_companion_voice.py --character neighbour), and what the girls say about her farm. She is a woman on the girls' model, older
// and calmer than either of them, and talks to the player as "you". Not a companion: she has no brain, only these lines.

const line = (cooldown, lines) => ({ cooldown, lines });

/** The neighbour as the voice generator reads a character: an id, the bank her lines are recorded into, and her lines by kind. */
export const NEIGHBOUR_VOICE = {
  id: 'neighbour',
  name: 'The neighbour',
  voiceBank: 'companion-voice-neighbour',
  lines: {
    greet: line(60, [
      'Morning. Mind the gate, it sticks.',
      'Hello, you. Come in, mind the muck.',
      'Well, look who it is. Come in, come in.',
      'Hello there. I wondered who that was on the lane.',
      'Ah, you found us. Park anywhere that is not in the way.',
    ]),
    greetAgain: line(60, [
      'Back again? The kettle is still warm.',
      'Hello again. Have you forgotten something?',
      'You again. Come in, then.',
      'Hello, love. Did you want something else?',
    ]),
    greetWet: line(60, [
      'You are soaked. Come in out of that.',
      'Dreadful out, isn\'t it? Come in, quick.',
      'Look at the state of you. Come in, come in.',
    ]),
    chat: line(45, [
      'The lane has been quiet today.',
      'That is a fine machine you have there.',
      'Mind my hens, they go everywhere.',
      'The post van was late again.',
      'I hear your engine from here, you know. Every morning.',
      'The barn roof wants doing. It has wanted doing for years.',
      'Have you eaten? I have a pie going spare.',
      'The tractor will start when it feels like it.',
    ]),
    farewell: line(90, [
      'Mind how you go on the lane.',
      'Right, off you go. Shut the gate.',
      'Come again. Bring a cake.',
      'Bye, then. Watch out for the post van.',
    ]),
  },
};

/** What the girls say as you reach the neighbour's farm: the same keys in both. */
export const AMY_NEIGHBOUR_LINES = {
  neighbourFarm: line(240, [
    'This is the neighbour\'s farm. Be polite.',
    'We are at the neighbour\'s. Do not touch anything.',
    'It is nice over here. Tidier than ours.',
  ]),
  neighbourWave: line(120, ['She is waving. Wave back.', 'The neighbour has seen us. Wave.']),
};

export const JESS_NEIGHBOUR_LINES = {
  neighbourFarm: ['Ooh, the neighbour\'s! Do they have biscuits?', 'We are at the neighbour\'s farm! Behave.', 'Look at their yard. It is so neat. Rude.'],
  neighbourWave: ['She is waving at us! Hiya!', 'Hello, neighbour!'],
};
