// The warm-up is the best bit. A cold engine shakes about twice as hard as a warm one at idle, so when a girl starts your usual quad to have
// it warm for you (headStart.js), she sometimes sits on it while it warms instead of standing beside it: on the back of a quad, or in the
// passenger seat of a Land Rover or the UTV. She may ask first. She says so as it begins to smooth out, is disappointed when it has, and is slow
// to get off when you arrive. Pure logic: the game says whether she is sat on it running, how warm it is and where you are.

export const DEFAULT_WARMSIT_PARAMS = {
  sitChance: 0.75, // of the head starts she makes, the share where she sits on it while it warms
  askChance: 0.35, // of those, the share where she asks first, if you are near enough to hear
  askRange: 8, // metres: how close you have to be for her to ask
  smoothFrom: 0.45, // engine temperature (0..1) at which she notices it starting to smooth out
  arriveRange: 3, // metres: you've come to take it
  slowMin: 2, // seconds she takes to get off once you've come
  slowMax: 5,
  giveUpAfter: 180, // seconds she sits there, with nobody coming, before she gets off anyway
  goTimeout: 150, // seconds she has to be sat on it running by (starting it can take a few goes) before it's dropped
};

export const WARMSIT_PARAM_RANGES = {
  sitChance: [0, 1, 0.05],
  askChance: [0, 1, 0.05],
  askRange: [2, 30, 1],
  smoothFrom: [0.1, 1, 0.01],
  arriveRange: [1, 10, 0.5],
  slowMin: [0, 20, 0.5],
  slowMax: [0, 30, 0.5],
  giveUpAfter: [20, 900, 10],
  goTimeout: [20, 400, 10],
};

const between = (random, min, max) => min + random() * Math.max(0, max - min);

export class WarmSit {
  constructor(params = { ...DEFAULT_WARMSIT_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.mine = new Map(); // girl id -> { phase: 'going' | 'sitting' | 'leaving', t, said: { smoothing, smooth }, offAt }
  }

  /** What she does for this head start: 'beside' (as it always was), 'sit', or 'ask' (sit if you say so). `canSit`: there is a seat for her. */
  decide(canSit, youDistance) {
    const p = this.p;
    if (!canSit || this.random() >= p.sitChance) return 'beside';
    return youDistance <= p.askRange && this.random() < p.askChance ? 'ask' : 'sit';
  }

  has(id) {
    return this.mine.has(id);
  }

  /** Whether she is sat there (so nothing else revs it or switches it off). */
  sitting(id) {
    const m = this.mine.get(id);
    return m?.phase === 'sitting' || m?.phase === 'leaving';
  }

  begin(id) {
    this.mine.set(id, { phase: 'going', t: 0, said: { smoothing: false, smooth: false }, offAt: Infinity });
  }

  drop(id) {
    this.mine.delete(id);
  }

  /**
   * One step. `ctx.girls` is [{ id, ready, temperature, warm, youDistance, youOn }]: `ready`: she is sat on it with the engine running; `warm`:
   * the cold light would be out. Returns events: { type: 'in', girl }, { type: 'smoothing', girl } (it's starting to smooth out),
   * { type: 'smooth', girl } (it has: disappointed), { type: 'slow', girl } (you've come: "already?"), { type: 'off', girl } (she gets off),
   * { type: 'giveUp', girl } (nobody came; she gets off), { type: 'lost', girl } (it died or she never got going).
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
          m.phase = 'sitting';
          m.t = 0;
          events.push({ type: 'in', girl: g.id });
        } else if (m.t >= p.goTimeout) {
          this.mine.delete(g.id);
          events.push({ type: 'lost', girl: g.id });
        }
        continue;
      }
      if (!g.ready) {
        this.mine.delete(g.id);
        events.push({ type: 'lost', girl: g.id });
        continue;
      }
      if (m.phase === 'sitting') {
        if (!m.said.smoothing && g.temperature >= p.smoothFrom) {
          m.said.smoothing = true;
          events.push({ type: 'smoothing', girl: g.id });
        }
        if (!m.said.smooth && g.warm) {
          m.said.smooth = true;
          events.push({ type: 'smooth', girl: g.id });
        }
        if (g.youOn || g.youDistance <= p.arriveRange) {
          m.phase = 'leaving';
          m.offAt = m.t + between(this.random, p.slowMin, p.slowMax);
          events.push({ type: 'slow', girl: g.id });
        } else if (m.t >= p.giveUpAfter) {
          this.mine.delete(g.id);
          events.push({ type: 'giveUp', girl: g.id });
        }
      } else if (m.t >= m.offAt) {
        this.mine.delete(g.id);
        events.push({ type: 'off', girl: g.id });
      }
    }
    return events;
  }
}
