// The farm's standing and running water as one answer (#1216): the stream, the river and the brook, the wood's and the pit's ponds and the far pond.
// The placement rules (farmPlacement.js) and the hedges (props.js `buildHedges`, which stop at the water's edge) ask the same thing.
import { landmarksOf, pondShape } from './fieldLandmarks.js';

/**
 * @param {object} layout  the farm's layout (its far pond is one of its field landmarks)
 * @param {object} heights `createTerrainHeight`'s answer, whose `hill`, `woods`, `quarry` and `brook` each know their own water
 * @returns {(x: number, z: number) => number} how deep the water is there, game metres (0 on dry ground, 1 anywhere in the far pond)
 */
export function farmWaterAt(layout, heights) {
  const h = heights;
  const ponds = landmarksOf(layout, 'farPond').map((l) => pondShape(l));
  return (x, z) => Math.max(h.hill?.waterAt(x, z) ?? 0, h.woods?.waterAt(x, z) ?? 0, h.quarry?.waterAt(x, z) ?? 0, h.brook?.waterAt(x, z) ?? 0, ponds.some((p) => p.through(x, z) < 1) ? 1 : 0);
}
