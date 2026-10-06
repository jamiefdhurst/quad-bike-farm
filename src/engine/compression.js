// A diesel, as the tractor has: no mixture to get right and no choke. Cold, it won't light until the glow plugs have heated
// the combustion chamber; warm, it starts without them. The key only switches the plugs and the dash on, and leaves a running
// engine running: it stops with the pull-out knob. Pure logic.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** How hot the glow plugs have to be before it will start: nothing when the engine is warm, everything when it's stone cold. */
export function glowNeeded(temperature, p) {
  return clamp01(1 - temperature / Math.max(0.01, p.glowWarmAbove));
}

/** The plugs' heat after dt seconds: climbing while the key is on and it isn't running, falling away otherwise. */
export function stepGlow(glow, dt, heating, p) {
  return clamp01(glow + (heating ? dt / Math.max(0.1, p.glowSeconds) : -dt / Math.max(0.1, p.glowCoolSeconds)));
}

/** The dash light: the plugs are hot enough for this engine's temperature. */
export function glowReady(glow, temperature, p) {
  return glow >= glowNeeded(temperature, p) - 1e-6;
}

/**
 * How much of its chance of catching it keeps while cranking: all of it once the plugs are ready, and only a sliver (the
 * `glowColdCatch` floor) cranked cold on unheated plugs, rising as they heat.
 */
export function compressionCatchFactor(glow, temperature, p) {
  const need = glowNeeded(temperature, p);
  if (glow >= need - 1e-6) return 1;
  const heat = glow / need;
  return p.glowColdCatch + (1 - p.glowColdCatch) * heat * heat;
}
