// What the girls say about the electric fence on the hill pasture (world/electricFence.js): a yelp when it gets her, and a word when it gets
// someone else. Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_FENCE_LINES = {
  fenceZap: line(10, ['Ow! That is live!', 'It bit me! It actually bit me.', 'Ow. Who put that there?', 'That was the fence. I knew it was the fence.']),
  fenceZapSeen: line(20, ['It is an electric fence. It has a sign on it.', 'Did you not see the sign? There is a lightning bolt on it.', 'Are you all right? It is live, you know.']),
};

export const JESS_FENCE_LINES = {
  fenceZap: ['Ow! Ow! Ow!', 'My teeth buzzed!', 'That is not funny. Ha. It is a bit funny.', 'It got me right in the elbow!'],
  fenceZapSeen: ['Ha! You touched it!', 'Did you feel that? I saw your face.', 'You went right into it. Brilliant.'],
};
