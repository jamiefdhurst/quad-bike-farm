// The L plates. Jess makes a pair for Amy and tapes them to her quad. Amy peels them off, and they keep turning up again, until
// Amy is a confident driver (the mean of her four skills, npc/skills.js), when she tapes them to the tractor instead, Jess's
// favourite. Pure logic: the game says who is free and where the plates are, and acts on the events; Jess taping them on and Amy putting
// them on the tractor are offers the chooser weighs (chooser.js). Tested in tests/lPlates.test.js.
//
//   jessTape   Jess tapes them to Amy's quad (the first time, and each time they've turned up again)
//   amyPeel    Amy takes them off, and they're gone for a while
//   amyStick   Amy, confident now, tapes them to the tractor: they stay there

export const DEFAULT_LPLATE_PARAMS = {
  firstAfter: 120, // seconds into the game before Jess first makes them
  tapeWeight: 1, // how keen Jess is to tape them on, once she can (chooser.js weighs it)
  peelMin: 25, // shortest seconds Amy leaves them on, once she's by her quad and free
  peelMax: 90, // longest
  backGapMin: 120, // shortest seconds before they turn up again
  backGapMax: 360, // longest
  confident: 0.7, // Amy's mean skill at which she's a confident driver and puts them on the tractor
  stickWeight: 1.5, // how keen Amy is to put them on the tractor, once confident
};

export const LPLATE_PARAM_RANGES = {
  firstAfter: [0, 1800, 10],
  tapeWeight: [0, 5, 0.05],
  peelMin: [0, 300, 5],
  peelMax: [0, 600, 5],
  backGapMin: [0, 900, 10],
  backGapMax: [0, 1800, 10],
  confident: [0.4, 1, 0.01],
  stickWeight: [0, 5, 0.05],
};

/** How good a driver she is overall: the mean of her skill levels ({ starting, choke, cornering, mud }). */
export function meanSkill(levels) {
  const v = Object.values(levels ?? {});
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0.5;
}

export class LPlates {
  constructor(params = { ...DEFAULT_LPLATE_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.where = 'none'; // 'none' (not made yet, or peeled off), 'quad' or 'tractor'
    this.tapes = 0; // how many times Jess has put them on Amy's quad
    this.peels = 0; // how many times Amy has taken them off
    this.peelAt = Infinity; // clock time Amy peels them
    this.backAt = this.p.firstAfter; // clock time they turn up again
  }

  /** Debug: put the plates somewhere now ('quad', 'tractor' or 'none'). The story carries on from there. */
  put(where) {
    this.where = where;
    this.peelAt = Infinity;
    if (where === 'quad') this.tapes = Math.max(this.tapes, 1);
    if (where === 'none') this.backAt = this.clock + this.p.backGapMin;
  }

  /**
   * One step. `ctx`: { amyFree, jessFree, amyByQuad (she's within reach of the plates on her quad), hasQuad (Amy has a quad of her own),
   * confidence (Amy's mean skill), tractorFree (nobody on or going to it) }. Returns events: { type, girl }.
   */
  update(dt, ctx) {
    this.clock += dt;
    const p = this.p;
    if (this.where === 'tractor') return [];
    // Jess taping them on and Amy moving them to the tractor are offers (offers, take); Amy peeling them off is her reaction.
    if (this.where === 'quad' && ctx.amyFree && ctx.amyByQuad) {
      if (this.peelAt === Infinity) this.peelAt = this.clock + p.peelMin + this.random() * (p.peelMax - p.peelMin);
      if (this.clock >= this.peelAt) {
        this.where = 'none';
        this.peels += 1;
        this.peelAt = Infinity;
        this.backAt = this.clock + p.backGapMin + this.random() * (p.backGapMax - p.backGapMin);
        return [{ type: 'amyPeel', girl: 'amy' }];
      }
    }
    return [];
  }

  /**
   * (The same `ctx` as update.) [{ key: 'lPlatesTractor', girl: 'amy', weight }] once Amy is confident and Jess has made them, and
   * [{ key: 'lPlates', girl: 'jess', weight }] once they're off and due back and Amy has a quad.
   */
  offers(ctx) {
    const p = this.p;
    if (this.where === 'tractor') return [];
    const out = [];
    if (ctx.confidence >= p.confident && ctx.amyFree && ctx.tractorFree && this.tapes > 0) out.push({ key: 'lPlatesTractor', girl: 'amy', weight: p.stickWeight });
    if (this.where === 'none' && ctx.hasQuad && ctx.jessFree && this.clock >= this.backAt) out.push({ key: 'lPlates', girl: 'jess', weight: p.tapeWeight });
    return out;
  }

  /** She chose to: the plates move, and the event the game acts on is returned. */
  take(o) {
    this.peelAt = Infinity;
    if (o.key === 'lPlatesTractor') {
      this.where = 'tractor';
      return { type: 'amyStick', girl: 'amy' };
    }
    this.where = 'quad';
    this.tapes += 1; // the clock for peeling starts when she's by her quad
    return { type: 'jessTape', girl: 'jess' };
  }
}
