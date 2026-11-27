// Where props.js stands the farm's own oaks and the distant tree clumps, as numbers (#1187): pure, so the farm's list of placed things
// (farmPlacement.js) sees the trees the game draws. Each takes the builder's own random stream and draws from it in the order the builder always has.

import { boundaryTreeBlocked } from './boundaryTrees.js';
import { patchAt } from './patchwork.js';
import { nearNeighbourYard } from './neighbourFarm.js';
import { inVillage, nearApproach } from './village.js';
import { inLaneFittings } from './aRoadFittings.js';

/** The grass field's half-side, the number the trees round the yard and the tufts of grass were laid out against (the farm's own limit went with the old layout, #692). */
export const YARD_HALF = 80;

/**
 * The oaks `buildTrees` stands (props.js), each with a trunk collider: [{ x, z, v (which of the two models), s (scale), yaw }]. A spot the wood or the
 * pit takes (`boundaryTreeBlocked`) is drawn for and left out, as the builder does.
 */
export function farmTreeSpots(layout, random) {
  const F = YARD_HALF;
  const spots = [];
  const farm = { maxX: F, maxZ: F };
  // Tree line along the north boundary, two staggered rows, the length of the farm.
  for (let x = -115; x <= farm.maxX + 35; x += 7 + random() * 5) {
    spots.push([x, -F - 8 - random() * 4]);
    if (random() < 0.7) spots.push([x + 3, -F - 15 - random() * 6]);
  }
  // Hedgerow oaks on the east and south hedges (the grass field's east hedge is now between it and the stubble), and the farm's far ones.
  for (const z of [-58, -18, 24, 62]) spots.push([F + 0.5, z + (random() - 0.5) * 6]);
  for (const x of [10, 52]) spots.push([x, F + 0.5]);
  // Behind the barn.
  spots.push([-76, 72], [-84, 52], [-86, 20], [-90, -14]);
  const out = [];
  for (const [x, z] of spots) {
    const v = random() < 0.5 ? 0 : 1;
    const s = 1.35 + random() * 0.6;
    if (boundaryTreeBlocked(layout, x, z)) continue; // the north boundary's tree line would stand in the wood or across the pit's lead-in road
    out.push({ x, z, v, s, yaw: random() * Math.PI * 2 });
  }
  return out;
}

/**
 * The low-poly clumps `buildDistantTrees` stands along the far hedgerows (props.js), no colliders: [{ x, z, s (trunk scale), crown: [yaw, sx, sy, sz] }].
 * `fields` and `roads` are the farm's (createFields, roadNetwork). The crowns' colours are drawn after, by the builder.
 */
export function distantTreeSpots(layout, fields, roads, random) {
  const out = [];
  const reach = layout.outerSize / 2 - 20;
  let tries = 0;
  while (out.length < 520 && tries++ < 25000) {
    const x = (random() * 2 - 1) * reach;
    const z = (random() * 2 - 1) * reach;
    // Well clear of the farm's hedges, and none on the ground through the south gate, which is kept for the hill.
    if (fields.outside(x, z) < 40) continue;
    if (x > -100 && x < 100 && z > fields.farm.maxZ && z < layout.ground.maxZ + 10) continue;
    if (patchAt(x, z).border > 4 && random() > 0.04) continue;
    const s = 0.8 + random() * 0.9;
    const crown = [random() * 6, s * (3.2 + random() * 1.2), s * (3 + random()), s * (3.2 + random() * 1.2)];
    if (nearNeighbourYard(layout, x, z, 45)) continue; // none stand by her yard or the lane beside it
    if (inVillage(layout, x, z, 14)) continue; // nor in the village
    if (nearApproach(layout, x, z, 14)) continue; // nor in the lane houses' gardens or the small farm's yard (#1085)
    if (roads.nearest(x, z, 14) || inLaneFittings(layout, x, z, 14)) continue; // nor on a road or its verge, nor in the lane's cottages' gardens (#687)
    out.push({ x, z, s, crown });
  }
  return out;
}
