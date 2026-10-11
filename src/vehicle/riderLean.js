// A rider shifting their weight to the inside of a corner on a narrow three-wheeler (the old ATC). It happens by itself from the bars: the
// rider leans in as you turn, but not instantly, so a corner that is eased into stays up and one thrown into with the bars flung over
// catches it out. The weight is a sideways offset from the middle; the roll torque it makes (rider mass times g times the offset) pushes the
// chassis over towards the inside, against the outward roll of the corner. Pure, no Three.js or Rapier; quad.js feeds it the bars and the
// speed and applies the torque with `QuadPhysics.rollTorque`. Positive is to the left, like steering.

const G = 9.81;

export const DEFAULT_RIDER_LEAN_PARAMS = {
  riderMass: 75, // kg of rider that moves
  maxShift: 0.25, // m, how far off the middle the rider gets their weight at full bars
  fullLeanSpeed: 6, // m/s at which full bars ask for the full shift (less below that: slow corners need no leaning)
  shiftRate: 1.5, // 1/s, how fast the rider moves their weight towards where the bars ask
  girlShift: 0.75, // how much of the shift a girl riding manages (she is careful, and a little less quick to lean in)
};

export const RIDER_LEAN_RANGES = {
  riderMass: [30, 120, 5],
  maxShift: [0, 0.7, 0.02],
  fullLeanSpeed: [2, 15, 0.5],
  shiftRate: [0.5, 8, 0.1],
  girlShift: [0, 1, 0.05],
};

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export class RiderLean {
  constructor(params = DEFAULT_RIDER_LEAN_PARAMS) {
    this.p = params;
    this.shift = 0; // metres off the middle, positive left
    this.torque = 0; // N m, positive leans the chassis left
  }

  /**
   * @param {number} dt
   * @param {object} s
   * @param {number} s.bars     Steering, -1..1, positive left.
   * @param {number} s.speed    Signed forward speed, m/s (reversing needs no leaning).
   * @param {boolean} s.aboard  Someone is on it; with nobody the weight drifts back to the middle.
   * @param {boolean} s.girl    A girl is riding.
   * @returns {number} The roll torque, N m, positive leaning it left.
   */
  update(dt, s) {
    const p = this.p;
    const want = s.aboard && s.speed > 0
      ? clamp(s.bars, -1, 1) * Math.min(1, s.speed / p.fullLeanSpeed) * p.maxShift * (s.girl ? p.girlShift : 1)
      : 0;
    const k = 1 - Math.exp(-p.shiftRate * dt);
    this.shift += (want - this.shift) * k;
    this.torque = s.aboard ? p.riderMass * G * this.shift : 0;
    return this.torque;
  }

  /** Sat upright again (it has been put right). */
  recover() {
    this.shift = 0;
    this.torque = 0;
  }
}
