// Driving lessons. A girl on the back of a manual vehicle you are driving offers to teach you. Amy sets one drill at a time (pulling away
// without revving it, clutch control on a hill, changing down before a bank, smooth changes, stopping without stalling) and judges each go by
// what the drivetrain actually did: stalls, slip time, over-revs. Two clean goes in a row and she moves on. Jess has one lesson, "faster",
// and judges it on the clock. The reverse of you coaching her (skills.js). Pure: the game hands in a sample of the drivetrain each frame and
// says each girl's words and favour for the events that come out. The offer goes through the chooser (OFFER_KINDS.lesson).

export const DEFAULT_LESSON_PARAMS = {
  amyWeight: 0.6, // how keen Amy is to offer a lesson once she could (chooser.js weighs it)
  jessWeight: 0.45, // how keen Jess is
  startAfter: 25, // seconds you have been driving with her on the back before she offers
  cooldown: 240, // seconds after a lesson before either girl offers another
  setDelay: 3.5, // seconds from her offering to setting the first drill, and from one drill passing to the next
  goodNeeded: 2, // clean goes in a row to pass a drill
  badMax: 4, // goes gone wrong in a row before she calls it a day
  nudgeEvery: 40, // seconds without a go at the drill before she says it again
  nudgeMax: 3, // times she says it again before she gives up
  leaveAfter: 5, // seconds not driving it (you got off, or she did) before the lesson is over
  passFavour: 0.5, // favour with her for each drill you pass
  graduateFavour: 2, // and for passing the last one
  maxSeconds: 900, // longest a lesson goes on
  pullThrottle: 0.45, // pulling away: the most throttle you may use (0 to 1)
  pullRevs: 0.55, // and the most revs, as a share of the range between idle and the limit
  pullSlip: 3, // and the most seconds you may ride the clutch at the bite
  pullSpeed: 2.5, // m/s at which you have pulled away
  hillSlope: 0.06, // sine of the slope that counts as a hill
  hillRoll: -0.4, // m/s backwards that counts as rolling back
  hillSlip: 5, // seconds of slipping the clutch on the hill before it counts as too much
  bankSlope: 0.08, // sine of the slope where a bank starts
  bankLead: 4, // seconds before the bank in which a change down counts as before it
  bankLate: 1.5, // seconds into the bank after which a change down is late
  bankWindow: 5, // seconds from the foot of the bank that she watches
  bankStall: 1.2, // m/s: slower than this part-way up in a high gear and the engine is lugging
  shiftLoss: 1.5, // m/s you may lose between pressing the clutch and a change finishing
  shiftRevs: 0.85, // revs (0 to 1) above which a change has over-revved it
  shiftSettle: 1, // seconds after the clutch comes up that she watches the revs
  stopFrom: 4, // m/s you must be doing before a stop counts
  fasterSpeed: 11, // m/s Jess wants you to reach
  fasterTime: 8, // seconds she gives you to do it from a standing start
};

export const LESSON_PARAM_RANGES = {
  amyWeight: [0, 3, 0.05],
  jessWeight: [0, 3, 0.05],
  startAfter: [0, 300, 5],
  cooldown: [0, 1800, 10],
  setDelay: [0, 15, 0.5],
  goodNeeded: [1, 5, 1],
  badMax: [1, 10, 1],
  nudgeEvery: [10, 180, 5],
  nudgeMax: [1, 10, 1],
  leaveAfter: [1, 30, 1],
  passFavour: [0, 5, 0.1],
  graduateFavour: [0, 10, 0.1],
  maxSeconds: [60, 3600, 30],
  pullThrottle: [0.1, 1, 0.05],
  pullRevs: [0.1, 1, 0.05],
  pullSlip: [0.5, 10, 0.5],
  pullSpeed: [1, 6, 0.1],
  hillSlope: [0.02, 0.3, 0.01],
  hillRoll: [-3, -0.1, 0.1],
  hillSlip: [1, 15, 0.5],
  bankSlope: [0.02, 0.3, 0.01],
  bankLead: [1, 10, 0.5],
  bankLate: [0.2, 5, 0.1],
  bankWindow: [2, 12, 0.5],
  bankStall: [0.2, 4, 0.1],
  shiftLoss: [0.2, 5, 0.1],
  shiftRevs: [0.4, 1, 0.05],
  shiftSettle: [0.2, 4, 0.1],
  stopFrom: [1, 10, 0.5],
  fasterSpeed: [4, 20, 0.5],
  fasterTime: [2, 20, 0.5],
};

/** Each drill, in the order Amy teaches them, and who teaches it. `label` is for the debug panel. */
export const DRILLS = {
  pullAway: { label: 'pulling away without revving it', teacher: 'amy' },
  hillClutch: { label: 'clutch control on a hill', teacher: 'amy' },
  changeDown: { label: 'changing down before the bank', teacher: 'amy' },
  smooth: { label: 'smooth changes', teacher: 'amy' },
  stopping: { label: 'stopping without stalling', teacher: 'amy' },
  faster: { label: 'going faster', teacher: 'jess' },
};

/** What can go wrong in a go (each has a line: lessonBad_<why>). */
export const BAD_WHYS = ['stalled', 'revved', 'slipped', 'rolled', 'noChange', 'late', 'lugged', 'jerky', 'overrev', 'slow'];

export const drillsFor = (girl) => Object.keys(DRILLS).filter((k) => DRILLS[k].teacher === girl);

const atBite = (s) => s.clutch > 0.05 && s.clutch < 0.85;

/**
 * One drill's judge. `step(dt, s)` returns null, or { result: 'good' | 'bad', why }. The sample `s` is
 * { running, stalled, gear, pedal (0 up to 1 down), clutch (how hard it bites), throttle, speed (m/s along its way), climb (sine of the slope
 * uphill), revs (0 idle to 1 the limit) }. `s.stalled` is true on the frame the engine stops by itself.
 */
export function makeJudge(drill, p) {
  const j = { t: 0 };
  switch (drill) {
    case 'pullAway':
    case 'hillClutch': {
      // Stopped in gear: the go begins when the pedal comes up, and ends when you are away (or it stalls, or you roll back).
      const hill = drill === 'hillClutch';
      return {
        step(dt, s) {
          if (!j.on) {
            const stopped = s.running && Math.abs(s.speed) < 0.4 && s.gear >= 1 && (!hill || s.climb >= p.hillSlope);
            if (stopped && s.pedal < 0.9) Object.assign(j, { on: true, t: 0, peakThrottle: 0, peakRevs: 0, slip: 0, rolled: false });
            return null;
          }
          j.t += dt;
          j.peakThrottle = Math.max(j.peakThrottle, s.throttle);
          j.peakRevs = Math.max(j.peakRevs, s.revs);
          if (atBite(s)) j.slip += dt;
          const end = (result, why) => {
            j.on = false;
            return { result, why };
          };
          if (s.stalled) return end('bad', 'stalled');
          if (hill && s.speed < p.hillRoll) return end('bad', 'rolled');
          if (s.speed >= p.pullSpeed) {
            if (hill) return j.slip > p.hillSlip ? end('bad', 'slipped') : end('good');
            if (j.peakThrottle > p.pullThrottle || j.peakRevs > p.pullRevs) return end('bad', 'revved');
            return j.slip > p.pullSlip ? end('bad', 'slipped') : end('good');
          }
          if (j.t > 12 || s.gear < 1 || s.pedal > 0.95) j.on = false; // nothing came of it
          return null;
        },
      };
    }
    case 'changeDown': {
      const lead = []; // [time, gear] for the lead seconds before now
      let clock = 0;
      return {
        step(dt, s) {
          clock += dt;
          lead.push([clock, s.gear]);
          while (lead.length && lead[0][0] < clock - p.bankLead - p.bankWindow) lead.shift();
          if (!j.on) {
            j.below = s.climb < p.bankSlope * 0.5 ? clock : j.below ?? -Infinity;
            const starts = s.running && s.climb >= p.bankSlope && clock - j.below < 1.5 && s.speed > 2 && s.gear >= 2;
            if (!starts) return null;
            const before = lead.filter(([t]) => t >= clock - p.bankLead).reduce((m, [, g]) => Math.max(m, g), 0);
            Object.assign(j, { on: true, t: 0, before, droppedAt: s.gear < before ? 0 : null });
            return null;
          }
          j.t += dt;
          if (j.droppedAt === null && s.gear >= 1 && s.gear < j.before) j.droppedAt = j.t;
          const end = (result, why) => {
            j.on = false;
            j.below = -Infinity;
            return { result, why };
          };
          if (s.stalled) return end('bad', 'stalled');
          if (j.t < p.bankWindow) return null;
          if (s.speed < p.bankStall) return end('bad', 'lugged');
          if (j.before <= 2 || (j.droppedAt !== null && j.droppedAt <= p.bankLate)) return end('good');
          return j.droppedAt !== null ? end('bad', 'late') : end('bad', 'noChange');
        },
      };
    }
    case 'smooth': {
      let lastGear = 0;
      return {
        step(dt, s) {
          if (s.stalled) {
            const was = j.on;
            j.on = false;
            return was ? { result: 'bad', why: 'stalled' } : null;
          }
          if (s.gear >= 1 && !j.on) lastGear = s.gear;
          if (!j.on) {
            if (s.running && s.pedal > 0.5 && s.speed > 2 && lastGear >= 1) Object.assign(j, { on: true, phase: 'down', start: s.speed, min: s.speed, settle: 0, peakRevs: 0 });
            return null;
          }
          j.min = Math.min(j.min, s.speed);
          if (j.phase === 'down') {
            if (s.pedal < 0.5) {
              if (s.gear < 1 || s.gear === lastGear) {
                j.on = false; // the clutch came up in neutral, or in the same gear: not a change
                return null;
              }
              j.phase = 'settle';
            }
            return null;
          }
          j.settle += dt;
          j.peakRevs = Math.max(j.peakRevs, s.revs);
          if (j.settle < p.shiftSettle) return null;
          j.on = false;
          lastGear = s.gear;
          if (j.start - j.min > p.shiftLoss) return { result: 'bad', why: 'jerky' };
          if (j.peakRevs > p.shiftRevs) return { result: 'bad', why: 'overrev' };
          return { result: 'good' };
        },
      };
    }
    case 'stopping': {
      return {
        step(dt, s) {
          j.peak = Math.max(j.peak ?? 0, s.speed);
          if (s.stalled) {
            const was = j.peak >= p.stopFrom * 0.5;
            j.peak = 0;
            return was ? { result: 'bad', why: 'stalled' } : null;
          }
          if (Math.abs(s.speed) < 0.3 && s.running) {
            const was = j.peak >= p.stopFrom;
            j.peak = 0;
            return was ? { result: 'good' } : null;
          }
          if (s.speed < j.peak - p.stopFrom * 3) j.peak = s.speed; // a long way down and back up: start the count again
          return null;
        },
      };
    }
    case 'faster': {
      return {
        step(dt, s) {
          if (!j.on) {
            if (s.running && s.gear >= 1 && s.speed < 2 && s.throttle > 0.6) Object.assign(j, { on: true, t: 0, soft: 0 });
            return null;
          }
          j.t += dt;
          j.soft = s.throttle < 0.3 ? j.soft + dt : 0;
          const end = (result, why) => {
            j.on = false;
            return { result, why };
          };
          if (s.stalled) {
            j.on = false; // she does not mind a stall; it just was not a go
            return null;
          }
          if (s.speed >= p.fasterSpeed) return end('good');
          if (j.t > p.fasterTime || j.soft > 1.5) return end('bad', 'slow');
          return null;
        },
      };
    }
    default:
      throw new Error(`no such drill: ${drill}`);
  }
}

export class Lessons {
  constructor(params = { ...DEFAULT_LESSON_PARAMS }) {
    this.p = params;
    this.passed = { amy: new Set(), jess: new Set() }; // the drills each girl has passed you on (kept between games)
    this.active = null; // { girl, drill, judge, streak, bads, nudges, since, time, pending }
    this.resting = 0; // seconds until anyone offers again
    this.together = { amy: 0, jess: 0 }; // seconds you have been driving a manual with her on the back
    this.away = 0; // seconds the lesson has not had you driving with her
    this.wasRunning = false;
    this.graduated = { amy: false, jess: false };
  }

  /** The drills a girl still has to teach you. */
  remaining(girl) {
    return drillsFor(girl).filter((d) => !this.passed[girl]?.has(d));
  }

  /** Is this girl in the middle of teaching you? */
  get teaching() {
    return this.active?.girl ?? null;
  }

  /** What she could offer now (chooser.js): a lesson, as keen as her weight says, if there is something left to teach and you have been at it a while. */
  offers({ girls = [] } = {}) {
    if (this.active || this.resting > 0) return [];
    const out = [];
    for (const id of girls) {
      if (!this.remaining(id).length || this.together[id] < this.p.startAfter) continue;
      out.push({ key: 'lesson', girl: id, weight: id === 'amy' ? this.p.amyWeight : this.p.jessWeight });
    }
    return out;
  }

  /** She chose to: start the lesson. Returns the event for the game to say and show. */
  take(offer) {
    return this.start(offer.girl);
  }

  /** Starts a lesson with her (also what the debug panel's button does). */
  start(girl, drill = null) {
    const first = drill ?? this.remaining(girl)[0] ?? drillsFor(girl)[0];
    this.active = { girl, drill: first, judge: makeJudge(first, this.p), streak: 0, bads: 0, nudges: 0, since: 0, time: 0, pending: { type: 'set', in: this.p.setDelay } };
    this.away = 0;
    this.wasRunning = false;
    return { type: 'begin', girl, drill: first };
  }

  /** Ends it (you got off, or she gave up, or it is done) and rests the offers. */
  stop(why) {
    const a = this.active;
    this.active = null;
    this.resting = this.p.cooldown;
    return a ? [{ type: 'end', girl: a.girl, why }] : [];
  }

  /**
   * @param {number} dt
   * @param {{girls: string[], sample: object|null}} ctx  The girls on the back of the manual you're driving, and the drivetrain sample
   *   (makeJudge's) or null when you are not driving one.
   * @returns {object[]} Events: set, good, bad, passed, graduated, nudge, end ({ type, girl, drill, why }).
   */
  update(dt, { girls = [], sample = null } = {}) {
    this.resting = Math.max(0, this.resting - dt);
    for (const id of Object.keys(this.together)) this.together[id] = sample && girls.includes(id) ? this.together[id] + dt : 0;
    const a = this.active;
    const s = sample ? { ...sample, stalled: this.wasRunning && !sample.running } : null;
    this.wasRunning = !!sample?.running;
    if (!a) return [];
    a.time += dt;
    this.away = sample && girls.includes(a.girl) ? 0 : this.away + dt;
    if (this.away > this.p.leaveAfter) return this.stop('left');
    if (a.time > this.p.maxSeconds) return this.stop('long');
    if (!s || this.away > 0) return [];
    const events = [];
    if (a.pending) {
      a.pending.in -= dt;
      if (a.pending.in <= 0) {
        events.push({ type: a.pending.type, girl: a.girl, drill: a.drill });
        a.pending = null;
        a.since = 0;
      }
      return events;
    }
    a.since += dt;
    const r = a.judge.step(dt, s);
    if (!r) {
      if (a.since > this.p.nudgeEvery) {
        a.since = 0;
        if (++a.nudges > this.p.nudgeMax) return [...events, ...this.stop('gaveUp')];
        events.push({ type: 'nudge', girl: a.girl, drill: a.drill });
      }
      return events;
    }
    a.since = 0;
    a.nudges = 0;
    if (r.result === 'bad') {
      a.streak = 0;
      events.push({ type: 'bad', girl: a.girl, drill: a.drill, why: r.why });
      if (++a.bads >= this.p.badMax) events.push(...this.stop('gaveUp'));
      return events;
    }
    a.bads = 0;
    if (++a.streak < this.p.goodNeeded) {
      events.push({ type: 'good', girl: a.girl, drill: a.drill });
      return events;
    }
    this.passed[a.girl].add(a.drill);
    events.push({ type: 'passed', girl: a.girl, drill: a.drill });
    const next = this.remaining(a.girl)[0];
    if (!next) {
      this.graduated[a.girl] = true;
      events.push({ type: 'graduated', girl: a.girl });
      events.push(...this.stop('done'));
      return events;
    }
    Object.assign(a, { drill: next, judge: makeJudge(next, this.p), streak: 0, bads: 0, pending: { type: 'set', in: this.p.setDelay } });
    return events;
  }

  /** What the farm keeps: the drills each girl has passed you on. */
  capture() {
    return { amy: [...this.passed.amy], jess: [...this.passed.jess] };
  }

  /** Puts it back (farmState.js). Unknown drills are ignored, so a renamed one doesn't break an old save. */
  restore(s) {
    if (!s) return;
    for (const id of Object.keys(this.passed)) {
      for (const d of Array.isArray(s[id]) ? s[id] : []) if (DRILLS[d]?.teacher === id) this.passed[id].add(d);
      this.graduated[id] = !this.remaining(id).length;
    }
  }

  /** Forgets everything you have passed (the debug panel). */
  forget() {
    for (const id of Object.keys(this.passed)) this.passed[id].clear();
    this.graduated = { amy: false, jess: false };
  }
}
