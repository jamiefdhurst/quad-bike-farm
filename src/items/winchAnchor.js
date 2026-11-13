// What the green's winch can be hooked on besides a quad: a tree (its trunk is a vertical cylinder), or a heavy vehicle that stays put while
// the green pulls itself up to it. Pure, so it can be tested without the game.

const TRUNK_TOP = 4; // metres above the ground a trunk is hookable up to
const HOOK_HEIGHT = 0.6; // metres above the ground the hook sits on a trunk

/** A vehicle the winch never drags: the tractor, the cars, the Tor, the Crag and the UTV. The green pulls itself to them instead. */
export function isHeavy(spec) {
  return !!(spec && (spec.tractor || spec.landRover || spec.car || spec.utv));
}

/**
 * The nearest trunk the look ray hits within `reach` metres, or null. `anchors` are `{ x, y, z, r }` (y the ground there).
 * The ray is `origin` + t * `dir` (unit), taken in plan with the trunk a vertical cylinder from its foot to TRUNK_TOP.
 */
export function pickTree(anchors, origin, dir, reach = 6) {
  let best = null;
  let bestT = reach;
  const flat = Math.hypot(dir.x, dir.z);
  if (flat < 1e-6) return null;
  for (const a of anchors) {
    // Closest approach of the ray to the trunk's axis in plan.
    const dx = a.x - origin.x;
    const dz = a.z - origin.z;
    const along = (dx * dir.x + dz * dir.z) / (flat * flat);
    if (along <= 0) continue;
    const px = origin.x + dir.x * along - a.x;
    const pz = origin.z + dir.z * along - a.z;
    const miss = Math.hypot(px, pz);
    const slop = a.r + 0.25; // a forgiving trunk: you are aiming at it by eye
    if (miss > slop) continue;
    const y = origin.y + dir.y * along;
    if (y < a.y - 0.3 || y > a.y + TRUNK_TOP) continue;
    if (along > bestT) continue;
    bestT = along;
    best = a;
  }
  return best;
}

/** Where the hook goes on a trunk: the side facing `from`, a little above the ground. */
export function trunkHookPoint(anchor, from, out = { x: 0, y: 0, z: 0 }) {
  const dx = from.x - anchor.x;
  const dz = from.z - anchor.z;
  const len = Math.hypot(dx, dz) || 1;
  out.x = anchor.x + (dx / len) * anchor.r;
  out.y = anchor.y + HOOK_HEIGHT;
  out.z = anchor.z + (dz / len) * anchor.r;
  return out;
}

/** How hard the cable is working, 0 (just tight) to 1 (at its limit). */
export function cableLoad(pull, maxPull) {
  return maxPull > 0 ? Math.min(1, Math.max(0, pull / maxPull)) : 0;
}

/** Seconds until the next creak while winding under load: quicker the harder it works. Null when it should be quiet. */
export function creakGap(load, reeling) {
  if (!reeling || load < 0.15) return null;
  return 1.6 - 1.1 * load;
}
