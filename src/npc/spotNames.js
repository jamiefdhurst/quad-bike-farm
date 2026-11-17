// Names for places on the farm, so a girl who is stuck can shout where she is ("I am stuck by the ford!"). Pure: the nearest named spot to a
// point. Each has an `id` (the key of her line for it, see strandedLines.js) and a `name` that reads after "by", "in" or "at" as written.

import { LAYOUT } from '../world/layout.js';

const L = LAYOUT;
const spot = (id, p, name) => ({ id, x: p.x, z: p.z, name });
const away = (where) => L.spawn.away.find((a) => a.where === where);

// Every place comes from the layout (a building's anchor, a feature, a parking spot), so the names move when the map does.
export const SPOTS = [
  spot('yard', L.yard, 'in the yard'),
  spot('ramp', L.jumpRamp, 'by the jump'),
  spot('dragStrip', L.dragStrip, 'on the drag strip'),
  spot('lowBog', L.bogs.find((b) => b.x !== undefined), 'in the low bog'),
  spot('bottomTrack', away('by the bottom of the track'), 'by the bottom of the track'),
  spot('middleField', away('in the middle of the field'), 'in the middle of the field'),
  spot('northHedge', away('by the north hedge'), 'by the north hedge'),
  spot('farCorner', away('in the far corner'), 'in the far corner'),
  spot('westHedge', away('down the west hedge'), 'down the west hedge'),
  spot('lane', L.namedSpots.lane, 'down the lane'),
  spot('ford', { x: L.hill.lane.x, z: L.hill.stream.z }, 'by the ford'),
  spot('hill', L.namedSpots.hill, 'on the hill'),
  spot('pond', L.hill.paddocks.west.pond, 'by the pond'),
  spot('wood', L.namedSpots.wood, 'in the wood'),
  spot('cattleGrid', { x: L.road.fromX, z: L.road.z }, 'by the cattle grid'),
  spot('road', L.namedSpots.road, 'out on the farm road'),
  spot('trough', L.trough, 'by the trough'),
  spot('barley', away('out in the barley field'), 'in the barley field'),
  spot('wheat', away('out in the wheat field'), 'in the wheat field'),
  spot('fieldShed', away('by the field shed'), 'by the field shed'),
  spot('dutchBarn', L.dutchBarn, 'by the Dutch barn'),
];

/** The named spot nearest to (x, z), with how far off it is: { id, name, distance }. */
export function nearestNamedSpot(x, z, spots = SPOTS) {
  let best = null;
  for (const s of spots) {
    const d = Math.hypot(s.x - x, s.z - z);
    if (!best || d < best.distance) best = { id: s.id, name: s.name, distance: d };
  }
  return best;
}
