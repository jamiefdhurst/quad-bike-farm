// Amy guiding you back with a trailer on. When you have been reversing a hitched trailer for a few seconds she walks round behind it, to
// one side, and calls the lock ("left hand down", "straight", "stop") from how the trailer is lying against what pulls it, and gets
// cross if you turn the wrong way. It ends when you have stopped reversing for a bit, get off or unhitch. Pure: the game says where
// everything is and does the walking and the talking this asks for. (Jess does not: she would only laugh.)

export const DEFAULT_TRAILER_GUIDE_PARAMS = {
  reverseFor: 2.5, // seconds you've been reversing a hitched trailer before she offers
  reverseSpeed: 0.4, // m/s backwards that counts as reversing
  range: 35, // metres she'll come from
  behind: 3.6, // metres behind the trailer's rear she stands
  aside: 2.6, // metres off to one side, so the trailer isn't backing onto her
  straightBelow: 0.1, // radians of fold under which it counts as straight
  stopAt: 0.75, // fraction of the jack-knife angle at which she shouts stop
  callEvery: 2.2, // seconds between calls (a change of call comes sooner)
  steerWrong: 0.25, // steering past this the wrong way for the call counts as wrong
  wrongFor: 1.4, // seconds of turning the wrong way before she tells you
  crossHardAfter: 3, // times she has told you off this job before she really loses patience
  quitAfter: 4, // times she has told you off before she gives up
  endAfter: 7, // seconds not reversing before she reckons you're done
  lastsFor: 600, // seconds at most
  weight: 1.5, // how keen she is (times her own trailerGuideWeight)
  cooldown: 90, // seconds after one before she offers again
};

export const TRAILER_GUIDE_PARAM_RANGES = {
  reverseFor: [0, 20, 0.5],
  reverseSpeed: [0.1, 2, 0.05],
  range: [5, 100, 1],
  behind: [2, 8, 0.1],
  aside: [1, 6, 0.1],
  straightBelow: [0.02, 0.4, 0.01],
  stopAt: [0.3, 1, 0.05],
  callEvery: [0.5, 8, 0.1],
  steerWrong: [0.05, 0.8, 0.05],
  wrongFor: [0.3, 6, 0.1],
  crossHardAfter: [1, 10, 1],
  quitAfter: [2, 15, 1],
  endAfter: [2, 30, 0.5],
  lastsFor: [30, 3600, 30],
  weight: [0, 5, 0.05],
  cooldown: [0, 900, 10],
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * What she would call. `angle` is the trailer's yaw less the puller's (left positive; 0 is straight behind), `limit` the angle at which it
 * jams. A trailer lying with its nose to the left has its rear out to the right, and the rear of the puller has to chase it there:
 * reversing, the wheel goes the way you want the back to go. Returns 'stop', 'left', 'right' or 'straight' ('left' is left hand down).
 */
export function guideCall(angle, jammed, limit, p = DEFAULT_TRAILER_GUIDE_PARAMS) {
  if (jammed || Math.abs(angle) > limit * p.stopAt) return 'stop';
  if (Math.abs(angle) < p.straightBelow) return 'straight';
  return angle > 0 ? 'right' : 'left';
}

/** Which way the wheel has to go for a call: +1 left, -1 right, 0 either (the steering is positive turning left). */
export function wheelFor(call) {
  return call === 'left' ? 1 : call === 'right' ? -1 : 0;
}

/**
 * Where she stands: behind the trailer's rear, off to the side that is nearer her. `trailer` is { x, z, yaw } of its axle and the way it
 * points (toward the puller); `rear` is how far behind the axle its back end is. Returns { x, z, facing } (facing the puller).
 */
export function guideSpot(trailer, rear, girl, p = DEFAULT_TRAILER_GUIDE_PARAMS) {
  const fx = Math.sin(trailer.yaw);
  const fz = Math.cos(trailer.yaw);
  const lx = Math.cos(trailer.yaw); // its left
  const lz = -Math.sin(trailer.yaw);
  const bx = trailer.x - fx * (rear + p.behind);
  const bz = trailer.z - fz * (rear + p.behind);
  const side = (girl.x - bx) * lx + (girl.z - bz) * lz >= 0 ? 1 : -1;
  const x = bx + lx * side * p.aside;
  const z = bz + lz * side * p.aside;
  return { x, z, facing: Math.atan2(trailer.x + fx * 4 - x, trailer.z + fz * 4 - z) };
}

export class TrailerGuide {
  constructor(p = { ...DEFAULT_TRAILER_GUIDE_PARAMS }) {
    this.p = p;
    this.clock = 0;
    this.reversingFor = 0; // seconds you've been reversing a hitched trailer
    this.job = null; // { girl, since, idle, lastCall, lastAt, wrongFor, crosses }
    this.coolUntil = 0;
  }

  get active() {
    return !!this.job;
  }

  /**
   * One step. `ctx`: { hitched (you're riding something with a trailer on), speed (signed, forward positive), angle, jammed, limit,
   * steer (positive left) }. Returns events: { type: 'call', girl, call }, { type: 'cross', girl, hard },
   * { type: 'done', girl, why: 'finished' | 'quit' | 'left' | 'long' }.
   */
  update(dt, ctx) {
    const p = this.p;
    this.clock += dt;
    const reversing = ctx.hitched && ctx.speed < -p.reverseSpeed;
    this.reversingFor = reversing ? this.reversingFor + dt : ctx.hitched ? Math.max(0, this.reversingFor - dt * 0.5) : 0;
    const job = this.job;
    if (!job) return [];
    job.since += dt;
    if (!ctx.hitched) return [this.finish(job.lastCall === 'straight' ? 'finished' : 'left')];
    if (job.since > p.lastsFor) return [this.finish('long')];
    job.idle = reversing ? 0 : job.idle + dt;
    if (job.idle > p.endAfter) return [this.finish(job.lastCall === 'straight' || job.lastCall === 'stop' ? 'finished' : 'left')];
    const out = [];
    const call = guideCall(ctx.angle, ctx.jammed, ctx.limit, p);
    const since = this.clock - job.lastAt;
    const changed = call !== job.lastCall;
    // A new call comes quickly; the same one again only while you are still going and it is still wanting something done.
    if (changed ? (reversing || call === 'stop') && since > p.callEvery * 0.45 : reversing && call !== 'straight' && since > p.callEvery * 1.8) {
      out.push({ type: 'call', girl: job.girl, call });
      job.lastCall = call;
      job.lastAt = this.clock;
    }
    // Turning the wrong way for the call she is making, while reversing and it's out of true.
    const need = wheelFor(job.lastCall);
    const wrong = reversing && need !== 0 && Math.abs(ctx.angle) >= p.straightBelow && ctx.steer * need < -p.steerWrong;
    job.wrongFor = wrong ? job.wrongFor + dt : Math.max(0, job.wrongFor - dt);
    if (job.wrongFor > p.wrongFor) {
      job.wrongFor = 0;
      job.crosses++;
      if (job.crosses >= p.quitAfter) return [...out, this.finish('quit')];
      out.push({ type: 'cross', girl: job.girl, hard: job.crosses >= p.crossHardAfter });
    }
    return out;
  }

  /** Over: the cooldown starts. Returns the event. */
  finish(why) {
    const job = this.job;
    this.job = null;
    this.coolUntil = this.clock + this.p.cooldown;
    this.reversingFor = 0;
    return { type: 'done', girl: job?.girl, why };
  }

  /**
   * Her offer (`ctx` as update, plus girls: [{ id, x, z, free, weight (her trailerGuideWeight) }] and you: { x, z }): once you've been
   * reversing a hitched trailer a few seconds and she's free and near. [{ key: 'trailerGuide', girl, weight }].
   */
  offers(ctx) {
    const p = this.p;
    if (this.job || this.clock < this.coolUntil || !ctx.hitched || this.reversingFor < p.reverseFor) return [];
    const out = [];
    for (const g of ctx.girls) {
      if (!g.free || !(g.weight > 0) || dist(g, ctx.you) > p.range) continue;
      out.push({ key: 'trailerGuide', girl: g.id, weight: p.weight * g.weight });
    }
    return out;
  }

  /** She's taking it on (her own offer, or forced from the debug panel). Returns { type: 'go', girl }. */
  take(o) {
    this.job = { girl: o.girl, since: 0, idle: 0, lastCall: null, lastAt: this.clock - 99, wrongFor: 0, crosses: 0 };
    return { type: 'go', girl: o.girl };
  }

  /** For the debug panel and the console. */
  describe() {
    const j = this.job;
    if (!j) return this.clock < this.coolUntil ? `no (again in ${Math.round(this.coolUntil - this.clock)} s)` : 'no';
    return `${j.girl} guiding you back${j.lastCall ? `, last called ${j.lastCall}` : ''}${j.crosses ? `, cross ${j.crosses} times` : ''}`;
  }
}
