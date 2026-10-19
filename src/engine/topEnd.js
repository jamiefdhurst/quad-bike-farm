// The top-end rebuild. A two-stroke that has scuffed or seized (no oil, too lean a jet) is not put right at the toolbox any more: the
// barrel comes off at the bench (the `topEnd` job in workshop/benchJobs.js), you look at the scoring, fit a new piston and rings and
// put it back together, and then it wants running in. Pure logic, no Three.js.

import { fitNewPiston } from './pistonSlap.js';
import { startRunningIn } from './runningIn.js';

/** Is there anything to rebuild: a two-stroke that is seized or has scuffed. */
export function canRebuildTopEnd(engine, P) {
  return engine.params.strokes === 2 && (engine.seized || engine.scuff >= P.topEndScuffFrom);
}

/** What the barrel and piston look like when you pull them, from how far it got: { kind, look }. */
export function readScoring(engine, P) {
  if (engine.seized) return { kind: 'seized', look: 'welded to the bore with aluminium, deep scores right down the barrel' };
  if (engine.scuff >= P.topEndDeepScuff) return { kind: 'deep', look: 'deeply scored down one side, the rings stuck in their grooves' };
  return { kind: 'light', look: 'lightly scuffed, with a few bright marks on the skirt' };
}

/**
 * Puts a new piston and rings in. A good job clears the scuffing and the seizure, takes `topEndWearRemoved` off the wear (a seizure
 * first costs `topEndSeizeWear`, less than the strip down's, since the damaged parts are replaced) and starts the running in. A botched
 * one (head nuts uneven) leaves `topEndBotchedScuff` of scuffing, so it nips up again sooner. Returns whether it had really seized.
 */
export function rebuildTopEnd(engine, botched, P) {
  const seized = engine.seized;
  if (seized) engine.wear = Math.min(engine.params.wearMax, engine.wear + P.topEndSeizeWear);
  engine.wear = Math.max(0, engine.wear - P.topEndWearRemoved);
  engine.seized = false;
  fitNewPiston(engine);
  engine.scuff = botched ? P.topEndBotchedScuff : 0;
  engine.overheat = 0;
  startRunningIn(engine);
  return seized;
}
