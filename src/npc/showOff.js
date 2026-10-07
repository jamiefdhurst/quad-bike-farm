// Showing off. A confident girl rides at you and pulls a wheelie past (two-strokes) or skids to a stop beside you (any quad), then looks
// over to see if you saw. If you weren't looking she goes back and does it again.
// Pure logic: ShowOffRun drives one girl's goes (herDriving.js runs it as a drive mode) and `youSaw` decides whether you were watching.

export const DEFAULT_SHOWOFF_PARAMS = {
  runUp: 32, // metres from you that she lines up from
  approachSpeed: 7, // m/s she goes at getting to the run-up
  runSpeed: 9, // m/s she aims to be doing as she comes at you
  side: 4, // metres to one side of you that she passes or stops
  wheelieChance: 0.7, // on a two-stroke, the chance it is a wheelie rather than a skid
  wheelieAt: 17, // metres from your side that the wheelie starts
  wheelieFor: 1.8, // seconds the front wheels stay up
  wheelieLift: 0.5, // radians the nose comes up
  skidDecel: 6, // m/s squared she reckons the brakes give her, to know where to stand on them
  skidMargin: 1.2, // metres she stops short of her mark
  lookFor: 3, // seconds she sits looking at you once she has done it
  seeCone: 0.55, // how squarely you have to be facing her to see it (the cosine of the angle: 0.55 is about 57 degrees each way)
  seeRange: 80, // metres: further off than this you can't tell what she's doing
  seeTime: 0.35, // seconds of looking at her during it that count as having seen
  goesMax: 3, // how many times she tries before giving up on you
  planRange: 70, // metres: she only thinks of it when you're this close
  runTimeout: 25, // seconds without getting anywhere before she gives up
};

export const SHOWOFF_PARAM_RANGES = {
  runUp: [15, 60, 1],
  approachSpeed: [3, 12, 0.5],
  runSpeed: [4, 14, 0.5],
  side: [2, 10, 0.5],
  wheelieChance: [0, 1, 0.05],
  wheelieAt: [8, 40, 1],
  wheelieFor: [0.5, 4, 0.1],
  wheelieLift: [0.1, 0.9, 0.05],
  skidDecel: [2, 12, 0.5],
  skidMargin: [0, 5, 0.1],
  lookFor: [1, 10, 0.5],
  seeCone: [0, 0.95, 0.05],
  seeRange: [20, 200, 5],
  seeTime: [0, 3, 0.05],
  goesMax: [1, 6, 1],
  planRange: [20, 200, 5],
  runTimeout: [8, 90, 1],
};

const angleDiff = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Were you looking at her? `you` is { x, z, fx, fz } (where you are, and which way your eyes point) and `her` { x, z }. */
export function youSaw(you, her, p) {
  const dx = her.x - you.x;
  const dz = her.z - you.z;
  const dist = Math.hypot(dx, dz);
  if (dist > p.seeRange) return false;
  const flat = Math.hypot(you.fx, you.fz);
  if (dist < 0.5 || flat < 0.05) return true;
  return (you.fx * dx + you.fz * dz) / (flat * dist) >= p.seeCone;
}

/** What she does: a wheelie only on a light two-stroke that can lift its nose, otherwise a skid. */
export function pickTrick(twoStroke, p, random = Math.random) {
  return twoStroke && random() < p.wheelieChance ? 'wheelie' : 'skid';
}

export class ShowOffRun {
  /** `trick`: 'wheelie' or 'skid'. `side`: 1 or -1, which of your sides she passes. */
  constructor(trick, p = { ...DEFAULT_SHOWOFF_PARAMS }, random = Math.random, isClear = () => true) {
    this.trick = trick;
    this.isClear = isClear; // (a, b) => whether she could drive straight from a to b
    this.p = p;
    this.random = random;
    this.side = random() < 0.5 ? 1 : -1;
    this.phase = 'setup'; // setup (getting to the run-up), run, look
    this.goes = 1;
    this.trickT = null; // seconds since the trick began, once it has
    this.lookT = 0;
    this.sawFor = 0; // seconds you were looking at her during the trick and after
    this.timer = 0;
    this.setupTarget = null;
    this.result = null; // 'seen' or 'missed' or 'gaveUp', once it is over
  }

  /** Where she is aiming: the point beside you that she passes or stops at. */
  mark(you, her) {
    const dx = you.x - her.x;
    const dz = you.z - her.z;
    const d = Math.hypot(dx, dz) || 1;
    return { x: you.x + (dz / d) * this.side * this.p.side, z: you.z - (dx / d) * this.side * this.p.side };
  }

  /**
   * One step. `ctx`: { pos: {x, z}, yaw, speed, you: { x, z, fx, fz } }. Returns { steer (-1..1), throttle, brake, targetSpeed
   * (a speed to hold, in which case she works the pedals herself and throttle and brake are to be ignored), wheelie (0..1: how far the nose is up), events, done }. The events are 'showOffGo' (the trick begins), 'showOffSeen',
   * 'showOffAgain' (you missed it, so she goes back) and 'showOffMissed' (she's given up on you). A result of 'noRoom' means there
   * was nowhere clear to run at you from.
   */
  step(dt, ctx, steerGain = 1.4) {
    const p = this.p;
    const { pos, yaw, speed, you } = ctx;
    const events = [];
    const out = { steer: 0, throttle: 0, brake: 0, targetSpeed: null, wheelie: 0, events, done: false };
    this.timer += dt;
    if (this.timer > p.runTimeout && this.phase !== 'look') return this.end(out, 'gaveUp');
    const aimAt = (t) => clamp(angleDiff(yaw, Math.atan2(t.x - pos.x, t.z - pos.z)) * steerGain, -1, 1);

    if (this.phase === 'setup') {
      const fromYou = Math.hypot(pos.x - you.x, pos.z - you.z);
      if (!this.setupTarget && fromYou < p.runUp - 2) {
        this.setupTarget = this.findRunUp(pos, you);
        if (!this.setupTarget) return this.end(out, 'noRoom');
      }
      const target = this.setupTarget;
      if (!target || Math.hypot(target.x - pos.x, target.z - pos.z) < 5) {
        this.phase = 'run';
        this.timer = 0;
        this.trickT = null;
        this.sawFor = 0;
        return this.step(0, ctx, steerGain);
      }
      Object.assign(out, { targetSpeed: p.approachSpeed, steer: aimAt(target) });
      return out;
    }

    const mark = this.mark(you, pos);
    const dist = Math.hypot(mark.x - pos.x, mark.z - pos.z);
    if (this.phase === 'run') {
      out.steer = aimAt(mark);
      if (this.trick === 'wheelie') {
        if (this.trickT === null && dist < p.wheelieAt) {
          this.trickT = 0;
          events.push('showOffGo');
        }
        if (this.trickT !== null) {
          this.trickT += dt;
          if (this.trickT < p.wheelieFor) {
            Object.assign(out, { throttle: 1, brake: 0, wheelie: 1 });
          } else {
            this.phase = 'look';
          }
        } else {
          out.targetSpeed = p.runSpeed;
        }
      } else {
        const stopping = (speed * speed) / (2 * p.skidDecel) + p.skidMargin;
        if (this.trickT === null && dist <= Math.max(stopping, 3)) {
          this.trickT = 0;
          events.push('showOffGo');
        }
        if (this.trickT !== null) {
          this.trickT += dt;
          Object.assign(out, { throttle: 0, brake: 1, steer: 0 });
          if (speed < 0.4) this.phase = 'look';
        } else {
          out.targetSpeed = p.runSpeed;
        }
      }
    }
    if (this.phase === 'look') {
      // Come to a stop, then sit and see whether you noticed.
      Object.assign(out, { throttle: 0, brake: 1, steer: 0 });
      if (speed < 0.5) this.lookT += dt;
      if (this.lookT >= p.lookFor) return this.finishGo(out, events);
    }
    if (this.trickT !== null && youSaw(you, pos, p)) this.sawFor += dt;
    return out;
  }

  /** A point `runUp` metres from you, as near the way she is already facing you as there is a clear run at you from; null if none. */
  findRunUp(pos, you) {
    const p = this.p;
    const base = Math.atan2(pos.x - you.x, pos.z - you.z);
    for (const turn of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4, Math.PI]) {
      const a = base + turn;
      const at = { x: you.x + Math.sin(a) * p.runUp, z: you.z + Math.cos(a) * p.runUp };
      // The run at you stops a few metres short of you, so a bench or a wall right by you doesn't rule it out.
      const near = { x: you.x + Math.sin(a) * 6, z: you.z + Math.cos(a) * 6 };
      if (this.isClear(at, near) && this.isClear(pos, at)) return at;
    }
    return null;
  }

  finishGo(out, events) {
    if (this.sawFor >= this.p.seeTime) {
      events.push('showOffSeen');
      return this.end(out, 'seen');
    }
    if (this.goes >= this.p.goesMax) {
      events.push('showOffMissed');
      return this.end(out, 'missed');
    }
    events.push('showOffAgain');
    this.goes += 1;
    this.phase = 'setup';
    this.setupTarget = null;
    this.lookT = 0;
    this.timer = 0;
    this.side = -this.side;
    return out;
  }

  end(out, result) {
    this.result = result;
    out.done = true;
    return out;
  }
}
