// Diagnosing by ear: what a girl stood by a running quad reckons is wrong with it. The truth comes from
// the engine's real state; her guess is right as often as her `diagnoseAccuracy` (Amy careful, Jess sure
// of herself). Pure logic; the lines are in diagnosisLines.js and the argument in banterLines.js.

/** What can be heard: 'fine' for none of them. */
export const CONDITIONS = ['cold', 'rich', 'fouled', 'worn'];

/**
 * What's actually wrong with this engine, the most obvious thing, or 'fine'.
 * Each condition scores 0..1 against its own threshold, so a mild one doesn't hide a bad one.
 */
export function engineCondition(engine, p) {
  const scores = {
    cold: (p.diagnoseColdBelow - engine.temperature) / p.diagnoseColdBelow,
    rich: (engine.rich - p.diagnoseRichFrom) / (1 - p.diagnoseRichFrom),
    fouled: (engine.fouling - p.diagnoseFoulFrom) / (1 - p.diagnoseFoulFrom),
    worn: (engine.wear - p.diagnoseWearFrom) / (1 - p.diagnoseWearFrom),
  };
  let best = 'fine';
  let top = 0;
  for (const kind of CONDITIONS) {
    if (scores[kind] > top) {
      top = scores[kind];
      best = kind;
    }
  }
  return best;
}

/** Her guess: the truth with probability `accuracy`, otherwise something else (which may be "sounds fine"). */
export function guessCondition(truth, accuracy, random = Math.random) {
  if (random() < accuracy) return truth;
  const wrong = [...CONDITIONS, 'fine'].filter((c) => c !== truth);
  return wrong[Math.floor(random() * wrong.length)];
}
