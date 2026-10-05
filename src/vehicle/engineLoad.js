// How hard the wheels are holding the engine back. A CVT quad on the flat
// spins up to its working revs and stays there; pulling away, climbing or
// ploughing through mud it labours lower; spinning its wheels or in the air
// the load drops away and the revs flare. This works out that load, 0..1, for
// the engine model, plus how fast the wheels turn the engine over on a closed
// throttle. Pure logic, no Rapier or Three.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Fraction of the drive force the tyres can put down, from how hard each one is
 * pressed into the ground and how muddy it is there. The physics never spins a
 * wheel, so this is only heard and felt through the engine.
 * @param {{force:number, mud:number, contact:boolean}[]} wheels  Suspension force (N), mud 0..1.
 * @param {number} request  Drive force asked for, N, split evenly across the wheels.
 * @param {{tyreGrip:number, mudGrip:number}} params  Grip per newton of wheel load on grass and in mud.
 */
export function tractionFraction(wheels, request, { tyreGrip, mudGrip }) {
  if (!wheels.length) return 0;
  if (request <= 0) return 1;
  const each = request / wheels.length;
  let put = 0;
  for (const w of wheels) {
    if (!w.contact) continue;
    const grip = tyreGrip + (mudGrip - tyreGrip) * clamp(w.mud, 0, 1);
    put += Math.min(each, Math.max(0, w.force) * grip);
  }
  return put / request;
}

export class EngineLoad {
  constructor(params) {
    this.params = params;
    this.put = 0; // smoothed drive force the tyres put down, N
    this.accelForce = 0; // smoothed mass x forward acceleration, N
    this.prevSpeed = null;
    this.grip = 1; // fraction of the drive force the tyres put down
    this.driveLoad = 0; // how hard the wheels hold the engine back, 0..1
    this.resistLoad = 0; // the part of that from climbing, mud or being blocked, 0..1
    this.overrunRpm = 0; // rpm above idle the wheels turn the engine at, throttle shut
  }

  /**
   * @param {number} dt
   * @param {object} s
   * @param {number} s.throttle      0..1
   * @param {number} s.brake         0..1
   * @param {number} s.forwardSpeed  m/s, signed.
   * @param {boolean} s.reverse
   * @param {number} s.driveForce    N at the wheels from the drivetrain this step, signed.
   * @param {number} s.available     N the engine could give at this throttle with the clutch locked.
   * @param {number} s.clutch        0..1 clutch bite.
   * @param {boolean} s.coupled      Clutch locked onto a moving bike.
   * @param {number} s.mass          kg
   * @param {{force:number, mud:number, contact:boolean}[]} s.wheels
   * @param {number} [s.grip]        Fraction of the drive the tyres put down, from the physics (traction.js);
   *                                 without it, worked out from tyreGrip and mudGrip.
   */
  update(dt, { throttle, brake, forwardSpeed, reverse, driveForce, available, clutch, coupled, mass, wheels, grip }) {
    const p = this.params;
    const a = this.prevSpeed !== null && dt > 0 ? (forwardSpeed - this.prevSpeed) / dt : 0;
    this.prevSpeed = forwardSpeed;
    // The drive force and the acceleration it makes are smoothed alike, so
    // the difference between them (the resistance) doesn't lag behind either.
    const k = dt > 0 ? Math.min(1, dt / p.loadSmoothing) : 0;

    const dir = reverse ? -1 : 1;
    const speed = Math.abs(forwardSpeed);
    let contact = 0;
    let mud = 0;
    for (const w of wheels) {
      if (!w.contact) continue;
      contact++;
      mud += w.mud;
    }
    mud = contact ? mud / contact : 0;
    contact /= wheels.length || 1;

    // Of the force the tyres put down, whatever isn't speeding the bike up is
    // going into the hill, the mud or whatever's in the way.
    const push = Math.max(0, driveForce * dir);
    this.grip = push <= 0 ? 1 : (grip ?? tractionFraction(wheels, push, p));
    this.put += (push * this.grip - this.put) * k;
    this.accelForce += (mass * a * dir - this.accelForce) * k;
    const put = this.put;
    const resisting = Math.max(0, put - this.accelForce) * contact;
    const accelerating = clamp(this.accelForce, 0, put);
    // Pulling away the CVT sits in its lowest ratio with the clutch slipping, so
    // the engine feels the whole job of getting the bike moving. Once it's
    // shifting up it holds the revs and only the resistance really counts.
    const launch = 1 - smoothstep(0, p.cvtShiftSpeed, speed);
    const accelWeight = p.cruiseAccelLoad + (p.launchLoad - p.cruiseAccelLoad) * launch;
    // Churning through mud takes effort the physics doesn't charge for.
    const resistShare = (available > 0 ? resisting / available : 0) + p.mudLoad * mud * contact * this.grip;
    const accelShare = available > 0 ? (accelWeight * accelerating) / available : 0;

    const driving = throttle > 0 && push > 0;
    const engaged = driving ? (coupled ? 1 : clutch) : 0;
    this.driveLoad = clamp((accelShare + resistShare) * engaged, 0, 1);
    this.resistLoad = clamp(resistShare * engaged, 0, 1);

    // Throttle shut with the clutch locked, the wheels turn the engine over a
    // little faster than idle, more so the faster it rolls. Braking keeps the
    // existing braking drag instead.
    this.overrunRpm =
      coupled && throttle < 0.05 && brake === 0 && contact > 0
        ? Math.min(p.overrunMaxRpm, speed * p.overrunRpmPerMs)
        : 0;
    return this;
  }
}
