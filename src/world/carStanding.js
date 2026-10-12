// The girls' cars' hard-standing (layout.carStanding): a concrete slab by the barn where Amy's Fiesta and Jess's Corsa park. Pure, so the
// ground, the grass, the grip and the spawn checks all ask the same question of it.

/** How far (x, z) is outside the slab's rectangle, metres; 0 or less on it (negative inside, by the distance to its nearest edge). */
export function standingDistance(st, x, z) {
  const dx = Math.abs(x - st.x) - st.halfX;
  const dz = Math.abs(z - st.z) - st.halfZ;
  return dx > 0 || dz > 0 ? Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) : Math.max(dx, dz);
}

/** 0..1 how much of (x, z) is concrete: 1 on the slab, 0 off it, with a soft edge a hand's width across. */
export function onStanding(st, x, z, edge = 0.15) {
  if (!st) return 0;
  const d = standingDistance(st, x, z);
  return d <= -edge ? 1 : d >= edge ? 0 : (edge - d) / (2 * edge);
}
