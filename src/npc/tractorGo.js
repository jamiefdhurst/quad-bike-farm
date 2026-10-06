// The girls and a go on the tractor. Jess is desperate to drive it and, now and then, just takes it. Amy won't go near it, until one
// day (about twenty minutes in, once Jess has had a go) she has a go herself and is annoyingly good, after which you can ask her.
// Pure logic: the game says who is free, and acts on the events. Tested in tests/tractorGo.test.js.
//
//   jessGo   Jess walks over, climbs on and has a go
//   amyDay   Amy's day: she has a go, and from now on she'll do it when asked

export const DEFAULT_TRACTORGO_PARAMS = {
  jessAfter: 150, // seconds into the game before Jess first takes it
  jessEvery: 300, // seconds between anyone's goes
  jessRate: 0.03, // chance a second that Jess goes, once she can
  amyDayAfter: 1200, // seconds into the game before Amy's day can come...
  amyDayJessGoes: 1, // ...and not until Jess has had this many goes
  amyDayGap: 90, // seconds after the last go before Amy's day
};

export const TRACTORGO_PARAM_RANGES = {
  jessAfter: [0, 1800, 10],
  jessEvery: [30, 1800, 10],
  jessRate: [0, 0.5, 0.005],
  amyDayAfter: [0, 7200, 30],
  amyDayJessGoes: [0, 10, 1],
  amyDayGap: [0, 600, 10],
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
   * One step. `ctx`: { free: { amy, jess }, tractorFree: nobody's on it or going to it, youOnTractor }.
   * Returns events: { type: 'jessGo' | 'amyDay', girl }.
   */
  update(dt, ctx) {
    this.clock += dt;
    const p = this.p;
    if (!ctx.tractorFree || ctx.youOnTractor) return [];
    const since = this.clock - this.lastGo;
    if (!this.amyCan && ctx.free.amy && this.clock >= p.amyDayAfter && this.goes.jess >= p.amyDayJessGoes && since >= p.amyDayGap) {
      this.amyCan = true;
      return [{ type: 'amyDay', girl: 'amy' }];
    }
    if (ctx.free.jess && this.clock >= p.jessAfter && since >= p.jessEvery && this.random() < p.jessRate * dt) return [{ type: 'jessGo', girl: 'jess' }];
    return [];
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
