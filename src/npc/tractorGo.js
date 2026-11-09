// The girls and a go on the tractor, the UTV or the Land Rover. Jess is desperate to drive them and, now and then, just takes one. Amy
// won't go near them, until one day (about twenty minutes in, once Jess has had a go) she has a go herself and is annoyingly good, after
// which you can ask her, for any of the three. Pure logic: the game says who is free and which of the three are free to take, and acts
// on the events; Jess's goes are offers the chooser weighs (chooser.js), Amy's day the one story beat. Tested in tests/tractorGo.test.js.
//
//   jessGo   Jess walks over, climbs on and has a go (`vehicle` is the one she picked)
//   amyDay   Amy's day: she has a go, and from now on she'll do it when asked

// The vehicles the girls take for a go (and are asked to start): the tractor, the UTV, the two Land Rovers and the cars.
export const GO_KINDS = ['tractor', 'utv', 'landy', 'defender', 'fiesta', 'corsa', 'p309'];

export const DEFAULT_TRACTORGO_PARAMS = {
  jessAfter: 150, // seconds into the game before Jess first takes it
  jessEvery: 300, // seconds between anyone's goes
  jessWeight: 1.3, // how keen Jess is on a go, once she can (chooser.js weighs it)
  amyDayAfter: 1200, // seconds into the game before Amy's day can come...
  amyDayJessGoes: 1, // ...and not until Jess has had this many goes
  amyDayGap: 90, // seconds after the last go before Amy's day
  joinChance: 0.5, // chance the other girl, if she's stood about, climbs in beside her on a go at the UTV or Land Rover (the tractor's is under Mudguard ride)
  joinDelayMin: 0.5, // seconds after the driver starts getting in before the other one sets off
  joinDelayMax: 2,
};

export const TRACTORGO_PARAM_RANGES = {
  jessAfter: [0, 1800, 10],
  jessEvery: [30, 1800, 10],
  jessWeight: [0, 5, 0.05],
  amyDayAfter: [0, 7200, 30],
  amyDayJessGoes: [0, 10, 1],
  amyDayGap: [0, 600, 10],
  joinChance: [0, 1, 0.05],
  joinDelayMin: [0, 5, 0.1],
  joinDelayMax: [0, 8, 0.1],
};

export class TractorGo {
  constructor(params = { ...DEFAULT_TRACTORGO_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.lastGo = -Infinity;
    this.goes = { jess: 0, amy: 0 };
    this.amyCan = false; // her day has come
  }

  /**
   * One step. `ctx`: { free: { amy, jess }, vehicles: the ones free to take (nobody on them or going to them), youOnTractor }. A
   * `tractorFree` boolean instead of `vehicles` means just the tractor.
   * Returns events: { type: 'amyDay', girl, vehicle: 'tractor' | 'utv' | 'landy' }. Jess's goes are offers (offers, take).
   */
  update(dt, ctx) {
    this.clock += dt;
    const p = this.p;
    const vehicles = ctx.vehicles ?? (ctx.tractorFree ? ['tractor'] : []);
    if (!vehicles.length || ctx.youOnTractor) return [];
    const since = this.clock - this.lastGo;
    if (!this.amyCan && ctx.free.amy && this.clock >= p.amyDayAfter && this.goes.jess >= p.amyDayJessGoes && since >= p.amyDayGap) {
      this.amyCan = true;
      return [{ type: 'amyDay', girl: 'amy', vehicle: this.pick(vehicles) }];
    }
    return [];
  }

  /** Jess's go (the same `ctx` as update): [{ key: 'bigGo', girl: 'jess', vehicle, weight }] once she can and it's her turn, or none. */
  offers(ctx) {
    const p = this.p;
    const vehicles = ctx.vehicles ?? (ctx.tractorFree ? ['tractor'] : []);
    if (!vehicles.length || ctx.youOnTractor || !ctx.free.jess) return [];
    if (this.clock < p.jessAfter || this.clock - this.lastGo < p.jessEvery) return [];
    return [{ key: 'bigGo', girl: 'jess', vehicle: this.pick(vehicles), weight: p.jessWeight }];
  }

  /** She chose to: the event the game acts on, { type: 'jessGo', girl, vehicle } (the game calls `started` once she's under way). */
  take(o) {
    return { type: 'jessGo', girl: o.girl, vehicle: o.vehicle };
  }

  /** One of the free vehicles, at random. */
  pick(vehicles) {
    return vehicles[Math.min(vehicles.length - 1, Math.floor(this.random() * vehicles.length))];
  }

  /** A go has begun (however it came about). */
  started(id) {
    this.goes[id] = (this.goes[id] ?? 0) + 1;
    this.lastGo = this.clock;
  }

  /** You ask her for a go: 'ok', or 'refuse' (Amy, before her day). */
  ask(id) {
    return id === 'amy' && !this.amyCan ? 'refuse' : 'ok';
  }
}
