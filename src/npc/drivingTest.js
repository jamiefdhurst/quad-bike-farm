// Amy's driving test (#85). The first of the girls' stories across days: she practises in the Finch on the lane with you beside her, books
// her test, is nervous the evening before, is away for it one morning and comes back having passed or failed. A fail needs a few more
// practices and she tries again; a pass takes the L plates off the Finch for good. Pure logic: the game says what happened (a practice, the
// day, the hour, whether the test morning has begun) and acts on the events. Kept by the farm (capture/restore). Tested in tests/drivingTest.test.js.
//
//   practice   she had a go in the Finch with you beside her (one counts a day at most)
//   booked     the last practice she needed: the test is booked for `testDay`
//   nervous    the evening before
//   leaves     the morning of the test: she is away for `awayFor` seconds
//   passed     she comes back with her licence
//   failed     she comes back without it, and needs `retryPractices` more practices

export const DEFAULT_DRIVING_TEST_PARAMS = {
  practicesNeeded: 4, // practices in the Finch with you beside her before she books her test
  retryPractices: 2, // and after a fail, before she books it again
  practiceSeconds: 40, // seconds you sit beside her while she drives for it to count
  bookGapMin: 2, // days between booking the test and taking it...
  bookGapMax: 3, // ...up to this many
  nerveHour: 17, // the hour of the evening before at which she says she is nervous
  awayFor: 150, // seconds she is away for on the morning of her test
  passBase: 0.55, // the chance of passing with no skill at all...
  passSkill: 0.3, // ...plus this much of her mean driving skill (0 to 1), so about 0.75 at the usual level
  askWeight: 3, // how much more keen she is to take the Finch out while she is learning and hasn't practised today
  passFavour: 2, // her favour towards you for being there for it
};

export const DRIVING_TEST_PARAM_RANGES = {
  practicesNeeded: [1, 10, 1],
  retryPractices: [1, 10, 1],
  practiceSeconds: [5, 300, 5],
  bookGapMin: [1, 7, 1],
  bookGapMax: [1, 10, 1],
  nerveHour: [12, 22, 0.5],
  awayFor: [10, 600, 5],
  passBase: [0, 1, 0.05],
  passSkill: [0, 1, 0.05],
  askWeight: [1, 10, 0.5],
  passFavour: [0, 5, 0.1],
};

export class DrivingTest {
  constructor(params = { ...DEFAULT_DRIVING_TEST_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.stage = 'learning'; // 'learning', 'booked' or 'passed'
    this.practices = 0; // since she started, or since her last fail
    this.need = params.practicesNeeded;
    this.lastPracticeDay = -1;
    this.testDay = -1; // the day of the booked test
    this.fails = 0;
    this.nervousSaid = false;
    this.awayLeft = 0; // seconds left of the test morning, while she is away
    this.sat = 0; // seconds you have sat beside her on this go
    this.counted = false; // this go has already counted
  }

  get passed() {
    return this.stage === 'passed';
  }

  get away() {
    return this.awayLeft > 0;
  }

  /** Whether she is keen to take the Finch out today: learning and not yet practised on `day`. */
  wantsPractice(day) {
    return this.stage === 'learning' && this.lastPracticeDay !== day;
  }

  /** A go in the Finch has begun. */
  goBegan() {
    this.sat = 0;
    this.counted = false;
  }

  /**
   * One step. `ctx`: { day, hour, besideHer (she is driving the Finch and you are sat in it with her) }. Returns events.
   * The test morning's start is `startDay`, not this.
   */
  update(dt, ctx) {
    const ev = [];
    if (this.awayLeft > 0) {
      this.awayLeft -= dt;
      if (this.awayLeft <= 0) ev.push(this.result(ctx.skill ?? 0.5));
      return ev;
    }
    if (this.stage === 'learning') {
      if (!ctx.besideHer) {
        this.sat = 0;
        return ev;
      }
      this.sat += dt;
      if (!this.counted && this.sat >= this.p.practiceSeconds && this.lastPracticeDay !== ctx.day) {
        this.counted = true;
        ev.push(...this.practised(ctx.day));
      }
    } else if (this.stage === 'booked' && !this.nervousSaid && ctx.day === this.testDay - 1 && ctx.hour >= this.p.nerveHour) {
      this.nervousSaid = true;
      ev.push({ type: 'nervous', girl: 'amy' });
    }
    return ev;
  }

  /** A practice counts (once a day): the event, and the booking if it was the last she needed. */
  practised(day) {
    if (this.stage !== 'learning' || this.lastPracticeDay === day) return [];
    this.practices += 1;
    this.lastPracticeDay = day;
    if (this.practices < this.need) return [{ type: 'practice', girl: 'amy', n: this.practices, of: this.need }];
    const gap = this.p.bookGapMin + Math.floor(this.random() * (Math.max(this.p.bookGapMin, this.p.bookGapMax) - this.p.bookGapMin + 1));
    this.stage = 'booked';
    this.testDay = day + gap;
    this.nervousSaid = false;
    return [{ type: 'practice', girl: 'amy', n: this.practices, of: this.need }, { type: 'booked', girl: 'amy', testDay: this.testDay }];
  }

  /** The farm's morning is `day`: on or after the test day she is off to it. Returns the event, or []. */
  startDay(day) {
    if (this.stage !== 'booked' || day < this.testDay || this.awayLeft > 0) return [];
    this.awayLeft = this.p.awayFor;
    return [{ type: 'leaves', girl: 'amy', awayFor: this.p.awayFor }];
  }

  /** The chance of passing at `skill` (her mean driving skill, 0 to 1). */
  chance(skill) {
    return Math.min(1, Math.max(0, this.p.passBase + this.p.passSkill * skill));
  }

  result(skill) {
    this.awayLeft = 0;
    if (this.random() < this.chance(skill)) {
      this.stage = 'passed';
      return { type: 'passed', girl: 'amy', fails: this.fails };
    }
    this.fails += 1;
    this.stage = 'learning';
    this.practices = 0;
    this.need = this.p.retryPractices;
    this.testDay = -1;
    return { type: 'failed', girl: 'amy', fails: this.fails };
  }

  /** Debug: carry on to the next beat now, whatever stage she is at. Returns the events. */
  skip(day, skill = 0.5) {
    if (this.stage === 'passed') return [];
    if (this.awayLeft > 0) return [this.result(skill)];
    if (this.stage === 'booked') return this.startDay(Math.max(day, this.testDay));
    this.lastPracticeDay = -1;
    return this.practised(day);
  }

  /** Debug: back to the start, or straight to the end. */
  reset(stage = 'learning') {
    Object.assign(this, new DrivingTest(this.p, this.random));
    if (stage === 'passed') this.stage = 'passed';
  }

  /** In a line, for the debug panel. */
  describe(day) {
    if (this.stage === 'passed') return `passed${this.fails ? ` (after ${this.fails} fail${this.fails > 1 ? 's' : ''})` : ''}`;
    if (this.away) return 'away at her test';
    if (this.stage === 'booked') return `test booked for day ${this.testDay}${this.testDay === day ? ' (today)' : ''}`;
    return `learning: ${this.practices} of ${this.need} practices${this.fails ? `, failed ${this.fails}` : ''}`;
  }

  capture() {
    return { stage: this.stage, practices: this.practices, need: this.need, lastPracticeDay: this.lastPracticeDay, testDay: this.testDay, fails: this.fails, nervousSaid: this.nervousSaid };
  }

  restore(s) {
    if (!s) return;
    if (['learning', 'booked', 'passed'].includes(s.stage)) this.stage = s.stage;
    for (const k of ['practices', 'need', 'lastPracticeDay', 'testDay', 'fails']) if (Number.isFinite(s[k])) this[k] = s[k];
    this.nervousSaid = !!s.nervousSaid;
  }
}
