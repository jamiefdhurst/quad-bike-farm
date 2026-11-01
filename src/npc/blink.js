// Blinking. A girl's eyelids (eyelids.js builds them) come down in a quick blink every few seconds, now and then twice running, stay
// shut while she's asleep, and screw up tight when she laughs or flinches. Pure: this says how far shut the lids are (0 open, 1 shut,
// up to `squeezeLid` squeezed), eyelids.js poses them. Amy blinks a little slower and steadier than Jess (`blinkSlow`, `blinkSteady`).

export const DEFAULT_BLINK_PARAMS = {
  blinkGapMin: 2, // seconds between blinks, at the least
  blinkGapMax: 6, // and at the most
  blinkDouble: 0.15, // chance a blink is followed at once by another
  blinkClose: 0.06, // seconds for the lid to come down: quicker shut than open
  blinkOpen: 0.1, // and to go back up (0.16 s a blink)
  blinkDoubleGap: 0.12, // seconds between the two of a double blink
  squeezeLid: 1.25, // how far the lid goes when squeezed (1 is shut): lower, with the cheek lifting under it
  sleepSeconds: 0.5, // seconds her lids take to close as she falls asleep, and to open as she wakes
  squeezeSeconds: 0.12, // and to squeeze and let go
};

export const BLINK_PARAM_RANGES = {
  blinkGapMin: [0.5, 10, 0.1],
  blinkGapMax: [1, 20, 0.1],
  blinkDouble: [0, 1, 0.05],
  blinkClose: [0.02, 0.4, 0.01],
  blinkOpen: [0.02, 0.6, 0.01],
  blinkDoubleGap: [0.02, 0.6, 0.01],
  squeezeLid: [1, 1.5, 0.01],
  sleepSeconds: [0.05, 3, 0.05],
  squeezeSeconds: [0.02, 1, 0.02],
};

/** The reactions that screw her eyes shut (reactions.js): a start, a bang beside her, hands over her ears. */
export const SQUEEZING_REACTIONS = ['flinch', 'coverEars'];

const ease = (t) => t * t * (3 - 2 * t);

export class Blink {
  /** `slow`: her blinks take this many times as long (Amy 1.3); `steady`: 0..1, how evenly spaced they are (1 every time the same). */
  constructor(params = { ...DEFAULT_BLINK_PARAMS }, { slow = 1, steady = 0, random = Math.random } = {}) {
    this.p = params;
    this.slow = slow;
    this.steady = steady;
    this.random = random;
    this.rate = 1; // blinks this many times as often as the tuning says (the debug panel)
    this.hold = false; // eyes held shut (the debug panel)
    this.wait = this.gap(); // seconds to the next blink
    this.t = null; // seconds into the blink in progress, or null
    this.again = false; // the blink in progress is the first of a double
    this.second = false; // the next is the second of one
    this.sleepK = 0; // 0..1: how far asleep her lids are
    this.squeezeK = 0; // 0..1: how far squeezed
    this.lid = 0;
  }

  /** The seconds to her next blink, from the tuning's range (narrower the steadier she is). */
  gap() {
    const { blinkGapMin: lo, blinkGapMax: hi } = this.p;
    const mid = (lo + hi) / 2;
    const span = ((hi - lo) / 2) * (1 - 0.6 * this.steady);
    return Math.max(0.2, (mid - span + this.random() * 2 * span) / Math.max(0.05, this.rate));
  }

  /** Starts a blink now (a double one if `double`). */
  blink(double = false) {
    if (this.t !== null) return;
    this.t = 0;
    this.again = double;
  }

  get blinking() {
    return this.t !== null;
  }

  /**
   * One step. `asleep`: she's asleep or dozing; `squeeze`: she's laughing or flinching (0..1). Returns how shut the lids are: 0 open,
   * 1 shut, up to `squeezeLid` squeezed.
   */
  update(dt, { asleep = false, squeeze = 0 } = {}) {
    const p = this.p;
    this.sleepK = Math.max(0, Math.min(1, this.sleepK + ((asleep || this.hold ? 1 : -1) * dt) / p.sleepSeconds));
    const want = Math.max(0, Math.min(1, squeeze));
    this.squeezeK += Math.sign(want - this.squeezeK) * Math.min(Math.abs(want - this.squeezeK), dt / p.squeezeSeconds);
    // She doesn't blink with her eyes already shut.
    const shut = this.sleepK > 0.5 || this.squeezeK > 0.5;
    let pulse = 0;
    if (this.t !== null) {
      this.t += dt;
      const close = p.blinkClose * this.slow;
      const open = p.blinkOpen * this.slow;
      if (this.t < close) pulse = ease(this.t / close);
      else if (this.t < close + open) pulse = 1 - ease((this.t - close) / open);
      else {
        this.t = null;
        this.wait = this.again ? p.blinkDoubleGap : this.gap();
        this.second = this.again; // the one after a double's first is its second, never the start of another
        this.again = false;
      }
    } else if (!shut && (this.wait -= dt) <= 0) {
      this.blink(!this.second && this.random() < p.blinkDouble);
      this.second = false;
    }
    this.lid = Math.max(pulse, ease(this.sleepK), this.squeezeK * p.squeezeLid);
    return this.lid;
  }
}
