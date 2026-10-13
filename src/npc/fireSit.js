// Sitting round the bonfire. Once the fire is going a free girl may fancy a sit by it on one of the logs, more so as it gets dark and cold
// (an offer in chooser.js, weighed by her needs). She walks over, sits facing the fire, warms up, says a thing or two, and gets up when she has
// had enough or the fire dies. Both girls can be sat there at once, each on her own log. Pure logic: the game says where everyone is and what the
// fire is doing, this says what happens next, and the game does the walking and sitting (like npc/flask.js).

export const DEFAULT_FIRE_SIT_PARAMS = {
  weight: 0.9, // how much she cares for a sit by the fire (weighed against everything else she could do, chooser.js)
  duskBoost: 1.2, // extra keenness as it gets dark (times how dark it is, 0 to 1)
  cooldown: 240, // seconds after she has had a sit before she fancies another (you can still ask)
  girlRange: 90, // metres: she is this close to the fire to think of it
  rainAbove: 0.12, // rain above this and she would rather not
  sitSeconds: 110, // seconds she stays sat by a blaze
  goTimeout: 100, // seconds she has to get to her log
  askRange: 7, // metres: a girl this close to you at the fire goes when you press E
  youRange: 6, // metres: you are this close to her for her to say the quiet one
  favour: 1.5, // favour for the girl you were sat near when she finished
  romanceFavour: 1, // more, when she is the favoured one
};

export const FIRE_SIT_PARAM_RANGES = {
  weight: [0, 3, 0.05],
  duskBoost: [0, 4, 0.05],
  cooldown: [0, 1800, 10],
  girlRange: [10, 200, 5],
  rainAbove: [0, 1, 0.01],
  sitSeconds: [10, 600, 5],
  goTimeout: [20, 400, 10],
  askRange: [2, 30, 1],
  youRange: [2, 20, 1],
  favour: [0, 10, 0.1],
  romanceFavour: [0, 10, 0.1],
};

export class FireSit {
  constructor(params = { ...DEFAULT_FIRE_SIT_PARAMS }) {
    this.p = params;
    this.clock = 0;
    this.sessions = new Map(); // girl id -> { seat, how, phase: 'going' | 'sitting', t, said }
    this.cooldownUntil = new Map(); // girl id -> clock
  }

  get active() {
    return this.sessions.size > 0;
  }

  /** The seats (indices) that nobody is going to or sat on. */
  seatsLeft(count) {
    const taken = new Set([...this.sessions.values()].map((s) => s.seat));
    return Array.from({ length: count }, (_, i) => i).filter((i) => !taken.has(i));
  }

  sitting(girl) {
    return this.sessions.get(girl)?.phase === 'sitting';
  }

  seatOf(girl) {
    return this.sessions.get(girl)?.seat ?? null;
  }

  /**
   * Who could suggest it now: [{ key: 'fire', girl, weight }] for the chooser. `ctx`: { blazing, seats (how many are free), rain, darkness,
   * girls: [{ id, free, distance }] }.
   */
  offers(ctx) {
    const p = this.p;
    if (!ctx.blazing || ctx.seats <= 0 || ctx.rain > p.rainAbove) return [];
    const weight = p.weight * (1 + p.duskBoost * ctx.darkness);
    return ctx.girls
      .filter((g) => g.free && g.distance <= p.girlRange && !this.sessions.has(g.id) && this.clock >= (this.cooldownUntil.get(g.id) ?? 0))
      .map((g) => ({ key: 'fire', girl: g.id, weight }));
  }

  take(offer, seats) {
    return this.begin(offer.girl, 'offer', seats);
  }

  /** Starts it for this girl (a choice, you pressing E, or the debug panel) on the first of `seats` (free indices). Returns { type: 'go', girl, seat, how } or null. */
  begin(girl, how, seats) {
    if (this.sessions.has(girl) || !seats.length) return null;
    this.sessions.set(girl, { seat: seats[0], how, phase: 'going', t: 0, said: new Set() });
    return { type: 'go', girl, seat: seats[0], how };
  }

  /** The game could not do it (she was stopped, nowhere to sit): forget it. */
  cancel(girl) {
    this.sessions.delete(girl);
  }

  /**
   * One step. `ctx`: { blazing, girls: { id: { free (asked), seated (sat on her log), youNear, favoured } | null } }. Events: { type: 'say', girl, line },
   * { type: 'end', girl, why: 'done' | 'out' | 'lost' }.
   */
  update(dt, ctx) {
    const p = this.p;
    this.clock += dt;
    const events = [];
    for (const [id, s] of [...this.sessions]) {
      const g = ctx.girls[id];
      const end = (why) => {
        this.sessions.delete(id);
        if (why === 'done' || why === 'out') this.cooldownUntil.set(id, this.clock + p.cooldown);
        events.push({ type: 'end', girl: id, why });
      };
      s.t += dt;
      if (!g) {
        end('lost');
        continue;
      }
      if (s.phase === 'going') {
        if (g.seated) {
          s.phase = 'sitting';
          s.t = 0;
          events.push({ type: 'say', girl: id, line: 'fireSit' });
        } else if (s.t >= p.goTimeout || !ctx.blazing) end(ctx.blazing ? 'lost' : 'out');
        continue;
      }
      if (!ctx.blazing) {
        events.push({ type: 'say', girl: id, line: 'fireOut' });
        end('out');
        continue;
      }
      if (s.t >= p.sitSeconds * 0.4 && !s.said.has('fireWarm')) {
        s.said.add('fireWarm');
        events.push({ type: 'say', girl: id, line: 'fireWarm' });
      }
      if (s.t >= p.sitSeconds * 0.7 && g.favoured && g.youNear && !s.said.has('fireRomance')) {
        s.said.add('fireRomance');
        events.push({ type: 'say', girl: id, line: 'fireRomance' });
      }
      if (s.t >= p.sitSeconds) {
        events.push({ type: 'say', girl: id, line: 'fireDone' });
        end('done');
      }
    }
    return events;
  }
}
