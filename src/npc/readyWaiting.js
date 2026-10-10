// Ready and waiting. You tell her you'll be a minute: she gets the quad going (the ordinary starting routine), sits on the back with the
// engine running, revs it now and then and, as the minute stretches, sounds the horn, more and longer. Jess runs out of patience sooner
// than Amy. When you come back she says so; if you take too long she gives up and gets off. Pure logic: the game says whether she is
// sat on the running quad and where you are; this says when she revs, toots, speaks and gives up.

export const DEFAULT_READY_PARAMS = {
  goTimeout: 150, // seconds she has to be sat on a running quad by (starting it can take a few goes) before she gives up
  revMin: 18, // seconds between her revs of the engine, from...
  revMax: 38, // ...to
  revSeconds: 0.7, // how long each rev is
  tootFromJess: 40, // seconds into the wait before the first toot of the horn
  tootFromAmy: 75,
  tootGap: 28, // seconds between toots at first...
  tootGapMin: 9, // ...shortening to this as the wait goes on
  tootRamp: 0.82, // each toot makes the gap this much of what it was
  tootsLong: 3, // from this many toots on they are long
  tootLength: 0.22, // seconds of a short toot (the horns' beepLength)
  tootLongLength: 0.7, // and a long one
  impatientAt: 2, // the toot she says something at, as well
  giveUpJess: 150, // seconds before she gives up and gets off
  giveUpAmy: 210,
  keyOffChance: 0.5, // when she gives up, the chance she switches it off first
  doneRange: 2.5, // metres: you've come back
};

export const READY_PARAM_RANGES = {
  goTimeout: [20, 400, 10],
  revMin: [3, 120, 1],
  revMax: [3, 180, 1],
  revSeconds: [0.2, 3, 0.1],
  tootFromJess: [5, 400, 5],
  tootFromAmy: [5, 600, 5],
  tootGap: [3, 120, 1],
  tootGapMin: [2, 60, 1],
  tootRamp: [0.3, 1, 0.01],
  tootsLong: [1, 12, 1],
  tootLength: [0.05, 1, 0.01],
  tootLongLength: [0.1, 3, 0.05],
  impatientAt: [1, 10, 1],
  giveUpJess: [20, 900, 10],
  giveUpAmy: [20, 900, 10],
  keyOffChance: [0, 1, 0.05],
  doneRange: [1, 10, 0.5],
};

const between = (random, min, max) => min + random() * Math.max(0, max - min);

export class ReadyWaiting {
  constructor(params = { ...DEFAULT_READY_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.mine = new Map(); // girl id -> { phase: 'going' | 'waiting', t, nextRev, nextToot, toots, gap }
  }

  /** Whether she is on her way or waiting. */
  has(id) {
    return this.mine.has(id);
  }

  /** Whether she is sat there waiting (the game stops other things revving it or switching it off). */
  waiting(id) {
    return this.mine.get(id)?.phase === 'waiting';
  }

  /** You told her you'll be a minute. */
  begin(id) {
    this.mine.set(id, { phase: 'going', t: 0, nextRev: 0, nextToot: 0, toots: 0, gap: this.p.tootGap });
  }

  drop(id) {
    this.mine.delete(id);
  }

  /**
   * One step. `ctx.girls` is [{ id, ready, youDistance, youOn }]: `ready`: she is sat on the back of the quad with it running; `youOn`: you have
   * got on that quad. Returns events: { type: 'waiting', girl } (she has settled), { type: 'rev', girl, seconds },
   * { type: 'toot', girl, length, impatient }, { type: 'here', girl } (you came back), { type: 'giveUp', girl, keyOff } (and she gets off),
   * { type: 'lost', girl } (she never got going).
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    for (const g of ctx.girls) {
      const m = this.mine.get(g.id);
      if (!m) continue;
      m.t += dt;
      if (m.phase === 'going') {
        if (g.ready) {
          m.phase = 'waiting';
          m.t = 0;
          m.nextRev = between(this.random, p.revMin, p.revMax);
          m.nextToot = g.id === 'jess' ? p.tootFromJess : p.tootFromAmy;
          events.push({ type: 'waiting', girl: g.id });
        } else if (m.t >= p.goTimeout) {
          this.mine.delete(g.id);
          events.push({ type: 'lost', girl: g.id });
        }
        continue;
      }
      if (!g.ready) {
        this.mine.delete(g.id); // it died, she was asked off, or she left
        events.push({ type: 'lost', girl: g.id });
        continue;
      }
      if (g.youOn || g.youDistance <= p.doneRange) {
        this.mine.delete(g.id);
        events.push({ type: 'here', girl: g.id });
        continue;
      }
      if (m.t >= (g.id === 'jess' ? p.giveUpJess : p.giveUpAmy)) {
        this.mine.delete(g.id);
        events.push({ type: 'giveUp', girl: g.id, keyOff: this.random() < p.keyOffChance });
        continue;
      }
      if (m.t >= m.nextRev) {
        m.nextRev = m.t + between(this.random, p.revMin, p.revMax);
        events.push({ type: 'rev', girl: g.id, seconds: p.revSeconds });
      }
      if (m.t >= m.nextToot) {
        m.toots++;
        m.gap = Math.max(p.tootGapMin, m.gap * p.tootRamp);
        m.nextToot = m.t + m.gap;
        events.push({ type: 'toot', girl: g.id, length: m.toots >= p.tootsLong ? p.tootLongLength : p.tootLength, impatient: m.toots === p.impatientAt });
      }
    }
    return events;
  }
}
