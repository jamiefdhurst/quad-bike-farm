// The UTV's tipping bed and its tailgate. Pure logic, no Three.js: the game poses the model from `tip` and `gate` (vehicle/utvModel.js
// poseUtvBed) and tested in tests/utvBed.test.js.
//
//   tip: how far the bed has risen, 0 down to 1 fully up; it climbs on a hydraulic ram, slowly, and comes down a little quicker
//   gate: how open the tailgate is, 0 shut to 1 lying flat. It's down while a girl sits on it, and it drops open by itself as the bed rises.

export const DEFAULT_UTV_BED_PARAMS = {
  riseSeconds: 7, // the ram takes this long to lift the bed all the way
  lowerSeconds: 5, // and this long to let it down
  gateSeconds: 0.9, // the tailgate swings open or shut in this long
  maxTipSpeed: 0.8, // m/s: the bed won't go up while it's moving faster than this
  autoLowerSpeed: 2, // m/s: drive off with it up and the ram lets it down again by itself
  gateOpenAt: 0.08, // the tailgate unlatches once the bed has risen this far
  slideAt: 0.55, // how far up the bed is when whoever is sitting on the tailgate starts to slide off
  tipLeaveAt: 0.04, // the bed counts as down below this
};

export const UTV_BED_PARAM_RANGES = {
  riseSeconds: [1, 20, 0.5],
  lowerSeconds: [1, 20, 0.5],
  gateSeconds: [0.2, 3, 0.1],
  maxTipSpeed: [0.1, 4, 0.1],
  autoLowerSpeed: [0.5, 8, 0.1],
  gateOpenAt: [0, 0.5, 0.01],
  slideAt: [0.1, 1, 0.01],
  tipLeaveAt: [0, 0.2, 0.01],
};

export class UtvBed {
  constructor(params = { ...DEFAULT_UTV_BED_PARAMS }) {
    this.p = params;
    this.tip = 0;
    this.gate = 0;
    this.want = false; // the ram is lifting it (true) or lowering it (false)
    this.cap = 1; // how far up this lift goes: less than 1 holds it part-way (the muck job's spreading tilt)
    this.gateHeld = false; // somebody is sat on the tailgate, so it stays down
  }

  /** Whether the bed is down and shut. */
  get stowed() {
    return this.tip <= this.p.tipLeaveAt && this.gate <= 0.001;
  }

  /** Whether it's high enough that anyone on the tailgate slides off. */
  get sliding() {
    return this.tip >= this.p.slideAt;
  }

  /**
   * The tip lever: raises the bed, or lowers it if it's going up or up already (pulled while it's coming down, it goes up again). Returns a note for whoever pulled it when nothing happened, or
   * null when it did.
   */
  toggle(speed) {
    if (this.want) {
      this.want = false;
      return null;
    }
    if (Math.abs(speed) > this.p.maxTipSpeed) return 'Stop first: the bed will not go up while it is moving';
    this.want = true;
    return null;
  }

  /** One step. `ctx`: speed (m/s), gateDown (a girl is sitting on the tailgate or climbing onto it). */
  update(dt, ctx) {
    const p = this.p;
    if (this.want && Math.abs(ctx.speed) > p.autoLowerSpeed) this.want = false;
    this.gateHeld = !!ctx.gateDown;
    if (this.want) this.tip = Math.max(Math.min(this.cap, this.tip + dt / p.riseSeconds), this.tip - dt / p.lowerSeconds);
    else this.tip = Math.max(0, this.tip - dt / p.lowerSeconds);
    // The tailgate: open while the bed is up and while somebody sits on it, otherwise shut again once the bed is down.
    const wantOpen = this.gateHeld || this.tip >= p.gateOpenAt;
    const step = dt / p.gateSeconds;
    this.gate = wantOpen ? Math.min(1, this.gate + step) : Math.max(0, this.gate - step);
  }
}
