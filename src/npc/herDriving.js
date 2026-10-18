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

import { settleBoost, boostFactor } from './tarmac.js';
import { StartingAttempt, DEFAULT_STARTING_PARAMS } from './startingAttempt.js';
import { TractorStartAttempt } from './tractorStart.js';
import { COACHING, mistake, mistakeChance, successChance } from './skills.js';
import { doughnutControl } from './doughnuts.js';
import { JumpRun } from './jumps.js';
import { ShowOffRun } from './showOff.js';
import { slotHeading, slotOffsets } from './lineUp.js';
import { pathLength } from './outings.js';

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
 * The speed she's comfortable with: her cruising speed, eased off into turns
 * (and no faster than `corner` allows for the turn ahead), as she nears a
 * waypoint she means to stop at, and when something's ahead.
 */
export function targetSpeed(cruise, { error = 0, toStop = Infinity, clear = Infinity, corner = Infinity } = {}) {
  let v = cruise * clamp(1 - Math.abs(error) * 0.55, 0.35, 1);
  v = Math.min(v, corner);
  v = Math.min(v, 0.6 + toStop * 0.45);
  // Creeping up to anything ahead (distances from the middle of the quad); at
  // speed, slowing for it no harder than a steady 3.5 m/s2.
  const gap = clear - BLOCKED;
  v = Math.min(v, Math.max(0.5, Math.min(gap * 0.6, Math.sqrt(7 * Math.max(0, gap)))));
  return Math.max(0, v);
}

/**
 * The fastest she'll take a turn: a heading error of `error` radians to make up
 * within `distance` metres needs a circle of about distance / (2 sin error),
 * and she corners at no more than `accel` m/s2 round it.
 */
export function cornerSpeed(error, distance, accel) {
  const radius = distance / (2 * Math.max(Math.abs(Math.sin(clamp(error, -Math.PI / 2, Math.PI / 2))), 0.02));
  return Math.max(1.5, Math.sqrt(accel * Math.max(2, radius)));
}

/**
 * The most bars she'll give (0..1 of the quad's lock at this speed) at a
 * speed: enough to corner at about `accel` m/s2, so never a yank at full lock
 * going quickly.
 */
export function steerLimit(speed, accel, { maxSteerDeg = 32, steerSpeedReduction = 0.06, wheelbase = 1.25 } = {}) {
  if (speed < 1) return 1;
  const lock = ((maxSteerDeg * Math.PI) / 180) / (1 + steerSpeedReduction * speed);
  return clamp(Math.atan((accel * wheelbase) / (speed * speed)) / lock, 0.05, 1);
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
   * @param {function} [opts.passenger]  () => whether someone's riding on the back; then she doesn't tire of it.
   * @param {boolean} [opts.tires]  Her own idea to take you out: she gets bored with you aboard like any drive, and gives up if you never get on.
   * @param {boolean} [opts.waitForPassenger]  Started it to give you a ride: she waits for you to get on.
   * @param {object} [opts.race]  A race (npc/race.js): { route, gridIndex, gridYaw, cruise, go(), alive(), onGrid(), onFinish(), onAbort(), blip(), keepDriving }. She
   *   drives to the grid waypoint, waits for go(), then flat out round the rest of the route and over the line (the last
   *   waypoint), with no pauses and no tiring or scaring of herself.
   * @param {object} [opts.doughnut]  { centre, radius, dir, seconds, p }: instead of her loops she drives to the circle and spins
   *   round it for `seconds`, tearing the ground up (quad.churn), then pulls up.
   * @param {object} [opts.jump]  { ramp, p }: instead of her loops she rides at the ramp (jumps.js) a few times, taking it as fast as she
   *   likes, and pulls up after each; each landing is rated (a 'jumpRated' event with the result in `lastJump`).
   * @param {object} [opts.showOff]  { trick, p, you() }: instead of her loops she rides at you and does a wheelie past or a skid to a stop
   *   beside you (showOff.js), looks to see if you saw, and goes again if you didn't; `you()` is { x, z, fx, fz }, where you are and are facing.
   * @param {object} [opts.outing]  { pick(from) => { name, path } | null, back(from) => path, p }: now and then, instead of a loop, she drives to a place on the farm
   *   (the path through the gateways), stops a moment and drives back to where she started (outings.js).
   * @param {object} [opts.tarmac]  { at(x, z), p }: whether a point is on the farm road, and the tarmac params; she rides faster there and the 'onRoad' event fires as she joins it.
   * @param {object} [opts.park]  { route }: drive the route (in line with a slot, then the slot) slowly, and stop on the last point.
   * @param {function} [opts.follow]  () => the quad she's following (yours), or null. Following, she keeps
   *   behind it at its pace rather than doing her own loop, and doesn't tire of it.
   * @param {function} [opts.followWay]  (her position, the point behind the lead, the lead's position) => { point, wait, to }: the way
   *   there through the gateways, or, with `wait`, to the foot of the hill (`to`) where she pulls up rather than go on up after you.
   */
  constructor(quad, { tractorStarting = undefined, params, probe, isClear, random = Math.random, startingParams, momentWindow = 5, skill = { starting: 0.5, choke: 0.5, cornering: 0.5, mud: 0.5 }, passenger = () => false, waitForPassenger = false, tires = false, follow = null, followWay = null, friend = () => null, after = null, race = null, doughnut = null, jump = null, park = null, showOff = null, tarmac = null, outing = null }) {
    this.quad = quad;
    this.tractorStarting = tractorStarting; // how she goes about starting the tractor (tractorStart.js), when it is one
    this.p = params;
    this.probe = probe;
    this.isClear = isClear;
    this.random = random;
    this.startingParams = startingParams;
    this.momentWindow = momentWindow; // seconds a wobble stays a good moment to coach about it
    this.skill = skill; // her live levels (npc/skills.js); coaching changes them under her
    this.clock = 0; // seconds since she took the bars, for how recent a wobble was
    this.noted = {}; // skill -> clock time of something going wrong that you could coach her about
    this.cleanLeg = true; // no wobble since the last waypoint
    this.wasStuck = false;
    this.passenger = passenger;
    this.friend = friend; // the other girl on the back: 'on', 'coming' or null
    this.friendAboard = false;
    this.waitForPassenger = waitForPassenger;
    this.tires = tires;
    this.waited = 0;
    this.waitedTotal = 0;
    this.cruiseScale = 1; // you asked her to go faster or slower
    this.outing = outing; // driving somewhere and back, now and then (outings.js)
    this.trip = null; // the outing she is on: { name, stage: 'there' | 'back' }
    this.tarmac = tarmac; // { at(x, z) => on the road, p }: she goes faster on the tarmac (tarmac.js)
    this.roadPace = 1; // multiplier on her cruising speed from the road
    this.roadSettled = 0; // 0 off the road, 1 settled into its pace
    this.follow = follow;
    this.followWay = followWay;
    this.hillWaiting = false; // pulled up at the foot of the hill, you having gone on up it
    this.race = race;
    this.after = after; // her ordinary driving settings, for carrying on once an activity is over (carryOn)
    this.doughnut = doughnut; // spinning doughnuts: { centre, radius, dir, seconds, p } (doughnuts.js)
    this.jump = jump ? { run: new JumpRun(jump.ramp, jump.p, random) } : null; // riding at the ramp (jumps.js)
    this.showOff = showOff ? { run: new ShowOffRun(showOff.trick, showOff.p, random, isClear), you: showOff.you } : null; // showing off to you (showOff.js)
    this.lastJump = null; // the last landing rated: { rating, air, upY, impact }
    this.park = park; // tidying a quad into the row (lineUp.js): { route: [stage, slot] }; she drives in line with the slot, stops on it
    this.pass = null; // overtaking whoever she's following (passTarget)
    this.slowFor = 0;
    this.behindTime = 0; // seconds she's been well behind you
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
    this.clearAround = Infinity; // nearest thing off to either side
    this.stuckTime = 0;
    this.bogs = 0; // times it's sat there and not gone
    this.regrids = 0; // times she has gone round again to face the right way on the grid
    this.boost = 0; // seconds left giving it extra throttle
    this.hillStart = 0; // extra throttle she's learned to pull away with, after rolling back
    this.waypoints = [];
    this.index = 0;
    this.pauseFor = null; // the waypoint pauseHere was decided for
    this.pauseHere = false;
    this.cruise = race ? race.cruise : this.pickCruise();
    this.driveFor = this.between(params.driveForMin, params.driveForMax);
    this.forgetsChoke = random() < mistakeChance(params.driveForgetChokeChance, skill.choke);
    this.attempt = null;
    this.stopReason = null;
    if (quad.engine.isRunning) this.setPhase('settle', this.between(0.8, 2));
    else this.beginStart();
  }

  between(a, b) {
    return a + this.random() * Math.max(0, b - a);
  }

  /** The place an outing is going to: she stops there for a moment. */
  atPlace(wp) {
    return this.trip?.stage === 'there' && wp === this.waypoints[this.waypoints.length - 1];
  }

  pickCruise() {
    return this.between(this.p.driveSpeedMin, this.p.driveSpeedMax) * this.cruiseScale;
  }

  /** Someone on the back, or following you: she keeps going until asked, rather than tiring of it. */
  get carrying() {
    return (this.passenger() && !this.tires) || !!this.follow;
  }

  /**
   * Following: where to aim (a point behind your quad, a little to one side) and
   * how fast, to hold her gap. Null when there's nothing to follow or you've stopped
   * and she's caught up.
   */
  followTarget(pos) {
    const p = this.p;
    const lead = this.follow?.();
    if (!lead) return null;
    const lp = lead.position;
    const fx = Math.sin(lead.yaw);
    const fz = Math.cos(lead.yaw);
    // Behind a two-stroke she hangs back (or, if she likes the smoke, in close).
    const smoky = lead.engine?.params?.strokes === 2;
    // Behind a quad throwing up dust she does the same: Amy drops well back, Jess tucks in and coughs.
    const dusty = (lead.dust ?? 0) >= p.followDustLevel;
    const want = p.followGap * (smoky ? p.followSmokeGap ?? 1 : 1) * (dusty ? p.followDustGap ?? 1 : 1);
    if (smoky && !this.smokeNoted) {
      this.smokeNoted = true;
      this.events.push('followSmoke');
    }
    if (dusty && !this.dustNoted) {
      this.dustNoted = true;
      this.events.push('followDust');
    }
    if (!dusty) this.dustNoted = false; // she has something to say about the next cloud too
    if (dusty && Math.hypot(lp.x - pos.x, lp.z - pos.z) < p.dustCoughWithin) this.events.push('dustCough');
    let point = { x: lp.x - fx * want - fz * 1.2, z: lp.z - fz * want + fx * 1.2 };
    const way = this.followWay?.(pos, point, lp);
    if (way?.wait) {
      // You've gone on up the hill: she goes as far as its foot and waits there.
      if (!this.hillWaiting) this.events.push('hillWait');
      this.hillWaiting = true;
      const d = Math.hypot(way.to.x - pos.x, way.to.z - pos.z);
      if (d < p.followMinGap) return { point: way.to, speed: 0, gap: d, stopped: true };
      const top = p.followMaxSpeed * (p.driveSpeedMax / p.driveSpeedMaxBase);
      return { point: way.point, speed: clamp(d * 0.4, 1.5, top), gap: d, stopped: false };
    }
    this.hillWaiting = false;
    if (way) point = way.point;
    const gap = Math.hypot(lp.x - pos.x, lp.z - pos.z);
    const leadSpeed = Math.max(0, lead.forwardSpeed);
    if (leadSpeed < 0.8 && gap < want * 1.4) return { point, speed: 0, gap, stopped: true };
    // Never right up against you, whichever way you're going.
    if (gap < p.followMinGap) return { point, speed: 0, gap, stopped: true };
    const top = p.followMaxSpeed * (p.driveSpeedMax / p.driveSpeedMaxBase);
    const speed = clamp(leadSpeed + p.followCatchUp * (gap - want), 0, top);
    return { point, speed, gap, stopped: false };
  }

  /**
   * Overtaking whoever she's following, out of impatience (Jess, at your pace) or because a convoy swaps its order. She
   * drives past on one side to a point well ahead, then waits there, looking pleased with herself, until they've gone
   * by again (or `overtakeWait` is up), when she goes back to following. Returns a follow target while she's at it,
   * else null (and then maybe starts one: stuck behind a slow pace for `overtakeAfter` seconds, with `overtakeChance`
   * a second). The 'overtook' event is her getting ahead and 'waitedAhead' the leader coming up to her.
   */
  passTarget(dt) {
    const p = this.p;
    const q = this.quad;
    const lead = this.follow?.();
    if (!lead) {
      this.pass = null;
      return null;
    }
    const lp = lead.position;
    const fx = Math.sin(lead.yaw);
    const fz = Math.cos(lead.yaw);
    const leadSpeed = Math.max(0, lead.forwardSpeed);
    if (!this.pass) {
      // Bored of the pace: following something slowly for a while.
      this.slowFor = leadSpeed > 0.8 && leadSpeed < p.overtakeBelow ? (this.slowFor ?? 0) + dt : 0;
      if (!this.race && this.slowFor > p.overtakeAfter && this.random() < p.overtakeChance * dt) this.startPass();
      if (!this.pass) return null;
    }
    const g = this.pass;
    g.t += dt;
    const pos = q.position;
    const rx = pos.x - lp.x;
    const rz = pos.z - lp.z;
    const along = rx * fx + rz * fz; // metres ahead of the leader (negative: behind)
    const gap = Math.hypot(rx, rz);
    if (g.phase === 'overtaking') {
      if (along > p.overtakeAhead || g.t > 25 || gap > 70) {
        Object.assign(g, { phase: 'waiting', t: 0, said: false });
        this.events.push('overtook');
      } else {
        const out = p.overtakeAhead + 10;
        const point = { x: lp.x + fx * out - fz * g.side * 3.5, z: lp.z + fz * out + fx * g.side * 3.5 };
        const top = p.followMaxSpeed * (p.driveSpeedMax / p.driveSpeedMaxBase);
        return { point, speed: clamp(leadSpeed + p.overtakeSpeedUp, 4, top), gap, stopped: false };
      }
    }
    if (!g.said && gap < p.overtakeGloatRange) {
      g.said = true;
      this.events.push('waitedAhead');
    }
    // They've caught up and gone by (or she's waited long enough): back to following.
    if (along < -1.5 || g.t > p.overtakeWait) {
      this.pass = null;
      this.slowFor = 0;
      return null;
    }
    return { point: { x: pos.x, z: pos.z }, speed: 0, gap, stopped: true };
  }

  /** Starts overtaking whoever she's following, on a side. */
  startPass(side = this.random() < 0.5 ? 1 : -1) {
    if (this.pass || !this.follow) return false;
    this.pass = { phase: 'overtaking', t: 0, side, said: false };
    return true;
  }

  /**
   * Following, with you off your quad (or on hers): after followGiveUpMin..Max
   * seconds she stops following. Then she either has a drive about on her own
   * (followDriveOnChance) or pulls up and finishes, as after any drive.
   */
  waitForLeader(dt) {
    const p = this.p;
    if (!this.follow) return;
    if (this.follow()) {
      this.leaderGone = 0;
      return;
    }
    this.leaderGone = (this.leaderGone ?? 0) + dt;
    this.giveUpAfter ??= this.between(p.followGiveUpMin, p.followGiveUpMax);
    if (this.leaderGone < this.giveUpAfter) return;
    this.follow = null;
    this.waypoints = [];
    this.leaderGone = 0;
    this.giveUpAfter = null;
    if (this.random() < p.followDriveOnChance) {
      this.events.push('followDriveOn');
      // Her own loops from here, for a go of her usual length.
      this.origin = { x: this.quad.position.x, z: this.quad.position.z };
      this.driveFor = this.time + this.between(p.driveForMin, p.driveForMax);
      if (this.phase === 'settle') this.timer = 0;
    } else {
      this.events.push('followGaveUp');
      this.stop('bored');
    }
  }

  /**
   * Her friend getting on the back: she pulls up for her, and once she's on,
   * it's a proper ride: bigger loops, and she keeps going for friendRideMin..Max
   * seconds from then (both get off at the end).
   */
  watchFriend() {
    const f = this.friend();
    if (f === 'coming' && this.phase === 'drive') {
      this.pullUp();
      this.parkedForFriend = true;
    } else if (f !== 'coming' && this.parkedForFriend && this.phase === 'parked') {
      this.parkedForFriend = false;
      this.resume();
    }
    if (f === 'on' && !this.friendAboard) {
      const p = this.p;
      this.friendAboard = true;
      this.events.push('friendOn');
      // Already scaled up if you're on the back.
      if (!this.passenger()) {
        p.driveLoopRadiusMin *= p.rideLoopScale;
        p.driveLoopRadiusMax *= p.rideLoopScale;
      }
      this.waypoints = []; // a new, bigger loop from here
      this.driveFor = Math.max(this.driveFor, this.time + this.between(p.friendRideMin, p.friendRideMax));
    }
  }

  /** Go a bit faster (factor > 1) or slower; she won't go past her scare speed. */
  setCruiseScale(scale) {
    const next = clamp(scale, 0.5, 2);
    this.cruise *= next / this.cruiseScale;
    this.cruiseScale = next;
  }

  /** Pull up and wait where she is, engine running, until resume(). */
  pullUp() {
    if (this.done || this.phase === 'start' || this.phase === 'parked') return;
    this.setPhase('parked');
    this.events.push('parked');
  }

  resume() {
    if (this.phase !== 'parked') return;
    this.cruise = this.pickCruise();
    this.setPhase('settle', 0.5);
  }

  setPhase(phase, timer = 0) {
    this.phase = phase;
    this.timer = timer;
  }

  beginStart() {
    // The tractor and the UTV are diesels: no tap or choke, but a key and glow plugs to wait for (Jess doesn't always).
    if (this.quad.tractor || this.quad.engine.params?.compressionIgnition) this.attempt = new TractorStartAttempt(this.quad, { random: this.random, params: this.tractorStarting });
    else this.attempt = new StartingAttempt(this.quad, { random: this.random, params: this.skilledStarting() });
    this.setPhase('start');
  }

  /** Her starting habits at her level: with less skill she forgets the tap and the choke more, and takes longer to remember. */
  skilledStarting() {
    const base = this.startingParams ?? DEFAULT_STARTING_PARAMS;
    const level = this.skill.starting;
    return {
      ...base,
      tapCheckChance: successChance(base.tapCheckChance, level),
      coldChokeChance: successChance(base.coldChokeChance, level),
      rememberChance: clamp(base.rememberChance * (0.5 + level), 0, 1),
    };
  }

  /** Something went wrong that you could coach her about. */
  note(skill) {
    this.noted[skill] = this.clock;
  }

  /** Whether now is a good moment to coach her about this skill: what she's getting wrong, as it happens. */
  isMoment(skill) {
    const q = this.quad;
    const recent = this.clock - (this.noted[skill] ?? -Infinity) < this.momentWindow;
    switch (skill) {
      case 'choke':
        return q.engine.isRunning && q.choke > 0 && q.engine.temperature > 0.5;
      case 'starting':
        return this.phase === 'start' || this.phase === 'stalled' || recent;
      case 'cornering':
        return recent || (this.phase === 'drive' && Math.abs(this.controls.steer) > 0.35);
      case 'mud':
        return recent || this.stuckTime > 1 || q.bog?.sink > 0.1;
      default:
        return false;
    }
  }

  /** The coaching that fits this moment, as keys of COACHING. */
  coachable() {
    if (this.done || this.phase === 'stop') return [];
    return Object.keys(COACHING).filter((k) => this.isMoment(COACHING[k].skill));
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
    if (this.doughnut) this.quad.churn = 0;
    this.quad.wheelie = 0;
    if (this.race && !this.done && result !== 'raced') this.race.onAbort?.();
    this.done = true;
    this.result = result;
    this.phase = 'done';
    Object.assign(this.controls, { throttle: 0, brake: 1, starter: false, reverse: false });
  }

  /** Advances by dt seconds and sets `controls`. Returns this step's events. */
  update(dt) {
    this.events = [];
    if (this.done) return this.events;
    this.clock += dt;
    const q = this.quad;
    const c = this.controls;
    const speed = Math.abs(q.forwardSpeed);
    const pos = q.position;
    this.maxDistance = Math.max(this.maxDistance, Math.hypot(pos.x - this.origin.x, pos.z - this.origin.z));
    this.timer -= dt;
    c.starter = false;
    // Following you and you've got off: she waits a while, then gives up on you.
    if (this.follow && (this.phase === 'drive' || this.phase === 'settle')) this.waitForLeader(dt);
    this.watchFriend();
    // The race has been called off (or is long over): she stops where she is.
    if (this.race?.alive && !this.race.alive() && this.phase !== 'stop' && this.phase !== 'done') this.stop('bored');

    // Stalled on her (anywhere but while she's starting it).
    if (this.phase !== 'start' && this.running && !q.engine.isRunning) {
      this.stalls++;
      this.events.push('stalled');
      this.note('starting');
      // Pushing the choke off cold is a mistake she only makes once.
      this.forgetsChoke = false;
      if (this.phase !== 'stop') this.setPhase('stalled', this.between(1.5, 3));
    }
    this.running = q.engine.isRunning;

    switch (this.phase) {
      case 'start':
        this.hold(c);
        for (const e of this.attempt.update(dt)) {
          this.events.push(`start:${e}`);
          if (e === 'caught') this.events.push('practice:starting');
        }
        c.starter = this.attempt.starter;
        if (q.engine.isRunning && (this.attempt.phase === 'tending' || this.attempt.done)) {
          this.setPhase('settle', this.between(this.p.driveSettleMin, this.p.driveSettleMax));
        } else if (this.attempt.done) {
          this.finish('gaveUp');
        }
        break;

      case 'settle':
        // Let it tick over a moment, then off she goes (once you're on, if she's giving you a ride).
        this.hold(c);
        this.tendChoke();
        // Following you: she sets off once you do.
        if (this.follow && !(this.follow()?.forwardSpeed > 1)) {
          this.hold(c);
          break;
        }
        // Her friend's on her way to hop on the back: she waits for her.
        if (this.friend() === 'coming') break;
        if (this.waitForPassenger && !this.passenger()) {
          this.waited += dt;
          if (this.tires && this.waitedTotal > this.p.offerRideGiveUp) {
            this.finish('bored');
            break;
          }
          this.waitedTotal += dt;
          if (this.waited > 15) {
            this.waited = 0;
            this.events.push('waitingForYou');
          }
          break;
        }
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

      case 'grid':
        // On the start line, waiting for the other one and the count-down.
        this.hold(c);
        if (q.forwardSpeed > 0.4) c.brake = this.p.driveBrakeFirm;
        this.tendChoke();
        // Blipping the throttle on the spot (a drag race challenge): the brake stays on, so it only revs.
        if (this.race.blip?.()) c.throttle = 1;
        if (this.race.go()) {
          this.setPhase('drive');
          this.events.push('raceGo');
        }
        break;

      case 'parked':
        // Stopped where you asked, holding it on the brake.
        this.hold(c);
        if (q.forwardSpeed > 0.4) c.brake = this.p.driveBrakeFirm;
        this.tendChoke();
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
          if (this.time > this.driveFor && !this.carrying) {
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
        c.steer = this.reverseSteer;
        // Not into whatever's behind her, either.
        this.probeTimer -= dt;
        if (this.probeTimer <= 0) {
          this.probeTimer = 0.1;
          if (q.forwardSpeed < -0.2 && this.probe(q.yaw + Math.PI, 2.2) < Infinity) this.timer = 0;
        }
        if (this.timer <= 0) {
          c.reverse = false;
          // Having backed off a waypoint she moves on to the next one, except in a race, where skipping one (the start
          // line, say) would have her drive the whole lap without ever lining up: there she has another go at it.
          if (!this.race) this.index = Math.min(this.index + 1, this.waypoints.length);
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
    const before = q.choke;
    q.choke = Math.round(clamp(want, 0, q.choke) * 10) / 10;
    if (before > 0 && q.choke === 0) this.events.push('practice:choke');
  }

  /**
   * An activity is over (the race, doughnuts, the ramp, showing off, a convoy) and she doesn't pull up: back to her ordinary driving, with her usual
   * speed and nerves, a drive of the usual length from now, and the usual dismount at the end.
   */
  carryOn() {
    Object.assign(this.p, this.after ?? {});
    if (this.doughnut) this.quad.churn = 0;
    this.quad.wheelie = 0;
    this.race = null;
    this.doughnut = null;
    this.jump = null;
    this.showOff = null;
    this.follow = null;
    this.trip = null;
    this.waypoints = [];
    this.index = 0;
    this.time = 0;
    this.driveFor = this.between(this.p.driveForMin, this.p.driveForMax);
    this.cruise = this.pickCruise();
    this.setPhase('drive');
    this.events.push('carryOn');
  }

  /** An activity of hers is finished: sometimes she carries on with an ordinary drive (`keepRidingAfter`), otherwise she pulls up. */
  endActivity() {
    if (this.random() < this.p.keepRidingAfter) this.carryOn();
    else this.stop('bored');
  }

  /** Swaps the race she's in for another on the same quad (the drag race challenge: she pulled up beside you, now it's to the strip). */
  reroute(race) {
    this.race = race;
    this.waypoints = race.route.map((pt) => ({ ...pt }));
    this.index = 0;
    this.regrids = 0;
    this.setPhase('drive');
  }

  plan() {
    if (this.park) {
      this.waypoints = this.park.route.map((pt) => ({ ...pt }));
      this.index = 0;
      return true;
    }
    if (this.race) {
      this.waypoints = this.race.route.map((pt) => ({ ...pt }));
      this.index = 0;
      return true;
    }
    const q = this.quad;
    const pos = q.position;
    if (this.outing && !this.follow) {
      const o = this.outing;
      if (this.trip && !this.waypoints.length) this.trip = null; // something cleared her route on the way (backing off twice, a friend getting on): the trip is off
      if (this.trip?.stage === 'there') {
        // At the place: home again, by the same gateways.
        this.trip.stage = 'back';
        this.waypoints = o.back(pos).map((pt) => ({ x: pt.x, z: pt.z }));
        this.index = 0;
        if (this.waypoints.length) return true;
      }
      if (this.trip?.stage === 'back') this.trip = null;
      else if (!this.trip && this.random() < o.p.chance) {
        const trip = o.pick(pos);
        if (trip?.path.length) {
          this.trip = { name: trip.name, stage: 'there' };
          this.waypoints = trip.path.map((pt) => ({ x: pt.x, z: pt.z }));
          this.index = 0;
          // Long enough to get there and back at her pace, and a while at the place, before she tires of it.
          const pace = Math.max(1, this.cruise * o.p.speedScale);
          const there = pathLength(pos, this.waypoints);
          this.driveFor = Math.max(this.driveFor, this.time + (there * 2) / pace + o.p.stopMax + o.p.extraSeconds);
          this.events.push('outing');
          return true;
        }
      }
    }
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
    if (this.doughnut) return this.driveDoughnut(dt, speed);
    if (this.jump) return this.driveJump(dt, speed);
    if (this.showOff) return this.driveShowOff(dt, speed);

    if (this.time > this.driveFor && !this.carrying && !this.race && !this.park) {
      this.stop(this.random() < p.driveScaredChance ? 'scared' : 'bored');
      return;
    }
    // Going faster than she likes (downhill, or her hand slipped): that's her done,
    // or with you on the back, she pulls up to collect herself.
    const road = this.updateRoadPace(dt);
    if (speed > p.driveScareSpeed * road.scare) {
      this.events.push('tooFast');
      if (this.carrying) this.pullUp();
      else this.stop('scared');
      return;
    }

    // Following you: aim behind your quad at your pace, instead of her own loop.
    let follow = null;
    if (this.follow) {
      follow = this.passTarget(dt) ?? this.followTarget(q.position);
      if (!follow || follow.stopped) {
        // You've stopped (or got off): she pulls up behind you and waits.
        this.hold(c);
        if (q.forwardSpeed > 0.4) c.brake = p.driveBrakeFirm * 1.5;
        return;
      }
      this.waypoints = [follow.point];
      this.index = 0;
      this.pauseFor = follow.point;
      this.pauseHere = false;
      this.cruise = follow.speed;
      this.behindTime = follow.gap > p.followFarGap ? this.behindTime + dt : 0;
      if (this.behindTime > 4) {
        this.behindTime = -20; // not again for a while
        this.events.push('fallingBehind');
      }
    }
    // Not on the grid yet: she can't be past it.
    if (this.race && !this.race.go() && this.index > this.race.gridIndex) this.index = this.race.gridIndex;
    if (this.park && this.index >= this.waypoints.length) {
      this.events.push('parkedUp');
      this.stop('parked');
      return;
    }
    if (this.index >= this.waypoints.length && !this.plan()) return;
    const wp = this.waypoints[this.index];
    const pos = q.position;
    const dist = Math.hypot(wp.x - pos.x, wp.z - pos.z);
    // Going quickly she can't thread a waypoint exactly: near enough will do.
    // (Racing she holds her line much tighter, to keep out of the puddles.)
    const onGrid = this.race && this.index === this.race.gridIndex;
    const lastPark = this.park && this.index === this.waypoints.length - 1;
    // The last leg: she lines up with the slot's heading rather than just pointing at it, and stops once she is on it.
    let slotLeg = null;
    if (lastPark && this.park.yaw !== undefined) {
      slotLeg = slotOffsets(pos, { x: wp.x, z: wp.z, yaw: this.park.yaw });
      if (slotLeg.along > -0.3) {
        this.index++;
        return;
      }
    }
    const arrive = lastPark ? this.p.parkArriveRadius : this.park ? this.p.parkStageRadius : onGrid ? this.p.raceGridRadius : p.driveArriveRadius;
    if (dist < Math.max(arrive, speed * (this.race || this.park ? 0.2 : 0.5)) && !follow) {
      this.index++;
      this.events.push('waypoint');
      if (this.cleanLeg && Math.abs(c.steer) > 0.2) this.events.push('practice:cornering');
      this.cleanLeg = true;
      if (this.race) {
        if (this.index - 1 === this.race.gridIndex) {
          // Pointing the wrong way (she came at it from the side): back to the staging point behind the line and come at it again.
          if (this.race.gridYaw !== undefined && Math.abs(angleDiff(q.yaw, this.race.gridYaw)) > this.p.raceGridYaw && this.regrids < 2) {
            this.regrids++;
            this.index = 0;
            this.events.push('raceRegrid');
            return;
          }
          // On the start line: stop and wait for the start.
          this.events.push('raceGrid');
          this.race.onGrid?.();
          this.hold(c);
          this.setPhase('grid');
        } else if (this.index >= this.waypoints.length) {
          // Over the line: that's the race, and she pulls up.
          this.events.push('raceFinish');
          this.race.onFinish?.();
          if (this.race.keepDriving) return void this.carryOn();
          this.stop('raced');
        }
        return;
      }
      if (this.pauseHere) {
        this.events.push('pause');
        this.setPhase('pause', this.trip?.stage === 'there' && this.index >= this.waypoints.length ? this.between(this.outing.p.stopMin, this.outing.p.stopMax) : this.between(p.drivePauseMin, p.drivePauseMax));
        // She brakes there rather than coasting.
        this.hold(c);
        c.brake = p.driveBrakeFirm;
      }
      return;
    }
    // Whether she'll stop for a moment at this one; if so she slows for it on the way.
    if (this.pauseFor !== wp) {
      this.pauseFor = wp;
      this.pauseHere = !this.park && (this.atPlace(wp) || this.random() < p.drivePauseChance);
    }

    // Look where she's going a few times a second, and steer round anything in the way.
    let desired = slotLeg && dist < 8 ? slotHeading(this.park.yaw, slotLeg.lateral) : headingTo(pos, wp);
    this.probeTimer -= dt;
    if (this.probeTimer <= 0) {
      this.probeTimer = 0.1;
      this.lookAhead(desired, speed, dist);
    }
    desired += this.avoid;

    // Something right in front of her: stamp on the brake, then back off it.
    if (this.clearAhead < BLOCKED + speed * 0.5) {
      this.hold(c);
      this.avoidSide = -this.avoidSide;
      this.backOff('obstacle');
      return;
    }

    // Rolling back down a slope she couldn't get up: brake, then give it more.
    if (q.forwardSpeed < -0.4) {
      if (!this.rollingBack) {
        this.rollingBack = true;
        this.events.push('rollBack');
        this.note('mud');
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
    if (this.wasStuck && q.forwardSpeed > 1.5) {
      this.wasStuck = false;
      this.events.push('practice:mud');
    }

    const error = angleDiff(q.yaw, desired);
    let steer = steerFor(error, p);
    // Now and then she yanks the bars too far, then corrects too far the other way.
    if (this.yank) {
      this.yank.t -= dt;
      steer = this.yank.t > 0.35 ? this.yank.dir : -this.yank.dir * 0.7;
      if (this.yank.t <= 0) this.yank = null;
    } else if (Math.abs(error) > 0.25 && speed > 1 && this.random() < p.driveOverSteerRate * mistake(this.skill.cornering) * dt) {
      this.yank = { t: 0.35 + this.between(0.4, 0.8), dir: Math.sign(error) };
      this.events.push('overSteer');
      this.note('cornering');
      this.cleanLeg = false;
    }
    // However she's steering, she doesn't throw it into a turn at speed (a yank too, just less of one).
    // Better hands take a corner a little harder and cleaner; poorer ones go in hot or too timid.
    const cornerAccel = p.driveCornerAccel * (0.8 + 0.4 * this.skill.cornering);
    const bars = steerLimit(speed, cornerAccel * (this.yank ? 1.8 : 1.3), q.params);
    c.steer = clamp(steer, -bars, bars);

    // A hand that can't keep the throttle still.
    this.wobbleTimer -= dt;
    if (this.wobbleTimer <= 0) {
      this.wobbleTimer = this.between(0.3, 1.1);
      this.wobble = 1 + (this.random() * 2 - 1) * p.driveJerk;
    }
    const stopsHere = this.race ? this.index === this.race.gridIndex : !follow && (this.index === this.waypoints.length - 1 || this.pauseHere);
    const corner = cornerSpeed(error, dist, cornerAccel);
    const crowded = Math.max(2.5, this.clearAround * 1.2);
    const target = targetSpeed(this.cruise * this.roadPace * (this.trip ? this.outing.p.speedScale : 1), { error, toStop: stopsHere ? dist : Infinity, clear: this.clearAhead, corner: Math.min(corner, crowded) });
    const short = target - speed;
    this.integral = clamp(this.integral + short * dt, -3, 8);
    const pedals = pedalsFor(speed, target, this.integral, p);
    // A bit more on in a tight turn, where it drags.
    const turning = pedals.throttle > 0 ? Math.abs(c.steer) * 0.04 : 0;
    // Giving it a bootful because it won't go.
    this.boost = Math.max(0, this.boost - dt);
    // And a bit more pulling away, if it's rolled back on her.
    const pullAway = pedals.throttle > 0 ? this.hillStart * clamp(1 - speed / 2, 0, 1) : 0;
    const most = Math.min(1, p.driveMaxThrottle + pullAway + (this.boost > 0 ? 0.25 : 0));
    c.throttle = clamp((pedals.throttle + turning) * this.wobble + pullAway + (this.boost > 0 ? 0.25 : 0), 0, most);
    c.brake = pedals.brake;

    // Wanting to go and going nowhere (or creeping backwards).
    this.stuckTime = target > 0.3 && q.forwardSpeed < 0.3 ? this.stuckTime + dt : 0;
    if (this.stuckTime > 3) {
      this.stuckTime = 0;
      this.unstick();
    }
  }

  /** Settles her pace to the road under her: faster on tarmac, with a remark as she joins it. Returns the multiplier on her scare speed. */
  updateRoadPace(dt) {
    const t = this.tarmac;
    if (!t || this.race || this.park || this.follow) {
      this.roadPace = 1;
      return { scare: 1 };
    }
    const on = t.at(this.quad.position.x, this.quad.position.z);
    const was = this.roadSettled;
    this.roadSettled = settleBoost(was, on, dt, t.p);
    if (on && was === 0 && this.roadSettled > 0) this.events.push('onRoad');
    this.roadPace = boostFactor(this.roadSettled, t.p.speedBoost);
    return { scare: boostFactor(this.roadSettled, t.p.scareBoost) };
  }

  /** Getting to the circle, then going round and round it until her time is up. */
  driveDoughnut(dt, speed) {
    const d = this.doughnut;
    const q = this.quad;
    const c = this.controls;
    const pos = q.position;
    const dist = Math.hypot(pos.x - d.centre.x, pos.z - d.centre.z);
    if (!d.spinning) {
      if (dist <= d.radius * 1.4) {
        Object.assign(d, { spinning: true, t: 0 });
        this.events.push('doughnuts');
      } else {
        // Straight at the middle, at a gentle pace, until she is near enough to start going round.
        const pedals = pedalsFor(speed, 4, this.integral, this.p);
        c.steer = steerFor(angleDiff(q.yaw, headingTo(pos, d.centre)), this.p);
        c.throttle = pedals.throttle;
        c.brake = pedals.brake;
        return;
      }
    }
    d.t += dt;
    if (d.t > d.seconds) {
      q.churn = 0;
      this.endActivity();
      return;
    }
    const k = doughnutControl(pos, q.yaw, d.centre, d.radius, d.dir, d.p, this.p.driveSteerGain);
    c.steer = k.steer;
    c.throttle = k.throttle;
    c.brake = 0;
    q.churn = d.p.churn;
  }

  /** Showing off: ShowOffRun steers, works the pedals and says how far the nose is up; this passes it on and tells the game what happened. */
  driveShowOff(dt, speed) {
    const q = this.quad;
    const c = this.controls;
    const so = this.showOff;
    const r = so.run.step(dt, { pos: q.position, yaw: q.yaw, speed, you: so.you() }, this.p.driveSteerGain);
    this.events.push(...r.events);
    q.wheelie = r.wheelie * so.run.p.wheelieLift;
    if (r.done) {
      if (so.run.result === 'noRoom') this.events.push('noRoom');
      if (so.run.result === 'noRoom') this.stop('bored');
      else this.endActivity();
      return;
    }
    c.steer = r.steer;
    if (r.targetSpeed === null) {
      c.throttle = r.throttle;
      c.brake = r.brake;
    } else {
      // Getting there and building up speed: her usual feel for the pedals, which a manual needs to avoid stalling.
      this.integral = clamp(this.integral + (r.targetSpeed - speed) * dt, -3, 8);
      const pedals = pedalsFor(speed, r.targetSpeed, this.integral, this.p);
      c.throttle = pedals.throttle;
      c.brake = pedals.brake;
    }
    // Something in the way ahead and she's still moving: off the throttle and on the brakes, whatever the trick.
    this.probeTimer -= dt;
    if (this.probeTimer <= 0) {
      this.probeTimer = 0.1;
      this.blocked = speed > 2 && this.probe(q.yaw, 4 + speed * 0.6) < Infinity;
    }
    if (this.blocked) {
      Object.assign(c, { throttle: 0, brake: 1 });
      this.blockedFor = (this.blockedFor ?? 0) + dt;
      if (this.blockedFor > 1.5) {
        this.events.push('obstacle');
        this.stop('bored'); // no room for it here after all
      }
    }
  }

  /** Riding at the ramp: JumpRun steers and says how fast, and this turns that into the pedals and tells the game what happened. */
  driveJump(dt, speed) {
    const q = this.quad;
    const c = this.controls;
    const v = q.velocity;
    const r = this.jump.run.step(dt, { pos: q.position, yaw: q.yaw, speed, airborne: q.airborne, vy: v.y, upY: q.upY, tipped: q.isTipped }, this.p.driveSteerGain);
    for (const e of r.events) {
      if (typeof e === 'string') this.events.push(e);
      else {
        this.lastJump = e;
        this.events.push('jumpRated');
      }
    }
    if (r.done) {
      if (this.jump.run.lastRating === 'bail') this.stop('scared');
      else this.endActivity();
      return;
    }
    c.steer = r.steer;
    const phase = this.jump.run.phase;
    if (phase === 'air' || phase === 'landing') {
      // Hands off the pedals: nothing to do but hold on.
      c.throttle = 0;
      c.brake = 0;
    } else if (r.brake) {
      c.throttle = 0;
      c.brake = 0.6;
    } else if (phase === 'run' && speed < r.targetSpeed - 0.5) {
      // The run-up: flat out until she's at speed (the quads are slow off the mark, and the ramp takes it out of them).
      c.throttle = 1;
      c.brake = 0;
    } else {
      const pedals = pedalsFor(speed, r.targetSpeed, this.integral, this.p);
      c.throttle = pedals.throttle;
      c.brake = pedals.brake;
    }
  }

  /**
   * Backs away from something in the way. Backing off again and again in the same spot (it is still in the way) used to
   * go on for ever: the second time she plans a fresh way out (a different heading), and the fifth she's had enough and
   * gets off. In a race the route is kept, and she just gives up the fifth time.
   */
  backOff(event) {
    const here = this.quad.position;
    const last = this.lastBackOff;
    const again = last && Math.hypot(here.x - last.x, here.z - last.z) < this.p.backOffRadius && this.clock - last.at < this.p.backOffWithin;
    this.backOffs = again ? this.backOffs + 1 : 1;
    this.lastBackOff = { x: here.x, z: here.z, at: this.clock };
    if (this.backOffs >= this.p.backOffsToGiveUp) {
      this.events.push('noRoom');
      this.stop('noRoom');
      return;
    }
    if (this.backOffs >= 2 && !this.race && !this.follow) this.waypoints = [];
    this.events.push(event);
    this.reverseSteer = this.chooseReverseSteer(again);
    // Backing off the same thing again she goes further each time, so the nose has room to come round.
    const longer = 1 + this.p.backOffLonger * (this.backOffs - 1);
    this.setPhase('reversing', this.between(1.5, 2.5) * longer);
  }

  /**
   * Which way to turn the bars to back away. Reversing, the nose swings the other way to forward driving, so the bars go
   * opposite to the side she wants the nose to end up on: whichever has more room. Backing off again from the same spot she
   * goes the other way unless that side is clearly worse, rather than winding the same lock on into the same hedge.
   */
  chooseReverseSteer(again) {
    const yaw = this.quad.yaw;
    const reach = this.p.backOffLook;
    let left = Math.min(this.probe(yaw + 0.9, reach), this.probe(yaw + 0.45, reach)); // yaw grows to the left
    let right = Math.min(this.probe(yaw - 0.9, reach), this.probe(yaw - 0.45, reach));
    const last = this.lastReverseSide ?? 0;
    if (again && last) {
      if (last > 0) right += reach * 0.5;
      else left += reach * 0.5;
    }
    let side = left === right ? -last || this.avoidSide : left > right ? 1 : -1;
    this.lastReverseSide = side;
    return -side;
  }

  /**
   * Not moving. Up against something: she backs off it. Otherwise it's
   * bogging: she gives it more, or remembers the choke if it's cold, and in
   * the end gives up on it.
   */
  unstick() {
    const q = this.quad;
    if (this.clearAhead < 3.5) {
      this.backOff('stuck');
      return;
    }
    this.bogs++;
    this.wasStuck = true;
    this.note('mud');
    // A hand that knows mud keeps at it a go longer before giving up.
    const patient = this.skill.mud >= 0.8 ? 1 : 0;
    // Sunk in a bog: a couple of goes at it, then she's had it and shouts for help.
    if (q.bog?.sink > 0.3 && this.bogs > 1 + patient) {
      this.events.push('stuckInBog');
      this.strandedInBog = true; // the driving state keeps her up on the quad calling for help (strandedWait.js) rather than getting her off
      this.stop('gaveUp');
      return;
    }
    if (this.bogs > 3 + patient) {
      this.events.push('bogged');
      this.stop('gaveUp');
    } else if (q.engine.temperature < 0.5 && q.choke < 0.5 && this.random() < 0.5) {
      q.choke = 1;
      this.forgetsChoke = false; // and now she'll mind it
      this.events.push('chokeBack');
    } else {
      this.boost = 2 * (0.6 + 0.8 * this.skill.mud); // she knows how much to give it
      this.events.push('revIt');
    }
  }

  /** Probes ahead and towards the waypoint; picks a way round if it's blocked. */
  lookAhead(desired, speed, dist) {
    const q = this.quad;
    const reach = Math.min(dist + 1, 3.5 + speed * 1.5);
    // Further ahead the quicker she's going, so she has room to slow for it.
    this.clearAhead = this.probe(q.yaw, 2.5 + speed * 2.2);
    // And to either side, the way she might turn: among parked quads and people
    // she picks her way through, and only opens it up with room around her.
    const side = 5 + speed;
    this.clearAround = Math.min(this.probe(q.yaw + 0.6, side), this.probe(q.yaw - 0.6, side), this.probe(q.yaw + 1.2, side * 0.6), this.probe(q.yaw - 1.2, side * 0.6));
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
