// The windscreen wipers on the cars, the Land Rovers and the UTV. Pure logic, no Three.js: the stalk (or switch) and where the blades are.
//
// Each vehicle's spec lists the speeds its stalk has, in order (`wipers: ['int', 'slow', 'fast']`), and X steps the stalk through them and
// back to off. The blades run off the ignition: with the key off they stop where they are, and switched off mid-sweep they carry on to
// the bottom of the screen and park, as the real motor's self-park does. `blade` is 0 parked to 1 at the far end of the sweep, eased at
// each end so the blades slow and turn round as they do. The model turns the arms (`poseWipers` in quadModel.js) and the screen's drops
// are cleared where they pass (effects/screenRain.js).

export const WIPER_SPEEDS = ['int', 'slow', 'fast'];

export const DEFAULT_WIPER_PARAMS = {
  slowCycle: 1.5, // seconds for a slow wipe, across and back (about 40 a minute)
  fastCycle: 0.95, // and a fast one (about 60 a minute)
  intPause: 4.5, // seconds parked between wipes on intermittent
  girlIntFrom: 0.05, // a girl driving puts them on intermittent once the rain is more than this (0..1)
  girlSlowFrom: 0.3, // slow from this
  girlFastFrom: 0.7, // and fast from this
};

export const WIPER_PARAM_RANGES = {
  slowCycle: [0.6, 3, 0.05],
  fastCycle: [0.4, 2, 0.05],
  intPause: [1, 15, 0.5],
  girlIntFrom: [0, 0.5, 0.01],
  girlSlowFrom: [0, 1, 0.01],
  girlFastFrom: [0, 1, 0.01],
};

export const WIPER_PARAMS = { ...DEFAULT_WIPER_PARAMS }; // shared by every vehicle that has them, registered once

/** What a speed is called, for the panel, the console and the FAQ. */
export const SPEED_NAMES = { off: 'off', int: 'intermittent', slow: 'slow', fast: 'fast' };

export class Wipers {
  /** @param {string[]} speeds  the stalk's positions after off, from WIPER_SPEEDS */
  constructor(speeds = ['slow']) {
    this.speeds = speeds.filter((s) => WIPER_SPEEDS.includes(s));
    this.setting = 'off';
    this.phase = 0; // 0..1 through the current wipe; 0 is parked
    this.wait = 0; // seconds left parked before intermittent wipes again
    this.blade = 0; // 0 parked .. 1 at the far end
    this.moved = false; // the stalk moved this frame (for its click; cleared by the next update)
  }

  /** The stalk's positions, off first. */
  positions() {
    return ['off', ...this.speeds];
  }

  /** X: the stalk on one notch, from the last back to off. Returns the new setting. */
  step() {
    const at = this.positions();
    return this.set(at[(at.indexOf(this.setting) + 1) % at.length]);
  }

  /** Sets the stalk to a position it has; anything else leaves it. Returns the setting. */
  set(setting) {
    if (!this.positions().includes(setting) || setting === this.setting) return this.setting;
    const wasOff = this.setting === 'off';
    this.setting = setting;
    this.moved = true;
    if (wasOff) this.wait = 0; // switching on starts a wipe at once, intermittent too
    return this.setting;
  }

  /** Whether the blades are moving or about to: on, or still going home to park. */
  get running() {
    return this.setting !== 'off' || this.phase > 0;
  }

  /**
   * Moves the blades on.
   * @param {number} dt
   * @param {boolean} powered  the ignition is on and the battery has something to give
   */
  update(dt, powered, P = WIPER_PARAMS) {
    this.moved = false;
    if (!powered) return this.blade; // the motor stops dead: the blades stay where they are
    if (this.setting !== 'int') this.wait = 0; // only intermittent waits parked: a pause left over from it would hold slow and fast still
    const cycle = this.setting === 'fast' ? P.fastCycle : P.slowCycle;
    if (this.phase > 0 || (this.setting !== 'off' && this.wait <= 0)) {
      this.phase += dt / cycle;
      if (this.phase >= 1) {
        // Home at the bottom of the screen: park if switched off, pause if intermittent, otherwise straight into the next wipe.
        this.phase = this.setting === 'off' || this.setting === 'int' ? 0 : this.phase % 1;
        if (this.setting === 'int') this.wait = P.intPause;
      }
    } else if (this.setting === 'int') {
      this.wait -= dt;
    }
    this.blade = (1 - Math.cos(2 * Math.PI * this.phase)) / 2;
    return this.blade;
  }
}

/** What a girl driving sets the stalk to for the rain: the slowest it has that keeps up, off when it's dry. */
export function girlWiperSetting(rain, speeds, P = WIPER_PARAMS) {
  if (rain <= P.girlIntFrom || !speeds.length) return 'off';
  const want = rain >= P.girlFastFrom ? ['fast', 'slow', 'int'] : rain >= P.girlSlowFrom ? ['slow', 'fast', 'int'] : ['int', 'slow', 'fast'];
  return want.find((s) => speeds.includes(s));
}
