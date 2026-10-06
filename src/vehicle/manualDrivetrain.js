// A manual drivetrain: a clutch pedal and a simple gearbox (reverse, neutral and three forward gears), as on the old tractor. It
// answers to the same interface as the quads' automatic Drivetrain (driveForce, available, clutch, coupled, engineLoad) so the
// rest of the vehicle doesn't care which it has. Pure logic, no Rapier or Three.
//
// Each gear has a top speed and a share of the drive force: first is slow and strong, third quick and weak. Dumping the clutch in a
// high gear from a standstill drags the engine down and stalls it unless the throttle is open (`launchLoad`); first is forgiving.
// The pedal is a key, so it is smoothed: it goes down fast and comes up over about half a second, which is the "feathering".

export const DEFAULT_GEARBOX_PARAMS = {
  topSpeed1: 2.4, // m/s in first at full throttle (about 5 mph)
  topSpeed2: 4.8, // in second
  topSpeed3: 8.5, // in third
  topSpeedReverse: 2.6,
  torque1: 1, // share of the vehicle's maxDriveForce in first...
  torque2: 0.68, // ...second
  torque3: 0.46, // ...third
  torqueReverse: 0.9,
  launchLoad1: 0.25, // how hard pulling away from rest drags the engine down with the clutch fully out, in first...
  launchLoad2: 0.5, // ...second (about stalls an idling engine)
  launchLoad3: 0.95, // ...third (stalls it unless there's throttle)
  launchRelief: 0.9, // fraction of that drag a fully open throttle takes away
  clutchPressRate: 8, // 1/s the pedal goes down at
  clutchReleaseRate: 1.6, // 1/s it comes up at, so about 0.6 s from down to fully engaged
  changeClutch: 0.7, // the pedal has to be this far down to change gear (neutral can always be found)
};

export const GEARBOX_PARAM_RANGES = {
  topSpeed1: [0.5, 8, 0.1],
  topSpeed2: [1, 12, 0.1],
  topSpeed3: [2, 20, 0.1],
  topSpeedReverse: [0.5, 8, 0.1],
  torque1: [0.1, 2, 0.01],
  torque2: [0.1, 2, 0.01],
  torque3: [0.1, 2, 0.01],
  torqueReverse: [0.1, 2, 0.01],
  launchLoad1: [0, 1.5, 0.01],
  launchLoad2: [0, 1.5, 0.01],
  launchLoad3: [0, 1.5, 0.01],
  launchRelief: [0, 1, 0.01],
  clutchPressRate: [1, 30, 0.5],
  clutchReleaseRate: [0.2, 10, 0.1],
  changeClutch: [0.1, 1, 0.05],
};

export const GEARS = [-1, 0, 1, 2, 3];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** The letter or number on the gear lever's gate. */
export function gearLabel(gear) {
  return gear < 0 ? 'R' : gear === 0 ? 'N' : String(gear);
}

export class ManualDrivetrain {
  constructor(params, gearbox = DEFAULT_GEARBOX_PARAMS) {
    this.params = params;
    this.gearbox = gearbox;
    this.gear = 0; // -1 reverse, 0 neutral, 1 to 3
    this.pedal = 0; // 0 up (clutch engaged) to 1 fully down
    this.clutch = 0; // how hard the clutch bites, 0..1
    this.coupled = false; // locked to a moving vehicle, so braking drags the engine
    this.driveForce = 0;
    this.available = 0;
    this.engineLoad = 0;
  }

  get neutral() {
    return this.gear === 0;
  }

  /** The top speed of a gear, m/s. */
  topSpeed(gear = this.gear) {
    const g = this.gearbox;
    return gear < 0 ? g.topSpeedReverse : [g.topSpeedReverse, 1, g.topSpeed1, g.topSpeed2, g.topSpeed3][gear + 1];
  }

  /** Share of the drive force a gear has. */
  torque(gear = this.gear) {
    const g = this.gearbox;
    return gear < 0 ? g.torqueReverse : [g.torqueReverse, 1, g.torque1, g.torque2, g.torque3][gear + 1];
  }

  launchLoad(gear = this.gear) {
    const g = this.gearbox;
    return gear === 0 ? 0 : gear < 0 ? g.launchLoad1 : [0, 0, g.launchLoad1, g.launchLoad2, g.launchLoad3][gear + 1];
  }

  /** Whether the clutch is down far enough to change gear. */
  get canChange() {
    return this.pedal >= this.gearbox.changeClutch;
  }

  /** Whether the starter may turn it: in neutral, or with the clutch down (a tractor won't crank in gear with it out). */
  get mayCrank() {
    return this.gear === 0 || this.pedal >= this.gearbox.changeClutch;
  }

  /**
   * Moves the lever to a gear (-1 to 3). Neutral can always be found; the others need the clutch down.
   * @returns {'ok'|'clutch'|'same'}
   */
  select(gear) {
    if (!GEARS.includes(gear)) return 'same';
    if (gear === this.gear) return 'same';
    if (gear !== 0 && !this.canChange) return 'clutch';
    this.gear = gear;
    return 'ok';
  }

  /**
   * @param {object} s
   * @param {number} s.dt
   * @param {boolean} s.clutchHeld  The clutch key is down.
   * @param {number} s.rpm
   * @param {number} s.power         Engine power fraction 0..1.
   * @param {boolean} s.running
   * @param {number} s.throttle      0..1 as sent to the engine.
   * @param {number} s.brake         0..1
   * @param {number} s.forwardSpeed  m/s, signed.
   */
  update({ dt = 0, clutchHeld = false, power, running, throttle, brake, forwardSpeed }) {
    const p = this.params;
    const gb = this.gearbox;
    const speed = Math.abs(forwardSpeed);
    const rate = clutchHeld ? gb.clutchPressRate : gb.clutchReleaseRate;
    this.pedal = clamp(this.pedal + (clutchHeld ? 1 : -1) * rate * dt, 0, 1);
    this.clutch = smoothstep(0, 1, 1 - this.pedal);

    const g = this.gear;
    const inGear = g !== 0 && running;
    const top = this.topSpeed(g);
    const dir = g < 0 ? -1 : 1;

    this.coupled = inGear && this.clutch > 0.5 && speed > p.coupledReleaseSpeed;

    let force = 0;
    this.available = 0;
    if (inGear) {
      const pedalTorque = p.idleTorque + (1 - p.idleTorque) * throttle;
      const drivePower = p.drivePowerFloor + (1 - p.drivePowerFloor) * power;
      this.available = pedalTorque * drivePower * p.maxDriveForce * this.torque(g);
      // Past the gear's top speed (rolling downhill, say) it holds back rather than pushing.
      const speedFactor = clamp(1 - (speed / top) ** 2, 0, 1);
      force = dir * this.clutch * this.available * speedFactor;
      if (throttle < 0.05) force -= Math.sign(forwardSpeed) * p.engineBrakeForce * this.clutch * Math.min(1, speed / 2);
    }
    this.driveForce = force;

    // Pulling away from rest in too high a gear drags the engine down, and so does braking while coupled.
    let load = 0;
    if (inGear) {
      const launch = this.launchLoad(g) * this.clutch * (1 - clamp(speed / top, 0, 1)) * (1 - gb.launchRelief * throttle);
      const braking = this.coupled ? brake * Math.min(1, speed / p.brakeLoadSpeed) : 0;
      load = Math.max(launch, braking);
    }
    this.engineLoad = clamp(load, 0, 1);
    return this;
  }
}
