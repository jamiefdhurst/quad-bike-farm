// Names for places on the farm, so a girl who is stuck can shout where she is ("I am stuck by the ford!"). Pure: the nearest named spot to a
// point. Each has an `id` (the key of her line for it, see strandedLines.js) and a `name` that reads after "by", "in" or "at" as written.

import { LAYOUT } from '../world/layout.js';

/** Every place she can name, by id (the key of her line: strandedLines.js writes one per id), whichever farm is loaded: a place the farm lacks just isn't found. */
export const SPOT_NAMES = {
  yard: 'in the yard', ramp: 'by the jump', dragStrip: 'on the drag strip', lowBog: 'in the low bog', bottomTrack: 'by the bottom of the track',
  middleField: 'in the middle of the field', northHedge: 'by the north hedge', farCorner: 'in the far corner', westHedge: 'down the west hedge',
  lane: 'down the lane', ford: 'by the ford', hill: 'on the hill', pond: 'by the pond', wood: 'in the wood', cattleGrid: 'by the cattle grid',
  road: 'out on the farm road', trough: 'by the trough', barley: 'in the barley field', wheat: 'in the wheat field', fieldShed: 'by the field shed',
  dutchBarn: 'by the Dutch barn',
};

/** The places only the new farm has (#690): the drive, Back Lane, the Moor and the pit. Their lines are recorded after all the rest (callThemLines.js), so no bank before them moves. */
export const NEW_FARM_SPOT_NAMES = { drive: 'on the drive', backLane: 'on Back Lane', moor: 'out on the moor', pit: 'in the pit' };
export const ALL_SPOT_NAMES = { ...SPOT_NAMES, ...NEW_FARM_SPOT_NAMES };

// Every place comes from the layout (a building's anchor, a feature, a parking spot), so the names move when the map does. A place the farm lacks isn't
// found: the girls' lines for the ones the old farm had (the drag strip, the trough, the barley and wheat fields) stay in the recorded banks.
export const spotsFor = (L) => {
  const away = (where) => L.spawn?.away?.find((a) => a.where === where);
  const at = {
    yard: L.yard, ramp: L.jumpRamp, lowBog: L.bogs?.find((b) => b.x !== undefined),
    bottomTrack: away('by the bottom of the track'), middleField: away('in the middle of the field'), northHedge: away('by the north hedge'),
    farCorner: away('in the far corner'), westHedge: away('down the west hedge'),
    ford: L.hill && { x: L.hill.lane.x, z: L.hill.stream.z }, pond: L.hill?.paddocks?.west?.pond,
    fieldShed: away('by the field shed'), dutchBarn: L.dutchBarn,
    lane: L.namedSpots?.lane, hill: L.namedSpots?.hill, wood: L.namedSpots?.wood,
    cattleGrid: L.road?.grid?.x !== undefined && { x: L.road.grid.x, z: L.road.z },
    drive: L.road?.grid?.x !== undefined && { x: L.road.grid.x - 100, z: L.road.z },
    backLane: L.woods?.backLane, moor: L.moor?.trig && { x: L.moor.trig.at[0], z: L.moor.trig.at[1] }, pit: L.quarry?.centre,
  };
  return Object.keys(ALL_SPOT_NAMES).filter((id) => at[id]).map((id) => ({ id, x: at[id].x, z: at[id].z, name: ALL_SPOT_NAMES[id] }));
};

export const SPOTS = spotsFor(LAYOUT);

/** The named spot nearest to (x, z), with how far off it is: { id, name, distance }. */
export function nearestNamedSpot(x, z, spots = SPOTS) {
  let best = null;
  for (const s of spots) {
    const d = Math.hypot(s.x - x, s.z - z);
    if (!best || d < best.distance) best = { id: s.id, name: s.name, distance: d };
  }
  return best;
}
