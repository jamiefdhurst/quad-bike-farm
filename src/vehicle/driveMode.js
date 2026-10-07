// The 2WD / 4WD switch on the red and blue quads (and the blue's diff lock). Pure logic, no Three.js or Rapier.
//
// 2WD drives the rear axle only and is lighter on the bars; 4WD drives all four wheels, which is what mud wants, at a little more steering
// weight and driveline drag; the diff lock (blue only, 4WD only) pulls hardest in the mud and pushes wide on grass. The quad turns the mode
// into `driveEffects` each step. Which mode a quad is in persists (per quad, until a new game), so a girl who forgot leaves it forgotten.

export const DEFAULT_DRIVE_PARAMS = {
  steerRate2wd: 1.2, // bar response in 2WD, as a multiple of the quad's own steerRate: lighter, quicker bars
  steerRate4wd: 1, // and in 4WD (the quad's own figure)
  steerRateLock: 0.8, // and with the diff lock in, which is heavy on the bars
  steerScaleLock: 0.88, // fraction of full steering lock left with the diff lock in: it pushes wide
  fourWdLoss: 0.04, // fraction of the drive eaten by the front driveline in 4WD
  lockGrip: 1.12, // drive the tyres can take with the diff lock in, as a multiple of 4WD (the fronts share it however the grip splits)
  stuckMud: 0.35, // mud (0..1) under the wheels, with the throttle open, before a rear-wheel-drive quad counts as struggling
  stuckSeconds: 2.5, // seconds a girl on a 2WD quad has to be struggling in mud before she works out why and flips it to 4WD
  stuckSpeed: 1.2, // m/s: below this in the mud, she's struggling
};

export const DRIVE_PARAM_RANGES = {
  steerRate2wd: [0.5, 2, 0.05],
  steerRate4wd: [0.5, 2, 0.05],
  steerRateLock: [0.3, 2, 0.05],
  steerScaleLock: [0.4, 1, 0.01],
  fourWdLoss: [0, 0.3, 0.01],
  lockGrip: [1, 2, 0.01],
  stuckMud: [0.05, 1, 0.05],
  stuckSeconds: [0.5, 15, 0.5],
  stuckSpeed: [0.2, 4, 0.1],
};

export const DRIVE_MODES = ['2wd', '4wd', 'lock'];

export class DriveSwitch {
  /** @param {{ lock?: boolean, mode?: string }} opts  `lock`: this quad has a diff lock. */
  constructor({ lock = false, mode = '2wd' } = {}) {
    this.hasLock = lock;
    this.mode = DRIVE_MODES.includes(mode) && (lock || mode !== 'lock') ? mode : '2wd';
  }

  get frontDriven() {
    return this.mode !== '2wd';
  }

  get locked() {
    return this.mode === 'lock';
  }

  /** The 2WD / 4WD switch: anything in gear goes back to 2WD, 2WD goes to 4WD. Returns the new mode. */
  toggle() {
    this.mode = this.mode === '2wd' ? '4wd' : '2wd';
    return this.mode;
  }

  /** The diff lock button: in from 2WD or 4WD (it needs the fronts driven, so it brings 4WD with it), out if it was in. Does nothing without one. */
  toggleLock() {
    if (!this.hasLock) return this.mode;
    this.mode = this.mode === 'lock' ? '4wd' : 'lock';
    return this.mode;
  }

  /** The girls' (and the debug panel's) way in: set 4WD on, leaving a diff lock alone. */
  engage4wd() {
    if (this.mode === '2wd') this.mode = '4wd';
  }
}

/**
 * What a mode does to the quad this step.
 * @returns {{ frontDriven: boolean, steerRate: number, steerScale: number, driveScale: number, gripScale: number }}
 *   `steerRate` and `steerScale` multiply the quad's own bar response and lock; `driveScale` the drive force; `gripScale` the drive the tyres can take.
 */
export function driveEffects(mode, P = DEFAULT_DRIVE_PARAMS) {
  if (mode === '2wd') return { frontDriven: false, steerRate: P.steerRate2wd, steerScale: 1, driveScale: 1, gripScale: 1 };
  if (mode === 'lock') return { frontDriven: true, steerRate: P.steerRateLock, steerScale: P.steerScaleLock, driveScale: 1 - P.fourWdLoss, gripScale: P.lockGrip };
  return { frontDriven: true, steerRate: P.steerRate4wd, steerScale: 1, driveScale: 1 - P.fourWdLoss, gripScale: 1 };
}

/**
 * A girl on a quad in 2WD that's struggling in the mud works out why. Feed it each step she's driving; it says when to flip the switch.
 * `forgot` is set once, the first time, so Amy can tell Jess.
 */
export class StuckWatch {
  constructor(P = DEFAULT_DRIVE_PARAMS) {
    this.P = P;
    this.time = 0;
  }

  reset() {
    this.time = 0;
  }

  /** @returns {boolean} true on the step she realises. */
  update(dt, { is2wd, throttle, mud, speed }) {
    const struggling = is2wd && throttle > 0.4 && mud > this.P.stuckMud && speed < this.P.stuckSpeed;
    this.time = struggling ? this.time + dt : Math.max(0, this.time - dt * 2);
    if (this.time < this.P.stuckSeconds) return false;
    this.time = 0;
    return true;
  }
}

/** Who says what when a girl flips a quad to 4WD after getting bogged: Amy tells Jess (and Jess owns up with a bad grace). */
export function forgotReaction(who, girlsNear) {
  const near = girlsNear.filter((g) => g !== who);
  const lines = [{ girl: who, situation: 'fourWdOwn' }];
  if (near.length) lines.unshift({ girl: near[0], situation: `fourWdTold${who[0].toUpperCase()}${who.slice(1)}` });
  return lines;
}
