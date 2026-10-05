// Tyre grip on grass, mud and puddles, and wheelspin. Pure logic, no Rapier.
//
// The driven wheels are locked together (a solid rear axle, and a front diff
// that's as good as locked on a farm quad), so they share one drive force in
// proportion to the grip each has. If the drive asks for more than all of them
// can take, they spin up together: less of the force gets through, and spinning
// tyres hold less sideways, so the back steps out when you power through mud.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Grip coefficient (Rapier friction slip) for a mix of grass, mud and puddle, each 0..1. */
export function surfaceGrip(p, mud, puddle) {
  const ground = p.grassFrictionSlip + (p.mudFrictionSlip - p.grassFrictionSlip) * clamp(mud, 0, 1);
  return ground + (p.puddleFrictionSlip - ground) * clamp(puddle, 0, 1);
}

/** Whether wheel `front` is driven, from the fourWheelDrive setting. */
export function isDriven(p, front) {
  return !front || p.fourWheelDrive > 0.5;
}

export class Traction {
  constructor(wheelCount = 4) {
    this.spin = 0; // 0..1, how hard the driven wheels are spinning
    this.demand = 0; // drive force asked for over the grip available (1 = on the limit)
    this.forces = new Float32Array(wheelCount);
    this.grips = new Float32Array(wheelCount);
  }

  /**
   * @param {number} dt
   * @param {number} driveForce  Total newtons at the wheels, signed.
   * @param {object[]} wheels    Per wheel: { driven, load (N), grip (friction slip), contact }.
   * @param {object} p           Vehicle params.
   * @returns {this}  forces[i] is the drive force for wheel i, grips[i] its friction slip.
   */
  update(dt, driveForce, wheels, p) {
    let capacity = 0;
    let driven = 0;
    for (const w of wheels) {
      if (!w.driven) continue;
      driven++;
      if (w.contact) capacity += w.grip * w.load;
    }
    capacity *= p.driveGrip;
    const want = Math.abs(driveForce);
    // Airborne, the wheels spin freely with any throttle.
    this.demand = capacity > 1 ? want / capacity : want > 1 ? 10 : 0;
    const target = clamp((this.demand - 1) / p.spinRange, 0, 1);
    const rate = target > this.spin ? p.spinRiseRate : p.spinFallRate;
    this.spin += (target - this.spin) * Math.min(1, rate * dt);

    // What gets through: up to the grip, less once the tyres are spinning.
    const through = Math.min(want, capacity * (1 - p.spinDriveLoss * this.spin));
    const sign = Math.sign(driveForce);
    for (let i = 0; i < wheels.length; i++) {
      const w = wheels[i];
      let f = 0;
      if (w.driven) {
        if (capacity > 1) f = w.contact ? (through * w.grip * w.load * p.driveGrip) / capacity : 0;
        else f = want / driven;
      }
      this.forces[i] = sign * f;
      this.grips[i] = w.grip * (w.driven ? 1 - p.spinSideLoss * this.spin : 1);
    }
    return this;
  }

  /** Extra tyre surface speed over the ground from wheelspin, m/s, for the visual wheels and mud. */
  spinSlip(p) {
    return this.spin * p.spinSlipSpeed;
  }
}
