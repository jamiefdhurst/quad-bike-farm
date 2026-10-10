// Keeping a sick one alive. A quad that is hard to keep going (it took a few goes to start, the plug is fouled, the battery is weak,
// it is worn out, or its choke creeps on) won't be switched off by the girl who got it going, because if it dies it won't start again.
// She sits on the pillion seat, leaning forward with a hand on the throttle, holding a fast idle and catching it when it falters, and
// leaves it when you take it or she has had enough. Pure logic: `sickness` scores a quad, `KeepAlive` is the hand on the throttle.

export const DEFAULT_KEEPALIVE_PARAMS = {
  sickFrom: 0.5, // sickness score at which a quad counts as sick (any one heavy cause does it; two light ones do)
  hardStartCranks: 2, // goes at the starter or cord (a start that took this many) that make it hard to start
  hardStartScore: 0.5,
  foulFrom: 0.3, // plug fouling past which it counts
  foulScore: 0.35,
  weakBatteryBelow: 0.45, // battery charge below which it counts
  weakBatteryScore: 0.35,
  wornFrom: 0.5, // engine wear past which it is worn out
  wornScore: 0.5,
  chokeCreepScore: 0.5, // the choke-creeps quirk
  erraticFrom: 0.3, // erratic running (it wants a service)
  erraticScore: 0.3,
  goRange: 14, // how far from the quad she is when she goes over to sit on it, in metres
  goChance: 0.5, // per second, once she is free and it is running unattended
  fastIdle: 1.5, // the revs she holds, as a multiple of its idle
  holdBase: 0.1, // throttle she keeps on even when it is happy
  holdGain: 1.6, // how hard she opens it per fraction of the target rpm it is short by
  falterBelow: 0.85, // below this fraction of idle it is faltering and she catches it
  catchHold: 0.4, // seconds she gives it a handful when she catches it
  catchGap: 3, // and the least between catches
  truthAfterJess: 40, // seconds sat there before Jess owns up to why she is really on the back
  truthAfterAmy: 90, // and before Amy would, if you are near enough to catch her
  truthRange: 4, // how near you have to be, in metres
  giveUpAfter: 180, // seconds she sits there with nobody coming before she has had enough
  keyOffChance: 0.15, // when she gives up, the chance she switches it off (mostly she just gets off and leaves it to its luck)
  letGoStall: 0.6, // when she lets go of a sick one (you take it, or she gets off), the chance it dies, at full sickness
  letGoAfter: 4, // she has to have been holding it this many seconds for that to matter
  cooldown: 240, // seconds before she will do it again after giving up
};

export const KEEPALIVE_PARAM_RANGES = {
  sickFrom: [0.1, 1, 0.05],
  hardStartCranks: [1, 6, 1],
  hardStartScore: [0, 1, 0.05],
  foulFrom: [0, 1, 0.05],
  foulScore: [0, 1, 0.05],
  weakBatteryBelow: [0, 1, 0.05],
  weakBatteryScore: [0, 1, 0.05],
  wornFrom: [0, 1, 0.05],
  wornScore: [0, 1, 0.05],
  chokeCreepScore: [0, 1, 0.05],
  erraticFrom: [0, 1, 0.05],
  erraticScore: [0, 1, 0.05],
  goRange: [3, 40, 1],
  goChance: [0, 2, 0.05],
  fastIdle: [1, 3, 0.05],
  holdBase: [0, 0.5, 0.01],
  holdGain: [0, 5, 0.05],
  falterBelow: [0.3, 1, 0.01],
  catchHold: [0.1, 2, 0.05],
  catchGap: [0.5, 20, 0.5],
  truthAfterJess: [5, 300, 5],
  truthAfterAmy: [5, 600, 5],
  truthRange: [1, 15, 0.5],
  giveUpAfter: [20, 900, 10],
  keyOffChance: [0, 1, 0.01],
  letGoStall: [0, 1, 0.05],
  letGoAfter: [0, 30, 0.5],
  cooldown: [0, 1200, 10],
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * How sick a quad is, 0..1, and why. `s` is { cranks (goes the last start took), fouling, battery, wear, chokeCreeps, erratic }.
 * Returns { score, sick, reasons }, the reasons being 'hardStart', 'fouled', 'weakBattery', 'worn', 'chokeCreeps' and 'erratic'.
 */
export function sickness(s, P = DEFAULT_KEEPALIVE_PARAMS) {
  const reasons = [];
  let score = 0;
  const add = (reason, points) => {
    reasons.push(reason);
    score += points;
  };
  if ((s.cranks ?? 0) >= P.hardStartCranks) add('hardStart', P.hardStartScore);
  if ((s.fouling ?? 0) >= P.foulFrom) add('fouled', P.foulScore);
  if ((s.battery ?? 1) < P.weakBatteryBelow) add('weakBattery', P.weakBatteryScore);
  if ((s.wear ?? 0) >= P.wornFrom) add('worn', P.wornScore);
  if (s.chokeCreeps) add('chokeCreeps', P.chokeCreepScore);
  if ((s.erratic ?? 0) >= P.erraticFrom) add('erratic', P.erraticScore);
  score = clamp(score, 0, 1);
  return { score, sick: score >= P.sickFrom, reasons };
}

/** What `sickness` reads off a quad (anything with engine, quirks and startTrouble). */
export function sickEvidence(quad) {
  const e = quad.engine;
  return { cranks: quad.startTrouble ?? 0, fouling: e.fouling, battery: e.battery, wear: e.wear, chokeCreeps: !!quad.quirks?.has('chokeCreeps'), erratic: e.erratic };
}

/** Whether a sick quad dies when she lets go of it, having held it for `heldFor` seconds. */
export function letGoStalls(score, heldFor, random, P = DEFAULT_KEEPALIVE_PARAMS) {
  if (heldFor < P.letGoAfter) return false;
  return random() < P.letGoStall * clamp(score, 0, 1);
}

/** The hand on the throttle. One per girl; she is `holding` while it is running, sick and nobody is on it. */
export class KeepAlive {
  constructor({ params = DEFAULT_KEEPALIVE_PARAMS, random = Math.random } = {}) {
    this.p = params;
    this.random = random;
    this.reset();
    this.coolFor = 0;
  }

  /** Counts down the time before she will go and do it again (the game calls this every frame, wherever she is). */
  cool(dt) {
    this.coolFor = Math.max(0, this.coolFor - dt);
  }

  reset() {
    this.holding = false;
    this.heldFor = 0;
    this.throttle = 0;
    this.catching = 0; // seconds left of a handful of throttle
    this.sinceCatch = Infinity;
    this.saidTruth = false;
    this.sat = false;
  }

  /** Whether she would go over and sit on it: it is sick, running and unattended, she is free and not cooling off. */
  wouldGo(ctx) {
    return this.coolFor <= 0 && ctx.sick && ctx.running && ctx.unattended && ctx.distance <= this.p.goRange;
  }

  /**
   * One step while she is sat on the quad. `ctx` is { running, sick, score, unattended, rpm, idleRpm, youDistance, id }. Returns events:
   * { type: 'sit' } once she is holding it, 'catch', 'truth' (she owns up), 'died' (it stalled under her), 'letGo' (with heldFor and
   * whether it stalls), and 'giveUp' (with whether she switches it off).
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    const on = ctx.running && ctx.sick && ctx.unattended;
    if (!on) {
      if (this.holding) {
        if (!ctx.running && ctx.unattended) events.push({ type: 'died' });
        else if (!ctx.unattended) events.push({ type: 'letGo', heldFor: this.heldFor, stalls: letGoStalls(ctx.score, this.heldFor, this.random, p) });
      }
      this.reset();
      return events;
    }
    if (!this.holding) {
      this.holding = true;
      events.push({ type: 'sit' });
    }
    this.heldFor += dt;
    this.sinceCatch += dt;
    const target = ctx.idleRpm * p.fastIdle;
    let t = p.holdBase + Math.max(0, (target - ctx.rpm) / target) * p.holdGain;
    if (this.catching > 0) {
      this.catching -= dt;
      t = 1;
    } else if (ctx.rpm < ctx.idleRpm * p.falterBelow && this.sinceCatch >= p.catchGap) {
      this.catching = p.catchHold;
      this.sinceCatch = 0;
      events.push({ type: 'catch' });
      t = 1;
    }
    this.throttle = clamp(t, 0, 1);

    const after = ctx.id === 'jess' ? p.truthAfterJess : p.truthAfterAmy;
    const caught = ctx.id === 'jess' || ctx.youDistance <= p.truthRange;
    if (!this.saidTruth && this.heldFor >= after && caught) {
      this.saidTruth = true;
      events.push({ type: 'truth' });
    }
    if (this.heldFor >= p.giveUpAfter) {
      const keyOff = this.random() < p.keyOffChance;
      const stalls = !keyOff && letGoStalls(ctx.score, this.heldFor, this.random, p);
      this.reset();
      this.coolFor = p.cooldown;
      events.push({ type: 'giveUp', keyOff, stalls });
    }
    return events;
  }
}
