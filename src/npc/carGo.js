// The girls and their own cars. Each takes hers out now and then, for a run down the farm road and back (never into the fields: they're
// road cars), and nobody else drives it: Jess never takes Amy's Fiesta, and Amy wouldn't be seen in Jess's Corsa at the wheel. You can
// borrow either, and its owner minds (borrowing, below). Pure logic: the game says who is free and whether her car is, and acts on the
// events; a go is an offer the chooser weighs (chooser.js). Tested in tests/carGo.test.js.

export const DEFAULT_CAR_GO_PARAMS = {
  firstAfter: 200, // seconds into the game before either takes her car out
  every: 480, // seconds between one girl's goes in her car
  // How she drives it: speeds (m/s) on the way, how long she's out, and how hard she uses the throttle. Amy is careful and on L plates;
  // Jess drives hers as she drives everything.
  amySpeedMin: 5,
  amySpeedMax: 11,
  jessSpeedMin: 8,
  jessSpeedMax: 16,
  forMin: 70,
  forMax: 130,
  amyMaxThrottle: 0.6,
  jessMaxThrottle: 1,
  // Borrowing: how much her favour drops when you take hers without her (once a go), and more for what comes back.
  favourTaken: -0.5,
  favourDamaged: -1, // it came back with a fault it didn't have, or bogged
  favourRidden: 0.3, // you took her with you: she likes being asked
  seenRange: 45, // metres: she notices you driving off in it, or bringing it back
};

export const CAR_GO_PARAM_RANGES = {
  firstAfter: [0, 1800, 10],
  every: [30, 3600, 10],
  amySpeedMin: [1, 30, 0.5],
  amySpeedMax: [1, 30, 0.5],
  jessSpeedMin: [1, 30, 0.5],
  jessSpeedMax: [1, 30, 0.5],
  forMin: [10, 600, 5],
  forMax: [10, 600, 5],
  amyMaxThrottle: [0.1, 1, 0.05],
  jessMaxThrottle: [0.1, 1, 0.05],
  favourTaken: [-5, 0, 0.1],
  favourDamaged: [-5, 0, 0.1],
  favourRidden: [0, 3, 0.1],
  seenRange: [5, 150, 5],
};

/** Who owns a car spec (its `owner`), and whether a girl may drive it: only her own. */
export function mayDriveCar(girlId, spec) {
  return !spec?.car || spec.owner === girlId;
}

/**
 * What she says when you ask her to drive a car that isn't hers: your own (#229) gets "it's yours, you drive it", the other girl's gets "that's
 * hers". Null when she may drive it. Asking about your car is left open on her wheel so she can say so; the other girl's is greyed.
 */
export function refuseCarLine(girlId, spec) {
  if (mayDriveCar(girlId, spec)) return null;
  return spec.owner === 'you' ? 'carYours' : 'carNotMine';
}

export class CarGo {
  constructor(params = { ...DEFAULT_CAR_GO_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.lastGo = {}; // girl id -> clock at her last go
    this.forced = null; // the debug panel's "go now", by girl id
  }

  update(dt) {
    this.clock += dt;
  }

  /**
   * Her go in her own car: `ctx` is { girls: { <id>: { free, car (its kind, or null), carFree, weight } } }. Returns
   * [{ key: 'carGo', girl, vehicle, weight }] for each girl who could go now.
   */
  offers(ctx) {
    const out = [];
    for (const [girl, g] of Object.entries(ctx.girls ?? {})) {
      if (!g.free || !g.car || !g.carFree) continue;
      const due = this.clock >= this.p.firstAfter && this.clock - (this.lastGo[girl] ?? -Infinity) >= this.p.every;
      if (!due && this.forced !== girl) continue;
      out.push({ key: 'carGo', girl, vehicle: g.car, weight: this.forced === girl ? 100 : g.weight ?? 1 });
    }
    return out;
  }

  /** She chose to: the event the game acts on, { type: 'carGo', girl, vehicle }. */
  take(o) {
    if (this.forced === o.girl) this.forced = null;
    return { type: 'carGo', girl: o.girl, vehicle: o.vehicle };
  }

  /** A go has begun (however it came about). */
  started(id) {
    this.lastGo[id] = this.clock;
  }

  /** Her drive's numbers for this go: { speedMin, speedMax, forMin, forMax, maxThrottle }. */
  driveFor(id) {
    const p = this.p;
    const jess = id === 'jess';
    return {
      speedMin: jess ? p.jessSpeedMin : p.amySpeedMin,
      speedMax: jess ? p.jessSpeedMax : p.amySpeedMax,
      forMin: p.forMin,
      forMax: p.forMax,
      maxThrottle: jess ? p.jessMaxThrottle : p.amyMaxThrottle,
    };
  }
}

/**
 * You and her car. Pure: the game says each moment whether you're driving it, whether she is in it with you, whether she can see it,
 * and what state it's in; this says when she minds and by how much. One `Borrowing` per car.
 *
 *   taken     you drove off in it without her, and she saw (or found it gone when she looked): favour down, a line
 *   back      you brought it back (stopped, out of it, within sight of her): a line, worse if it's damaged or bogged
 *   ridden    you took her with you (she was in it as you set off): a smaller line, and she doesn't mind
 */
export class Borrowing {
  constructor(params = DEFAULT_CAR_GO_PARAMS) {
    this.p = params;
    this.out = null; // { withHer, faults, seen } while you have it
  }

  /**
   * `s`: { driving (you, at the wheel, moving or not), herIn (she's in one of its seats), sees (she can see it, or you in it), faults
   * (a count of what's wrong with it), bogged }. Returns events.
   */
  update(s) {
    const ev = [];
    if (s.driving && !this.out) {
      this.out = { withHer: !!s.herIn, faults: s.faults ?? 0, seen: false };
      if (this.out.withHer) ev.push({ type: 'ridden', favour: this.p.favourRidden });
    }
    if (!this.out) return ev;
    if (s.herIn) this.out.withHer = true;
    if (!this.out.withHer && !this.out.seen && s.sees) {
      this.out.seen = true;
      ev.push({ type: 'taken', favour: this.p.favourTaken });
    }
    if (!s.driving) {
      const worse = (s.faults ?? 0) > this.out.faults || !!s.bogged;
      if (!this.out.withHer && (this.out.seen || s.sees)) ev.push({ type: 'back', damaged: worse, favour: worse ? this.p.favourDamaged : 0 });
      else if (this.out.withHer && worse) ev.push({ type: 'back', damaged: true, favour: this.p.favourDamaged / 2 });
      this.out = null;
    }
    return ev;
  }
}
