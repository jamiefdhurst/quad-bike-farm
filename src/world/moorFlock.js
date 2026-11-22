// The Moor's summer flock (#821): a stand-in for the stock year (#707), which replaces it. A flock of its own grazes the common from May to September and is
// not there the rest of the year; the hill's and the sheep field's flocks stay where they are. It lives west of Back Lane, away from the flushes, the outcrops, the
// peat and the ridge wall, and may drift onto the lane itself between the two cattle grids, where Back Lane is open to the common. The moor gate stays shut.
// Pure: no Three.js.

/** The farm months (0 for January) the flock is on the Moor: May to September. */
export const MOOR_FLOCK_MONTHS = [4, 8];

/** Whether the flock is up on the Moor on the farm's date (`seasons.js`'s date, of which only `month` is read). */
export const moorFlockOn = (date) => date.month >= MOOR_FLOCK_MONTHS[0] && date.month <= MOOR_FLOCK_MONTHS[1];

/** How far past the lane's middle a sheep may stand where the lane is open to the common: onto the tarmac of its west half, no further. */
export const LANE_FLOCK_REACH = 1.5;

/** How far from the lane's middle, on the common's side, the flock may graze its verge between the grids. */
export const LANE_BAND = 9;

/**
 * Whether a sheep may stand at (x, z): on the common (`moor.clear`) or the lane's verge and west half between the grids, and out of the flushes and the outcrops' humps
 * (`gridZ` is [lowest, highest] z of the two).
 */
export function moorFlockAllowed(moor, gridZ) {
  const [z0, z1] = gridZ;
  return (x, z) => {
    if (!moor.inside(x, z) || moor.wetAt(x, z) > 0.3 || moor.reliefAt(x, z) > 0.25) return false;
    const edge = moor.laneEdge(z);
    // `moor.clear` keeps 9 m off the lane (it is the plants' and rocks' rule), but the flock may graze its verge and cross it between the grids.
    if (z > z0 && z < z1 && x >= edge - LANE_BAND && x < edge + LANE_FLOCK_REACH) return true;
    return moor.clear(x, z);
  };
}

/** Where the flock is put down: on the common a few metres west of the lane, level with the moor gate. */
export const moorFlockCentre = (moor, gate) => ({ x: moor.laneEdge(gate.z) - 5, z: gate.z });
