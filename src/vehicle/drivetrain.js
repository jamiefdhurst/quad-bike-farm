// Automatic drivetrain: centrifugal clutch into a CVT. Turns engine state and
// rider inputs into a drive force at the wheels and a load back on the engine.
// Pure logic, no Rapier or Three.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export class Drivetrain {
  constructor(params) {
    this.params = params;
    this.coupled = false; // clutch locked to a moving bike, so braking drags the engine
    this.clutch = 0;
    this.driveForce = 0;
    this.engineLoad = 0;
  }

  /**
   * @param {object} s
   * @param {number} s.rpm
   * @param {number} s.power         Engine power fraction 0..1.
   * @param {boolean} s.running
   * @param {number} s.throttle      0..1 as sent to the engine.
   * @param {number} s.brake         0..1
   * @param {number} s.forwardSpeed  m/s, signed.
   * @param {boolean} s.reverse
   */
  update({ rpm, power, running, throttle, brake, forwardSpeed, reverse }) {
    const p = this.params;
    const speed = Math.abs(forwardSpeed);

    this.clutch = running ? smoothstep(p.clutchEngageRpm, p.clutchFullRpm, rpm) : 0;

    // Coupling has hysteresis: it locks once the clutch bites with the bike
    // moving and only lets go when the bike all but stops.
    if (!running || speed < p.coupledReleaseSpeed) this.coupled = false;
    else if (rpm > p.couplingRpm && speed > p.coupledReleaseSpeed * 2) this.coupled = true;

    let force = 0;
    if (running) {
      // Fairly flat torque, tailing off near the top.
      const rpmNorm = clamp(rpm / 8500, 0, 1);
      const torque = 0.75 + 0.25 * Math.sin(Math.PI * Math.min(1, rpmNorm * 1.2));
      const top = reverse ? p.maxReverseSpeed : p.maxSpeed;
      const speedFactor = clamp(1 - (speed / top) ** 2, 0, 1);
      const pedal = p.idleTorque + (1 - p.idleTorque) * throttle;
      const drivePower = p.drivePowerFloor + (1 - p.drivePowerFloor) * power;
      force = this.clutch * pedal * torque * drivePower * p.maxDriveForce * speedFactor;
      if (reverse) force = -force;

      // Light engine braking at a closed throttle with the clutch locked.
      if (throttle < 0.05 && this.clutch > 0.5) {
        force -= Math.sign(forwardSpeed) * p.engineBrakeForce * this.clutch * Math.min(1, speed / 2);
      }
    }
    this.driveForce = force;

    this.engineLoad = this.coupled ? brake * Math.min(1, speed / p.brakeLoadSpeed) : 0;
    return this;
  }
}
