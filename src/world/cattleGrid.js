// The cattle grid in the farm road's gateway, or the drive's at the lane (layout.road.grid): where it is, which bars a wheel has rolled over and how hard it rattles
// the vehicle. Pure logic, no Three.js; the pit and its bars are built in props.js, the shake is in vibration/vibrationModel.js and the
// sound in audio/rideAudio.js.

/**
 * The grid as a rectangle on the ground, or null if the layout has none. It sits across the road in the grass field's east hedge, the
 * bars lying across the road (along z) with `pitch` metres from one to the next, and `margin` of pit either side of the tarmac.
 */
export function createCattleGrid(layout) {
  const road = layout.road;
  const g = road?.grid;
  if (!g) return null;
  const x = g.x ?? layout.fieldHalf; // the drive says where its own is; today's fills the grass field's east gateway
  const half = road.halfWidth + g.margin;
  const grid = { minX: x - g.length / 2, maxX: x + g.length / 2, minZ: road.z - half, maxZ: road.z + half, pitch: g.pitch, x, z: road.z, half };
  /** Whether (x, z) is over the bars. */
  grid.onGrid = (px, pz) => px >= grid.minX && px <= grid.maxX && pz >= grid.minZ && pz <= grid.maxZ;
  /** Whole bars a wheel has crossed going from x0 to x1 (z being over the grid), 0 if it isn't on it. */
  grid.barsBetween = (x0, x1, pz) => {
    if (pz < grid.minZ || pz > grid.maxZ) return 0;
    const a = Math.min(Math.max(x0, grid.minX), grid.maxX);
    const b = Math.min(Math.max(x1, grid.minX), grid.maxX);
    return Math.abs(Math.floor((b - grid.minX) / grid.pitch) - Math.floor((a - grid.minX) / grid.pitch));
  };
  return grid;
}

/**
 * A grid across a lane that runs at an angle (the Moor's two on Back Lane, #821): the same questions as `createCattleGrid`'s, asked along the lane's
 * direction (`tx`, `tz`, a unit vector) from its middle (`x`, `z`), `length` of bars along it and `width` across it. `barsAlong` is `barsBetween` for a wheel
 * going from one point to another.
 */
export function createLaneGrid({ id, x, z, tx, tz, length, width, pitch }) {
  const local = (px, pz) => ({ u: (px - x) * tx + (pz - z) * tz, v: -(px - x) * tz + (pz - z) * tx });
  const grid = { id, x, z, tx, tz, length, width, half: width / 2, pitch };
  /** Whether (px, pz) is over the bars. */
  grid.onGrid = (px, pz) => {
    const { u, v } = local(px, pz);
    return Math.abs(u) <= length / 2 && Math.abs(v) <= width / 2;
  };
  /** Whole bars a wheel has crossed going from (ax, az) to (bx, bz), 0 if it isn't across the lane on it. */
  grid.barsAlong = (ax, az, bx, bz) => {
    const a = local(ax, az);
    const b = local(bx, bz);
    if (Math.abs(a.v) > width / 2 || Math.abs(b.v) > width / 2) return 0;
    const bar = (u) => Math.floor((Math.min(Math.max(u, -length / 2), length / 2) + length / 2) / pitch);
    return Math.abs(bar(b.u) - bar(a.u));
  };
  return grid;
}

/** The grid nearest (x, z) of `grids` that is within `reach` metres of its middle, or null. */
export function gridNear(grids, x, z, reach = 8) {
  let best = null;
  let bestD = reach;
  for (const g of grids) {
    const d = Math.hypot(x - g.x, z - g.z);
    if (d < bestD) [best, bestD] = [g, d];
  }
  return best;
}

/**
 * The rattle of crossing the grid at `speed` m/s with `share` (0..1) of the wheels on it: knocks a second and their size in pulse
 * kicks. A wheel meets a bar every pitch/speed seconds, but the springs can't tell more than `maxRate` of them apart, so the rate
 * stops there and the size carries on with speed.
 */
export function gridRumble(speed, share, pitch, p) {
  const v = Math.abs(speed);
  if (share <= 0 || v < 0.3) return { rate: 0, size: 0 };
  return { rate: Math.min(p.gridMaxRate, v / pitch), size: p.gridGain * share * Math.min(1.5, v / p.gridFullSpeed) };
}
