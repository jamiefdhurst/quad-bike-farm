// The MOT at Hollis Motors: a Tor or Crag parked square in the garage's bay is gone over and given a sheet of what passed and what failed, each
// from the vehicle's own faults and wear. A pass is a certificate good for a few farm days, kept by the farm; a fail is only a sheet, and the lane stays
// open (the girls mind, see girlMinds). Pure: no Three.js or DOM, the host reads the unit through `readCondition` and draws what this says.
// Tested in tests/mot.test.js. docs/decisions/vehicles.md, "An MOT for the Tor and the Crag (#73, was TODO 178)".

export const DEFAULT_MOT_PARAMS = {
  price: 20, // pounds from the tin for a test
  testSeconds: 20, // the garage going over it
  validDays: 14, // farm days a pass is good for
  saleBonus: 0.08, // the share a valid certificate adds to the cork board's offer
  parkWithin: 2.2, // metres the vehicle's middle may be off the bay's middle
  parkSquare: 0.3, // radians its heading may be off the bay's
  wornAt: 0.6, // bulbs, blades or horn contacts this worn fail
  treadMin: 0.15, // tread (0..1) under this fails the tyres
  psiMin: 2.2, // a tyre under this many psi fails
  faultAt: 0.25, // a fault (a leak, a hole in the silencer, a seeping tyre) at this level or over fails its item
  brakeHeat: 0.45, // brakes this hot (fading) fail
  leakAt: 0.1, // coolant leaking at this rate or over fails the leak
  exhaustAt: 0.3, // a blown silencer at this level or over fails the exhaust
  bulbsPerHour: 0.12, // bulbs' wear per engine hour
  bladesPerHour: 0.14, // wiper rubbers' wear per engine hour
  hornPerHour: 0.08, // horn contacts' wear per engine hour
  dealMax: 0.55, // the most a vehicle is dealt of each at the start of a game
  logKept: 12, // tests the farm remembers
};

export const MOT_PARAMS = { ...DEFAULT_MOT_PARAMS }; // shared by the garage and every Tor's or Crag's wear, registered once

export const MOT_PARAM_RANGES = {
  price: [0, 200, 1],
  testSeconds: [3, 90, 1],
  validDays: [1, 90, 1],
  saleBonus: [0, 0.5, 0.01],
  parkWithin: [0.5, 5, 0.1],
  parkSquare: [0.05, 1, 0.05],
  wornAt: [0.2, 1, 0.05],
  treadMin: [0, 0.6, 0.05],
  psiMin: [0, 5, 0.1],
  faultAt: [0.05, 1, 0.05],
  brakeHeat: [0, 1, 0.05],
  leakAt: [0, 1, 0.05],
  exhaustAt: [0, 1, 0.05],
  bulbsPerHour: [0, 1, 0.01],
  bladesPerHour: [0, 1, 0.01],
  hornPerHour: [0, 1, 0.01],
  dealMax: [0, 1, 0.05],
  logKept: [1, 50, 1],
};

/** The vehicles the garage tests: the Tor and the Crag. */
export const canMot = (spec) => !!spec?.landRover;

/** The items on the sheet, in the order the garage goes through them. */
export const MOT_ITEMS = ['lights', 'brakes', 'wipers', 'horn', 'tyres', 'leak', 'exhaust'];

export const ITEM_NAMES = { lights: 'Lights', brakes: 'Brakes', wipers: 'Wipers', horn: 'Horn', tyres: 'Tyres', leak: 'Leaks', exhaust: 'Exhaust' };

/** What the sheet says beside a failed item. */
export const FAIL_NOTES = {
  lights: 'bulb blown or dim',
  brakes: 'binding, sticking or fading',
  wipers: 'blades split, smearing',
  horn: 'will not sound',
  tyres: 'tread or pressure below the limit',
  leak: 'fluid weeping',
  exhaust: 'blowing, hole in the silencer',
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The bulbs, wiper rubbers and horn contacts of a Tor or Crag: 0 new .. 1 gone. Dealt a little worn at the start of a game and wearing with
 * the engine hours; the bench's electrics job renews all three. Nothing else reads them but the MOT.
 */
export class MotWear {
  constructor(p = MOT_PARAMS) {
    this.p = p;
    this.bulbs = 0;
    this.blades = 0;
    this.horn = 0;
  }

  /** Deals its starting wear from `random` (so a seed repeats it). */
  deal(random) {
    this.bulbs = random() * this.p.dealMax;
    this.blades = random() * this.p.dealMax;
    this.horn = random() * this.p.dealMax;
  }

  /** Wears with `hours` of engine running. */
  wear(hours) {
    this.bulbs = clamp01(this.bulbs + hours * this.p.bulbsPerHour);
    this.blades = clamp01(this.blades + hours * this.p.bladesPerHour);
    this.horn = clamp01(this.horn + hours * this.p.hornPerHour);
  }

  /** New bulbs, blades and horn contacts, as the bench fits them. */
  renew() {
    this.bulbs = 0;
    this.blades = 0;
    this.horn = 0;
  }

  capture() {
    return { bulbs: this.bulbs, blades: this.blades, horn: this.horn };
  }

  restore(s) {
    for (const k of ['bulbs', 'blades', 'horn']) if (typeof s?.[k] === 'number' && Number.isFinite(s[k])) this[k] = clamp01(s[k]);
  }
}

/**
 * What the garage looks at, read off a unit: { wear: { bulbs, blades, horn }, brakes: { binding, heat, wet }, faults: { kind: level (0 if not started) },
 * tread: { front, rear }, psi: [..], coolantLeak, silencerBlown }. The host builds it; a test can write it by hand.
 */
export function readCondition(unit) {
  const q = unit.quad;
  const e = unit.engine;
  const started = (kind) => (q.faults.started?.[kind] ? q.faults.levels?.[kind] ?? 0.15 : 0);
  const faults = {};
  for (const k of ['puncture', 'tyreLeak', 'valveCore', 'tyreUneven', 'brakeMud', 'caliper', 'gasket', 'exhaustHole']) faults[k] = started(k);
  return {
    wear: q.motWear ? q.motWear.capture() : { bulbs: 0, blades: 0, horn: 0 },
    brakes: { binding: !!q.brakes?.binding, heat: q.brakes?.heat ?? 0, wet: q.brakes?.wet ?? 0 },
    faults,
    tread: { front: q.tyres?.tread?.front ?? 1, rear: q.tyres?.tread?.rear ?? 1 },
    psi: q.tyres ? [...q.tyres.psi] : [],
    coolantLeak: e.coolantLeak ?? 0,
    silencerBlown: e.silencerBlown ?? 0,
  };
}

/** Whether one item fails, from a condition. */
export function itemFails(item, c, P = DEFAULT_MOT_PARAMS) {
  const f = c.faults ?? {};
  switch (item) {
    case 'lights': return c.wear.bulbs >= P.wornAt;
    case 'wipers': return c.wear.blades >= P.wornAt;
    case 'horn': return c.wear.horn >= P.wornAt;
    case 'brakes': return !!c.brakes.binding || c.brakes.heat >= P.brakeHeat || (f.brakeMud ?? 0) >= P.faultAt || (f.caliper ?? 0) >= P.faultAt;
    case 'tyres':
      return Math.min(c.tread.front, c.tread.rear) < P.treadMin || c.psi.some((p) => p < P.psiMin)
        || [f.puncture, f.tyreLeak, f.valveCore, f.tyreUneven].some((l) => (l ?? 0) >= P.faultAt);
    case 'leak': return c.coolantLeak >= P.leakAt || (f.gasket ?? 0) >= P.faultAt;
    case 'exhaust': return c.silencerBlown >= P.exhaustAt || (f.exhaustHole ?? 0) >= P.faultAt;
    default: return false;
  }
}

/** The sheet for a condition: { passed, items: [{ id, name, pass, note }], fails: [ids] }. */
export function inspect(c, P = DEFAULT_MOT_PARAMS) {
  const items = MOT_ITEMS.map((id) => {
    const pass = !itemFails(id, c, P);
    return { id, name: ITEM_NAMES[id], pass, note: pass ? 'pass' : FAIL_NOTES[id] };
  });
  const fails = items.filter((i) => !i.pass).map((i) => i.id);
  return { passed: fails.length === 0, items, fails };
}

/** Why a test can't start now, or null. `at` is { dx, dz, yaw } of the vehicle from the bay's middle and heading. */
export function whyNotTest({ spec, onBay, purse, busy, running }, P = DEFAULT_MOT_PARAMS) {
  if (busy) return 'The garage is going over one now';
  if (!onBay) return 'Park a Tor or Crag square in the MOT bay first';
  if (!canMot(spec)) return 'Hollis Motors only does the Tor and the Crag';
  if (running) return 'Switch the engine off first';
  if (purse < P.price) return `You are £${P.price - purse} short`;
  return null;
}

/** Whether a vehicle sits in the bay: near the middle and pointing along it, either way round. */
export function inBay({ x, z, yaw }, bay, P = DEFAULT_MOT_PARAMS) {
  if (Math.hypot(x - bay.x, z - bay.z) > P.parkWithin) return false;
  const d = Math.abs(Math.atan2(Math.sin(yaw - bay.yaw), Math.cos(yaw - bay.yaw)));
  return d <= P.parkSquare || Math.PI - d <= P.parkSquare;
}

/**
 * What the farm remembers of its tests, per vehicle model: the last sheet ({ day, passed, fails }) and, after a pass, the day the certificate runs
 * to. A new test replaces the last one; a fail leaves an old certificate alone but a fresh fail on the same vehicle means the girls go by the fail.
 */
export class MotLog {
  constructor(p = MOT_PARAMS) {
    this.p = p;
    this.last = {}; // specId -> { day, passed, fails }
    this.certificate = {}; // specId -> the last farm day it is good for
    this.history = []; // { day, specId, passed, fails } newest last
  }

  record(specId, day, sheet) {
    this.last[specId] = { day, passed: sheet.passed, fails: [...sheet.fails] };
    if (sheet.passed) this.certificate[specId] = day + this.p.validDays;
    else delete this.certificate[specId]; // a fail voids it: the sheet is the latest word
    this.history.push({ day, specId, passed: sheet.passed, fails: [...sheet.fails] });
    while (this.history.length > this.p.logKept) this.history.shift();
  }

  /** Whether the vehicle has a pass that is still good on `day`. */
  valid(specId, day) {
    return this.certificate[specId] !== undefined && day <= this.certificate[specId];
  }

  /** The latest test failed (the girls mind). A later pass clears it. */
  failed(specId) {
    return this.last[specId] ? !this.last[specId].passed : false;
  }

  /** "Passed on day 12, good to day 26", "Failed on day 12: lights, horn", "Pass ran out on day 26", or "Never tested". */
  describe(specId, day) {
    const l = this.last[specId];
    if (!l) return 'never tested';
    if (!l.passed) return `failed on day ${l.day}: ${l.fails.map((f) => ITEM_NAMES[f].toLowerCase()).join(', ')}`;
    return this.valid(specId, day) ? `passed on day ${l.day}, good to day ${this.certificate[specId]}` : `pass ran out on day ${this.certificate[specId]}`;
  }

  toJSON() {
    return { last: structuredClone(this.last), certificate: { ...this.certificate }, history: structuredClone(this.history) };
  }

  restore(s) {
    if (!s || typeof s !== 'object') return;
    const num = (v) => typeof v === 'number' && Number.isFinite(v);
    for (const [id, l] of Object.entries(s.last ?? {})) {
      if (num(l?.day) && typeof l.passed === 'boolean' && Array.isArray(l.fails)) this.last[id] = { day: l.day, passed: l.passed, fails: l.fails.filter((f) => MOT_ITEMS.includes(f)) };
    }
    for (const [id, d] of Object.entries(s.certificate ?? {})) if (num(d)) this.certificate[id] = d;
    this.history = (s.history ?? []).filter((h) => num(h?.day) && typeof h.specId === 'string' && Array.isArray(h.fails)).slice(-this.p.logKept);
  }
}

/** The cork board's offer with a valid certificate: the bonus on top, rounded to a tenner as the offers are. */
export function withCertificate(price, valid, P = DEFAULT_MOT_PARAMS) {
  return valid ? Math.round((price * (1 + P.saleBonus)) / 10) * 10 : price;
}

/**
 * How a girl takes a vehicle whose latest test failed, when you drive the lane: Amy won't get on as a passenger, Jess does and says so.
 * Returns 'ok' (nothing to mind), 'refuses' or 'grumbles'.
 */
export function girlMinds(girlId, failed) {
  if (!failed) return 'ok';
  return girlId === 'amy' ? 'refuses' : 'grumbles';
}

/** The sheet's words: its heading, a row for each item, and the verdict with the certificate's last day on a pass. */
export function sheetLines(name, sheet, day, P = MOT_PARAMS) {
  return {
    title: `MOT test: ${name}`,
    rows: sheet.items.map((i) => ({ name: i.name, pass: i.pass, note: i.note })),
    verdict: sheet.passed ? `PASS. Certificate good to day ${day + P.validDays}` : `FAIL: ${sheet.fails.map((f) => ITEM_NAMES[f].toLowerCase()).join(', ')}`,
    advice: sheet.passed ? '' : 'Put it right at the bench and bring it back.',
  };
}
