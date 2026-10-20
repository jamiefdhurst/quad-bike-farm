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

/**
 * The kinds of tyre the barn stocks, which a vehicle's spec names as its `tyreSize`. The spares shelf has one part for each (`tyre` + the id with
 * a capital: tyreKid, tyreQuad...), counted in single tyres; `one` and `many` are how the shelf and the toasts say them.
 */
export const TYRE_SIZES = {
  kid: { one: 'small quad tyre', many: 'small quad tyres' }, // the kids' quad and the mini moto
  quad: { one: 'quad tyre', many: 'quad tyres' }, // the utility quads
  sport: { one: 'sport quad tyre', many: 'sport quad tyres' }, // the two-stroke sports quads
  trike: { one: 'balloon tyre', many: 'balloon tyres' }, // the old three-wheeler's
  utv: { one: 'utility vehicle tyre', many: 'utility vehicle tyres' },
  landrover: { one: 'Land Rover tyre', many: 'Land Rover tyres' },
  car: { one: 'car tyre', many: 'car tyres' },
  tractor: { one: 'tractor tyre', many: 'tractor tyres' },
};
export const TYRE_SIZE_IDS = Object.keys(TYRE_SIZES);

/** The spares shelf's part id for a tyre size: 'quad' is 'tyreQuad'. */
export const tyrePart = (size) => `tyre${size[0].toUpperCase()}${size.slice(1)}`;

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
  rimPsi: 2.2, // below this a tyre starts to squash off the rim: the bars pull towards it and it drags
  rimPull: 0.06, // radians of pull at 0 psi on a front wheel (half for a rear)
  rimDrag: 0.25, // share of the drive lost at 0 psi
  pumpStep: 0.5, // psi a click on the pump adds or lets out
  minPsi: 1.5, // the lowest a tyre is dealt
  ventMinPsi: 0.5, // the lowest you can let one down to at the pump
  maxPsi: 7,
  wearPerMetre: 0.00007, // tread lost per metre rolled on grass or the track: about 14 km makes a new tyre bald
  wearTarmac: 2, // times as fast on tarmac
  wearMud: 0.5, // times as fast in mud and puddles (soft ground is kind to a tyre)
  wearDriven: 1.3, // times as fast on a driven wheel...
  wearFree: 0.7, // ...and on one that only rolls
  wearSpin: 0.004, // tread a second lost by a driven wheel spinning at its worst (a doughnut): a minute of it is a quarter of a tyre
  baldPuncture: 3, // times as likely a puncture is to start with no tread left on the worst axle (1 with new tyres)
  replaceBelow: 0.95, // the bench only offers new tyres once an axle is worn below this
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
  rimPsi: [0, 4, 0.1],
  rimPull: [0, 0.3, 0.01],
  rimDrag: [0, 1, 0.05],
  pumpStep: [0.1, 2, 0.1],
  minPsi: [0, 5, 0.1],
  ventMinPsi: [0, 2, 0.1],
  maxPsi: [3, 12, 0.5],
  wearPerMetre: [0, 0.001, 0.00001],
  wearTarmac: [0, 5, 0.1],
  wearMud: [0, 3, 0.1],
  wearDriven: [0, 3, 0.1],
  wearFree: [0, 3, 0.1],
  wearSpin: [0, 0.05, 0.001],
  baldPuncture: [1, 10, 0.5],
  replaceBelow: [0, 1, 0.05],
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
    this.wheels = null; // [{ i, name, front }] when the vehicle isn't a plain four-wheeler (see useLayout)
  }

  /** A bike or a three-wheeler has fewer tyres than four: the gauge and the front/rear split follow its real wheels (outriggers have none). */
  useLayout(layoutWheels) {
    if (layoutWheels.length === 4 && !layoutWheels.some((w) => w.outrigger)) return;
    const list = layoutWheels.map((w, i) => ({ i, w })).filter(({ w }) => !w.outrigger);
    this.wheels = list.map(({ i, w }) => ({ i, front: !!w.front, name: (w.front ? 'F' : 'R') + (Math.abs(w.x) < 0.05 ? '' : w.x > 0 ? 'L' : 'R') }));
  }

  get meanPsi() {
    const psi = this.wheels ? this.wheels.map((w) => this.psi[w.i]) : this.psi;
    return psi.reduce((a, b) => a + b, 0) / psi.length;
  }

  /** Pumps (or lets down) every tyre to the same pressure: the toolbox's setting. */
  level(psi) {
    const v = clamp(psi, this.P.minPsi, this.P.maxPsi);
    this.psi = this.psi.map(() => v);
  }

  /** The real wheels as { i, name, front, side } (side 1 left, -1 right, 0 centre): what the pump lists. */
  get realWheels() {
    const list = this.wheels ?? WHEEL_NAMES.map((name, i) => ({ i, name, front: isFront(i) }));
    return list.map((w) => ({ ...w, side: w.name.length > 1 ? (w.name.endsWith('L') ? 1 : -1) : 0 }));
  }

  /** Pumps one tyre up (positive) or lets air out (negative), by `psi`; returns the new pressure. */
  pump(i, psi) {
    this.psi[i] = round(clamp(this.psi[i] + psi, this.P.ventMinPsi, this.P.maxPsi), 0.1);
    return this.psi[i];
  }

  /** 0..1 how far a tyre is down below the pressure where it starts to roll off the rim. */
  rimLevel(i) {
    return clamp((this.P.rimPsi - this.psi[i]) / Math.max(0.1, this.P.rimPsi), 0, 1);
  }

  /** Radians the bars are pulled by tyres let right down (positive is left); added to the puncture's pull. */
  get steerPull() {
    let pull = 0;
    for (const w of this.realWheels) pull += w.side * (w.front ? 1 : 0.5) * this.P.rimPull * this.rimLevel(w.i);
    return pull;
  }

  /** Multiplier on the drive force: a tyre half off its rim drags. */
  get driveFactor() {
    const worst = Math.max(0, ...this.realWheels.map((w) => this.rimLevel(w.i)));
    return 1 - this.P.rimDrag * worst;
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
    const axle = (this.wheels ? this.wheels.find((w) => w.i === i)?.front : isFront(i)) ? 'front' : 'rear';
    const brand = BRANDS[this.brand[axle]];
    const tread = this.tread[axle];
    const pressure = 1 - lerp(t.psiGrip, t.psiMudGrip, m) * (this.psi[i] - t.stockPsi);
    const treadFactor = lerp(1 - this.P.treadDryLoss * (1 - tread), 1 - this.P.treadMudLoss * (1 - tread), m);
    return Math.max(0.2, pressure) * lerp(brand.grass, brand.mud, m) * treadFactor;
  }

  /** Which wheels (physics indices) are on an axle: a bike has one a side, a quad two, an outrigger none. */
  axleWheels(axle) {
    return this.realWheels.filter((w) => w.front === (axle === 'front'));
  }

  /**
   * Wears the tyre on wheel `i` for `metres` rolled and `seconds` of wheelspin, on ground that is `tarmac` and `mud` (0..1 each). The tread is
   * per axle, so each of its tyres wears its share. Returns how much came off the axle.
   */
  wearWheel(i, { metres = 0, tarmac = 0, mud = 0, spin = 0, seconds = 0, driven = false }) {
    const P = this.P;
    const w = this.realWheels.find((x) => x.i === i);
    if (!w) return 0;
    const axle = w.front ? 'front' : 'rear';
    const rolled = metres * P.wearPerMetre * lerp(1, P.wearTarmac, clamp(tarmac, 0, 1)) * lerp(1, P.wearMud, clamp(mud, 0, 1)) * (driven ? P.wearDriven : P.wearFree);
    const lost = (rolled + (driven ? spin * seconds * P.wearSpin : 0)) / this.axleWheels(axle).length;
    this.tread[axle] = clamp(this.tread[axle] - lost, 0, 1);
    return lost;
  }

  /** The axle with the least tread ('front' if they are level). */
  get worstAxle() {
    return this.tread.rear < this.tread.front ? 'rear' : 'front';
  }

  /** Whether the worn axle is worn enough for new tyres to be worth fitting. */
  get wantsNew() {
    return this.tread[this.worstAxle] < this.P.replaceBelow;
  }

  /** New tyres on an axle. Returns how many were fitted (the shelf's cost). */
  replace(axle) {
    this.tread[axle] = 1;
    return this.axleWheels(axle).length;
  }

  /** Multiplier on how often a puncture starts: a bald tyre picks up every thorn. */
  get punctureFactor() {
    const worst = Math.min(this.tread.front, this.tread.rear);
    return 1 + (this.P.baldPuncture - 1) * (1 - worst) * (1 - worst);
  }

  /** "Front 82%, rear 30%" for the gauge panel. */
  treadText() {
    return ['front', 'rear'].filter((a) => this.axleWheels(a).length).map((a) => `${a === 'front' ? 'Front' : 'Rear'} ${Math.round(this.tread[a] * 100)}%`).join('   ');
  }

  /** Rolling resistance multiplier from the average pressure: harder tyres roll easier. */
  get rollingFactor() {
    return Math.max(0, 1 - this.tune.psiRolling * (this.meanPsi - this.tune.stockPsi));
  }

  /** Suspension stiffness multiplier for a wheel: soft tyres squash and bounce more. */
  stiffness(i) {
    return 1 + this.tune.psiStiffness * (this.psi[i] - this.tune.stockPsi);
  }

  /** "FL 3.8  FR 4.3  RL 4.0  RR 4.1 psi" (a bike's reads "F 3.8  R 4.0 psi") */
  gauge(punctureWheel = -1, level = 0) {
    const r = this.reading(punctureWheel, level);
    const shown = this.wheels ?? r.map((_, i) => ({ i, name: WHEEL_NAMES[i] }));
    return `${shown.map((w) => `${w.name} ${r[w.i].toFixed(1)}`).join('  ')} psi`;
  }

  /** "front Mudclaw, tread 0.82; rear Roadrunner, tread 0.30" */
  describe() {
    return ['front', 'rear'].map((a) => `${a} ${BRANDS[this.brand[a]].label}, tread ${this.tread[a].toFixed(2)}`).join('; ');
  }
}
