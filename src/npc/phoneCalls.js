// A girl's phone ringing. Now and then, stood about, a girl's phone goes; she says so, wanders off out of earshot to take it, talks
// for a bit with the phone at her ear and comes back to tell you the news, or in a mood that takes a while to lift (favour.js
// `sulk`). It is an offer (chooser.js) weighed by her own `phoneWeight`: Amy's calls are family and college and the odd bad one,
// Jess's are her mates, mostly good gossip. Pure: the game says who is free and where, and does the walking, the ringing and the mood.

export const DEFAULT_PHONE_PARAMS = {
  startAfter: 120, // seconds into the game before a call can come
  weight: 0.7, // how keen she is to answer (times her own phoneWeight, and weighed against everything else she could do, chooser.js)
  cooldown: 420, // seconds after one before either girl's phone goes again (you can still make it ring)
  awayMin: 9, // metres from you she goes to take it
  awayMax: 16, // and no further than this
  ringEvery: 2.4, // seconds between rings while she is on her way
  walkTimeout: 40, // seconds she has to get to her spot before she answers where she is
  talkMin: 14, // seconds she talks for
  talkMax: 32,
  talkSayEvery: 9, // seconds between the things she says into it
  tellRange: 3.5, // metres: she is this close to you to tell you
  backTimeout: 60, // seconds she has to get back to you before she keeps it to herself
};

export const PHONE_PARAM_RANGES = {
  startAfter: [0, 900, 10],
  weight: [0, 3, 0.05],
  cooldown: [0, 1800, 10],
  awayMin: [3, 30, 0.5],
  awayMax: [5, 40, 0.5],
  ringEvery: [1, 6, 0.1],
  walkTimeout: [10, 120, 1],
  talkMin: [3, 60, 1],
  talkMax: [5, 90, 1],
  talkSayEvery: [3, 30, 1],
  tellRange: [1.5, 8, 0.25],
  backTimeout: [10, 180, 5],
};

/**
 * Where she goes to take it: a point `away` metres from `from` (you), roughly on the side she is already, turned by `jitter`
 * (radians, either way). Returns { x, z }. The game keeps it inside her field.
 */
export function callSpot(girl, from, away, jitter = 0) {
  let dx = girl.x - from.x;
  let dz = girl.z - from.z;
  if (Math.hypot(dx, dz) < 0.5) {
    dx = 0;
    dz = 1;
  }
  const a = Math.atan2(dx, dz) + jitter;
  return { x: from.x + Math.sin(a) * away, z: from.z + Math.cos(a) * away };
}

export class PhoneCalls {
  constructor(params = { ...DEFAULT_PHONE_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.cooldownUntil = 0;
    this.session = null; // { girl, how, phase: 'going' | 'talking' | 'back', t, ringT, sayT, talkFor, mood, moodSeconds }
  }

  get girl() {
    return this.session?.girl ?? null;
  }

  get active() {
    return !!this.session;
  }

  /** `ctx.girls`: [{ id, free, weight, moodChance, moodSeconds }]. Offers for each free girl who likes a chat: [{ key: 'phoneCall', girl, weight, mood, moodSeconds }]. */
  offers(ctx) {
    const p = this.p;
    if (this.session || this.clock < p.startAfter || this.clock < this.cooldownUntil) return [];
    return ctx.girls
      .filter((g) => g.free && g.weight > 0)
      .map((g) => ({ key: 'phoneCall', girl: g.id, weight: p.weight * g.weight, mood: this.random() < (g.moodChance ?? 0), moodSeconds: g.moodSeconds ?? 240 }));
  }

  take(o) {
    return this.begin(o.girl, 'offer', o);
  }

  /** Starts it (her choice, or the debug panel's). Returns { type: 'ring', girl, how }, or null if one is on. */
  begin(girl, how, { mood = false, moodSeconds = 240 } = {}) {
    if (this.session) return null;
    const p = this.p;
    this.session = { girl, how, phase: 'going', t: 0, ringT: 0, sayT: 0, talkFor: p.talkMin + (Math.max(p.talkMin, p.talkMax) - p.talkMin) * this.random(), mood, moodSeconds };
    return { type: 'ring', girl, how };
  }

  cancel() {
    this.session = null;
  }

  describe() {
    const s = this.session;
    if (s) return `${s.girl} ${{ going: 'is going off to answer it', talking: 'is on the phone', back: 'is coming back' }[s.phase]} (${s.mood ? 'a bad call' : 'news'})`;
    return this.clock < this.cooldownUntil ? `no (again in ${Math.round(this.cooldownUntil - this.clock)} s)` : 'no';
  }

  end(out, why) {
    const s = this.session;
    this.session = null;
    this.cooldownUntil = this.clock + this.p.cooldown;
    out.push({ type: 'end', girl: s.girl, why });
  }

  /**
   * `ctx.girl`: { free (her own hold not counted), there (stood at her spot), youDistance } or null.
   * Events: { type: 'ring', girl } (the phone goes, also at the start), { type: 'answer', girl } (phone to her ear),
   * { type: 'say', girl, line }, { type: 'hangUp', girl } (she sets off back), { type: 'tell', girl, mood, moodSeconds } (she has reached
   * you), { type: 'end', girl, why: 'done' | 'busy' | 'timeout' }.
   */
  update(dt, ctx) {
    this.clock += dt;
    const s = this.session;
    if (!s) return [];
    const p = this.p;
    const out = [];
    s.t += dt;
    if (!ctx.girl || !ctx.girl.free) {
      this.end(out, 'busy');
      return out;
    }
    if (s.phase === 'going') {
      s.ringT += dt;
      if (s.ringT >= p.ringEvery) {
        s.ringT = 0;
        out.push({ type: 'ring', girl: s.girl });
      }
      if (ctx.girl.there || s.t >= p.walkTimeout) {
        s.phase = 'talking';
        s.t = 0;
        out.push({ type: 'answer', girl: s.girl });
      }
    } else if (s.phase === 'talking') {
      s.sayT += dt;
      if (s.sayT >= p.talkSayEvery && s.t < s.talkFor - 3) {
        s.sayT = 0;
        out.push({ type: 'say', girl: s.girl, line: 'phoneTalk' });
      }
      if (s.t >= s.talkFor) {
        s.phase = 'back';
        s.t = 0;
        out.push({ type: 'hangUp', girl: s.girl });
      }
    } else if (ctx.girl.youDistance <= p.tellRange) {
      out.push({ type: 'tell', girl: s.girl, mood: s.mood, moodSeconds: s.moodSeconds });
      this.end(out, 'done');
    } else if (s.t >= p.backTimeout) {
      this.end(out, 'timeout');
    }
    return out;
  }
}
