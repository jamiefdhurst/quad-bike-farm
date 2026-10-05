// Whether a girl can sit on the front rack of a quad. Pure, so it's tested without the game (tests/rack.test.js).
// The rack is the third seat: it's for the girl who isn't driving once you're on the back, so there's
// always a friend at the controls and the pillion seat is already taken.

/**
 * @param {object} s
 * @param {boolean} s.hasRack      the quad has a front rack to sit on
 * @param {boolean} s.tipped
 * @param {boolean} s.rackTaken    the other girl is already there (or heading there)
 * @param {boolean} s.friendDriving  the other girl is at the controls
 * @param {boolean} s.friendBusy   she's following you or waiting to give you a ride, so she won't stop for anyone
 * @param {boolean} s.pillionFree  someone could still take the back, so the rack isn't needed
 */
export function canRideRack({ hasRack, tipped, rackTaken, friendDriving, friendBusy = false, pillionFree = false }) {
  return !!hasRack && !tipped && !rackTaken && !!friendDriving && !friendBusy && !pillionFree;
}
