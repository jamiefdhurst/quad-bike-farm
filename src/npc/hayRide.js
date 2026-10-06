// The hay ride: the girls riding on the bales of a trailer behind the tractor while you drive. Pure logic (the game says what the
// trailer and the girls are doing, and gets events back), so it's tested without the game (tests/hayRide.test.js).
//
//   board   a girl who's stood about walks over and climbs on once you've stopped, with the trailer hitched and you on the tractor
//   bump    the trailer is thrown about by the ground and one of them shrieks
//   lie     a smooth, straight stretch: one lies back on the bales; a bump or a bend sits her up again
//   slide   a bend taken too fast: the girl on the outside loses her grip and goes off into the mud
//   leave   you got off the tractor or unhitched: they climb down

import { edgePush } from '../vehicle/trailer.js';

export const DEFAULT_HAYRIDE_PARAMS = {
  boardRange: 40, // metres a girl who's stood about will walk over from
  stopSpeed: 0.6, // m/s: the tractor has to be slower than this for them to climb on
  boardDelayMin: 1, // seconds after you've stopped (or she's free) before she sets off
  boardDelayMax: 4,
  holdPush: 2.4, // m/s squared of sideways push a girl sat up can take before her grip starts to go
  holdPushLying: 1.5, // the same lying back, with nothing to hold
  slackMin: 0.85, // each girl's own nerve scales that by this much...
  slackMax: 1.3, // ...up to this
  gripLoss: 0.45, // grip (1 to 0) lost a second per m/s squared over the limit
  gripRecover: 0.5, // grip regained a second when it's calm
  joltPush: 2.5, // a bump's vertical speed (m/s) counts as this much extra sideways push per m/s
  slideGrace: 12, // seconds on board before anyone can fall
  slideCooldown: 90, // seconds between falls
  slideChance: 0.6, // chance a girl whose grip has gone actually falls (otherwise she hangs on and the grip comes back a bit)
  bumpJolt: 0.5, // m/s of bounce that makes somebody shriek
  bumpCooldown: 14,
  jessBumpChance: 0.65, // chance it's Jess who shrieks, when both are aboard
  lieAfter: 7, // seconds of smooth going before one lies back
  lieSpeed: 1.2, // m/s: it has to be moving
  lieMaxTurn: 0.1, // rad/s: nearly straight
  lieMaxJolt: 0.25,
  lieChance: 0.5, // chance a smooth stretch ends in somebody lying back
  sitUpJolt: 0.6, // a bump this hard sits her up
  sitUpPush: 1.2, // so does this much sideways push
  leaveDelayMax: 0.9, // seconds she takes to start climbing down once you've got off
};

export const HAYRIDE_PARAM_RANGES = {
  boardRange: [5, 100, 1],
  stopSpeed: [0.1, 3, 0.1],
  boardDelayMin: [0, 10, 0.5],
  boardDelayMax: [0, 20, 0.5],
  holdPush: [0.5, 8, 0.1],
  holdPushLying: [0.3, 8, 0.1],
  slackMin: [0.3, 1.5, 0.05],
  slackMax: [0.5, 2.5, 0.05],
  gripLoss: [0.05, 3, 0.05],
  gripRecover: [0.05, 3, 0.05],
  joltPush: [0, 10, 0.1],
  slideGrace: [0, 120, 1],
  slideCooldown: [0, 600, 5],
  slideChance: [0, 1, 0.05],
  bumpJolt: [0.1, 3, 0.05],
  bumpCooldown: [0, 120, 1],
  jessBumpChance: [0, 1, 0.05],
  lieAfter: [1, 60, 1],
  lieSpeed: [0.2, 6, 0.1],
  lieMaxTurn: [0.02, 0.5, 0.01],
  lieMaxJolt: [0.05, 2, 0.05],
  lieChance: [0, 1, 0.05],
  sitUpJolt: [0.1, 3, 0.05],
  sitUpPush: [0.2, 6, 0.1],
  leaveDelayMax: [0, 5, 0.1],
};

export class HayRide {
  constructor(params = { ...DEFAULT_HAYRIDE_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.girls = {}; // id -> { grip, slack, lying, onFor, boardIn, leaveIn }
    this.smoothFor = 0; // seconds the ride has been smooth and straight
    this.last = { bump: -Infinity, slide: -Infinity };
  }

  girl(id) {
    return (this.girls[id] ??= { grip: 1, slack: 0, lying: false, onFor: 0, boardIn: null, leaveIn: null });
  }

  between(a, b) {
    return a + this.random() * Math.max(0, b - a);
  }

  /**
   * One step. `ctx`:
   *   active: you're on the tractor with the trailer hitched
   *   speed, omega, jolt: the trailer's ground speed, turn rate (left positive) and bounce (vehicle/trailer.js)
   *   girls: [{ id, free, aboard, dist, seatX }]  free: stood about with nothing to do; aboard: on or climbing onto the trailer;
   *          dist: metres from the trailer; seatX: which side she's on (left positive), when aboard
   * Returns events: { type: 'board' | 'bump' | 'lie' | 'sit' | 'slide' | 'leave', girl, side? } (side: +1 left, -1 right, for a slide).
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.clock += dt;
    const aboard = ctx.girls.filter((g) => g.aboard);

    // Climbing down: the ride is over, so each aboard girl goes after her own short wait.
    if (!ctx.active) {
      this.smoothFor = 0;
      for (const g of ctx.girls) {
        const s = this.girl(g.id);
        s.boardIn = null;
        if (!g.aboard) {
          s.leaveIn = null;
          continue;
        }
        s.leaveIn ??= this.between(0, p.leaveDelayMax);
        s.leaveIn -= dt;
        if (s.leaveIn <= 0) {
          s.leaveIn = null;
          events.push({ type: 'leave', girl: g.id });
        }
      }
      return events;
    }

    // Getting on, once you're stopped.
    const stopped = ctx.speed < p.stopSpeed;
    for (const g of ctx.girls) {
      const s = this.girl(g.id);
      s.leaveIn = null;
      if (g.aboard || !g.free || g.dist > p.boardRange || !stopped) {
        s.boardIn = null;
        continue;
      }
      s.boardIn ??= this.between(p.boardDelayMin, p.boardDelayMax);
      s.boardIn -= dt;
      if (s.boardIn <= 0) {
        s.boardIn = null;
        events.push({ type: 'board', girl: g.id });
      }
    }

    // Everyone on the trailer: grip, bumps, lying back.
    for (const g of aboard) {
      const s = this.girl(g.id);
      if (s.onFor === 0) {
        s.slack = this.between(p.slackMin, p.slackMax);
        s.grip = 1;
      }
      s.onFor += dt;
    }
    for (const g of ctx.girls) if (!g.aboard) Object.assign(this.girl(g.id), { onFor: 0, lying: false });
    if (!aboard.length) {
      this.smoothFor = 0;
      return events;
    }

    const smooth = ctx.speed > p.lieSpeed && Math.abs(ctx.omega) < p.lieMaxTurn && ctx.jolt < p.lieMaxJolt;
    this.smoothFor = smooth ? this.smoothFor + dt : 0;

    if (ctx.jolt > p.bumpJolt && this.clock - this.last.bump >= p.bumpCooldown) {
      const jess = aboard.find((g) => g.id === 'jess');
      const pick = aboard.length > 1 ? (jess && this.random() < p.jessBumpChance ? jess : aboard.find((g) => g.id !== jess?.id)) : aboard[0];
      this.last.bump = this.clock;
      events.push({ type: 'bump', girl: pick.id });
    }

    for (const g of aboard) {
      const s = this.girl(g.id);
      const push = Math.max(0, edgePush(ctx.speed, ctx.omega, g.seatX));
      const hold = (s.lying ? p.holdPushLying : p.holdPush) * s.slack;
      const over = push + ctx.jolt * p.joltPush * 0.4 - hold;
      s.grip = over > 0 ? Math.max(0, s.grip - over * p.gripLoss * dt) : Math.min(1, s.grip + p.gripRecover * dt);

      if (s.lying && (ctx.jolt > p.sitUpJolt || push > p.sitUpPush)) {
        s.lying = false;
        events.push({ type: 'sit', girl: g.id });
      }
      if (s.grip <= 0 && s.onFor > p.slideGrace && this.clock - this.last.slide >= p.slideCooldown) {
        if (this.random() < p.slideChance) {
          this.last.slide = this.clock;
          s.lying = false;
          s.grip = 1;
          events.push({ type: 'slide', girl: g.id, side: g.seatX < 0 ? -1 : 1 });
          continue;
        }
        s.grip = 0.4; // hung on, this time
      }
    }

    if (this.smoothFor >= p.lieAfter) {
      this.smoothFor = 0; // one try per smooth stretch of this length
      const sitting = aboard.filter((g) => !this.girl(g.id).lying);
      if (sitting.length && sitting.length === aboard.length && this.random() < p.lieChance) {
        const g = sitting[Math.floor(this.random() * sitting.length)];
        this.girl(g.id).lying = true;
        events.push({ type: 'lie', girl: g.id });
      }
    }
    return events;
  }

  /** She's off the trailer, however that happened: forget how she was. */
  clear(id) {
    Object.assign(this.girl(id), { lying: false, onFor: 0, grip: 1, boardIn: null, leaveIn: null });
  }
}
