// The trickle charger on the bench: one battery at a time, stood on its mat (items/battery.js), charged slowly over a few
// minutes while you get on with other things. The battery's charge is still the engine's `battery` number; the charger only
// raises it while that battery is on the mat, wherever the quad is.
// Pure logic, no Three.js or DOM.

export const DEFAULT_CHARGER_PARAMS = {
  rate: 0.0036, // battery (0..1) gained per second while it is on: flat to full in about five minutes
  taperFrom: 0.85, // above this charge it eases off, like a real trickle charger
  taperTo: 0.3, // and by full it is down to this share of the rate
  fullAt: 0.98, // the light goes green at this charge
  fitRange: 4, // metres from a quad within which the toolbox fits its loose battery back
};

export const CHARGER_PARAM_RANGES = {
  rate: [0.0005, 0.05, 0.0005],
  taperFrom: [0.5, 1, 0.01],
  taperTo: [0.05, 1, 0.05],
  fullAt: [0.8, 1, 0.01],
  fitRange: [1, 12, 0.5],
};

/** The charge one second adds at this level: the plain rate, easing off near the top. */
export function chargeStep(level, dt, P = DEFAULT_CHARGER_PARAMS) {
  const t = Math.max(0, Math.min(1, (level - P.taperFrom) / Math.max(0.01, 1 - P.taperFrom)));
  return P.rate * (1 - (1 - P.taperTo) * t) * dt;
}

export class Charger {
  constructor(params = { ...DEFAULT_CHARGER_PARAMS }) {
    this.params = params;
    this.unitId = null; // whose battery is on it
    this.full = false;
  }

  get busy() {
    return this.unitId !== null;
  }

  holds(unitId) {
    return this.unitId === unitId;
  }

  /** A battery goes on the mat. */
  put(unitId, engine) {
    this.unitId = unitId;
    this.full = engine.battery >= this.params.fullAt;
  }

  /** It comes off again. */
  take() {
    this.unitId = null;
    this.full = false;
  }

  /** One step with the engine whose battery is on it. Returns 'full' on the step the light goes green. */
  update(dt, engine) {
    if (!this.busy || !engine) return null;
    engine.battery = Math.min(1, engine.battery + chargeStep(engine.battery, dt, this.params));
    if (!this.full && engine.battery >= this.params.fullAt) {
      this.full = true;
      return 'full';
    }
    return null;
  }

  toJSON() {
    return { unitId: this.unitId };
  }


}
