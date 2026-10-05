// Heat. Pure logic, no Three.js.
//
// Apart from the warm-up (temperature, 0 cold to 1 warm), an engine can run on into being too hot. The
// air-cooled ones get there idling for ages on a sunny day, or crawling in mud with the throttle open, and
// start pinking and running rough; riding along at speed blows it away. The water-cooled one has a fan that
// cuts in and out and never gets that far. Separately, `soak` is how much heat the metal's holding after
// work, whatever the airflow: switched off it ticks as it cools, and a hot carburettor percolates, so a
// hot engine starts rich until the heat's gone.

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Fraction of full airflow for a ground speed (m/s). */
export function airflow(speed, p) {
  return clamp01(Math.abs(speed) / Math.max(0.1, p.airflowSpeed));
}

/** The heat it's heading for: the sun and its work, less what the air (and the fan) carries off. 0..1. */
export function heatTarget({ ambient, work, speed, fan }, p) {
  const scale = p.waterCooled ? p.heatWaterScale : 1;
  const load = (p.heatSun * clamp01(ambient) + p.heatWork * clamp01(work)) * scale;
  const cooling = p.heatAirCool * airflow(speed, p) + (fan ? p.fanCooling : 0);
  return clamp01(load - cooling);
}

/**
 * One step of running heat. state is { heat, fan }; the fan (water-cooled only) cuts in above fanOnAt and out
 * below fanOffAt. Off, the engine just sheds its heat.
 */
export function stepHeat(state, h, { running, ambient, work, speed }, p) {
  if (p.waterCooled && running) {
    if (state.heat > p.fanOnAt) state.fan = true;
    else if (state.heat < p.fanOffAt) state.fan = false;
  } else state.fan = false;
  const target = running ? heatTarget({ ambient, work, speed, fan: state.fan }, p) : 0;
  const seconds = target > state.heat ? p.heatRiseSeconds : p.heatFallSeconds;
  state.heat = clamp01(state.heat + ((target - state.heat) * h) / Math.max(1, seconds));
}

/** How badly it's pinking, 0..1 (an air-cooled engine only: the water-cooled one's heat never builds that far). */
export function pinkLevel(heat, p) {
  return clamp01((heat - p.pinkFrom) / Math.max(0.01, 1 - p.pinkFrom));
}

/** Where the dash gauge's red zone pushes to: poor lubrication, or this heat (shown weakly on the water-cooled). */
export function gaugeHeat(overheat, heat, p) {
  return Math.max(overheat, clamp01(heat) * (p.waterCooled ? p.heatGaugeWater : 1));
}

/** The heat in the metal after work: it follows what the engine's doing while it runs, and soaks away when it's off. */
export function stepSoak(soak, h, { running, work, heat }, p) {
  if (!running) return clamp01(soak - (soak * h) / Math.max(1, p.soakFallSeconds));
  const target = Math.max(p.soakIdle + (1 - p.soakIdle) * clamp01(work), clamp01(heat));
  const seconds = target > soak ? p.soakRiseSeconds : p.soakFallSeconds;
  return clamp01(soak + ((target - soak) * h) / Math.max(1, seconds));
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
