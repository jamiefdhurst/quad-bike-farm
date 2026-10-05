// Her driving a quad herself. She's a nervous learner: a loop of a few
// waypoints round where she started, slowly, a hand that can't keep the
// throttle steady, a habit of yanking the bars, braking to a stop now and then,
// and after a minute or so she's had enough. Starting it, and restarting it
// when she stalls, is a StartingAttempt like any other.
//
// Pure logic: it reads the quad (engine, fuel, choke, position, yaw, speed) and
// sets `controls` ({ throttle, brake, steer, starter, reverse }) for the quad to
// use in place of a rider's keys. Obstacles come from a probe callback, so the
// game can answer with raycasts and tests with anything.

import { StartingAttempt } from './startingAttempt.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const TAU = Math.PI * 2;
// Something this close to the middle of the quad (about 0.6 m off its nose) and she stops and backs off.
const BLOCKED = 1.6;

/** Signed angle from one heading to another, -PI..PI. */
export function angleDiff(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/** Heading (as the quad's yaw: atan2(dx, dz)) from one point to another. */
export function headingTo(from, to) {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

/** Steering input, -1..1, positive turning left (towards a positive heading error). */
export function steerFor(error, p) {
  return clamp(error * p.driveSteerGain, -1, 1);
}

/**
 * The speed she's comfortable with: her cruising speed, eased off into turns,
 * as she nears a waypoint she means to stop at, and when something's ahead.
 */
export function targetSpeed(cruise, { error = 0, toStop = Infinity, clear = Infinity } = {}) {
  let v = cruise * clamp(1 - Math.abs(error) * 0.55, 0.35, 1);
  v = Math.min(v, 0.6 + toStop * 0.45);
  // Creeping up to anything ahead (distances from the middle of the quad).
  v = Math.min(v, Math.max(0.5, (clear - BLOCKED) * 0.6));
  return Math.max(0, v);
}

/**
 * Throttle and brake (0..1) for a speed. A little throttle and a slowly
 * growing push when it's not getting there (`integral`, carried between
 * calls, seconds-weighted metres per second short), and the brake when it runs
 * away from her.
 */
export function pedalsFor(speed, target, integral, p) {
  const short = target - speed;
  if (target < 0.05) return { throttle: 0, brake: speed > 0.2 ? 0.5 : 0.3 };
  if (short < -p.driveBrakeMargin) {
    return { throttle: 0, brake: clamp(0.2 + (-short - p.driveBrakeMargin) * 0.35, 0, 0.8) };
  }
  const throttle = p.driveThrottleBase + short * p.driveThrottleGain + integral * p.driveThrottleIntegral;
  return { throttle: clamp(throttle, 0, p.driveMaxThrottle), brake: 0 };
}

/**
 * Waypoints for a loop round `origin`, setting off the way she's facing: a
 * rough circle through where she is, bending to whichever side is clear.
 * `isClear(a, b)` says whether she could drive straight from a to b. Returns
 * an empty list if there's nowhere to go.
 */
export function planLoop(origin, yaw, random, p, isClear) {
  const n = Math.round(p.driveWaypointsMin + random() * (p.driveWaypointsMax - p.driveWaypointsMin));
  const first = random() < 0.5 ? 1 : -1;
  const r0 = p.driveLoopRadiusMin + random() * (p.driveLoopRadiusMax - p.driveLoopRadiusMin);
  const jitter = Array.from({ length: n }, () => 0.8 + random() * 0.4);
  for (const scale of [1, 0.7, 0.5]) {
    for (const side of [first, -first]) {
      const r = Math.max(3.5, r0 * scale);
      // Circle centre to her left (side 1) or right (-1), so she sets off along it.
      const cx = origin.x + Math.sin(yaw + (side * Math.PI) / 2) * r;
      const cz = origin.z + Math.cos(yaw + (side * Math.PI) / 2) * r;
      const start = Math.atan2(origin.x - cx, origin.z - cz);
      const points = [];
      let prev = origin;
      let ok = true;
      for (let k = 1; k <= n; k++) {
        // Round the circle the way she's facing; the last point brings her back.
        const a = start + side * (k / n) * TAU;
        const rk = k === n ? r * 0.6 : r * jitter[k - 1];
        const pt = { x: cx + Math.sin(a) * rk, z: cz + Math.cos(a) * rk };
        if (k === n) {
          // Finish just past where she started, so she pulls up near it.
          pt.x = (pt.x + origin.x * 2) / 3;
          pt.z = (pt.z + origin.z * 2) / 3;
        }
        if (!isClear(prev, pt)) {
          ok = false;
          break;
        }
        points.push(pt);
        prev = pt;
      }
      if (ok && points.length >= 2) return points;
    }
  }
  return [];
}

/**
 * One go at driving, from getting it started to stopping at the end.
 * Phases: start (cranking it), settle (letting it tick over), drive, pause
 * (stopped for a moment), stalled, reversing (backing off something), stop
 * (pulling up to finish), done. `result` says how it ended: 'bored', 'scared',
 * 'asked', 'gaveUp' (it wouldn't start or kept stalling) or 'noRoom'.
 */
export class HerDrive {
  /**
   * @param {object} quad  { engine, fuel, choke, position: {x, z}, yaw, forwardSpeed }
   * @param {object} opts
   * @param {object} opts.params  Companion params (the drive* ones).
   * @param {function} opts.probe  (heading, distance) => distance to the nearest obstacle that way, or Infinity.
   * @param {function} opts.isClear  (a, b) => whether the straight line a to b is open ground.
   * @param {function} [opts.random]
   */
  constructor(quad, { params, probe, isClear, random = Math.random, startingParams }) {
    this.quad = quad;
    this.p = params;
    this.probe = probe;
    this.isClear = isClear;
    this.random = random;
    this.startingParams = startingParams;
    this.controls = { throttle: 0, brake: 1, steer: 0, starter: false, reverse: false };
    this.events = [];
    this.done = false;
    this.result = null;
    this.origin = { x: quad.position.x, z: quad.position.z };
    this.maxDistance = 0;
    this.time = 0; // since she set off
    this.timer = 0;
    this.stalls = 0;
    this.integral = 0;
    this.wobble = 1;
    this.wobbleTimer = 0;
    this.yank = null; // { t, dir } while she's yanking the bars too far
    this.avoid = 0; // heading offset to get round something
    this.avoidSide = random() < 0.5 ? 1 : -1;
    this.probeTimer = 0;
    this.clearAhead = Infinity;
    this.stuckTime = 0;
    this.bogs = 0; // times it's sat there and not gone
    this.boost = 0; // seconds left giving it extra throttle
    this.hillStart = 0; // extra throttle she's learned to pull away with, after rolling back
    this.waypoints = [];
    this.index = 0;
    this.pauseFor = null; // the waypoint pauseHere was decided for
    this.pauseHere = false;
    this.cruise = this.pickCruise();
    this.driveFor = this.between(params.driveForMin, params.driveForMax);
    this.forgetsChoke = random() < params.driveForgetChokeChance;
    this.attempt = null;
    this.stopReason = null;
    if (quad.engine.isRunning) this.setPhase('settle', this.between(0.8, 2));
    else this.beginStart();
  }

  between(a, b) {
    return a + this.random() * Math.max(0, b - a);
  }

  pickCruise() {
    return this.between(this.p.driveSpeedMin, this.p.driveSpeedMax);
  }

  setPhase(phase, timer = 0) {
    this.phase = phase;
    this.timer = timer;
  }

  beginStart() {
    this.attempt = new StartingAttempt(this.quad, { random: this.random, params: this.startingParams });
    this.setPhase('start');
  }

  /** Brake to a stop and finish, e.g. because you asked her to. */
  stop(reason = 'asked') {
    if (this.done || this.phase === 'stop') {
      if (reason === 'asked') this.stopReason = reason;
      return;
    }
    this.stopReason = reason;
    if (this.phase === 'start') {
      // Still trying to start it: she just stops trying.
      this.attempt.abandon();
      this.finish(reason);
      return;
    }
    this.setPhase('stop');
    this.sat = 0;
    this.satFor = this.between(0.8, 1.6);
  }

  finish(result) {
    this.done = true;
    this.result = result;
    this.phase = 'done';
    Object.assign(this.controls, { throttle: 0, brake: 1, starter: false, reverse: false });
  }

  /** Advances by dt seconds and sets `controls`. Returns this step's events. */
  update(dt) {
    this.events = [];
    if (this.done) return this.events;
    const q = this.quad;
    const c = this.controls;
    const speed = Math.abs(q.forwardSpeed);
    const pos = q.position;
    this.maxDistance = Math.max(this.maxDistance, Math.hypot(pos.x - this.origin.x, pos.z - this.origin.z));
    this.timer -= dt;
    c.starter = false;

    // Stalled on her (anywhere but while she's starting it).
    if (this.phase !== 'start' && this.running && !q.engine.isRunning) {
      this.stalls++;
      this.events.push('stalled');
      // Pushing the choke off cold is a mistake she only makes once.
      this.forgetsChoke = false;
      if (this.phase !== 'stop') this.setPhase('stalled', this.between(1.5, 3));
    }
    this.running = q.engine.isRunning;

    switch (this.phase) {
      case 'start':
        this.hold(c);
        for (const e of this.attempt.update(dt)) this.events.push(`start:${e}`);
        c.starter = this.attempt.starter;
        if (q.engine.isRunning && (this.attempt.phase === 'tending' || this.attempt.done)) {
          this.setPhase('settle', this.between(this.p.driveSettleMin, this.p.driveSettleMax));
        } else if (this.attempt.done) {
          this.finish('gaveUp');
        }
        break;

      case 'settle':
        // Let it tick over a moment, then off she goes.
        this.hold(c);
        this.tendChoke();
        if (this.timer <= 0) {
          if (!this.waypoints.length && !this.plan()) break;
          if (this.forgetsChoke && q.choke > 0) {
            q.choke = 0; // she pushes it off as she goes, forgetting it's cold
            this.events.push('chokeOff');
          }
          this.setPhase('drive');
          this.events.push(this.time === 0 ? 'setOff' : 'moveOff');
        }
        break;

      case 'stalled':
        this.hold(c);
        if (speed < 0.3 && this.timer <= 0) {
          if (this.stalls > this.p.driveMaxStalls) this.finish('gaveUp');
          else this.beginStart();
        }
        break;

      case 'pause':
        this.hold(c);
        // Pulling up steadily, then holding it.
        if (q.forwardSpeed > 0.4) c.brake = this.p.driveBrakeFirm;
        this.tendChoke();
        this.time += dt;
        if (this.timer <= 0) {
          if (this.time > this.driveFor) {
            this.stop(this.random() < this.p.driveScaredChance ? 'scared' : 'bored');
            break;
          }
          this.cruise = this.pickCruise();
          this.setPhase('drive');
          this.events.push('moveOff');
        }
        break;

      case 'reversing':
        // Backing away from whatever she nearly hit, bars turned.
        // Still rolling forwards: brake first, then back up slowly.
        c.reverse = true;
        c.brake = q.forwardSpeed > 0.2 ? 0.8 : 0;
        c.throttle = q.forwardSpeed < 0.2 && q.forwardSpeed > -1.2 ? 0.45 : 0;
        c.steer = this.avoidSide;
        // Not into whatever's behind her, either.
        this.probeTimer -= dt;
        if (this.probeTimer <= 0) {
          this.probeTimer = 0.1;
          if (q.forwardSpeed < -0.2 && this.probe(q.yaw + Math.PI, 2.2) < Infinity) this.timer = 0;
        }
        if (this.timer <= 0) {
          c.reverse = false;
          this.index = Math.min(this.index + 1, this.waypoints.length);
          this.setPhase('pause', this.between(0.8, 1.6));
        }
        break;

      case 'stop':
        c.throttle = 0;
        c.reverse = false;
        c.brake = q.forwardSpeed > 0.4 ? this.p.driveBrakeFirm * (this.stopReason === 'scared' ? 1.5 : 1) : 1;
        c.steer *= 0.9;
        // Sat there a moment once it's stopped, before she does anything.
        if (speed < 0.2) this.sat += dt;
        if (this.sat > this.satFor) this.finish(this.stopReason ?? 'bored');
        break;

      case 'drive':
        this.time += dt;
        this.tendChoke();
        this.drive(dt, speed);
        break;
    }
    return this.events;
  }

  /** Foot on the brake, hands off the throttle. */
  hold(c) {
    c.throttle = 0;
    c.brake = 1;
    c.reverse = false;
    c.steer *= 0.9;
  }

  /** Unless she's forgotten about it, she eases the choke off as it warms. */
  tendChoke() {
    const q = this.quad;
    if (this.forgetsChoke || !q.engine.isRunning || q.choke <= 0) return;
    const want = q.engine.temperature > 0.9 ? 0 : 1.15 - q.engine.temperature;
    q.choke = Math.round(clamp(want, 0, q.choke) * 10) / 10;
  }

  plan() {
    const q = this.quad;
    const pos = q.position;
    // Wandered off a bit: the next loop sets off back towards where she started.
    const away = Math.hypot(pos.x - this.origin.x, pos.z - this.origin.z) > this.p.driveLoopRadiusMin;
    const yaw = away ? headingTo(pos, this.origin) : q.yaw;
    // The way she's facing (or home) first; failing that, any way there's room,
    // and in a tight spot another go with different loops.
    const q4 = Math.PI / 4;
    search: for (let tries = 0; tries < 2; tries++) {
      for (const turn of [0, q4, -q4, 2 * q4, -2 * q4, 3 * q4, -3 * q4, Math.PI]) {
        this.waypoints = planLoop(pos, yaw + turn, this.random, this.p, this.isClear);
        if (this.waypoints.length) break search;
      }
    }
    this.index = 0;
    if (!this.waypoints.length) {
      this.events.push('noRoom');
      this.finish('noRoom');
      return false;
    }
    return true;
  }

  drive(dt, speed) {
    const p = this.p;
    const q = this.quad;
    const c = this.controls;
    c.reverse = false;

    if (this.time > this.driveFor) {
      this.stop(this.random() < p.driveScaredChance ? 'scared' : 'bored');
      return;
    }
    // Going faster than she likes (downhill, or her hand slipped): that's her done.
    if (speed > p.driveScareSpeed) {
      this.events.push('tooFast');
      this.stop('scared');
      return;
    }

    if (this.index >= this.waypoints.length && !this.plan()) return;
    const wp = this.waypoints[this.index];
    const pos = q.position;
    const dist = Math.hypot(wp.x - pos.x, wp.z - pos.z);
    if (dist < p.driveArriveRadius) {
      this.index++;
      this.events.push('waypoint');
      if (this.pauseHere) {
        this.events.push('pause');
        this.setPhase('pause', this.between(p.drivePauseMin, p.drivePauseMax));
        // She brakes there rather than coasting.
        this.hold(c);
        c.brake = p.driveBrakeFirm;
      }
      return;
    }
    // Whether she'll stop for a moment at this one; if so she slows for it on the way.
    if (this.pauseFor !== wp) {
      this.pauseFor = wp;
      this.pauseHere = this.random() < p.drivePauseChance;
    }

    // Look where she's going a few times a second, and steer round anything in the way.
    let desired = headingTo(pos, wp);
    this.probeTimer -= dt;
    if (this.probeTimer <= 0) {
      this.probeTimer = 0.1;
      this.lookAhead(desired, speed, dist);
    }
    desired += this.avoid;

    // Something right in front of her: stamp on the brake, then back off it.
    if (this.clearAhead < BLOCKED + speed * 0.5) {
      this.events.push('obstacle');
      this.hold(c);
      this.setPhase('reversing', this.between(1.5, 2.5));
      this.avoidSide = -this.avoidSide;
      return;
    }

    // Rolling back down a slope she couldn't get up: brake, then give it more.
    if (q.forwardSpeed < -0.4) {
      if (!this.rollingBack) {
        this.rollingBack = true;
        this.events.push('rollBack');
        // Next time she pulls away she gives it more; once that's all she dares, it counts against it.
        if (this.hillStart >= 0.25) this.bogs++;
        this.hillStart = Math.min(0.25, this.hillStart + 0.1);
      }
      c.throttle = 0;
      c.brake = 0.8;
      this.boost = 2.5;
      if (this.bogs > 3) {
        this.events.push('bogged');
        this.stop('gaveUp');
      }
      return;
    }
    if (q.forwardSpeed > 0.3) this.rollingBack = false;

    const error = angleDiff(q.yaw, desired);
    let steer = steerFor(error, p);
    // Now and then she yanks the bars too far, then corrects too far the other way.
    if (this.yank) {
      this.yank.t -= dt;
      steer = this.yank.t > 0.35 ? this.yank.dir : -this.yank.dir * 0.7;
      if (this.yank.t <= 0) this.yank = null;
    } else if (Math.abs(error) > 0.25 && speed > 1 && this.random() < p.driveOverSteerRate * dt) {
      this.yank = { t: 0.35 + this.between(0.4, 0.8), dir: Math.sign(error) };
      this.events.push('overSteer');
    }
    c.steer = steer;

    // A hand that can't keep the throttle still.
    this.wobbleTimer -= dt;
    if (this.wobbleTimer <= 0) {
      this.wobbleTimer = this.between(0.3, 1.1);
      this.wobble = 1 + (this.random() * 2 - 1) * p.driveJerk;
    }
    const stopsHere = this.index === this.waypoints.length - 1 || this.pauseHere;
    const target = targetSpeed(this.cruise, { error, toStop: stopsHere ? dist : Infinity, clear: this.clearAhead });
    const short = target - speed;
    this.integral = clamp(this.integral + short * dt, -3, 8);
    const pedals = pedalsFor(speed, target, this.integral, p);
    // A bit more on in a tight turn, where it drags.
    const turning = pedals.throttle > 0 ? Math.abs(c.steer) * 0.04 : 0;
    // Giving it a bootful because it won't go.
    this.boost = Math.max(0, this.boost - dt);
    // And a bit more pulling away, if it's rolled back on her.
    const pullAway = pedals.throttle > 0 ? this.hillStart * clamp(1 - speed / 2, 0, 1) : 0;
    const most = p.driveMaxThrottle + pullAway + (this.boost > 0 ? 0.25 : 0);
    c.throttle = clamp((pedals.throttle + turning) * this.wobble + pullAway + (this.boost > 0 ? 0.25 : 0), 0, most);
    c.brake = pedals.brake;

    // Wanting to go and going nowhere (or creeping backwards).
    this.stuckTime = target > 0.3 && q.forwardSpeed < 0.3 ? this.stuckTime + dt : 0;
    if (this.stuckTime > 3) {
      this.stuckTime = 0;
      this.unstick();
    }
  }

  /**
   * Not moving. Up against something: she backs off it. Otherwise it's
   * bogging: she gives it more, or remembers the choke if it's cold, and in
   * the end gives up on it.
   */
  unstick() {
    const q = this.quad;
    if (this.clearAhead < 3.5) {
      this.events.push('stuck');
      this.setPhase('reversing', this.between(1.5, 2.5));
      return;
    }
    this.bogs++;
    if (this.bogs > 3) {
      this.events.push('bogged');
      this.stop('gaveUp');
    } else if (q.engine.temperature < 0.5 && q.choke < 0.5 && this.random() < 0.5) {
      q.choke = 1;
      this.forgetsChoke = false; // and now she'll mind it
      this.events.push('chokeBack');
    } else {
      this.boost = 2;
      this.events.push('revIt');
    }
  }

  /** Probes ahead and towards the waypoint; picks a way round if it's blocked. */
  lookAhead(desired, speed, dist) {
    const q = this.quad;
    const reach = Math.min(dist + 1, 3.5 + speed * 1.5);
    this.clearAhead = this.probe(q.yaw, 2.5 + speed);
    if (this.probe(desired + this.avoid, reach) === Infinity) {
      // Ease back towards the straight line once it's clear.
      if (this.avoid !== 0 && this.probe(desired, reach) === Infinity) this.avoid = 0;
      return;
    }
    for (const o of [0.35, 0.7, 1.05, 1.4]) {
      for (const side of [this.avoidSide, -this.avoidSide]) {
        if (this.probe(desired + side * o, reach) === Infinity) {
          this.avoid = side * o;
          this.avoidSide = side;
          return;
        }
      }
    }
    // Nothing clear at all: skip this waypoint.
    this.avoid = 0;
    this.index++;
  }
}
