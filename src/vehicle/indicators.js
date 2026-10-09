// The Land Rovers' and the UTV's indicators. Three keys: left, right and hazards. A stalk cancels itself once the wheel has been turned
// the way it points and come back to straight; the hazards stay until pressed again. Pure logic, so it is tested without Three.js; the
// model lights the lamps (`setSignalLamps` in quadModel.js) and the dash shows a green tell-tale.

export const SIGNAL_MODES = ['off', 'left', 'right', 'hazard'];

export const DEFAULT_INDICATOR_PARAMS = {
  flashRate: 1.5, // flashes a second (the law says 60 to 120 a minute)
  litShare: 0.55, // how much of each flash the lamp is lit
  cancelTurn: 0.35, // how far the wheel must turn the way the indicator points (0..1 of full lock) before it counts as turning
  cancelStraight: 0.12, // and how close to straight it must come back for the indicator to cancel itself
  reverseGlow: 1, // the reverse lamp's brightness, 1 is the lens at full
};

export const INDICATOR_PARAM_RANGES = {
  flashRate: [0.8, 3, 0.05],
  litShare: [0.3, 0.8, 0.01],
  cancelTurn: [0.1, 0.9, 0.01],
  cancelStraight: [0.02, 0.4, 0.01],
  reverseGlow: [0.2, 2, 0.05],
};

export const INDICATOR_PARAMS = { ...DEFAULT_INDICATOR_PARAMS }; // shared by every vehicle that has them, registered once

export class Indicators {
  constructor() {
    this.mode = 'off';
    this.phase = 0; // 0..1 through the current flash
    this.turned = false; // the wheel has gone round the way the indicator points since it was switched on
    this.lit = false;
    this.click = null; // 'on' or 'off' on the frame the lamp changes, for the relay's tick (cleared by the next update)
  }

  /** A key: pressing the mode it is already in switches it off. Returns the new mode. */
  press(mode) {
    if (!SIGNAL_MODES.includes(mode) || mode === 'off') return this.mode;
    this.mode = this.mode === mode ? 'off' : mode;
    this.turned = false;
    this.phase = 0; // the first flash starts at once
    return this.mode;
  }

  set(mode) {
    if (!SIGNAL_MODES.includes(mode)) return this.mode;
    this.mode = mode;
    this.turned = false;
    this.phase = 0;
    return this.mode;
  }

  /**
   * Advances the flashing and the self-cancel.
   * @param {number} dt
   * @param {number} steer   the bars, -1..1, positive left
   * @param {boolean} powered   the key is on and the battery has something to give
   * @returns {{ left: boolean, right: boolean }} which sides' lamps are lit this frame
   */
  update(dt, steer, powered, P = INDICATOR_PARAMS) {
    this.click = null;
    if (this.mode === 'off' || !powered) {
      if (this.lit) this.click = 'off';
      this.lit = false;
      if (this.mode === 'off') this.phase = 0;
      return { left: false, right: false };
    }
    if (this.mode === 'left' || this.mode === 'right') {
      const way = this.mode === 'left' ? 1 : -1;
      if (steer * way > P.cancelTurn) this.turned = true;
      else if (this.turned && Math.abs(steer) < P.cancelStraight) {
        this.mode = 'off';
        this.turned = false;
        if (this.lit) this.click = 'off';
        this.lit = false;
        return { left: false, right: false };
      }
    }
    this.phase = (this.phase + dt * P.flashRate) % 1;
    const lit = this.phase < P.litShare;
    if (lit !== this.lit) this.click = lit ? 'on' : 'off';
    this.lit = lit;
    return { left: lit && this.mode !== 'right', right: lit && this.mode !== 'left' };
  }

  /** The dash's green tell-tale: lit with the lamps, whichever side. */
  get tellTale() {
    return this.lit;
  }
}
