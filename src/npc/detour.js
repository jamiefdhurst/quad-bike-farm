// Walking round a building. The girls steer by ray probes ahead of them, which cannot see round a whole barn: with the barn between her
// and where she is going she tries one way, then the other, and shuffles about at its back wall. So a walk that would cross a building's
// footprint is first aimed at one of its corners (and a walk into or out of one that has a doorway goes through the doorway). Pure and tested.
// A building is { minX, maxX, minZ, maxZ, door?: { x, z, halfWidth } } where the door is in the +x wall, centred on z, `x` the wall's outer face.

export const DEFAULT_DETOUR_PARAMS = {
  body: 0.6, // metres from a wall at which the straight way counts as blocked
  corner: 1.5, // metres out from the walls the corners she is aimed at sit
  doorOut: 1.8, // metres in front of the doorway the point she lines up on sits
  doorIn: 1.2, // metres inside the doorway, for the way out from the back
  reach: 1.2, // metres from a corner at which she counts as having got there and goes for the next
};

export const DETOUR_PARAM_RANGES = {
  body: [0.1, 2, 0.1],
  corner: [0.5, 4, 0.1],
  doorOut: [0.5, 5, 0.1],
  doorIn: [0.5, 3, 0.1],
  reach: [0.3, 3, 0.1],
};

const grown = (b, m) => ({ minX: b.minX - m, maxX: b.maxX + m, minZ: b.minZ - m, maxZ: b.maxZ + m });
const inside = (r, p) => p.x > r.minX && p.x < r.maxX && p.z > r.minZ && p.z < r.maxZ;

/** Whether the segment a to b passes through the rectangle r (the slab method). */
export function segmentHits(r, a, b) {
  let t0 = 0;
  let t1 = 1;
  for (const [lo, hi, from, to] of [[r.minX, r.maxX, a.x, b.x], [r.minZ, r.maxZ, a.z, b.z]]) {
    const d = to - from;
    if (Math.abs(d) < 1e-9) {
      if (from <= lo || from >= hi) return false;
      continue;
    }
    let near = (lo - from) / d;
    let far = (hi - from) / d;
    if (near > far) [near, far] = [far, near];
    t0 = Math.max(t0, near);
    t1 = Math.min(t1, far);
    if (t0 >= t1) return false;
  }
  return true;
}

/** The first point to head for to get from `from` to `to` round the buildings, or null if the straight way is fine. `prefer` is the corner chosen last time (kept, so she doesn't change her mind). */
export function detourVia(from, to, buildings, P = DEFAULT_DETOUR_PARAMS, prefer = null) {
  for (const b of buildings) {
    const wall = grown(b, P.body);
    const fromIn = inside(b, from);
    const toIn = inside(grown(b, 0.2), to);
    if (b.door && (fromIn || toIn)) {
      const door = b.door;
      const inCone = Math.abs(from.z - door.z) < door.halfWidth && from.x > door.x - P.doorIn - 0.4;
      if (fromIn && toIn) continue; // the way about inside is her own (the bales, the loft)
      if (fromIn) return inCone && from.x < door.x + 0.3 ? { x: door.x + P.doorOut, z: door.z } : inCone ? null : { x: door.x - P.doorIn, z: door.z };
      // On the way in: line up on the doorway first, going round the building to get there if she is at the back.
      if (from.x > door.x - 0.3 && Math.abs(from.z - door.z) < door.halfWidth + 0.6) return null;
      const lineUp = { x: door.x + P.doorOut, z: door.z };
      return detourVia(from, lineUp, [b], P, prefer) ?? lineUp;
    }
    if (fromIn || toIn || inside(wall, from)) continue; // hard against a wall already: her own steering's
    // A spot hard against a wall is reached round the building if the way there crosses it, not for the sake of the margin.
    if (!segmentHits(inside(wall, to) ? b : wall, from, to)) continue;
    const c = grown(b, P.corner);
    const corners = [{ x: c.minX, z: c.minZ }, { x: c.maxX, z: c.minZ }, { x: c.maxX, z: c.maxZ }, { x: c.minX, z: c.maxZ }];
    // Not the corner she is at (she has passed it: aiming at her own feet would stop her), nor one the wall is in the way of.
    const clear = corners.filter((p) => Math.hypot(p.x - from.x, p.z - from.z) > P.reach && !segmentHits(wall, from, p));
    const pool = clear.length ? clear : corners;
    const kept = prefer && pool.find((p) => p.x === prefer.x && p.z === prefer.z);
    if (kept) return kept;
    let best = pool[0];
    let bestLen = Infinity;
    for (const p of pool) {
      const len = Math.hypot(p.x - from.x, p.z - from.z) + Math.hypot(to.x - p.x, to.z - p.z);
      if (len < bestLen) [best, bestLen] = [p, len];
    }
    return best;
  }
  return null;
}
