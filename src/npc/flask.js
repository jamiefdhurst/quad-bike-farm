// A flask at the top of the hill. A flat rock at the top of the pasture (layout.hill.viewpoint) looks back over the whole farm. Ride up with
// a girl, get off and press E at the rock and she sits down there and pours the tea; or a girl stood about up there when you arrive may
// suggest it herself (an offer, weighed by her needs in chooser.js). You stay and look for a bit; walk off and it ends early. Pure logic: the
// game says where everyone is and what the weather is doing, this says what happens next, and the game does the walking, sitting and pouring.

export const DEFAULT_FLASK_PARAMS = {
  startAfter: 120, // seconds into the game before a girl thinks of it herself
  weight: 0.8, // how much she cares for a sit and a cup of tea at the top (weighed against everything else she could do, chooser.js)
  cooldown: 420, // seconds after one before either girl suggests another (you can still ask)
  offerRange: 20, // metres: you are this close to the rock for her to suggest it
  girlRange: 30, // metres: she is this close to the rock for her to suggest it
  askRange: 8, // metres: a girl this close to you at the rock goes when you press E
  rainAbove: 0.12, // rain (0..1) above which it is off: the view is the point
  darkAbove: 0.7, // how dark (0 day, 1 night) before it is off
  sitSeconds: 40, // seconds you sit and look once the tea is poured
  stayRange: 11, // metres: you have to stay this close to the rock
  leaveAfter: 6, // seconds out of range before she packs up
  getOffTimeout: 20, // seconds she has to get off a quad you are not on before it is dropped
  goTimeout: 150, // seconds she has to get to the rock (it is a long way up)
  pourSeconds: 3, // seconds from sitting down to the tea being poured
  favour: 2.5, // favour for the girl you finished a cup with
  romanceFavour: 1.5, // more, when she is the favoured one
};

export const FLASK_PARAM_RANGES = {
  startAfter: [0, 900, 10],
  weight: [0, 3, 0.05],
  cooldown: [0, 1800, 10],
  offerRange: [4, 60, 1],
  girlRange: [4, 80, 1],
  askRange: [2, 30, 1],
  rainAbove: [0, 1, 0.01],
  darkAbove: [0, 1, 0.01],
  sitSeconds: [10, 180, 5],
  stayRange: [4, 40, 1],
  leaveAfter: [1, 60, 1],
  getOffTimeout: [5, 90, 5],
  goTimeout: [20, 400, 10],
  pourSeconds: [0.5, 10, 0.5],
  favour: [0, 10, 0.1],
  romanceFavour: [0, 10, 0.1],
};

/** What the line she says while you sit is, and when (seconds after the tea is poured): the view, the weather, and a quiet one if she is the favoured girl. */
export function sitLines(weather, favoured) {
  const out = [{ at: 0.25, line: 'flaskView' }];
  if (weather.cold) out.push({ at: 0.5, line: 'flaskCold' });
  else if (weather.sunny) out.push({ at: 0.5, line: 'flaskSun' });
  if (favoured) out.push({ at: 0.75, line: 'flaskRomance' });
  return out;
}

export class Flask {
  constructor(params = { ...DEFAULT_FLASK_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.cooldownUntil = 0;
    this.session = null; // { girl, how: 'offer' | 'asked', phase: 'off' | 'going' | 'pouring' | 'sitting', t, said, away }
  }

  /** The girl who has the flask out, if any. */
  get girl() {
    return this.session?.girl ?? null;
  }

  /** Whether the tea is poured and you are sitting with her (the mugs are out). */
  get poured() {
    return this.session?.phase === 'sitting';
  }

  get active() {
    return !!this.session;
  }

  /** The weather is fit for it: dry enough and light enough. `w`: { rain, darkness }. */
  fine(w) {
    return w.rain <= this.p.rainAbove && w.darkness <= this.p.darkAbove;
  }

  /**
   * Where each free girl could suggest it now: [{ key: 'flask', girl, weight }] for the chooser. `ctx`: { girls: [{ id, free, distance }] (distance
   * from the rock), youDistance, youSlow, weather: { rain, darkness } }.
   */
  offers(ctx) {
    const p = this.p;
    if (this.session || this.clock < p.startAfter || this.clock < this.cooldownUntil) return [];
    if (!this.fine(ctx.weather) || ctx.youDistance > p.offerRange || !ctx.youSlow) return [];
    return ctx.girls.filter((g) => g.free && g.distance <= p.girlRange).map((g) => ({ key: 'flask', girl: g.id, weight: p.weight }));
  }

  /** She chose to: books it and returns the event the game acts on. */
  take(offer) {
    return this.begin(offer.girl, 'offer');
  }

  /**
   * Starts it for this girl (a choice she made, you pressing E, or the debug panel). Returns { type: 'go', girl, how } if she can go straight
   * off, { type: 'getOff', girl, how } if she has to get off a quad first, or null if it is already on.
   */
  begin(girl, how, { seated = false } = {}) {
    if (this.session) return null;
    this.session = { girl, how, phase: seated ? 'off' : 'going', t: 0, said: new Set(), away: 0 };
    return { type: seated ? 'getOff' : 'go', girl, how };
  }

  /** The game could not do it (nowhere to sit, she was stopped): forget it. */
  cancel() {
    this.session = null;
  }

  /**
   * One step. `ctx`: { girl: { free (asked), seated (she is sat at the rock), x, z } | null, youDistance, favoured, weather: { rain, darkness, cold, sunny } }
   * for the girl who has it. Events: { type: 'go', girl } (she is free: send her), { type: 'pour', girl } (the flask and mugs come out),
   * { type: 'say', girl, line }, { type: 'end', girl, why: 'done' | 'left' | 'weather' | 'lost' }.
   */
  update(dt, ctx) {
    const p = this.p;
    this.clock += dt;
    const s = this.session;
    if (!s) return [];
    const events = [];
    const end = (why) => {
      this.session = null;
      if (why === 'done') this.cooldownUntil = this.clock + p.cooldown;
      events.push({ type: 'end', girl: s.girl, why });
    };
    s.t += dt;
    if (!ctx.girl) {
      end('lost');
      return events;
    }
    if (!this.fine(ctx.weather) && s.phase !== 'off') {
      end('weather');
      return events;
    }
    if (s.phase === 'off') {
      if (ctx.girl.free) {
        s.phase = 'going';
        s.t = 0;
        events.push({ type: 'go', girl: s.girl });
      } else if (s.t >= p.getOffTimeout) end('lost');
    } else if (s.phase === 'going') {
      if (ctx.girl.seated) {
        s.phase = 'pouring';
        s.t = 0;
      } else if (s.t >= p.goTimeout) end('lost');
    } else if (s.phase === 'pouring') {
      if (s.t >= p.pourSeconds) {
        s.phase = 'sitting';
        s.t = 0;
        events.push({ type: 'pour', girl: s.girl });
        events.push({ type: 'say', girl: s.girl, line: 'flaskPour' });
      }
    } else {
      s.away = ctx.youDistance > p.stayRange ? s.away + dt : 0;
      if (s.away >= p.leaveAfter) {
        events.push({ type: 'say', girl: s.girl, line: 'flaskLeft' });
        end('left');
        return events;
      }
      for (const l of sitLines(ctx.weather, ctx.favoured)) {
        if (s.t >= p.sitSeconds * l.at && !s.said.has(l.line)) {
          s.said.add(l.line);
          events.push({ type: 'say', girl: s.girl, line: l.line });
        }
      }
      if (s.t >= p.sitSeconds) {
        events.push({ type: 'say', girl: s.girl, line: 'flaskDone' });
        end('done');
      }
    }
    return events;
  }
}
