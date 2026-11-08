// Whether one person on the farm could see another: the straight line between their eyes, blocked by a hedge (but not through its
// gaps, shut gate or no: a gate is bars), by a building (but into the barn through its doorway), and by a vehicle, which the game asks
// the physics about (`blockedBy`). Pure: the game hands it the hedge lines (fields.js) and the buildings (detour.js).

import { segmentHits } from './detour.js';

/** Whether the segment a to b crosses a hedge line (any way it runs) anywhere that is not a gap. */
export function hedgeBlocks(hedges, a, b) {
  for (const h of hedges) {
    // Which side of the line each end is on (positive to the left of the way it runs).
    const sa = (a.x - h.x1) * h.dz - (a.z - h.z1) * h.dx;
    const sb = (b.x - h.x1) * h.dz - (b.z - h.z1) * h.dx;
    if (sa * sb > 0 || sa === sb) continue; // both on one side, or running along it
    const t = sa / (sa - sb);
    const s = (a.x + (b.x - a.x) * t - h.x1) * h.dx + (a.z + (b.z - a.z) * t - h.z1) * h.dz;
    if (s < 0 || s > h.length) continue;
    if (h.gaps.some((g) => Math.abs(s - g.at) < g.half)) continue;
    return true;
  }
  return false;
}

const within = (r, p) => p.x > r.minX && p.x < r.maxX && p.z > r.minZ && p.z < r.maxZ;

/** Whether a building's walls are between a and b. The barn is open through its doorway (in the +x wall, centred on door.z). */
export function buildingBlocks(buildings, a, b) {
  for (const r of buildings) {
    const aIn = within(r, a);
    const bIn = within(r, b);
    if (aIn && bIn) continue; // both inside: they can see each other
    if (!aIn && !bIn) {
      if (segmentHits(r, a, b)) return true;
      continue;
    }
    // One inside: the line leaves through a wall, and sees out only if that is the doorway.
    const [inside, out] = aIn ? [a, b] : [b, a];
    const d = r.door;
    if (!d || out.x <= r.maxX) return true;
    const t = (r.maxX - inside.x) / (out.x - inside.x);
    const z = inside.z + (out.z - inside.z) * t;
    if (Math.abs(z - d.z) >= d.halfWidth) return true;
  }
  return false;
}

/**
 * Could `from` see `to`? Both are { x, y, z } eyes. `world`: { hedges, buildings, blockedBy(from, to) }, the last optional (vehicles).
 */
export function canSee(from, to, world) {
  if (hedgeBlocks(world.hedges ?? [], from, to)) return false;
  if (buildingBlocks(world.buildings ?? [], from, to)) return false;
  return !world.blockedBy?.(from, to);
}
