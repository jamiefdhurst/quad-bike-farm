// Practising on her own. A girl who isn't much good at pulling away on a manual (Jess most of all) goes and sits on one parked, running, and
// works at it with nobody watching: blipping the throttle, finding the clutch's bite point (and stalling it there), restarting, trying the
// choke. Each clean bite, each restart and each choke taken off in time counts as practice, so her skills go up and the stalls get rarer over
// a game. Pure logic: the game says whether she is sat on the quad and what the engine is doing; this says what her hands do, and when she
// stalls it. The stall chance falls with her `starting` skill (skills.js `mistakeChance`), as it does when she drives.

import { mistakeChance } from './skills.js';

export const DEFAULT_PRACTISING_PARAMS = {
  weightJess: 1, // how keen Jess is to go and practise, against Amy (the chooser's weight at no skill; it falls as she gets good)
  weightAmy: 0.25,
  cooldown: 420, // seconds before she goes and does it again after a sitting
  startAfter: 90, // seconds into the game before she thinks of it
  goRange: 40, // how far from a parked manual she is, in metres, for her to think of it
  lengthMin: 70, // seconds a sitting lasts, from...
  lengthMax: 130, // ...to
  goTimeout: 150, // seconds she has to be sat on it by (starting it can take a few goes) before it is dropped
  gainScale: 3, // practice here counts this many times an ordinary bit of practice (the skill's own gap between counts still applies)
  biteStall: 0.45, // chance she stalls it finding the bite point, at middling skill (0.5); none at 1, nearly always at 0
  biteSeconds: 1.6, // seconds she takes to bring the clutch up to the bite
  biteThrottle: 0.22, // the throttle she holds while she does
  blipSeconds: 0.45, // each blip of the throttle...
  blipGap: 0.35, // ...and the gap between
  blipMax: 3, // most blips in a row
  pauseMin: 1.2, // seconds between one thing and the next, from...
  pauseMax: 3.5, // ...to
  deadPause: 1.4, // seconds she sits there after a stall before she tries the starter
  burstSeconds: 2, // seconds on the starter each go
  burstPause: 1.2, // and between goes
  maxBursts: 4, // goes at restarting it before she gives up and gets off
  chokeSeconds: 5, // seconds she tries the choke for
  chokeForget: 0.4, // chance she forgets to push it off in time, at middling choke skill
  chokeLate: 6, // extra seconds she leaves it on when she forgets
  keyOffChance: 0.2, // when she has done, the chance she switches it off (mostly she leaves it ticking over for you)
  doneRange: 3, // metres: you have come to take it
  slowSeconds: 2.5, // seconds she takes to get off once you have come
};

export const PRACTISING_PARAM_RANGES = {
  weightJess: [0, 3, 0.05],
  weightAmy: [0, 3, 0.05],
  cooldown: [0, 1800, 10],
  startAfter: [0, 600, 10],
  goRange: [5, 80, 1],
  lengthMin: [10, 400, 5],
  lengthMax: [10, 600, 5],
  goTimeout: [20, 400, 10],
  gainScale: [0, 10, 0.5],
  biteStall: [0, 1, 0.05],
  biteSeconds: [0.4, 5, 0.1],
  biteThrottle: [0, 0.6, 0.01],
  blipSeconds: [0.1, 2, 0.05],
  blipGap: [0.1, 2, 0.05],
  blipMax: [1, 8, 1],
  pauseMin: [0, 10, 0.1],
  pauseMax: [0, 20, 0.1],
  deadPause: [0, 6, 0.1],
  burstSeconds: [0.5, 5, 0.1],
  burstPause: [0, 5, 0.1],
  maxBursts: [1, 10, 1],
  chokeSeconds: [1, 20, 0.5],
  chokeForget: [0, 1, 0.05],
  chokeLate: [0, 30, 0.5],
  keyOffChance: [0, 1, 0.05],
  doneRange: [1, 10, 0.5],
  slowSeconds: [0, 15, 0.5],
};

const between = (random, min, max) => min + random() * Math.max(0, max - min);
const NONE = { throttle: 0, choke: 0, starter: false };

export class Practising {
  constructor(params = { ...DEFAULT_PRACTISING_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.coolUntil = {}; // girl id -> clock when she will think of it again
    this.mine = new Map(); // girl id -> { phase: 'going' | 'sitting' | 'leaving', t, length, action, pause, ... }
  }

  has(id) {
    return this.mine.has(id);
  }

  /** Whether she is sat there at it (so nothing else revs her quad or switches it off). */
  sitting(id) {
    const m = this.mine.get(id);
    return m?.phase === 'sitting' || m?.phase === 'leaving';
  }

  /** Her hands for this step: { throttle, choke, starter }, or all off when she isn't at it. */
  controls(id) {
    return this.mine.get(id)?.hands ?? NONE;
  }

  /**
   * What she could choose now, as offers for the chooser: [{ key: 'practise', girl, unit, weight }]. `ctx.girls` is [{ id, free, unit, level }]:
   * `unit` is the parked manual she would go to (null if there is none within reach) and `level` her `starting` skill.
   */
  offers(ctx) {
    const p = this.p;
    if (this.clock < p.startAfter) return [];
    const out = [];
    for (const g of ctx.girls) {
      if (!g.free || !g.unit || this.mine.has(g.id) || this.clock < (this.coolUntil[g.id] ?? 0)) continue;
      const weight = (g.id === 'jess' ? p.weightJess : p.weightAmy) * Math.max(0.1, 1.2 - g.level);
      if (weight > 0) out.push({ key: 'practise', girl: g.id, unit: g.unit, weight });
    }
    return out;
  }

  /** She chose to (or the debug panel sent her): books it and returns the event the game acts on, { type: 'go', girl, unit }. */
  take(offer) {
    this.begin(offer.girl);
    return { type: 'go', girl: offer.girl, unit: offer.unit };
  }

  begin(id) {
    const p = this.p;
    this.mine.set(id, { phase: 'going', t: 0, length: between(this.random, p.lengthMin, p.lengthMax), action: null, pause: 0, hands: NONE, bursts: 0, offAt: 0 });
  }

  drop(id) {
    this.mine.delete(id);
    this.coolUntil[id] = this.clock + this.p.cooldown;
  }

  describe(id) {
    const m = this.mine.get(id);
    if (!m) return this.clock < this.p.startAfter ? 'not yet' : (this.coolUntil[id] ?? 0) > this.clock ? `resting for ${Math.round(this.coolUntil[id] - this.clock)} s` : 'no';
    if (m.phase === 'going') return 'on her way to a quad to practise on';
    return `practising (${m.action?.kind ?? 'between goes'}, ${Math.round(Math.max(0, m.length - m.t))} s left)`;
  }

  /**
   * One step. `ctx.girls` is [{ id, sat, running, cold, level: { starting, choke }, youDistance, youOn }]: `sat` is on the quad's back seat.
   * Returns events, each { type, girl }: 'in' (settled), 'blip', 'bite' (a clean one: practice 'starting'), 'stall' (the game stalls the
   * engine), 'caught' (restarted: practice 'starting'), 'chokeOn', 'chokeOff' (in time: practice 'choke'), 'chokeLate' (she forgot: none), 'gaveUp'
   * (it won't go), 'done', 'slow' (you have come), 'off' (she gets off; with `keyOff`) and 'lost' (she never got there, or you took it).
   */
  update(dt, ctx) {
    this.clock += dt;
    const p = this.p;
    const events = [];
    for (const g of ctx.girls) {
      const m = this.mine.get(g.id);
      if (!m) continue;
      const ev = (type, extra) => events.push({ type, girl: g.id, ...extra });
      m.t += dt;
      if (m.phase === 'going') {
        m.hands = NONE;
        if (g.sat) {
          m.phase = 'sitting';
          m.t = 0;
          m.pause = between(this.random, p.pauseMin, p.pauseMax);
          ev('in');
        } else if (m.t >= p.goTimeout) {
          this.drop(g.id);
          ev('lost');
        }
        continue;
      }
      if (!g.sat || g.youOn) {
        this.drop(g.id); // asked off, taken, or you got on it
        ev('lost');
        continue;
      }
      if (m.phase === 'leaving') {
        m.hands = NONE;
        if (m.t >= m.offAt) {
          this.drop(g.id);
          ev('off', { keyOff: m.keyOff });
        }
        continue;
      }
      if (g.youDistance <= p.doneRange) {
        this.finish(m, g, 'slow', events, p.slowSeconds);
        continue;
      }
      this.step(m, g, dt, events, ev);
    }
    return events;
  }

  finish(m, g, why, events, wait = 0) {
    m.phase = 'leaving';
    m.t = 0;
    m.offAt = wait;
    m.action = null;
    m.hands = NONE;
    m.keyOff = why === 'gaveUp' ? false : why === 'done' && this.random() < this.p.keyOffChance;
    events.push({ type: why, girl: g.id });
  }

  /** Her hands, one step at whatever she is doing; picks the next thing when she has done. */
  step(m, g, dt, events, ev) {
    const p = this.p;
    let a = m.action;
    if (!a) {
      m.hands = NONE;
      m.pause -= dt;
      if (m.pause > 0) return;
      if (m.t >= m.length) return void this.finish(m, g, 'done', events);
      a = m.action = this.pick(g);
      if (a.kind === 'chokeTry') ev('chokeOn');
    }
    a.t += dt;
    switch (a.kind) {
      case 'blip': {
        // On for blipSeconds, off for blipGap, a few times over.
        const cycle = p.blipSeconds + p.blipGap;
        const n = Math.floor(a.t / cycle);
        if (n >= a.count) return void this.next(m);
        const on = a.t - n * cycle < p.blipSeconds;
        if (on && a.last !== n) {
          a.last = n;
          ev('blip');
        }
        m.hands = { throttle: on ? 1 : 0, choke: 0, starter: false };
        return;
      }
      case 'bite':
        // The clutch coming up: a little throttle, and at the bite either it takes or it dies.
        m.hands = { throttle: p.biteThrottle, choke: 0, starter: false };
        if (a.t < p.biteSeconds) return;
        if (a.stalls) {
          ev('stall');
          m.action = { kind: 'dead', t: 0 };
        } else {
          ev('bite');
          this.next(m);
        }
        return;
      case 'dead':
        m.hands = NONE;
        if (a.t >= p.deadPause) m.action = { kind: 'restart', t: 0, phase: 'crank' };
        return;
      case 'restart':
        // On the starter in bursts, with the choke if it is cold, until it catches or she has had enough.
        if (g.running) {
          ev('caught');
          return void this.next(m);
        }
        if (a.phase === 'crank') {
          m.hands = { throttle: 0, choke: g.cold ? 1 : 0, starter: true };
          if (a.t >= p.burstSeconds) {
            a.phase = 'rest';
            a.t = 0;
            m.bursts++;
          }
        } else {
          m.hands = { throttle: 0, choke: g.cold ? 1 : 0, starter: false };
          if (m.bursts >= p.maxBursts) return void this.finish(m, g, 'gaveUp', events);
          if (a.t >= p.burstPause) {
            a.phase = 'crank';
            a.t = 0;
          }
        }
        return;
      case 'chokeTry':
        // Choke on, a little throttle to keep it, then pushed off; the less she knows, the more likely she forgets it.
        m.hands = { throttle: 0.12, choke: 1, starter: false };
        if (a.forgets && a.t >= p.chokeSeconds && !a.said) {
          a.said = true;
          ev('chokeLate');
        }
        if (a.t >= p.chokeSeconds + (a.forgets ? p.chokeLate : 0)) {
          if (!a.forgets) ev('chokeOff');
          this.next(m);
        }
        return;
    }
  }

  next(m) {
    m.action = null;
    m.hands = NONE;
    m.pause = between(this.random, this.p.pauseMin, this.p.pauseMax);
    m.bursts = 0;
  }

  /** The next thing she tries: mostly the bite point, now and then a blip or the choke. */
  pick(g) {
    const p = this.p;
    const r = this.random();
    if (r < 0.2) return { kind: 'blip', t: 0, count: 1 + Math.floor(this.random() * p.blipMax), last: -1 };
    if (r < 0.35) return { kind: 'chokeTry', t: 0, forgets: this.random() < mistakeChance(p.chokeForget, g.level.choke) };
    return { kind: 'bite', t: 0, stalls: this.random() < mistakeChance(p.biteStall, g.level.starting) };
  }
}
