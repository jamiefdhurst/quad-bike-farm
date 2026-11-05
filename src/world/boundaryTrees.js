// Where the farm's boundary tree line (world/props.js, buildTrees) may not stand: the wood and the gravel pit's field each have trees of their own,
// and the line runs along z = -88 to -101, straight across the pit's lead-in road.

/**
 * Whether a boundary tree at (x, z) would stand in the wood or in the gravel pit's field (a little beyond its hedges).
 * `layout` is the farm's layout, with or without a wood or a quarry.
 */
export function boundaryTreeBlocked(layout, x, z) {
  const wood = layout.woods;
  if (wood && x > wood.minX - 3 && x < wood.maxX + 3 && z < wood.maxZ + 0.2 && z > wood.minZ - 3) return true;
  const pit = layout.quarry;
  return !!pit && x > pit.minX - 3 && x < pit.maxX + 3 && z > pit.minZ - 3 && z < pit.maxZ + 3;
}
