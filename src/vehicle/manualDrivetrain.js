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
  topSpeed4: 12, // in fourth (only the quads' four-speed boxes have one)
  topSpeed5: 18, // in fifth (only the 200TDi's five-speed box has one)
  topSpeedReverse: 2.6,
  torque1: 1, // share of the vehicle's maxDriveForce in first...
  torque2: 0.68, // ...second
  torque3: 0.46, // ...third
  torque4: 0.4, // ...fourth
  torque5: 0.35, // ...fifth
  torqueReverse: 0.9,
  launchLoad1: 0.25, // how hard pulling away from rest drags the engine down with the clutch fully out, in first...
  launchLoad2: 0.5, // ...second (about stalls an idling engine)
  launchLoad3: 0.95, // ...third (stalls it unless there's throttle)
  launchLoad4: 1.2, // ...fourth (always stalls it from rest without a lot of throttle)
  launchLoad5: 1.3, // ...fifth
  lugSpeed: 1, // the drag fades out by this fraction of the gear's top speed: below it, a high gear labours the engine (1 is only from rest)
  launchRelief: 0.9, // fraction of that drag a fully open throttle takes away
  overrunHold: 4, // m/s2 the engine holds back in first, off the throttle and faster than the gear pulls (less in higher gears)
  clutchPressRate: 8, // 1/s the pedal goes down at
  clutchReleaseRate: 1.6, // 1/s it comes up at, so about 0.6 s from down to fully engaged
  handStart: 0.15, // where the hand throttle is left when the game starts (about 710 rpm); it moves in steps of 0.35 a second from there
  gears: 3, // forward gears: 3 on the tractor, 4 on the manual quads, 5 on the 200TDi
  changeClutch: 0.7, // the pedal has to be this far down to change gear (neutral can always be found)
  rushTime: 0.2, // s the pedal must have been down before the lever goes in cleanly; sooner than that you can miss the gear
  falseNeutralChance: 0.45, // chance of missing the gear (landing in a false neutral) when the change is rushed
  jumpSlope: 0.1, // how steep a climb has to be (sine of the angle, about 6 degrees) before a worn gear can jump out
  jumpThrottle: 0.5, // and how much throttle it needs: a worn gear only jumps out under load
  jumpRate: 0.6, // chance a second, for a fully worn gear, of it jumping out while it is under that load
  crashGears: 0, // how many of the bottom gears have no synchromesh (the Tor's or Crag's first and second)
  crashSpeed: 1, // m/s: going faster than this, a gear with no synchromesh crunches and won't go in
  declutchTime: 0.2, // s in neutral with the clutch up (the first declutch) before a crash gear will take on the move
  matchTolerance: 0.2, // how close the revs (0 idle to 1 flat out) must be to the gear's road speed to go in without a crunch
};

export const GEARBOX_PARAM_RANGES = {
  overrunHold: [0, 10, 0.1],
  crashGears: [0, 4, 1],
  crashSpeed: [0, 5, 0.1],
  declutchTime: [0, 1, 0.05],
  matchTolerance: [0.02, 0.5, 0.01],
  topSpeed1: [0.5, 8, 0.1],
  topSpeed2: [1, 12, 0.1],
  topSpeed3: [2, 20, 0.1],
  topSpeed4: [3, 30, 0.1],
  topSpeed5: [4, 40, 0.1],
  topSpeedReverse: [0.5, 8, 0.1],
  torque1: [0.1, 2, 0.01],
  torque2: [0.1, 2, 0.01],
  torque3: [0.1, 2, 0.01],
  torque4: [0.1, 2, 0.01],
  torque5: [0.1, 2, 0.01],
  torqueReverse: [0.1, 2, 0.01],
  launchLoad1: [0, 1.5, 0.01],
  launchLoad2: [0, 1.5, 0.01],
  launchLoad3: [0, 1.5, 0.01],
  launchLoad4: [0, 1.5, 0.01],
  launchLoad5: [0, 1.5, 0.01],
  lugSpeed: [0.1, 1, 0.01],
  launchRelief: [0, 1, 0.01],
  clutchPressRate: [1, 30, 0.5],
  clutchReleaseRate: [0.2, 10, 0.1],
  handStart: [0, 1, 0.01],
  gears: [3, 4, 1],
  changeClutch: [0.1, 1, 0.05],
  rushTime: [0, 1, 0.01],
  falseNeutralChance: [0, 1, 0.01],
  jumpSlope: [0, 0.5, 0.01],
  jumpThrottle: [0, 1, 0.05],
  jumpRate: [0, 3, 0.05],
};

export const GEARS = [-1, 0, 1, 2, 3, 4, 5];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** The letter or number on the gear lever's gate. */
export function gearLabel(gear) {
  return gear < 0 ? 'R' : gear === 0 ? 'N' : String(gear);
}

/**
 * Which manual vehicle has a worn gearbox this game, and in which gear. One of them, from its own random stream, so a seed repeats
 * it: it's a forward gear above first (first is the one you climb the bank in, so it would be unfair there), and how worn is 0.5 to 1.
 * @param {{id: string, gears: number}[]} candidates
 * @returns {{id: string, gear: number, wear: number}|null}
 */
export function pickWornGearbox(candidates, random) {
  if (!candidates.length) return null;
  const c = candidates[Math.floor(random() * candidates.length)];
  return { id: c.id, gear: 2 + Math.floor(random() * (c.gears - 1)), wear: 0.5 + 0.5 * random() };
}

export class ManualDrivetrain {
  constructor(params, gearbox = DEFAULT_GEARBOX_PARAMS, random = Math.random) {
    this.params = params;
    this.gearbox = gearbox;
    this.random = random;
    this.pedalDown = 0; // s the pedal has been down far enough to change gear
    this.worn = null; // { gear, wear }: a gear that jumps out of mesh under load on a climb
    this.event = null; // 'jumped' when a worn gear has just jumped out, taken by takeEvent
    this.neutralFree = 0; // s spent in neutral with the clutch up since the last gear: the first half of a double-declutch
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

  /** The top speed of a gear, m/s. A gear can't pull past the vehicle's own top speed (a limiter, say), whatever its ratio. */
  topSpeed(gear = this.gear) {
    const g = this.gearbox;
    const ratio = gear < 0 ? g.topSpeedReverse : [g.topSpeedReverse, 1, g.topSpeed1, g.topSpeed2, g.topSpeed3, g.topSpeed4, g.topSpeed5][gear + 1];
    return Math.min(ratio, gear < 0 ? this.params.maxReverseSpeed ?? Infinity : this.params.maxSpeed ?? Infinity);
  }

  /**
   * Rolling downhill faster than the gear would take it, off the throttle, the engine turns over faster than it wants to and holds the
   * vehicle back: most in first, a little in fourth, up to `overrunHold` m/s2 at twice the gear's speed. What spares the brakes on a bank.
   */
  overrunForce(gear, speed, top) {
    const over = clamp(speed / top - 1, 0, 1);
    if (over <= 0 || !(this.params.mass > 0)) return 0;
    const lowness = clamp(this.topSpeed(this.gearbox.gears) / this.topSpeed(gear) / 4, 0.25, 1);
    return this.params.mass * this.gearbox.overrunHold * lowness * over * this.clutch;
  }

  /** Share of the drive force a gear has. */
  torque(gear = this.gear) {
    const g = this.gearbox;
    return gear < 0 ? g.torqueReverse : [g.torqueReverse, 1, g.torque1, g.torque2, g.torque3, g.torque4, g.torque5][gear + 1];
  }

  launchLoad(gear = this.gear) {
    const g = this.gearbox;
    return gear === 0 ? 0 : gear < 0 ? g.launchLoad1 : [0, 0, g.launchLoad1, g.launchLoad2, g.launchLoad3, g.launchLoad4, g.launchLoad5][gear + 1];
  }

  /** Whether the clutch is down far enough to change gear. */
  get canChange() {
    return this.pedal >= this.gearbox.changeClutch;
  }

  /** Whether the starter may turn it: in neutral, or with the clutch down (a tractor won't crank in gear with it out). */
  get mayCrank() {
    return this.gear === 0 || this.pedal >= this.gearbox.changeClutch;
  }

  /** Forces the lever to a gear without the clutch: the girls' shifter dips the clutch itself, and getting off puts it in neutral. */
  setGear(gear) {
    this.gear = gear;
  }

  /**
   * Moves the lever to a gear (-1 to 3). Neutral can always be found; the others need the clutch down.
   * Rushing it (the pedal only just down) can miss the gear and leave the lever in a false neutral; `careful` is for a driver who
   * never does (the girls' shifter holds the clutch down for each change itself). `speed` (m/s) matters for a gear with no synchromesh
   * (`crashGears`): moving faster than `crashSpeed`, it crunches and won't go in, unless you double-declutch: through neutral with the
   * clutch let up for `declutchTime`, then the revs (`revs`, 0 idle to 1 flat out) brought to what the gear's road speed needs, within
   * `matchTolerance`. Revs that are off say 'mismatch' and the gear stays out.
   * @returns {'ok'|'clutch'|'same'|'missed'|'crunch'|'mismatch'}
   */
  select(gear, careful = false, speed = 0, revs = undefined) {
    if (!GEARS.includes(gear) || gear > this.gearbox.gears) return 'same';
    if (gear === this.gear) return 'same';
    if (gear !== 0 && !this.canChange) return 'clutch';
    if (gear > 0 && gear <= (this.gearbox.crashGears ?? 0) && Math.abs(speed) > (this.gearbox.crashSpeed ?? 1)) {
      if (revs === undefined || this.gear !== 0 || this.neutralFree < (this.gearbox.declutchTime ?? 0.2)) return 'crunch';
      const target = clamp(Math.abs(speed) / this.topSpeed(gear), 0, 1);
      if (Math.abs(revs - target) > (this.gearbox.matchTolerance ?? 0.2)) return 'mismatch';
    }
    if (gear !== 0 && !careful && this.pedalDown < this.gearbox.rushTime && this.random() < this.gearbox.falseNeutralChance) {
      this.gear = 0;
      return 'missed';
    }
    this.gear = gear;
    return 'ok';
  }

  /** Marks a gear as worn: it jumps out under load on a climb, in proportion to `wear` (0 to 1). */
  wear(gear, wear) {
    this.worn = { gear, wear };
  }

  /** 'jumped' once after a worn gear has jumped out, else null. */
  takeEvent() {
    const e = this.event;
    this.event = null;
    return e;
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
   * @param {number} [s.rpm]         Used by the two-stroke's power band only.
   * @param {number} [s.lugDrop]
   * @param {number} [s.slope]       Sine of the climb: positive pointing uphill.
   * @param {number} [s.speedLimit]  A lower top speed than the gear's, m/s (the tractor creeping with nobody on it).
   */
  update({ dt = 0, clutchHeld = false, power, running, throttle, brake, forwardSpeed, rpm = 0, lugDrop = 0, slope = 0, speedLimit = Infinity }) {
    const p = this.params;
    const gb = this.gearbox;
    const speed = Math.abs(forwardSpeed);
    const rate = clutchHeld ? gb.clutchPressRate : gb.clutchReleaseRate;
    this.pedal = clamp(this.pedal + (clutchHeld ? 1 : -1) * rate * dt, 0, 1);
    this.clutch = smoothstep(0, 1, 1 - this.pedal);
    this.pedalDown = this.pedal >= gb.changeClutch ? this.pedalDown + dt : 0;
    this.neutralFree = this.gear !== 0 ? 0 : this.pedal < 0.3 ? this.neutralFree + dt : this.neutralFree;

    // A worn gear jumps out of mesh when it's pulling hard up a bank (not with the clutch down: that's just changing gear).
    if (this.worn && this.gear === this.worn.gear && running && this.clutch > 0.8 && throttle >= gb.jumpThrottle && slope >= gb.jumpSlope) {
      const rate = gb.jumpRate * this.worn.wear * Math.min(2, slope / gb.jumpSlope);
      if (this.random() < 1 - Math.exp(-rate * dt)) {
        this.gear = 0;
        this.event = 'jumped';
      }
    }

    const g = this.gear;
    const inGear = g !== 0 && running;
    const top = Math.min(this.topSpeed(g), speedLimit);
    const dir = g < 0 ? -1 : 1;

    this.coupled = inGear && this.clutch > 0.5 && speed > p.coupledReleaseSpeed;

    let force = 0;
    this.available = 0;
    if (inGear) {
      const pedalTorque = p.idleTorque + (1 - p.idleTorque) * throttle;
      const drivePower = p.drivePowerFloor + (1 - p.drivePowerFloor) * power;
      // A two-stroke is weak below its power band, whatever the gear; the four-strokes are flat.
      const band = p.powerbandRpm > 0 ? p.torqueBelowBand + (1 - p.torqueBelowBand) * smoothstep(p.powerbandRpm - 1200, p.powerbandRpm + 600, rpm + lugDrop) : 1;
      this.available = pedalTorque * band * drivePower * p.maxDriveForce * this.torque(g);
      // Past the gear's top speed (rolling downhill, say) it holds back rather than pushing.
      const speedFactor = clamp(1 - (speed / top) ** 2, 0, 1);
      force = dir * this.clutch * this.available * speedFactor;
      if (throttle < 0.05) {
        force -= Math.sign(forwardSpeed) * p.engineBrakeForce * this.clutch * Math.min(1, speed / 2);
        force -= Math.sign(forwardSpeed) * this.overrunForce(g, speed, top);
      }
    }
    this.driveForce = force;

    // Pulling away from rest in too high a gear drags the engine down, and so does braking while coupled.
    let load = 0;
    if (inGear) {
      const launch = this.launchLoad(g) * this.clutch * (1 - clamp(speed / (top * gb.lugSpeed), 0, 1)) * (1 - gb.launchRelief * throttle);
      // Braking with the clutch out only stalls it once it is slow enough to labour in that gear (the tractor's does at any speed).
      const lugged = gb.lugSpeed < 1 ? 1 - clamp(speed / (top * gb.lugSpeed), 0, 1) : 1;
      const braking = this.coupled ? brake * Math.min(1, speed / p.brakeLoadSpeed) * lugged : 0;
      load = Math.max(launch, braking);
    }
    this.engineLoad = clamp(load, 0, 1);
    return this;
  }
}
