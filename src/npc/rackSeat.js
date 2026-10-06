// Whether a girl can sit on the front rack of a quad. Pure, so it's tested without the game (tests/rack.test.js).
// The rack is the third seat. It's for the girl who isn't driving once you're on the back (there's a friend at the controls and the
// pillion seat is already taken), or, if you ask her to, for a girl on a parked quad that nobody's on, so you can ride off with her on the front.

/**
 * @param {object} s
 * @param {boolean} s.hasRack      the quad has a front rack to sit on
 * @param {boolean} s.tipped
 * @param {boolean} s.rackTaken    the other girl is already there (or heading there)
 * @param {boolean} s.friendDriving  the other girl is at the controls
 * @param {boolean} s.friendBusy   she's following you or waiting to give you a ride, so she won't stop for anyone
 * @param {boolean} s.pillionFree  someone could still take the back, so the rack isn't needed
 * @param {boolean} s.parked       nobody's driving or riding it and it's stopped: she can be asked onto the rack whatever else is free
 */
export function canRideRack({ hasRack, tipped, rackTaken, friendDriving, friendBusy = false, pillionFree = false, parked = false }) {
  if (!hasRack || tipped || rackTaken) return false;
  if (parked) return true;
  return !!friendDriving && !friendBusy && !pillionFree;
}
