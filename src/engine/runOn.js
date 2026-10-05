// Overrun pops and run-on. Pure logic, no Three.js.
//
// Both come from an engine that's lean, worn or hot: unburnt fuel goes off in the pipe when the throttle's
// shut at speed (a pop, or a crackle on a two-stroke), and switched off it keeps firing on the heat in the
// chamber for a few beats.

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** How readily it pops on the overrun, 0 up: its own nature (popProne), leanness, wear and heat. */
export function popPropensity(e, p) {
  return Math.max(0, p.popProne + p.popLean * e.lean + p.popWear * e.wear + p.popHeat * clamp01(e.heat));
}

/** The chance it runs on when switched off while running: hot metal, wear and a lean mixture. 0..0.9. */
export function runOnChance(e, p) {
  const hot = clamp01((Math.max(e.soak, e.heat) - 0.5) / 0.5);
  return Math.min(0.9, p.runOnBase + p.runOnHot * hot + p.runOnWear * clamp01(e.wear) + p.runOnLean * clamp01(e.lean));
}
