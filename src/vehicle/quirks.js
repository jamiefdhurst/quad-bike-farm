// Quirks: each game every quad gets one to three small, permanent oddities from a pool (a fuel gauge that lies, a stiff fuel tap, a
// horn that works when it likes...). Nothing says which; you find out, or a girl who knows warns you. Unlike the faults that develop
// (faults.js) they are the quad's character and nobody fixes them, apart from the stiff tap, which frees up with use. Pure logic, no
// Three.js, so the effects are tested here and quad.js, game.js and rideAudio.js only ask for the numbers.

export const QUIRK_KINDS = ['fuelHigh', 'fuelSticks', 'tempCold', 'chokeCreeps', 'tapStiff', 'seatSplit', 'hornFlaky', 'brakesPull', 'brakeSqueal', 'headlightFlicker'];

export const DEFAULT_QUIRK_PARAMS = {
  countTwo: 0.35, // chance a quad gets two quirks (one is the rest less the next)
  countThree: 0.15, // chance a quad gets three
  fuelHighPower: 0.6, // the fuel gauge shows level to this power, so below full it reads high (and empty still reads empty)
  fuelStickJump: 0.01, // per second moving that a sticking fuel needle gets a knock and jumps to the real level before sticking again
  tempColdCap: 0.12, // the temperature needle never gets past this engine temperature (0 cold, 1 warm)
  chokeCreepRate: 0.25, // lever steps a second at full shake that the choke creeps back on, when running
  chokeCreepMax: 0.5, // the most the shake will pull the choke on to
  tapStiffPresses: 3, // presses of F to get a fully stiff tap to move (they have to come within tapStiffWindow of each other)
  tapStiffWindow: 2, // seconds
  tapStiffFreed: 0.35, // how much of its stiffness each turn takes off, so a few turns and it's free
  seatWetRise: 0.08, // per second the split seat soaks up in rain out in the open
  seatWetDry: 0.0015, // per second it dries (about eleven minutes from soaked)
  seatWetFrom: 0.3, // how wet before sitting on it soaks you
  hornWorks: 0.55, // chance the flaky horn works when you press it
  hornCutOut: 0.7, // per second a working flaky horn dies mid-beep
  hornCutIn: 0.9, // per second a dead one splutters back while it's still held
  brakePull: 0.05, // radians the bars are pulled to the left under full braking
  squealSpeed: 1.5, // m/s above which a squealing brake squeals under braking
  flickerEvery: 2.5, // seconds between flickers on average (it is 0.4 to 1.6 times this)
  flickerDip: 0.12, // seconds a flicker lasts
  flickerDepth: 0.85, // how far the light drops in a flicker
};

export const QUIRK_PARAM_RANGES = {
  countTwo: [0, 1, 0.05],
  countThree: [0, 1, 0.05],
  fuelHighPower: [0.2, 1, 0.05],
  fuelStickJump: [0, 0.2, 0.005],
  tempColdCap: [0, 0.5, 0.01],
  chokeCreepRate: [0, 2, 0.05],
  chokeCreepMax: [0, 1, 0.1],
  tapStiffPresses: [1, 6, 1],
  tapStiffWindow: [0.5, 5, 0.1],
  tapStiffFreed: [0, 1, 0.05],
  seatWetRise: [0, 0.5, 0.01],
  seatWetDry: [0, 0.02, 0.0005],
  seatWetFrom: [0, 1, 0.05],
  hornWorks: [0, 1, 0.05],
  hornCutOut: [0, 5, 0.1],
  hornCutIn: [0, 5, 0.1],
  brakePull: [0, 0.2, 0.005],
  squealSpeed: [0, 6, 0.1],
  flickerEvery: [0.5, 15, 0.5],
  flickerDip: [0.02, 0.5, 0.01],
  flickerDepth: [0, 1, 0.05],
};

/** Dash styles that show a fuel level and an engine temperature themselves (the others need a pod fitted to show them). */
const GAUGE_DASHES = ['grizzly', 'kodiak', 'series'];

/**
 * What a quad has that a quirk could act on. `hasPod`: an accessory pod is fitted at the start, which reads the quad's fuel and
 * temperature senders. The gauge quirks only land where a gauge is there to show them.
 */
export function featuresOf(spec, hasPod = false) {
  const gauge = hasPod || GAUGE_DASHES.includes(spec.dashStyle);
  return {
    fuelGauge: gauge,
    tempGauge: gauge,
    choke: !spec.tractor && !spec.utv,
    tap: !spec.fuel?.noTap,
    seat: !spec.tractor && !spec.utv && !spec.landRover && spec.id !== 'kids' && spec.id !== 'moto', // the Land Rover's is a vinyl bench
    horn: true,
    brakes: true,
    headlight: true,
  };
}

const NEEDS = {
  fuelHigh: 'fuelGauge',
  fuelSticks: 'fuelGauge',
  tempCold: 'tempGauge',
  chokeCreeps: 'choke',
  tapStiff: 'tap',
  seatSplit: 'seat',
  hornFlaky: 'horn',
  brakesPull: 'brakes',
  brakeSqueal: 'brakes',
  headlightFlicker: 'headlight',
};

/** The quirks a quad could have. */
export function applicableQuirks(features) {
  return QUIRK_KINDS.filter((k) => features[NEEDS[k]]);
}

/** One to three quirks for a quad, never both of the fuel gauge ones. `random` is seeded, so `?seed=` repeats it. */
export function pickQuirks(features, random, P = DEFAULT_QUIRK_PARAMS) {
  const pool = applicableQuirks(features);
  const roll = random();
  const count = roll < P.countThree ? 3 : roll < P.countThree + P.countTwo ? 2 : 1;
  const picked = [];
  while (picked.length < count && pool.length) {
    const kind = pool.splice(Math.floor(random() * pool.length), 1)[0];
    picked.push(kind);
    const other = kind === 'fuelHigh' ? 'fuelSticks' : kind === 'fuelSticks' ? 'fuelHigh' : null;
    if (other && pool.includes(other)) pool.splice(pool.indexOf(other), 1);
  }
  return picked;
}

/**
 * What one girl believes a quad's quirks are: each real one she knows with probability `accuracy` (her diagnoseAccuracy),
 * and the less sure she is, the likelier she is to be convinced of one it hasn't got.
 */
export function girlKnowsQuirks(kinds, applicable, accuracy, random) {
  const knows = kinds.filter(() => random() < accuracy);
  const spare = applicable.filter((k) => !kinds.includes(k));
  if (spare.length && random() < (1 - accuracy) * 0.5) knows.push(spare[Math.floor(random() * spare.length)]);
  return knows;
}

const lerp = (a, b, t) => a + (b - a) * t;

export class QuirkSet {
  constructor(kinds = [], P = DEFAULT_QUIRK_PARAMS, random = Math.random) {
    this.kinds = [...kinds];
    this.P = P;
    this.random = random;
    this.stuckFuel = lerp(0.2, 0.9, random()); // where a sticking needle is stuck
    this.fuelKnocked = false;
    this.creep = 0;
    this.tapStiff = 1; // 1 fully stiff, 0 free
    this.tapPresses = 0;
    this.tapWindow = 0;
    this.seatWet = 0;
    this.hornWorks = false;
    this.hornDown = false;
    this.hornSounding = false;
    this.flickerIn = lerp(0.4, 1.6, random()) * P.flickerEvery;
    this.flickerLeft = 0;
    this.flickerLevel = 1;
  }

  has(kind) {
    return this.kinds.includes(kind);
  }

  /** The fuel level, engine temperature and overheat the dash shows, with this quad's lies in them. */
  dash({ fuelLevel, temperature, overheat }, dt, moving = false) {
    const P = this.P;
    let fuel = fuelLevel;
    if (this.has('fuelHigh')) fuel = Math.min(1, Math.max(0, fuelLevel)) ** P.fuelHighPower;
    if (this.has('fuelSticks')) {
      if (moving && this.random() < P.fuelStickJump * dt) this.stuckFuel = fuelLevel; // a knock frees it, then it sticks where it lands
      fuel = this.stuckFuel;
    }
    if (this.has('tempCold')) return { fuelLevel: fuel, temperature: Math.min(temperature, P.tempColdCap), overheat: 0 };
    return { fuelLevel: fuel, temperature, overheat };
  }

  /** How much the choke creeps on this frame (a `step` of the lever, or 0), shaken by a running engine. */
  chokeCreep(dt, { running, shake, choke }, step = 0.1) {
    if (!this.has('chokeCreeps') || !running || choke >= this.P.chokeCreepMax - 1e-6) return 0;
    this.creep += dt * this.P.chokeCreepRate * Math.min(1, Math.max(0, shake));
    if (this.creep < 1) return 0;
    this.creep = 0;
    return step;
  }

  /** The player presses the fuel tap key: whether the tap actually turns this time. */
  pressTap() {
    if (!this.has('tapStiff') || this.tapStiff <= 0) return true;
    const needed = Math.max(1, Math.round(1 + this.tapStiff * (this.P.tapStiffPresses - 1)));
    this.tapPresses += 1;
    this.tapWindow = this.P.tapStiffWindow;
    if (this.tapPresses < needed) return false;
    this.tapPresses = 0;
    this.tapStiff = Math.max(0, this.tapStiff - this.P.tapStiffFreed);
    return true;
  }

  /** Bars pulled to the left (radians, positive is left) by braking. */
  brakePull(brake) {
    return this.has('brakesPull') ? this.P.brakePull * Math.min(1, Math.max(0, brake)) : 0;
  }

  /** How hard a squealing brake squeals, 0..1. */
  squeal(brake, speed) {
    if (!this.has('brakeSqueal') || speed < this.P.squealSpeed) return 0;
    return Math.min(1, Math.max(0, brake - 0.15)) * Math.min(1, speed / 5);
  }

  /** A split seat soaks up rain in the open and slowly dries. */
  seatStep(dt, { raining, covered }) {
    if (!this.has('seatSplit')) return;
    const P = this.P;
    this.seatWet = Math.min(1, Math.max(0, this.seatWet + (raining && !covered ? P.seatWetRise : -P.seatWetDry) * dt));
  }

  get seatSoaks() {
    return this.has('seatSplit') && this.seatWet >= this.P.seatWetFrom;
  }

  /** Sitting down: soaks you if it's wet enough, and then it's soaked up less (your trousers have it now). */
  sitOn() {
    if (!this.seatSoaks) return false;
    this.seatWet = Math.max(0, this.seatWet - 0.3);
    return true;
  }

  /** Whether the horn sounds this frame, given whether it's held. A flaky one works when it likes and cuts in and out. */
  horn(dt, held) {
    if (!this.has('hornFlaky')) return held;
    const P = this.P;
    if (held && !this.hornDown) this.hornWorks = this.random() < P.hornWorks;
    this.hornDown = held;
    if (!held) return (this.hornSounding = false);
    if (this.hornSounding) {
      if (this.random() < P.hornCutOut * dt) this.hornSounding = false;
    } else if (this.hornWorks) {
      this.hornSounding = true;
    } else if (this.random() < P.hornCutIn * dt) {
      this.hornSounding = true;
    }
    return this.hornSounding;
  }

  /** Per frame housekeeping: the tap's press window. */
  update(dt) {
    if (this.tapWindow > 0 && (this.tapWindow -= dt) <= 0) this.tapPresses = 0;
  }

  /** The headlamp's brightness, 0..1 of normal: it dips for a moment every so often. */
  headlight(dt) {
    if (!this.has('headlightFlicker')) return 1;
    const P = this.P;
    if (this.flickerLeft > 0) {
      this.flickerLeft -= dt;
      if (this.flickerLeft <= 0) {
        this.flickerLevel = 1;
        this.flickerIn = lerp(0.4, 1.6, this.random()) * P.flickerEvery;
      } else {
        this.flickerLevel = 1 - P.flickerDepth * (0.5 + 0.5 * this.random());
      }
    } else if ((this.flickerIn -= dt) <= 0) {
      this.flickerLeft = P.flickerDip * lerp(0.5, 1.5, this.random());
    }
    return this.flickerLevel;
  }
}
