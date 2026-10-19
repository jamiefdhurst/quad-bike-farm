// What the girls say when you ask them to watch you do something (watching.js): watchOk (she is looking, go on), watchLearnt (she saw
// it and has got it), watchMissed (she was looking elsewhere) and watchGaveUp (you never did it). Merged into the main line sets
// (voiceLines.js, jessLines.js), so they're recorded with the rest. The girls call you "you", never he, she or they.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_WATCH_LINES = {
  watchOk: line(10, ['All right. I am watching. Go on.', 'Show me, then. I am looking.', 'Go ahead. I will pay attention.']),
  watchLearnt: line(10, ['Oh, I see how you did that. I think I can do it.', 'Right. That makes sense now. Thank you.', 'I watched properly. I have got it.']),
  watchMissed: line(10, ['Sorry, I was looking at something else. Could you do it again?', 'I missed it. My mind wandered. Once more?', 'I did not see that. Show me again.']),
  watchGaveUp: line(20, ['You did not do it. I will go and do something useful.', 'I cannot stand here all day. Another time.']),
};

export const JESS_WATCH_LINES = {
  watchOk: ['Go on then, show me. I am watching.', 'Ooh, a lesson. Go!', 'Eyes on you. Do your thing.'],
  watchLearnt: ['Ohhh. That is how it goes! I have got it.', 'Brilliant. I could do that now. Probably.', 'Right, I saw all of that. Easy.'],
  watchMissed: ['Wait, I was not looking! Do it again.', 'Sorry! Something shiny. Once more, please.', 'I missed it. That is not my fault. Again!'],
  watchGaveUp: ['You are not doing it. I am bored now.', 'Fine, never mind. I will watch the sheep instead.'],
};
