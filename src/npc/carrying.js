// A girl carrying something in one hand (the jerry can, the toolbox, a mug of tea). Pure logic: how heavy it feels, how it
// slows and leans her, and the stages of picking it up, carrying it and putting it down. companionCarrying.js poses her from this.

export const DEFAULT_CARRY_PARAMS = {
  reachTime: 0.7, // seconds to bend, take hold and straighten up with it
  lowerTime: 0.7, // seconds to bend and set it down
  canPace: 0.78, // times her walking speed with a full jerry can (an empty one is nearly 1)
  toolboxPace: 0.88, // times her walking speed with the toolbox
  mugPace: 0.95, // times her walking speed with a mug of tea
  balePace: 0.8, // times her walking speed with a bale of hay
  lean: 0.09, // radians she leans away from the weight, at full weight
  bend: 0.4, // radians she bends forward to pick it up or put it down
  sway: 0.04, // metres the hand swings back and forth with her stride
  sipFor: 2.2, // seconds she has a drink from the mug before putting it down
};

/** The live settings, shared by both girls so the tuning panel changes them together. */
export const carryParams = { ...DEFAULT_CARRY_PARAMS };

export const CARRY_PARAM_RANGES = {
  reachTime: [0.2, 2, 0.05],
  lowerTime: [0.2, 2, 0.05],
  canPace: [0.4, 1, 0.01],
  toolboxPace: [0.4, 1, 0.01],
  mugPace: [0.4, 1, 0.01],
  balePace: [0.4, 1, 0.01],
  lean: [0, 0.3, 0.01],
  bend: [0, 0.8, 0.02],
  sway: [0, 0.15, 0.005],
  sipFor: [0.5, 6, 0.1],
};

/**
 * What each thing is like in the hand. `grip` is how high the part she holds is above the bottom of it, `hand` where her wrist is in her own
 * frame (x to her left, y up, z forward) while she walks with it, `yaw` how it's turned from her facing, `light` the weight at its lightest, 0..1.
 */
export const CARRY_ITEMS = {
  can: { grip: 0.49, hand: [0.27, 0.74, 0.02], yaw: -Math.PI / 2, light: 0.35, pace: 'canPace' },
  toolbox: { grip: 0.255, hand: [0.27, 0.74, 0.02], yaw: -Math.PI / 2, light: 0.7, pace: 'toolboxPace' },
  squareBale: { grip: 0.19, hand: [0.5, 0.82, 0.05], yaw: -Math.PI / 2, light: 0.75, pace: 'balePace' }, // held by the twine on top (its middle is the model's origin), out to her side so it clears her hip
  mug: { grip: 0.05, hand: [0.1, 1.12, 0.3], yaw: 0, light: 0.05, pace: 'mugPace' },
};

/** How heavy it feels, 0..1: a jerry can by how full it is, the others by what they are. */
export function carryWeight(kind, litres = 0, capacity = 20) {
  const item = CARRY_ITEMS[kind];
  if (kind === 'can') return item.light + (1 - item.light) * Math.max(0, Math.min(1, litres / capacity));
  return item.light;
}

/** Her walking speed as a fraction of the usual while she carries it. The can runs from 1 (empty) down to `canPace` (full). */
export function carryPace(p, kind, weight) {
  if (kind === 'can') return 1 - (1 - p.canPace) * weight;
  return p[CARRY_ITEMS[kind].pace];
}

/** Her lean away from it, in radians. */
export function carryLean(p, weight) {
  return p.lean * weight;
}

const smooth = (t) => t * t * (3 - 2 * t);

/**
 * The stages: 'raise' (taking hold and straightening up), 'hold', 'lower' (bending and setting it down), 'done'. `k` is 0 with it on the ground
 * and 1 in her hand; `ease` is the same smoothed. In the hold a mug can be sipped: `sip` rises to 1 and falls back.
 */
export class Carry {
  constructor(kind, weight, params = DEFAULT_CARRY_PARAMS, { sip = false } = {}) {
    this.kind = kind;
    this.weight = weight;
    this.p = params;
    this.phase = 'raise';
    this.k = 0;
    this.sipping = sip;
    this.sipTime = 0;
    this.held = 0; // seconds in the hold
  }

  get ease() {
    return smooth(this.k);
  }

  /** 0..1, how far the mug is up at her mouth. */
  get sip() {
    if (!this.sipping || this.phase !== 'hold') return 0;
    const t = this.sipTime / this.p.sipFor;
    return t <= 0 || t >= 1 ? 0 : smooth(Math.min(1, t / 0.25)) * smooth(Math.min(1, (1 - t) / 0.25));
  }

  /** Whether the sip has been had. */
  get sipped() {
    return !this.sipping || this.sipTime >= this.p.sipFor;
  }

  /** She has it in her hand already (a mug brought from the house). */
  inHand() {
    this.phase = 'hold';
    this.k = 1;
  }

  /** Starts setting it down. */
  lower() {
    if (this.phase === 'done') return;
    this.phase = 'lower';
  }

  /** Moves on; returns 'raised' or 'lowered' on the step it finishes that stage. */
  update(dt) {
    if (this.phase === 'raise') {
      this.k = Math.min(1, this.k + dt / this.p.reachTime);
      if (this.k >= 1) {
        this.phase = 'hold';
        return 'raised';
      }
    } else if (this.phase === 'hold') {
      this.held += dt;
      if (this.sipping) this.sipTime += dt;
    } else if (this.phase === 'lower') {
      this.k = Math.max(0, this.k - dt / this.p.lowerTime);
      if (this.k <= 0) {
        this.phase = 'done';
        return 'lowered';
      }
    }
    return null;
  }

  /** How far she bends forward, 0..1: most at the bottom of the lift. */
  get stoop() {
    return 1 - this.ease;
  }
}
