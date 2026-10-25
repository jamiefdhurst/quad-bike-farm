// Which seat you are looking at, so E sits where you look: the back of a quad, the passenger's side of a car, or the driver's seat.
// Pure, tested in tests/seatLook.test.js. Points are on the ground plan in the vehicle's own frame ({ x, z }).

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Whether `look` (where your view met the vehicle) is nearer the passenger's seat than the driver's. Nothing looked at means the driver's. */
export function nearerPassenger(look, driver, passenger) {
  if (!look || !driver || !passenger) return false;
  return dist(look, passenger) < dist(look, driver);
}
