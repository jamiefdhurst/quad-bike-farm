// The girls and a tractor creeping off on its own (vehicle/creep.js). They notice it, and one of them runs after it and stops it before
// it reaches the hedge; now and then nobody's looking and it noses into the hedge and stalls, and they blame each other.
// Pure logic: the game says what the tractor is doing and who is near, and acts on the events. Tested in tests/tractorRunaway.test.js.
//
//   note   one of them near it remarks that it's moving (said once an episode)
//   chase  the nearest free girl sets off after it, shouting
//   hedge  it has stalled against something and nobody got there: the nearest girl says so (the game has the other one blame her)

export const DEFAULT_TRACTOR_RUNAWAY_PARAMS = {
  noteDelay: 4, // seconds it has crept before anyone remarks on it
  noteRange: 30, // metres: how near a girl has to be to remark on it
  noticeDistance: 18, // metres from the hedge at which a girl who's looking sets off after it
  noticeSpread: 8, // metres the notice distance varies by, either way, each time
  missChance: 0.25, // chance each time that nobody is looking and it reaches the hedge
  jessChaseChance: 0.5, // chance it's Jess who goes, when both are free and equally near
};

export const TRACTOR_RUNAWAY_PARAM_RANGES = {
  noteDelay: [0, 30, 0.5],
  noteRange: [5, 80, 1],
  noticeDistance: [2, 60, 1],
  noticeSpread: [0, 30, 1],
  missChance: [0, 1, 0.05],
  jessChaseChance: [0, 1, 0.05],
};

export class TractorRunaway {
  constructor(params = { ...DEFAULT_TRACTOR_RUNAWAY_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.creeping = false;
    this.time = 0; // seconds into this creep
    this.noted = false;
    this.chased = false;
    this.noticeAt = 0;
    this.misses = false;
  }

  /**
   * One step. `ctx`: { creeping, trailer (hitched), hedge (metres to the hedge it's heading for), stalled (it has just stalled),
   * girls: [{ id, free, dist }] with dist to the tractor in metres }. Returns events: { type, girl, trailer? }.
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    if (!ctx.creeping) {
      if (this.creeping && ctx.stalled) {
        const girl = this.nearest(ctx.girls, () => true);
        if (girl) events.push({ type: 'hedge', girl: girl.id });
      }
      this.creeping = false;
      return events;
    }
    if (!this.creeping) {
      this.creeping = true;
      this.time = 0;
      this.noted = false;
      this.chased = false;
      this.misses = this.random() < p.missChance;
      this.noticeAt = p.noticeDistance + (this.random() - 0.5) * 2 * p.noticeSpread;
    }
    this.time += dt;

    if (!this.noted && this.time >= p.noteDelay) {
      const girl = this.nearest(ctx.girls, (g) => g.free && g.dist <= p.noteRange);
      if (girl) {
        this.noted = true;
        events.push({ type: 'note', girl: girl.id, trailer: !!ctx.trailer });
      }
    }
    if (!this.chased && !this.misses && ctx.hedge <= this.noticeAt) {
      const girl = this.nearest(ctx.girls, (g) => g.free);
      if (girl) {
        this.chased = true;
        events.push({ type: 'chase', girl: girl.id });
      }
    }
    return events;
  }

  /** The nearest girl that passes `ok`; of two about as near (within a metre), Jess goes `jessChaseChance` of the time. */
  nearest(girls, ok) {
    const list = girls.filter(ok).sort((a, b) => a.dist - b.dist);
    if (list.length > 1 && list[1].dist - list[0].dist < 1) return this.random() < this.p.jessChaseChance ? list.find((g) => g.id === 'jess') ?? list[0] : list.find((g) => g.id !== 'jess') ?? list[0];
    return list[0] ?? null;
  }
}
