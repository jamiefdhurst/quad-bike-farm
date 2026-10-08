// The cattle grid in the farm road's gateway (layout.road.grid): where it is, which bars a wheel has rolled over and how hard it rattles
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
  const x = layout.fieldHalf;
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
 * The rattle of crossing the grid at `speed` m/s with `share` (0..1) of the wheels on it: knocks a second and their size in pulse
 * kicks. A wheel meets a bar every pitch/speed seconds, but the springs can't tell more than `maxRate` of them apart, so the rate
 * stops there and the size carries on with speed.
 */
export function gridRumble(speed, share, pitch, p) {
  const v = Math.abs(speed);
  if (share <= 0 || v < 0.3) return { rate: 0, size: 0 };
  return { rate: Math.min(p.gridMaxRate, v / pitch), size: p.gridGain * share * Math.min(1.5, v / p.gridFullSpeed) };
}
