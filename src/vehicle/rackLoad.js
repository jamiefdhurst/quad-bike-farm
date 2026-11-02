// A load on a quad's rear rack: a jerry can or the toolbox stood on it, and the ratchet strap that holds it there. Pure logic, no
// Three.js: game.js poses the models and the strap from what this says, and it is tested in tests/rackLoad.test.js.
//
//   loose      stood on the rack; it shuffles with the quad's shake (looseThings.js) and, if the quad is braked hard or jolted over a
//              bump, slides off the back
//   strapped   held down: it rides along, never moves, and is only heavier to carry
//
// E on the rack is one control with two lengths (controls.md): a tap takes a loose load off, and holding E straps a loose load or
// unstraps a strapped one.

export const DEFAULT_RACK_PARAMS = {
  canKg: 12, // a full jerry can, kilos on the rack
  toolboxKg: 8, // the toolbox with its tools in
  driveLoss: 0.006, // fraction of the quad's drive lost per kilo carried
  brakeLoss: 0.004, // and of its braking: a heavier quad stops slower
  minDrive: 0.8, // the least drive left, whatever is on it
  minBrake: 0.85, // and the least braking
  tapSeconds: 0.25, // a press shorter than this is a tap: take a loose load off
  strapSeconds: 1.2, // holding E this long, after the tap, to ratchet the strap tight (or undo it)
  shakeGain: 0.012, // slide-off built up per second at one shake level above looseThings' threshold
  brakeFrom: 4.5, // m/s squared of slowing that starts it sliding forward off the rack's front edge, or back on the way down
  brakeGain: 0.18, // slide-off per second for each m/s squared over that
  bumpFrom: 9, // m/s squared of up-and-down jolt that starts the load hopping
  bumpGain: 0.06, // slide-off per second for each m/s squared over that
  settle: 0.25, // slide-off lost per second when nothing is pushing it
  slideAt: 1, // the load is off the rack when the slide-off reaches this
};

export const RACK_PARAM_RANGES = {
  canKg: [0, 40, 1],
  toolboxKg: [0, 40, 1],
  driveLoss: [0, 0.02, 0.0005],
  brakeLoss: [0, 0.02, 0.0005],
  minDrive: [0.3, 1, 0.01],
  minBrake: [0.3, 1, 0.01],
  tapSeconds: [0.1, 0.6, 0.05],
  strapSeconds: [0.2, 4, 0.1],
  shakeGain: [0, 0.1, 0.002],
  brakeFrom: [1, 12, 0.5],
  brakeGain: [0, 1, 0.02],
  bumpFrom: [2, 30, 0.5],
  bumpGain: [0, 0.5, 0.01],
  settle: [0, 2, 0.05],
  slideAt: [0.2, 3, 0.1],
};

/** What a load weighs, by the kind of thing it is. */
export function rackKg(kind, p = DEFAULT_RACK_PARAMS) {
  return kind === 'toolbox' ? p.toolboxKg : kind === 'can' ? p.canKg : 0;
}

/** What `kg` on the rack takes off the quad's drive and brakes. */
export function rackEffect(kg, p = DEFAULT_RACK_PARAMS) {
  if (kg <= 0) return { driveFactor: 1, brakeFactor: 1 };
  return { driveFactor: Math.max(p.minDrive, 1 - kg * p.driveLoss), brakeFactor: Math.max(p.minBrake, 1 - kg * p.brakeLoss) };
}

/**
 * How hard the quad is pushing a loose load off, per second: its shake (above `shakeFrom`, the same level looseThings.js uses), a hard
 * brake (`long` is the quad's forward acceleration, negative when slowing) and a jolt (`vert`, its up-and-down acceleration).
 */
export function slidePush(shakeDrive, long, vert, p = DEFAULT_RACK_PARAMS) {
  return shakeDrive * p.shakeGain + Math.max(0, -long - p.brakeFrom) * p.brakeGain + Math.max(0, Math.abs(vert) - p.bumpFrom) * p.bumpGain;
}

export class RackLoad {
  constructor(params = DEFAULT_RACK_PARAMS) {
    this.p = params;
    this.item = null;
    this.kind = null;
    this.strapped = false;
    this.slide = 0; // 0..slideAt: how close a loose load is to going over
    this.pressing = false;
    this.pressed = 0; // seconds E has been down on it
  }

  get loaded() {
    return !!this.item;
  }

  get kg() {
    return this.item ? rackKg(this.kind, this.p) : 0;
  }

  /** 0..1: how far the strap has been ratcheted (or undone) so far in this press. */
  get progress() {
    return this.pressing ? Math.min(1, Math.max(0, (this.pressed - this.p.tapSeconds) / this.p.strapSeconds)) : 0;
  }

  /** Stands a load on the rack, loose. */
  put(item, kind) {
    this.item = item;
    this.kind = kind;
    this.strapped = false;
    this.slide = 0;
    this.cancel();
  }

  /** Takes it off, however it went; returns what was there. */
  clear() {
    const item = this.item;
    this.item = null;
    this.kind = null;
    this.strapped = false;
    this.slide = 0;
    this.cancel();
    return item;
  }

  press() {
    this.pressing = true;
    this.pressed = 0;
  }

  /** E still down on the rack this frame. Returns 'strapped' or 'unstrapped' on the frame the hold completes. */
  hold(dt) {
    if (!this.pressing || !this.item) return null;
    this.pressed += dt;
    if (this.pressed < this.p.tapSeconds + this.p.strapSeconds) return null;
    this.pressing = false;
    this.strapped = !this.strapped;
    this.slide = 0;
    return this.strapped ? 'strapped' : 'unstrapped';
  }

  /** E let go. A short press on a loose load is a tap: 'takeOff'. Anything else is a hold that did not finish, and is dropped. */
  release() {
    const tap = this.pressing && this.pressed < this.p.tapSeconds && !this.strapped && !!this.item;
    this.cancel();
    return tap ? 'takeOff' : null;
  }

  /** Looked away, or the quad moved off. */
  cancel() {
    this.pressing = false;
    this.pressed = 0;
  }

  /** One frame of the quad underneath. Returns 'slid' on the frame a loose load goes over. */
  update(dt, push) {
    if (!this.item || this.strapped) return null;
    this.slide = Math.max(0, this.slide + (push > 0 ? push * dt : -this.p.settle * dt));
    if (this.slide < this.p.slideAt) return null;
    this.slide = 0;
    return 'slid';
  }
}
