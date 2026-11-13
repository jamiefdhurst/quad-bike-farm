// The Tor's drop tailgate. Pure logic, no Three.js: the game poses the model from `open` (cabModel.js poseTorTailgate) and
// tests/tailgate.test.js checks it. T drops it or raises it, from the seat or standing by the tub, only when the truck is nearly stopped; it
// is thrown shut again if you drive off with it down (the chains would not hold it at speed).

export const DEFAULT_TAILGATE_PARAMS = {
  seconds: 0.9, // it swings the whole way in this long
  maxToggleSpeed: 0.8, // m/s: it will not be let down while moving faster than this
  shutSpeed: 2.5, // m/s: drive off with it down and it swings shut by itself
};

export const TAILGATE_PARAM_RANGES = {
  seconds: [0.2, 3, 0.1],
  maxToggleSpeed: [0.1, 4, 0.1],
  shutSpeed: [0.5, 8, 0.1],
};

export class Tailgate {
  constructor(params = { ...DEFAULT_TAILGATE_PARAMS }) {
    this.p = params;
    this.open = 0; // 0 shut to 1 lying flat
    this.want = false;
  }

  /** Whether it is shut. */
  get shut() {
    return this.open <= 0.001 && !this.want;
  }

  /** Drops it or raises it. Returns a note for whoever asked when nothing happened, or null when it did. */
  toggle(speed) {
    if (this.want) {
      this.want = false;
      return null;
    }
    if (Math.abs(speed) > this.p.maxToggleSpeed) return 'Stop first: the tailgate will not come down while it is moving';
    this.want = true;
    return null;
  }

  update(dt, { speed = 0 } = {}) {
    if (this.want && Math.abs(speed) > this.p.shutSpeed) this.want = false;
    const step = dt / this.p.seconds;
    this.open = this.want ? Math.min(1, this.open + step) : Math.max(0, this.open - step);
  }
}
