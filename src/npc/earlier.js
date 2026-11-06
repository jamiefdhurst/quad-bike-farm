// The girls calling back to earlier in the day (#115): once something from today's log (farm/dayStory.js) is old enough, they bring it up
// while stood about together, each thing once. What the game says to the banter (banter.js) is `{ when: 'earlier' }` with roles saying
// which event it is; the lines are earlierLines.js. Pure: game.js hands in the log and whether they are stood about.

export const DEFAULT_EARLIER_PARAMS = {
  earlierAfter: 300, // seconds after something happens before they bring it up again (sooner and it is still just happening)
};

export const EARLIER_PARAM_RANGES = {
  earlierAfter: [30, 1800, 30],
};

/** The roles an exchange in earlierLines.js can ask for, for each kind of event in the log. Kinds not here are never called back. */
const ROLES = {
  race: (e) => ({ winner: e.winner, loser: e.loser }),
  youRaced: (e) => ({ result: e.place === 1 ? 'won' : 'lost' }),
  stranded: (e) => ({ girl: e.girl, how: e.how === 'tip' ? 'tip' : 'stuck' }),
  fellOut: () => ({}),
  seized: () => ({}),
  passedTest: () => ({}),
  failedTest: () => ({}),
};

export class Earlier {
  constructor(params = DEFAULT_EARLIER_PARAMS) {
    this.p = params;
    this.time = 0;
    this.seen = new Map(); // log entry -> when it first showed up in the log
    this.told = new Set(); // log entries already called back
    this.offered = null; // the entry the last trigger was for
  }

  /** The log entry they would bring up now, if any: the oldest one not yet told and old enough. */
  next(events) {
    return events.find((e) => ROLES[e.kind] && !this.told.has(e) && this.time - (this.seen.get(e) ?? this.time) >= this.p.earlierAfter) ?? null;
  }

  /**
   * @param {number} dt
   * @param {object[]} events  DayEvents.list
   * @param {boolean} ready  Both girls stood about together with nothing going on
   * @returns {object[]} banter triggers: { when: 'earlier', roles } (a lasting situation, so banter.js decides when)
   */
  triggers(dt, events, ready) {
    this.time += dt;
    for (const e of events) if (!this.seen.has(e)) this.seen.set(e, this.time);
    this.offered = ready ? this.next(events) : null;
    return this.offered ? [{ when: 'earlier', roles: { event: this.offered.kind, ...ROLES[this.offered.kind](this.offered) } }] : [];
  }

  /** The banter started an exchange: if it was the call back, that entry is told. */
  spoke(started) {
    if (started?.when === 'earlier' && this.offered) this.told.add(this.offered);
  }

  /** For the panel and console: what is waiting to be brought up, and what has been. */
  describe(events) {
    const waiting = events.filter((e) => ROLES[e.kind] && !this.told.has(e));
    const next = this.next(events);
    const left = waiting.length ? Math.max(0, this.p.earlierAfter - (this.time - (this.seen.get(waiting[0]) ?? this.time))) : 0;
    return `${this.told.size} brought up; ${waiting.length} waiting${next ? ` (${next.kind} is old enough)` : waiting.length ? ` (${waiting[0].kind} in ${left.toFixed(0)} s)` : ''}`;
  }

  /** Forget the day (a new day's log starts empty). */
  reset() {
    this.seen.clear();
    this.told.clear();
    this.offered = null;
  }
}
