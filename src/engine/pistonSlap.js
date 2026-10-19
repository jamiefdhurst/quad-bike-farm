// Piston slap. A worn bore lets the piston rock and clack against the cylinder wall while the metal is cold; as it warms and the piston
// swells the clack goes. It is heard, not shown: the engine emits 'slap' events and the audio plays a hollow clack for each. How loose
// the piston is (`pistonWear`) builds up as the engine wears, but a service doesn't touch it: only a new piston and rings do (the top-end
// rebuild, the big-bore kit). Pure logic.

export const DEFAULT_SLAP_PARAMS = {
  slapFrom: 0.3, // piston wear (0..1) at which a cold engine starts to knock
  slapFull: 0.8, // and knocks as loud as it gets at this
  slapWarmBelow: 0.7, // engine temperature (0 cold, 1 warm) over which the knock has gone: the piston has swelled to fit
  slapRate: 7, // clacks a second at full slap, at idle
  slapRevsQuiet: 0.6, // how much quieter it is at full revs than idling or pulling away (it is lost in the rest)
  slapRoughness: 0.04, // roughness when it knocks as loud as it gets
  slapNewPistonWear: 0, // piston wear a new piston and rings leave
};

export const SLAP_RANGES = {
  slapFrom: [0, 1, 0.01],
  slapFull: [0.05, 1, 0.01],
  slapWarmBelow: [0.1, 1, 0.05],
  slapRate: [0, 30, 0.5],
  slapRevsQuiet: [0, 1, 0.05],
  slapRoughness: [0, 0.3, 0.005],
  slapNewPistonWear: [0, 0.5, 0.01],
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** How loud the knock is, 0..1: the piston's looseness, less as the engine warms. Nothing from a stopped engine. */
export function slapLevel(pistonWear, temperature, p) {
  const loose = clamp01((pistonWear - p.slapFrom) / Math.max(0.01, p.slapFull - p.slapFrom));
  const cold = clamp01(1 - temperature / Math.max(0.01, p.slapWarmBelow));
  return loose * cold;
}

/** How much of it carries: all of it idling or pulling away under load, less with the revs up and the throttle off. */
export function slapCarry(rpmNorm, load, p) {
  const pulling = clamp01(load);
  const idling = 1 - clamp01(rpmNorm);
  return 1 - p.slapRevsQuiet * (1 - Math.max(idling, pulling));
}

/** What a piston that has run `dWear` of wear this step has added to its looseness. Pistons only loosen while it runs. */
export function loosen(pistonWear, dWear, wearMax) {
  return Math.min(wearMax, pistonWear + Math.max(0, dWear));
}

/** A new piston and rings (the top-end rebuild, the big-bore kit): the bore is tight again. */
export function fitNewPiston(engine) {
  engine.pistonWear = engine.params.slapNewPistonWear ?? 0;
}
