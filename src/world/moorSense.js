// What a girl on the back can see coming on the Moor (#821): she is on the open common, there is a wet flush ahead, there are sheep ahead on the common or the lane.
// Pure: the moor (heights.moor) and the flocks in, answers out. `companionVoice.js` asks it from the view the game gives each girl.

/** Metres ahead along the heading that a flush is looked for, and how far off a sheep is worth a word. */
export const FLUSH_LOOK = [5, 9, 13];
export const SHEEP_LOOK = 18;

export function createMoorSense(moor, getFlocks = () => []) {
  const heading = (vx, vz) => {
    const s = Math.hypot(vx, vz);
    return s > 1 ? [vx / s, vz / s] : null;
  };
  return {
    /** Whether (x, z) is on the open common, west of Back Lane. */
    common: (x, z) => moor.onCommon(x, z),
    /** Whether there is a bog ahead when going (vx, vz) from (x, z), and the quad is not already in it. */
    wetAhead(x, z, vx, vz) {
      const h = heading(vx, vz);
      if (!h || moor.bogAt(x, z) > 0.3) return false;
      return FLUSH_LOOK.some((d) => moor.bogAt(x + h[0] * d, z + h[1] * d) > 0.4);
    },
    /** Whether any of the Moor's flock is within `SHEEP_LOOK` m and in front, going (vx, vz) from (x, z). */
    sheepAhead(x, z, vx, vz) {
      const h = heading(vx, vz);
      if (!h) return false;
      for (const f of getFlocks()) {
        if (!f.moor) continue;
        for (const s of f.flock.sheep) {
          const dx = s.x - x;
          const dz = s.z - z;
          const d = Math.hypot(dx, dz);
          if (d < SHEEP_LOOK && d > 0.1 && (dx * h[0] + dz * h[1]) / d > 0.5) return true;
        }
      }
      return false;
    },
    /** The flocks it looks through: the game's `flocks`, set each time it is asked for. */
    set flocks(list) {
      getFlocks = () => list;
    },
  };
}
