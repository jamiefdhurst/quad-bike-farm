// Where the stubble's clumps stand in a field: in the drill rows, half a metre apart, and only inside the field's polygon, so a field that isn't a
// rectangle is filled to its corners and no further (#813). Pure: no Three.js, so a test can check every clump is inside.

import { pointInPolygon, polygonArea, polygonBounds, polygonEdges } from './polygons.js';

/** How many of `total` clumps each field gets, by its polygon's area (not its box's) times its density. `fields` is [{ polygon, density }]. */
export function stubbleShares(fields, total) {
  const weight = fields.map(({ polygon, density = 1 }) => Math.abs(polygonArea(polygon)) * density);
  const sum = weight.reduce((a, b) => a + b, 0) || 1;
  return weight.map((w) => Math.round((total * w) / sum));
}

/**
 * Stands up to `count` clumps in `polygon`, in rows along x (or along z), calling `make(x, z)` for each that `accept(x, z)` also allows. A
 * clump's other random numbers are drawn in `make`, so the order of the stream is the same as when the whole box was scattered over. It stops
 * after as many tries as the box is bigger than the polygon calls for, so an awkward field comes up a little short rather than looping.
 * Returns how many it stood.
 */
export function scatterStubble({ polygon, alongX, count, random, make, accept = () => true }) {
  const r = polygonBounds(polygon);
  const edges = polygonEdges(polygon);
  const boxPerPolygon = Math.max(1, ((r.maxX - r.minX) * (r.maxZ - r.minZ)) / (Math.abs(polygonArea(polygon)) || 1));
  const maxTries = Math.ceil(count * 3 * boxPerPolygon);
  const span = alongX ? r.maxZ - r.minZ : r.maxX - r.minX;
  let stood = 0;
  let tries = 0;
  while (stood < count && tries++ < maxTries) {
    const row = (alongX ? r.minZ : r.minX) + 0.25 + Math.floor(random() * (span / 0.5)) * 0.5 + (random() - 0.5) * 0.06;
    const along = alongX ? r.minX + random() * (r.maxX - r.minX) : r.minZ + random() * (r.maxZ - r.minZ);
    const x = alongX ? along : row;
    const z = alongX ? row : along;
    if (!pointInPolygon(polygon, x, z, 0, edges) || !accept(x, z)) continue;
    make(x, z);
    stood++;
  }
  return stood;
}
