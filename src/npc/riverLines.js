// What the girls say about the river: riverNear (you have come down to the marked crossing) and riverStall (the deep water has drowned your
// engine). Said by whoever is near and free (npc/riverWatch.js, game.js updateRiverWatch). Merged into the main line sets (voiceLines.js,
// jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_RIVER_LINES = {
  riverNear: line(240, ['Keep between the white posts. Anywhere else is far too deep.', 'That is the crossing, between the posts. Stay on the gravel.', 'It is only shallow between the posts. Do not wander off the line.']),
  riverStall: line(60, ['That is exactly what the posts were for.', 'You went off the line. Wait for it to drain.', 'It is deep outside the posts. I did say.']),
};

export const JESS_RIVER_LINES = {
  riverNear: ["Between the posts, or it's a swim. I'm hoping for a swim.", "Ooh, a proper river. Go on, stay between the posts. Or don't.", "Look at the size of it! Posts mark the shallow bit. Probably."],
  riverStall: ['You drowned it! In the deep bit! Brilliant.', "Oh, you've gone and done it. I did say to stay between the posts. Quietly.", "It's gurgling. The quad is gurgling. That is so good."],
};
