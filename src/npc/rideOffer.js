// You sitting on the back of a parked quad with nobody driving it: after a
// while a girl wanders over, gets on the front and takes you for a ride.
// Pure timing and choosing; the game decides who's free and tells her.

const between = (random, lo, hi) => lo + random() * (hi - lo);

/** Counts how long you've been sat waiting, and says when it's time for someone to offer. */
export class RideOffer {
  constructor(params, random = Math.random) {
    this.p = params;
    this.random = random;
    this.left = null;
    this.resting = 0;
  }

  /** @param {boolean} waiting you're on the back of a parked quad and nobody's at the front. Returns true when she should offer. */
  update(dt, waiting) {
    // The rest after a ride runs on whatever you're doing.
    if (this.resting > 0) {
      this.resting -= dt;
      return false;
    }
    if (!waiting) {
      this.left = null;
      return false;
    }
    this.left ??= between(this.random, this.p.offerRideWaitMin, this.p.offerRideWaitMax);
    this.left -= dt;
    if (this.left > 0) return false;
    this.left = null;
    return true;
  }

  /** After a ride: nobody offers again for a good while, however long you sit. Her own params say how long (she's the one who got bored). */
  rest(params = this.p) {
    this.left = null;
    this.resting = between(this.random, params.offerRideRestMin, params.offerRideRestMax);
  }
}

/** Which free girl offers: usually the nearer one, but not always. `girls` are { distance } objects. */
export function pickOfferer(girls, random = Math.random) {
  if (!girls.length) return null;
  const weights = girls.map((g) => 1 / (1 + g.distance / 10));
  let r = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < girls.length; i++) {
    r -= weights[i];
    if (r <= 0) return girls[i];
  }
  return girls[girls.length - 1];
}
