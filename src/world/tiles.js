// Scattered things (grass, stubble, tussocks, hedges, trees) split into square tiles of ground, so the renderer can leave out the tiles
// out of view, and small ground cover can stop at a draw distance. One batch spanning the farm is never out of view, so every stalk on the
// farm was drawn every frame, behind you or half a kilometre off. See docs/decisions/world.md, "Drawing less (frame time)".

/**
 * Groups instances into tiles by where they stand. `positions` is a list of { x, z }. Returns the tiles that have anything in them, each
 * with the bounds of what is in it (not of the tile's square) and the indices into `positions`, in their original order.
 */
export function tileInstances(positions, size) {
  const tiles = new Map();
  positions.forEach(({ x, z }, i) => {
    const key = `${Math.floor(x / size)},${Math.floor(z / size)}`;
    let t = tiles.get(key);
    if (!t) tiles.set(key, (t = { key, minX: x, maxX: x, minZ: z, maxZ: z, indices: [] }));
    t.minX = Math.min(t.minX, x);
    t.maxX = Math.max(t.maxX, x);
    t.minZ = Math.min(t.minZ, z);
    t.maxZ = Math.max(t.maxZ, z);
    t.indices.push(i);
  });
  return [...tiles.values()];
}

/** How far (x, z) is across the ground from the nearest edge of a tile's bounds: 0 inside it. */
export function distanceToTile(tile, x, z) {
  const dx = Math.max(tile.minX - x, 0, x - tile.maxX);
  const dz = Math.max(tile.minZ - z, 0, z - tile.maxZ);
  return Math.hypot(dx, dz);
}

/** Whether a tile is drawn from (x, z) at a draw distance in metres; 0 (or none) means no limit. */
export function inDrawDistance(tile, x, z, distance) {
  return !(distance > 0) || distanceToTile(tile, x, z) <= distance;
}
