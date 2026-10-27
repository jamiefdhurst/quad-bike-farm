// A stay in the shepherd's hut. A free girl may fancy a sit in the hut on the hill, more so in the rain, the cold and the dark: she walks up,
// lights the stove if it is out, sits on the bunk's edge, keeps it going and says a thing or two, and gets up when she has had enough. Both
// girls can be in at once, one to a seat. You can ask the nearest one up there too. Pure logic: the game says where everyone is and what the
// stove is doing, this says what happens next, and the game does the walking, the sitting and the stove (like npc/fireSit.js).

export const DEFAULT_HUT_STAY_PARAMS = {
  weight: 0.7, // how much she cares for a sit in the hut (weighed against everything else she could do, chooser.js)
  rainBoost: 1.4, // extra keenness in the rain (times how hard it rains, 0 to 1)
  coldBoost: 1.2, // extra keenness in the cold (times how cold it is, 0 to 1)
  duskBoost: 0.8, // extra keenness as it gets dark (times how dark it is, 0 to 1)
  coldStoveShy: 0.45, // times the keenness when the stove is out and it is neither wet, cold nor dark: nothing to go for
  cooldown: 300, // seconds after a stay before she fancies another (you can still ask)
  girlRange: 120, // metres: she is this close to the hut to think of it
  sitSeconds: 150, // seconds she stays on the bunk
  goTimeout: 220, // seconds she has to get there and sit (it is a long way up)
  askRange: 8, // metres: a girl this close to you at the hut goes up when you press E
  youRange: 5, // metres: you are this close to her for her to say the quiet one
  stokeBelow: 150, // seconds of fuel left at which she puts another log on, if the weather wants the stove
  favour: 1.5, // favour for the girl you were with when she finished
  romanceFavour: 1.2, // more, when she is the favoured one
  teaFavour: 0.5, // more again if you had a mug of tea in the hut while she was in it
};

export const HUT_STAY_PARAM_RANGES = {
  weight: [0, 3, 0.05],
  rainBoost: [0, 4, 0.05],
  coldBoost: [0, 4, 0.05],
  duskBoost: [0, 4, 0.05],
  coldStoveShy: [0, 1, 0.05],
  cooldown: [0, 1800, 10],
  girlRange: [10, 300, 5],
  sitSeconds: [10, 600, 5],
  goTimeout: [30, 600, 10],
  askRange: [2, 30, 1],
  youRange: [2, 20, 1],
  stokeBelow: [10, 600, 10],
  favour: [0, 10, 0.1],
  romanceFavour: [0, 10, 0.1],
  teaFavour: [0, 10, 0.1],
};

/** 0..1 how cold it is: nothing from 12 degrees up, full at freezing. */
export function coldness(temperature) {
  return Math.max(0, Math.min(1, (12 - temperature) / 12));
}

/** Whether the weather wants a fire: wet, cold or dark. */
export function wantsFire(ctx) {
  return ctx.rain > 0.12 || ctx.cold > 0.3 || ctx.darkness > 0.5;
}

export class HutStay {
  constructor(params = { ...DEFAULT_HUT_STAY_PARAMS }) {
    this.p = params;
    this.clock = 0;
    this.sessions = new Map(); // girl id -> { seat, how, phase: 'going' | 'sitting', t, said, teaBefore }
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
   * Who could suggest it now: [{ key: 'hut', girl, weight }] for the chooser. `ctx`: { seats (how many are free), rain, cold (0..1), darkness,
   * stoveWarm, girls: [{ id, free, distance }] }.
   */
  offers(ctx) {
    const p = this.p;
    if (ctx.seats <= 0) return [];
    const wanting = wantsFire(ctx);
    let weight = p.weight * (1 + p.rainBoost * ctx.rain + p.coldBoost * ctx.cold + p.duskBoost * ctx.darkness);
    if (!wanting && !ctx.stoveWarm) weight *= p.coldStoveShy;
    return ctx.girls
      .filter((g) => g.free && g.distance <= p.girlRange && !this.sessions.has(g.id) && this.clock >= (this.cooldownUntil.get(g.id) ?? 0))
      .map((g) => ({ key: 'hut', girl: g.id, weight }));
  }

  take(offer, seats) {
    return this.begin(offer.girl, 'offer', seats);
  }

  /** Starts it for this girl (a choice, you pressing E, or the debug panel) on the first of `seats` (free indices). Returns { type: 'go', girl, seat, how } or null. */
  begin(girl, how, seats) {
    if (this.sessions.has(girl) || !seats.length) return null;
    this.sessions.set(girl, { seat: seats[0], how, phase: 'going', t: 0, said: new Set(), teaBefore: 0 });
    return { type: 'go', girl, seat: seats[0], how };
  }

  /** The game could not do it (she was stopped, nowhere to sit): forget it. */
  cancel(girl) {
    this.sessions.delete(girl);
  }

  /** You had a mug of tea in the hut: any girl sat there remembers it. */
  noteTea() {
    for (const s of this.sessions.values()) if (s.phase === 'sitting') s.teaBefore++;
  }

  /**
   * One step. `ctx`: { rain, cold, darkness, burning, fuel (seconds left), canStoke, girls: { id: { free (asked), seated, youNear, favoured } | null } }.
   * Events: { type: 'say', girl, line }, { type: 'light', girl } (she lights the stove), { type: 'stoke', girl }, { type: 'end', girl, why: 'done' | 'lost' }.
   */
  update(dt, ctx) {
    const p = this.p;
    this.clock += dt;
    const events = [];
    const wanting = wantsFire(ctx);
    for (const [id, s] of [...this.sessions]) {
      const g = ctx.girls[id];
      const end = (why) => {
        this.sessions.delete(id);
        if (why === 'done') this.cooldownUntil.set(id, this.clock + p.cooldown);
        events.push({ type: 'end', girl: id, why, teaWith: s.teaBefore > 0 });
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
          events.push({ type: 'say', girl: id, line: 'hutSit' });
          if (!ctx.burning && (wanting || s.how === 'asked')) {
            events.push({ type: 'light', girl: id });
            events.push({ type: 'say', girl: id, line: 'hutLight' });
          }
        } else if (s.t >= p.goTimeout) end('lost');
        continue;
      }
      // Sat on the bunk. She puts a log on a stove that is running low in weather that wants it.
      if (wanting && ctx.burning && ctx.canStoke && ctx.fuel < p.stokeBelow) events.push({ type: 'stoke', girl: id });
      if (s.t >= p.sitSeconds * 0.35 && !s.said.has('hutWarm')) {
        s.said.add('hutWarm');
        events.push({ type: 'say', girl: id, line: ctx.rain > 0.12 ? 'hutRain' : 'hutWarm' });
      }
      if (s.t >= p.sitSeconds * 0.7 && g.favoured && g.youNear && !s.said.has('hutRomance')) {
        s.said.add('hutRomance');
        events.push({ type: 'say', girl: id, line: 'hutRomance' });
      }
      if (s.t >= p.sitSeconds) {
        events.push({ type: 'say', girl: id, line: 'hutDone' });
        end('done');
      }
    }
    return events;
  }
}
