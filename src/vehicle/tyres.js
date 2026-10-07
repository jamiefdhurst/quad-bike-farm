// A quad's tyres: each game it turns up with pressures not quite where they should be, mismatched brands front and rear and a
// worn (sometimes bald) rear, so grip and pull differ every game. Pressure is per wheel (the toolbox's gauge reads all four and its
// Tyres setting levels them); brand and tread are per axle. Pure logic, no Three.js; the physics asks it for per-wheel grip.
//
// Wheel order is the physics': 0 front left, 1 front right, 2 rear left, 3 rear right (see tyreSide in faults.js).

export const WHEEL_NAMES = ['FL', 'FR', 'RL', 'RR'];

export const BRANDS = {
  trackmaster: { label: 'Trackmaster', grass: 1, mud: 1 }, // an all-rounder that is better on grass
  mudclaw: { label: 'Mudclaw', grass: 0.93, mud: 1.2 }, // deep lugs: digs in in the wet, a bit skittish on grass
  roadrunner: { label: 'Roadrunner', grass: 1.06, mud: 0.88 }, // grips on the dry, slides about in mud
};
const BRAND_IDS = Object.keys(BRANDS);

export const DEFAULT_TYRE_PARAMS = {
  startBias: 0.5, // all four start up to this many psi either side of stock together (a shared low or high)
  startSpread: 0.4, // and each wheel up to this much either side of that
  oddOneChance: 0.25, // chance one wheel is further out
  oddOneLow: 0.8, // how much further out: from this many psi...
  oddOneHigh: 1.6, // ...to this many
  matchedChance: 0.4, // chance the rear is the same brand as the front
  frontTreadLow: 0.6, // front tread, 0 bald to 1 new
  baldChance: 0.25, // chance the rear is bald
  rearTreadLow: 0.55, // otherwise the rear tread runs from this to new...
  baldLow: 0.2, // ...and a bald one from this...
  baldHigh: 0.4, // ...to this
  treadDryLoss: 0.15, // grip lost on grass and the track with no tread at all
  treadMudLoss: 0.4, // and in mud and puddles
  flatDrop: 0.75, // how much of a wheel's pressure a puncture at its worst takes off the gauge
  minPsi: 1.5,
  maxPsi: 7,
};

export const TYRE_PARAM_RANGES = {
  startBias: [0, 2, 0.1],
  startSpread: [0, 2, 0.1],
  oddOneChance: [0, 1, 0.05],
  oddOneLow: [0, 3, 0.1],
  oddOneHigh: [0, 4, 0.1],
  matchedChance: [0, 1, 0.05],
  frontTreadLow: [0, 1, 0.05],
  baldChance: [0, 1, 0.05],
  rearTreadLow: [0, 1, 0.05],
  baldLow: [0, 1, 0.05],
  baldHigh: [0, 1, 0.05],
  treadDryLoss: [0, 1, 0.01],
  treadMudLoss: [0, 1, 0.01],
  flatDrop: [0, 1, 0.05],
  minPsi: [0, 5, 0.1],
  maxPsi: [3, 12, 0.5],
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const round = (v, step) => Math.round(v / step) * step;
const isFront = (i) => i < 2;

/** A fresh set at the stock pressure, all brand-matched and new: what a quad with no dealt tyres has. */
export function newTyres(stockPsi = 4) {
  return { psi: [stockPsi, stockPsi, stockPsi, stockPsi], brand: { front: 'trackmaster', rear: 'trackmaster' }, tread: { front: 1, rear: 1 } };
}

/** This game's tyres, from a seeded `random`. */
export function dealTyres(random, stockPsi = 4, P = DEFAULT_TYRE_PARAMS) {
  const bias = (random() * 2 - 1) * P.startBias;
  const psi = [0, 1, 2, 3].map(() => stockPsi + bias + (random() * 2 - 1) * P.startSpread);
  if (random() < P.oddOneChance) {
    const i = Math.floor(random() * 4);
    psi[i] += (random() < 0.5 ? -1 : 1) * lerp(P.oddOneLow, P.oddOneHigh, random());
  }
  const front = BRAND_IDS[Math.floor(random() * BRAND_IDS.length)];
  const others = BRAND_IDS.filter((b) => b !== front);
  const rear = random() < P.matchedChance ? front : others[Math.floor(random() * others.length)];
  const bald = random() < P.baldChance;
  return {
    psi: psi.map((v) => round(clamp(v, P.minPsi, P.maxPsi), 0.1)),
    brand: { front, rear },
    tread: {
      front: round(lerp(P.frontTreadLow, 1, random()), 0.01),
      rear: round(bald ? lerp(P.baldLow, P.baldHigh, random()) : lerp(P.rearTreadLow, 1, random()), 0.01),
    },
  };
}

export class TyreSet {
  /**
   * @param {object} [set]   { psi: [4], brand: { front, rear }, tread: { front, rear } }
   * @param {object} [P]     DEFAULT_TYRE_PARAMS
   * @param {object} [tune]  the toolbox's tunables (tuneUp.js): the psi effects live there, so they stay in the panel
   */
  constructor(set = newTyres(), P = DEFAULT_TYRE_PARAMS, tune = { stockPsi: 4, psiGrip: 0.06, psiMudGrip: 0.1, psiRolling: 0.12, psiStiffness: 0.07 }) {
    this.psi = [...set.psi];
    this.brand = { ...set.brand };
    this.tread = { ...set.tread };
    this.P = P;
    this.tune = tune;
  }

  get meanPsi() {
    return this.psi.reduce((a, b) => a + b, 0) / this.psi.length;
  }

  /** Pumps (or lets down) every tyre to the same pressure: the toolbox's setting. */
  level(psi) {
    const v = clamp(psi, this.P.minPsi, this.P.maxPsi);
    this.psi = this.psi.map(() => v);
  }

  /** What the gauge reads on each wheel: the pressure, less what a puncture has let out (`punctureWheel` -1 for none, level 0..1). */
  reading(punctureWheel = -1, level = 0) {
    return this.psi.map((v, i) => (i === punctureWheel ? v * (1 - this.P.flatDrop * level) : v));
  }

  /**
   * Grip multiplier for a wheel standing on ground with this much mud and puddle (0..1 each): its pressure, its axle's brand and tread.
   * Softer grips better, more so in mud; the brand's own grass and mud grip, and tread matters most where it's wet.
   */
  grip(i, mud = 0, puddle = 0) {
    const t = this.tune;
    const m = clamp(Math.max(mud, puddle), 0, 1);
    const axle = isFront(i) ? 'front' : 'rear';
    const brand = BRANDS[this.brand[axle]];
    const tread = this.tread[axle];
    const pressure = 1 - lerp(t.psiGrip, t.psiMudGrip, m) * (this.psi[i] - t.stockPsi);
    const treadFactor = lerp(1 - this.P.treadDryLoss * (1 - tread), 1 - this.P.treadMudLoss * (1 - tread), m);
    return Math.max(0.2, pressure) * lerp(brand.grass, brand.mud, m) * treadFactor;
  }

  /** Rolling resistance multiplier from the average pressure: harder tyres roll easier. */
  get rollingFactor() {
    return Math.max(0, 1 - this.tune.psiRolling * (this.meanPsi - this.tune.stockPsi));
  }

  /** Suspension stiffness multiplier for a wheel: soft tyres squash and bounce more. */
  stiffness(i) {
    return 1 + this.tune.psiStiffness * (this.psi[i] - this.tune.stockPsi);
  }

  /** "FL 3.8  FR 4.3  RL 4.0  RR 4.1 psi" */
  gauge(punctureWheel = -1, level = 0) {
    return `${this.reading(punctureWheel, level).map((v, i) => `${WHEEL_NAMES[i]} ${v.toFixed(1)}`).join('  ')} psi`;
  }

  /** "front Mudclaw, tread 0.82; rear Roadrunner, tread 0.30" */
  describe() {
    return ['front', 'rear'].map((a) => `${a} ${BRANDS[this.brand[a]].label}, tread ${this.tread[a].toFixed(2)}`).join('; ');
  }
}
