// Rev-offs. Blip the throttle of a stood quad near a girl sat on a running one and she may blip back. Jess always
// does, and each round she goes longer and louder; Amy answers now and then, once or twice, and stops. Past a few
// rounds somebody complains: Amy, if she's about and isn't the one revving, otherwise the engine (it stalls cold or
// worn, or just pops). Pure logic: the game says who and where everyone is, and sets each girl's quad throttle
// from `throttleFor`.

export const DEFAULT_REVOFF_PARAMS = {
  blipAt: 0.3, // your throttle must rise past this to count as a blip (the throttle key opens gradually from 0.25, vehicle/pedalKeys.js)
  maxYourSpeed: 2, // m/s; you only rev it stood still (or near enough)
  hearRange: 16, // metres between you and the girl for her to answer
  complainRange: 40, // metres: how far off Amy can be and still tell you both off
  jessReplyChance: 1, // Jess always answers
  amyReplyChance: 0.2, // Amy answers now and then
  replyDelayMin: 0.3, // seconds before she answers
  replyDelayMax: 0.8,
  blipHold: 0.35, // seconds the throttle is held for the first answer
  holdStep: 0.12, // seconds longer each round
  holdMax: 1.1,
  blipGap: 0.2, // seconds between blips within one answer
  maxBlips: 4, // most blips in one answer
  roundWindow: 7, // seconds after her answer that you blipping again counts as another round
  amyMaxRound: 1, // Amy gives up after this many rounds (she's said her bit)
  complainRound: 3, // round at which somebody may complain
  complainChance: 0.6, // per answer from then on
  complainCooldown: 60, // seconds between complaints
  stallBelow: 0.5, // engine temperature (0..1) under which an engine that's complaining stalls
  stallWear: 0.4, // or wear above which it does
};

export const REVOFF_PARAM_RANGES = {
  blipAt: [0.1, 1, 0.05],
  maxYourSpeed: [0, 10, 0.5],
  hearRange: [4, 50, 1],
  complainRange: [5, 100, 1],
  jessReplyChance: [0, 1, 0.05],
  amyReplyChance: [0, 1, 0.05],
  replyDelayMin: [0, 3, 0.05],
  replyDelayMax: [0, 3, 0.05],
  blipHold: [0.1, 2, 0.05],
  holdStep: [0, 0.5, 0.01],
  holdMax: [0.2, 3, 0.05],
  blipGap: [0.05, 1, 0.05],
  maxBlips: [1, 8, 1],
  roundWindow: [2, 30, 0.5],
  amyMaxRound: [0, 6, 1],
  complainRound: [1, 8, 1],
  complainChance: [0, 1, 0.05],
  complainCooldown: [0, 300, 5],
  stallBelow: [0, 1, 0.05],
  stallWear: [0, 1, 0.05],
};

const REPLY_CHANCE = { jess: 'jessReplyChance', amy: 'amyReplyChance' };

export class RevOff {
  constructor(params = { ...DEFAULT_REVOFF_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.lastThrottle = 0;
    this.round = 0; // how far the current exchange has escalated
    this.lastAnswer = -Infinity; // when the last answer was scheduled to end
    this.lastComplaint = -Infinity;
    this.replies = new Map(); // girl id -> { segments: [[from, to]], end }
  }

  /** Is her throttle held open right now? 1 or 0. */
  throttleFor(girl) {
    const r = this.replies.get(girl);
    if (!r) return 0;
    return r.segments.some(([a, b]) => this.clock >= a && this.clock < b) ? 1 : 0;
  }

  /** Is she mid-answer? */
  answering(girl) {
    return this.replies.has(girl);
  }

  /**
   * One step. `ctx`:
   *   you: { riding, running, speed, throttle, x, z }     riding: you're on a quad that's running
   *   girls: [{ id, canBlip, x, z }]                      canBlip: sat on a running quad nobody else is driving
   * Returns events: { type: 'answer', girl, round, blips, hold }, { type: 'done', girl },
   *   { type: 'complain', by: 'amy', girl } or { type: 'complain', by: 'engine', girl }.
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.clock += dt;
    for (const [id, r] of this.replies) {
      if (this.clock >= r.end || !ctx.girls.find((g) => g.id === id)?.canBlip) {
        this.replies.delete(id);
        events.push({ type: 'done', girl: id });
      }
    }
    const t = ctx.you.throttle;
    const blipped = t >= p.blipAt && this.lastThrottle < p.blipAt;
    this.lastThrottle = t;
    if (this.round > 0 && this.clock - this.lastAnswer > p.roundWindow) this.round = 0;
    if (!blipped || !ctx.you.riding || !ctx.you.running || ctx.you.speed > p.maxYourSpeed) return events;

    const near = ctx.girls.filter((g) => g.canBlip && !this.replies.has(g.id) && Math.hypot(g.x - ctx.you.x, g.z - ctx.you.z) <= p.hearRange);
    const within = this.clock - this.lastAnswer <= p.roundWindow;
    for (const g of near) {
      if (this.random() >= (p[REPLY_CHANCE[g.id]] ?? 0)) continue;
      const round = within ? this.round + 1 : 1;
      if (g.id === 'amy' && round > p.amyMaxRound) continue;
      this.answer(g, round, ctx, events);
    }
    return events;
  }

  answer(g, round, ctx, events) {
    const p = this.p;
    this.round = round;
    const blips = Math.min(p.maxBlips, round);
    const hold = Math.min(p.holdMax, p.blipHold + p.holdStep * (round - 1));
    let at = this.clock + p.replyDelayMin + this.random() * Math.max(0, p.replyDelayMax - p.replyDelayMin);
    const segments = [];
    for (let i = 0; i < blips; i++) {
      segments.push([at, at + hold]);
      at += hold + p.blipGap;
    }
    const end = segments[segments.length - 1][1];
    this.replies.set(g.id, { segments, end });
    this.lastAnswer = end;
    events.push({ type: 'answer', girl: g.id, round, blips, hold });

    if (round < p.complainRound || this.clock - this.lastComplaint < p.complainCooldown || this.random() >= p.complainChance) return;
    this.lastComplaint = this.clock;
    this.round = 0;
    const amy = ctx.girls.find((o) => o.id === 'amy' && o.id !== g.id && Math.hypot(o.x - ctx.you.x, o.z - ctx.you.z) <= p.complainRange);
    events.push(amy ? { type: 'complain', by: 'amy', girl: g.id } : { type: 'complain', by: 'engine', girl: g.id });
  }

  /** A worn or cold engine that's being complained about stalls; a healthy warm one just coughs. */
  stalls(engine) {
    return engine.temperature < this.p.stallBelow || engine.wear > this.p.stallWear;
  }
}
