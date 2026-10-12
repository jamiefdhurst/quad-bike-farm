// Carburettor icing. Petrol evaporating in the venturi chills the air in it by many degrees, so on a cold, damp day the moisture freezes
// round the throttle plate. It builds at a steady part throttle, where the air is moving slowly enough and the plate is partly shut, and
// strangles the engine (the engine takes `ice` as a power loss). A blip of the throttle breaks it off; so does stopping to idle,
// where the warm engine melts it. A diesel has no carb, so it never ices. Pure logic, no Three.js: quad.js feeds it each step.

export const DEFAULT_CARB_ICE_PARAMS = {
  buildRate: 0.035, // ice a second in the worst weather at a steady part throttle (about half a minute from clear to choked)
  coldBest: 2, // degrees C: the coldest the worst icing weather goes (below this the air is too dry to do much)
  warmBest: 8, // and the warmest; icing fades out either side of the two
  coldEdge: -4, // degrees C at which it stops altogether on the cold side
  warmEdge: 14, // and on the warm side
  dampFrom: 0.25, // below this much damp (rain, or wet ground) the air is too dry
  partLow: 0.12, // the throttle band that builds it: the least open
  partHigh: 0.75, // and the most (nearly flat out, the air rushes past too fast to freeze)
  steadyRate: 1.2, // the throttle may move this much a second and still count as steady
  blipRate: 3.5, // a throttle opened faster than this a second is a blip
  blipClear: 0.5, // the ice a blip breaks off
  idleMelt: 0.06, // ice a second melted with the throttle shut and the engine running
  offMelt: 0.03, // and with the engine off
  heatSlow: 0.5, // how much a warm engine slows the build (0 not at all, 1 stops it when fully warm)
  feelFrom: 0.15, // below this much ice the engine doesn't lose anything you'd feel
};

export const CARB_ICE_PARAM_RANGES = {
  buildRate: [0, 0.2, 0.005],
  coldBest: [-5, 10, 0.5],
  warmBest: [0, 20, 0.5],
  coldEdge: [-15, 5, 0.5],
  warmEdge: [5, 25, 0.5],
  dampFrom: [0, 1, 0.05],
  partLow: [0, 0.5, 0.01],
  partHigh: [0.3, 1, 0.01],
  steadyRate: [0.1, 5, 0.1],
  blipRate: [0.5, 10, 0.1],
  blipClear: [0, 1, 0.05],
  idleMelt: [0, 0.3, 0.005],
  offMelt: [0, 0.3, 0.005],
  heatSlow: [0, 1, 0.05],
  feelFrom: [0, 0.5, 0.01],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 0..1 how well the day suits icing: cold enough and damp enough, worst between `coldBest` and `warmBest`. */
export function icingWeather(temperature, damp, p = DEFAULT_CARB_ICE_PARAMS) {
  if (damp < p.dampFrom) return 0;
  const t = temperature < p.coldBest ? (temperature - p.coldEdge) / (p.coldBest - p.coldEdge) : (p.warmEdge - temperature) / (p.warmEdge - p.warmBest);
  const wet = (damp - p.dampFrom) / (1 - p.dampFrom);
  return temperature >= p.coldBest && temperature <= p.warmBest ? clamp01(0.5 + 0.5 * wet) : clamp01(t) * clamp01(0.5 + 0.5 * wet);
}

export class CarbIcing {
  constructor(params = DEFAULT_CARB_ICE_PARAMS, enabled = true) {
    this.P = params;
    this.enabled = enabled; // false for a diesel
    this.ice = 0; // 0 clear .. 1 choked
    this.lastThrottle = 0;
    this.blipped = false; // set for the step a blip broke ice off, for the engine's ear
  }

  /** You can feel it: the engine is losing power. */
  get icing() {
    return this.enabled && this.ice >= this.P.feelFrom;
  }

  /** One step. `temperature` in degrees C and `damp` (0..1) are the weather now; `engineTemp` is the engine's 0..1; `revs` is 0..1 above idle. */
  update(dt, { running = false, throttle = 0, revs = 0, temperature = 12, damp = 0, engineTemp = 0 } = {}) {
    const P = this.P;
    const rate = dt > 0 ? (throttle - this.lastThrottle) / dt : 0;
    this.lastThrottle = throttle;
    this.blipped = false;
    if (!this.enabled) {
      this.ice = 0;
      return;
    }
    if (!running) {
      this.ice = clamp01(this.ice - dt * P.offMelt);
      return;
    }
    if (rate > P.blipRate && this.ice > 0) {
      this.ice = clamp01(this.ice - P.blipClear);
      this.blipped = true;
      return;
    }
    const steady = throttle >= P.partLow && throttle <= P.partHigh && Math.abs(rate) <= P.steadyRate && revs > 0.05;
    if (steady) this.ice = clamp01(this.ice + dt * P.buildRate * icingWeather(temperature, damp, P) * (1 - P.heatSlow * clamp01(engineTemp)));
    else if (throttle < P.partLow) this.ice = clamp01(this.ice - dt * P.idleMelt);
  }

  /** Put right (the panel's "Put it right"). */
  fix() {
    this.ice = 0;
  }
}
