// What the girls say when you change a two-stroke's jet from the toolbox: jetLean (you've gone too lean for the
// day, and it will run hot and may seize) and jetRight (you've got it spot on). Amy knows the jetting; Jess is
// just pleased by anything quick. Merged into the main line sets (voiceLines.js, jessLines.js), so they're
// recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_JET_LINES = {
  jetLean: line(60, ["That's too lean for today. It'll run hot and nip up.", 'You want a bigger jet than that when it is this cold. It will seize.', "It's far too lean for the weather. Put a bigger jet in.", "I wouldn't run it like that today. It'll melt a piston."]),
  jetRight: line(60, ["That's about right for today. It should run really cleanly.", 'Now that is the right jet for the weather. Lovely.', 'Spot on. It should pull properly now.']),
};

export const JESS_JET_LINES = {
  jetLean: ['Lean is fast. Lean is very fast.', 'Ha! Amy says it will seize. Nothing ever seizes.', 'It will be fine. Probably.'],
  jetRight: ['Ooh, is it faster now? It feels faster.', 'You did it! Go on, take it round.', 'It sounds so crisp. I love it.'],
};
