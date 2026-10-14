// A burnt leg on the exhaust: swinging a leg over a quad's hot silencer. The quads' pipes run down the right (-x), and she
// normally gets off on the left; Jess sometimes swings off the wrong side without looking, and catches her calf if the pipe is
// hot. Amy always gets off the other side. Pure logic: the companion says what the quad is like, this says which side and
// whether it burns. Tunables live in her companion params (companionParams.js).

/** Which side (+1 left, -1 right) the quad's exhaust is on, or 0 for one she can't catch her leg on (a cab, a tractor, a car). */
export function exhaustSideOf(quad) {
  if (!quad || quad.tractor || quad.landRover || quad.utv || quad.car || quad.driverStand) return 0;
  return quad.exhaustSide ?? -1;
}

/** How hot the pipe is, 0..1: the engine's heat or the heat held in its metal, but only while it is running or has just stopped. */
export function pipeHeat(engine) {
  if (!engine) return 0;
  return Math.max(0, Math.min(1, Math.max(engine.heat ?? 0, engine.soak ?? 0)));
}

/** The side she gets off: `side` (already chosen) unless she is the sort who swings off the exhaust side. */
export function dismountSideFor({ side, exhaustSide, p, random = Math.random }) {
  if (!exhaustSide || side === exhaustSide) return side;
  return random() < p.exhaustSideChance ? exhaustSide : side;
}

/** Whether her leg catches the pipe as she gets off on `side`. A forced one always does. */
export function burns({ side, exhaustSide, heat, p, forced = false, random = Math.random }) {
  if (!exhaustSide || side !== exhaustSide) return false;
  if (forced) return true;
  if (heat < p.burnFrom) return false;
  return random() < p.burnChance * Math.min(1, (heat - p.burnFrom) / Math.max(0.01, 1 - p.burnFrom) + 0.4);
}
