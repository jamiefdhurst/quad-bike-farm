// The L plates. Jess makes a pair for Amy and tapes them to her quad. Amy peels them off, and they keep turning up again, until
// Amy is a confident driver (the mean of her four skills, npc/skills.js), when she tapes them to the tractor instead, Jess's
// favourite. Pure logic: the game says who is free and where the plates are, and acts on the events. Tested in tests/lPlates.test.js.
//
//   jessTape   Jess tapes them to Amy's quad (the first time, and each time they've turned up again)
//   amyPeel    Amy takes them off, and they're gone for a while
//   amyStick   Amy, confident now, tapes them to the tractor: they stay there

export const DEFAULT_LPLATE_PARAMS = {
  firstAfter: 120, // seconds into the game before Jess first makes them
  tapeRate: 0.05, // chance a second that Jess does it, once she can
  peelMin: 25, // shortest seconds Amy leaves them on, once she's by her quad and free
  peelMax: 90, // longest
  backGapMin: 120, // shortest seconds before they turn up again
  backGapMax: 360, // longest
  confident: 0.7, // Amy's mean skill at which she's a confident driver and puts them on the tractor
  stickRate: 0.1, // chance a second that she does it, once confident and free
};

export const LPLATE_PARAM_RANGES = {
  firstAfter: [0, 1800, 10],
  tapeRate: [0, 0.5, 0.005],
  peelMin: [0, 300, 5],
  peelMax: [0, 600, 5],
  backGapMin: [0, 900, 10],
  backGapMax: [0, 1800, 10],
  confident: [0.4, 1, 0.01],
  stickRate: [0, 1, 0.01],
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

  /**
   * One step. `ctx`: { amyFree, jessFree, amyByQuad (she's within reach of the plates on her quad), hasQuad (Amy has a quad of her own),
   * confidence (Amy's mean skill), tractorFree (nobody on or going to it) }. Returns events: { type, girl }.
   */
  update(dt, ctx) {
    this.clock += dt;
    const p = this.p;
    if (this.where === 'tractor') return [];
    const confident = ctx.confidence >= p.confident && ctx.amyFree && ctx.tractorFree && this.tapes > 0;
    if (confident && this.random() < p.stickRate * dt) {
      this.where = 'tractor';
      this.peelAt = Infinity;
      return [{ type: 'amyStick', girl: 'amy' }];
    }
    if (this.where === 'none') {
      if (ctx.hasQuad && ctx.jessFree && this.clock >= this.backAt && this.random() < p.tapeRate * dt) {
        this.where = 'quad';
        this.tapes += 1;
        this.peelAt = Infinity; // the clock for peeling starts when she's by her quad
        return [{ type: 'jessTape', girl: 'jess' }];
      }
    } else if (this.where === 'quad' && ctx.amyFree && ctx.amyByQuad) {
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
}
