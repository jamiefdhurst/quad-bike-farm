// The jump. A wooden ramp stands in the field (world/jumpRamp.js); the girls take turns riding at it, and the other one rates the landing.
// Pure logic: JumpRun drives one girl's goes at it (the run-up, the take-off, the landing, pulling up) and judges each landing;
// JumpWatch decides who watches and who has the next turn. herDriving.js runs JumpRun as a drive mode.

export const DEFAULT_JUMP_PARAMS = {
  runUp: 22, // metres before the foot of the ramp that she lines up from (the quads are slow off the mark: she needs the room)
  runSpeed: 10, // m/s she aims to hit the ramp at
  approachSpeed: 6, // m/s she goes at getting to the run-up
  startRadius: 4, // metres from the run-up point that she turns for the ramp
  lookAhead: 5, // metres up the centre line she steers at on the run (pure pursuit)
  abortOffset: 1.6, // metres off the centre line, near the ramp, that she gives it up and goes round again
  abortHeading: 0.5, // radians off straight, near the ramp, that she gives it up and goes round again
  abortRange: 7, // metres from the ramp the two checks above start
  runTimeout: 14, // seconds on the run without taking off before she gives up on this go
  settleTime: 1.4, // seconds she watches the landing for a roll-over before it counts as clean
  goesMin: 1, // how many goes she has before she's done
  goesMax: 3,
  pauseBetween: 1.5, // seconds sat at the bottom before she goes back for another
  minAir: 0.25, // seconds airborne for it to be a jump at all; less is a bump
  greatAir: 0.7, // seconds airborne for a great one (with a clean landing)
  roughTilt: 0.92, // how upright the quad is on landing (1 is dead level); lower than this is rough
  hardImpact: 6.5, // m/s down on landing that is a bone-shaker
  watchRange: 40, // metres: the other girl can see it from this far
  rateGap: 4, // seconds after a landing before the other girl says what she thought
  turnChance: 0.7, // the chance the other girl has her go once the first is done
  turnAfter: 4, // seconds after the first girl is done
};

export const JUMP_PARAM_RANGES = {
  runUp: [8, 30, 1],
  runSpeed: [5, 18, 0.5],
  approachSpeed: [1, 8, 0.5],
  startRadius: [1, 10, 0.5],
  lookAhead: [2, 12, 0.5],
  abortOffset: [0.5, 4, 0.1],
  abortHeading: [0.1, 1.5, 0.05],
  abortRange: [3, 15, 0.5],
  runTimeout: [4, 40, 1],
  settleTime: [0.3, 4, 0.1],
  goesMin: [1, 6, 1],
  goesMax: [1, 8, 1],
  pauseBetween: [0, 10, 0.5],
  minAir: [0.05, 1, 0.05],
  greatAir: [0.2, 2, 0.05],
  roughTilt: [0.6, 1, 0.01],
  hardImpact: [2, 15, 0.5],
  watchRange: [5, 100, 1],
  rateGap: [0, 20, 0.5],
  turnChance: [0, 1, 0.05],
  turnAfter: [0, 30, 0.5],
};

const angleDiff = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** The unit vector the ramp points along (the way you ride up it), and across it. */
export function rampAxes(ramp) {
  return { fx: Math.sin(ramp.yaw), fz: Math.cos(ramp.yaw), rx: Math.cos(ramp.yaw), rz: -Math.sin(ramp.yaw) };
}

/** Where a point is against the ramp: `along` metres from its foot (negative is the run-up) and `across` metres off its centre line. */
export function rampFrame(ramp, pos) {
  const a = rampAxes(ramp);
  const dx = pos.x - ramp.x;
  const dz = pos.z - ramp.z;
  return { along: dx * a.fx + dz * a.fz, across: dx * a.rx + dz * a.rz };
}

/** The world point `along` metres up the centre line from the foot. */
export function rampPoint(ramp, along, across = 0) {
  const a = rampAxes(ramp);
  return { x: ramp.x + a.fx * along + a.rx * across, z: ramp.z + a.fz * along + a.rz * across };
}

/** What she thought of a landing, from the air time, how level she came down, how hard, and whether she rolled it. */
export function rateLanding({ air, upY, impact, tipped }, p = DEFAULT_JUMP_PARAMS) {
  if (tipped) return 'bail';
  if (air < p.minAir) return 'tame';
  if (impact > p.hardImpact || upY < p.roughTilt) return 'rough';
  return air >= p.greatAir ? 'great' : 'good';
}

/**
 * One girl's goes at the ramp. Each step takes what the quad is doing and returns what she does about it:
 * { steer, targetSpeed, brake, events, done }. Phases: 'approach' (to the run-up point), 'run' (up the centre line at the
 * ramp), 'air' (off it, hands off), 'landing' (watching for a roll), 'settle' (pulling up), 'pause' (then back for another go).
 * Events: 'jumpRun' (she turns for the ramp), 'jumpAbort', 'jumpAir' (leaves the ground), and { type: 'rated', rating, air, upY, impact }.
 */
export class JumpRun {
  constructor(ramp, p = DEFAULT_JUMP_PARAMS, random = Math.random) {
    this.ramp = ramp;
    this.p = p;
    this.random = random;
    this.goes = Math.round(p.goesMin + random() * (p.goesMax - p.goesMin));
    this.went = 0;
    this.phase = 'approach';
    this.t = 0; // seconds in this phase
    this.air = 0;
    this.impact = 0;
    this.landUpY = 1;
    this.results = [];
    this.lastRating = null;
  }

  setPhase(phase) {
    this.phase = phase;
    this.t = 0;
  }

  /** The point she heads for to line up. */
  get runUpPoint() {
    return rampPoint(this.ramp, -this.p.runUp);
  }

  /**
   * @param {number} dt
   * @param {object} s  { pos: {x, z}, yaw, speed (along the quad), airborne, vy (up is positive), upY (1 level, 0 on its side), tipped }
   * @param {number} steerGain  steering per radian of heading error
   */
  step(dt, s, steerGain = 1.4) {
    const p = this.p;
    const events = [];
    this.t += dt;
    const out = { steer: 0, targetSpeed: 0, brake: false, events, done: false };
    const f = rampFrame(this.ramp, s.pos);

    if (this.phase === 'approach') {
      const target = this.runUpPoint;
      const dx = target.x - s.pos.x;
      const dz = target.z - s.pos.z;
      if (Math.hypot(dx, dz) <= p.startRadius) {
        this.setPhase('run');
        events.push('jumpRun');
      } else {
        out.steer = clamp(angleDiff(s.yaw, Math.atan2(dx, dz)) * steerGain, -1, 1);
        out.targetSpeed = p.approachSpeed;
        return out;
      }
    }

    if (this.phase === 'run') {
      // Pure pursuit up the centre line: steer at a point `lookAhead` metres further along it than she is.
      const aim = rampPoint(this.ramp, Math.max(f.along, -p.runUp) + p.lookAhead);
      out.steer = clamp(angleDiff(s.yaw, Math.atan2(aim.x - s.pos.x, aim.z - s.pos.z)) * steerGain, -1, 1);
      out.targetSpeed = p.runSpeed;
      if (s.airborne && f.along > this.ramp.length * 0.5) {
        this.air = 0;
        this.impact = 0;
        this.setPhase('air');
        events.push('jumpAir');
        return this.stepAir(dt, s, out);
      }
      // Coming at it crooked: give up, go round and come at it again, rather than hit it sideways.
      const heading = Math.abs(angleDiff(s.yaw, this.ramp.yaw));
      if (f.along > -p.abortRange && f.along < 0 && (Math.abs(f.across) > p.abortOffset || heading > p.abortHeading)) {
        events.push('jumpAbort');
        this.setPhase('approach');
        out.targetSpeed = p.approachSpeed;
        return out;
      }
      if (this.t > p.runTimeout || f.along > this.ramp.length + 1) {
        // Missed it altogether (or never got up to speed): this go doesn't count.
        events.push('jumpAbort');
        this.setPhase('approach');
      }
      return out;
    }

    if (this.phase === 'air') return this.stepAir(dt, s, out);

    if (this.phase === 'landing') {
      out.targetSpeed = 0;
      out.brake = false;
      if (s.tipped) return this.rate(events, out, s, true);
      if (this.t >= p.settleTime) return this.rate(events, out, s, false);
      return out;
    }

    if (this.phase === 'settle') {
      out.brake = true;
      if (s.speed < 0.4 && this.t > 0.5) {
        this.setPhase('pause');
        this.went++;
      }
      return out;
    }

    // 'pause': sat at the bottom, then another go or done.
    out.brake = true;
    if (this.went >= this.goes) {
      out.done = true;
    } else if (this.t >= p.pauseBetween) {
      this.setPhase('approach');
    }
    return out;
  }

  /** In the air: nothing on the throttle, bars straight. Down again, it starts watching the landing. */
  stepAir(dt, s, out) {
    this.air += dt;
    this.impact = Math.max(this.impact, -s.vy);
    out.targetSpeed = 0;
    if (this.air > 0.1 && !s.airborne) {
      this.landUpY = s.upY;
      this.setPhase('landing');
    }
    return out;
  }

  /** The landing's over (or it rolled): say what it was, then she pulls up. */
  rate(events, out, s, tipped) {
    const rating = rateLanding({ air: this.air, upY: Math.min(this.landUpY, s.upY), impact: this.impact, tipped }, this.p);
    const result = { type: 'rated', rating, air: this.air, upY: this.landUpY, impact: this.impact };
    this.results.push(result);
    this.lastRating = rating;
    events.push(result);
    if (tipped) {
      out.done = true;
      return out;
    }
    this.setPhase('settle');
    out.brake = true;
    return out;
  }
}

/** The other girl watching: says what she thought of a landing a moment after it, and may then have her own go. */
export class JumpWatch {
  constructor(params = { ...DEFAULT_JUMP_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.jumper = null;
    this.ratings = []; // { girl, rating } this session
    this.pending = []; // { at, girl (who watches), jumper, rating }
    this.stoppedAt = null;
    this.turned = false;
    this.score = {}; // girl id -> { jumps, great, bails }, kept for the game
  }

  /** Notes a landing by `girl` (`rating` from rateLanding). */
  landed(girl, rating) {
    this.ratings.push({ girl, rating });
    const s = (this.score[girl] ??= { jumps: 0, great: 0, bails: 0 });
    s.jumps++;
    if (rating === 'great') s.great++;
    if (rating === 'bail') s.bails++;
    this.pending.push({ at: this.clock + this.p.rateGap, jumper: girl, rating });
  }

  /**
   * One step. `ctx`: { jumper: id of a girl riding at the ramp or null, girls: [{ id, free, distance }] } (distance from the ramp).
   * Returns events: { type: 'rate', girl (who says it), jumper, rating } and { type: 'turn', girl } (her go, once the jumper is done).
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.clock += dt;
    const due = this.pending.filter((r) => r.at <= this.clock);
    this.pending = this.pending.filter((r) => r.at > this.clock);
    for (const r of due) {
      const g = ctx.girls.find((o) => o.id !== r.jumper);
      if (g && g.distance <= p.watchRange) events.push({ type: 'rate', girl: g.id, jumper: r.jumper, rating: r.rating });
    }
    if (ctx.jumper) {
      this.jumper = ctx.jumper;
      this.stoppedAt = null;
      this.turned = false;
      return events;
    }
    if (!this.jumper || this.turned) return events;
    this.stoppedAt ??= this.clock;
    if (this.clock - this.stoppedAt < p.turnAfter) return events;
    const jumper = this.jumper;
    this.turned = true;
    this.jumper = null;
    const g = ctx.girls.find((o) => o.id !== jumper && o.free);
    if (g && g.distance <= p.watchRange * 1.5 && this.random() < p.turnChance) events.push({ type: 'turn', girl: g.id });
    return events;
  }
}
