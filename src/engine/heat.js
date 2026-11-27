// Heat. Pure logic, no Three.js.
//
// Apart from the warm-up (temperature, 0 cold to 1 warm), an engine can run on into being too hot. The
// air-cooled ones get there worked hard standing still or crawling in mud, sooner in the sun, and pink and run rough
// while they are made to work (not idling); riding along at speed blows it away. The water-cooled one has a fan that
// cuts in and out and copes idling and riding, though not revved hard standing still (thermal.js). All of it comes from the engine's real
// temperatures: pinking from the metal's °C, the steam from the 0..1 heat worked out from them, and `soak`, the heat the metal holds after
// work (thermal.js `soakLevel`): switched off it ticks as it cools, and a hot carburettor percolates, so a hot engine starts rich until the heat's gone.

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Fraction of full airflow for a ground speed (m/s). */
export function airflow(speed, p) {
  return clamp01(Math.abs(speed) / Math.max(0.1, p.airflowSpeed));
}

/** How hot the metal is for pinking, 0..1, from its °C: none below `pinkFromC`, fully `pinkSpanC` over it (an air-cooled engine only). */
export function pinkHeat(metalC, p) {
  return clamp01((metalC - p.pinkFromC) / Math.max(1, p.pinkSpanC));
}

/** 0..1 how hard it's asked to work, for pinking: pulling under load counts fully, free revving for `pinkRevShare` of it, idling (and revs up to `pinkRevFrom`) for nothing. */
export function pinkWork({ rpmNorm = 0, load = 0 }, p) {
  const revs = clamp01((rpmNorm - p.pinkRevFrom) / Math.max(0.01, 1 - p.pinkRevFrom));
  return clamp01(Math.max(clamp01(load), p.pinkRevShare * revs));
}

/**
 * How badly it's pinking, 0..1: the mixture detonating while a hot engine is made to work, so the metal's heat times how hard it is
 * working. A hot engine idling doesn't pink; opening the throttle on it does. The power loss and roughness of a hot engine follow this
 * (an engine that won't pink still runs hot and weak); the rattles are this times the engine's `pinkProne`.
 */
export function pinkLevel(metalC, work, p) {
  return pinkHeat(metalC, p) * clamp01(work);
}

/**
 * 0..1 how much steam a hot engine gives off. Two causes: it's cooking (running over `steamFrom` heat), which is a thin wisp, and
 * rain falling on (or wet ground splashing) a hot engine out in the open: the more rain and the hotter the metal (the greater of its
 * running heat and what it's soaked up), the more it steams, running or just switched off. Under cover there's no rain to boil off.
 */
export function hotSteam({ running, heat, soak, rain = 0, wet = 0, covered = false }, p) {
  const cooking = running ? clamp01((heat - p.steamFrom) / Math.max(0.01, 1 - p.steamFrom)) * p.steamCooking : 0;
  const wetness = covered ? 0 : Math.max(clamp01(rain), clamp01(wet) * p.steamWetGround);
  const hot = clamp01((Math.max(clamp01(heat), clamp01(soak)) - p.steamWetFrom) / Math.max(0.01, 1 - p.steamWetFrom));
  return clamp01(Math.max(cooking, wetness * hot * p.steamWet));
}

/**
 * 0..1 how much a cold exhaust condenses: the water in the exhaust gas turns to white vapour and drips from the tip while the engine
 * is cold and the air is cold. It needs both, so a cold engine on a warm afternoon shows nothing, and a warm one never does.
 */
export function condensation({ running, temperature, dayTemp }, p) {
  if (!running) return 0;
  const air = clamp01((p.condenseAirBelow - dayTemp) / Math.max(0.5, p.condenseAirBelow - p.condenseAirFull));
  const cold = clamp01((p.condenseWarmAt - temperature) / Math.max(0.05, p.condenseWarmAt));
  return air * cold;
}

/** Ticks a second from the cooling metal of an engine that's off: none when it's only warm, more the hotter it was. */
export function coolTickRate(soak, p) {
  return p.coolTickRate * clamp01((soak - p.tickFrom) / Math.max(0.01, 1 - p.tickFrom));
}

/** How much richer a hot carburettor makes it start (fuel boiling in the float bowl), eased off by holding the throttle open. */
export function hotStartRich(soak, throttle, p) {
  const k = clamp01((soak - p.hotStartFrom) / Math.max(0.01, 1 - p.hotStartFrom));
  return p.hotStartRich * k * (1 - p.hotStartThrottleRelief * clamp01(throttle));
}
