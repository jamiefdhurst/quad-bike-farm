// The big-bore kit for the yellow. Pure logic, no Three.js.
//
// A bigger barrel and piston, fitted at the bench (the `bore` job in workshop/benchJobs.js). It pulls harder,
// makes more heat doing it, wears the engine faster, and wants a richer jet than the weather alone does
// (jetting.js). A kit nipped up badly gives less of the power but all of the wear: `fit` is how well it went.

import { startRunningIn } from './runningIn.js';

/** Whether this engine has a kit made for it, and none fitted yet. */
export function canFitBore(engine) {
  return !!engine.params.boreKit && !engine.bore;
}

/** Fits the kit: `fit` is 1 for a good job, less for a botched one. */
export function fitBore(engine, fit, P) {
  engine.bore = 1;
  engine.boreFit = fit;
  engine.wear = Math.max(0, engine.wear - P.boreWearRemoved); // a new piston and rings: the old wear goes with them
  startRunningIn(engine); // and a new piston wants running in
}

/** The multiplier on power: nothing without the kit, up to `borePower` more with a good fit. */
export function borePowerFactor(bore, fit, p) {
  return 1 + p.borePower * bore * fit;
}

/** The multiplier on how fast the engine wears. */
export function boreWearFactor(bore, p) {
  return 1 + p.boreWear * bore;
}
