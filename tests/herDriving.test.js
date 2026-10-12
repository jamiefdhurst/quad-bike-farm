import { describe, it, expect } from 'vitest';
import { angleDiff, headingTo, steerFor, targetSpeed, pedalsFor, planLoop, HerDrive, steerLimit, cornerSpeed } from '../src/npc/herDriving.js';
import { DEFAULT_COMPANION_PARAMS } from '../src/npc/companionParams.js';

function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const P = DEFAULT_COMPANION_PARAMS;
const DT = 1 / 30;
const open = () => true;

/**
 * Just enough quad to drive: a bicycle model where throttle pushes, brakes
 * and drag slow it, and steer turns it. Walls are lines x = wallX (if set).
 */
function fakeQuad({ running = true, wallX = Infinity, x = 0, z = 0, yaw = 0 } = {}) {
  const q = {
    position: { x, z },
    yaw,
    forwardSpeed: 0,
    choke: 0,
    fuel: { tap: 'on' },
    engine: {
      isRunning: running,
      ignitionOn: running,
      temperature: 1,
      setIgnition(on) {
        this.ignitionOn = on;
      },
    },
    driver: null,
    step(dt) {
      const c = this.driver.controls;
      if (c.starter && this.engine.ignitionOn) this.engine.isRunning = true;
      const push = this.engine.isRunning ? Math.max(0, c.throttle - 0.18) * 20 : 0;
      let v = this.forwardSpeed + (push - c.brake * 6 * Math.sign(this.forwardSpeed) - 0.4 * this.forwardSpeed) * dt;
      if (c.reverse) v = -Math.min(1, c.throttle * 2);
      this.forwardSpeed = v;
      this.yaw += c.steer * 0.55 * v * 0.5 * dt;
      const nx = this.position.x + Math.sin(this.yaw) * v * dt;
      if (nx < wallX - 1) this.position.x = nx;
      else this.forwardSpeed = 0;
      this.position.z += Math.cos(this.yaw) * v * dt;
    },
  };
  return q;
}

function run(quad, { seed = 1, seconds = 200, probe = () => Infinity, isClear = open, params = P } = {}) {
  const d = new HerDrive(quad, { params, probe, isClear, random: seededRandom(seed) });
  quad.driver = d;
  const events = [];
  let maxSpeed = 0;
  let maxDist = 0;
  let t = 0;
  for (; t < seconds && !d.done; t += DT) {
    events.push(...d.update(DT));
    quad.step(DT);
    maxSpeed = Math.max(maxSpeed, Math.abs(quad.forwardSpeed));
    maxDist = Math.max(maxDist, Math.hypot(quad.position.x, quad.position.z));
  }
  return { d, events, maxSpeed, maxDist, t };
}

describe('her driving: the pieces', () => {
  it('measures headings the way the quad does', () => {
    expect(headingTo({ x: 0, z: 0 }, { x: 0, z: 5 })).toBeCloseTo(0);
    expect(headingTo({ x: 0, z: 0 }, { x: 5, z: 0 })).toBeCloseTo(Math.PI / 2);
    expect(angleDiff(3, -3)).toBeCloseTo(2 * Math.PI - 6);
  });

  it('steers towards the error and no further than full lock', () => {
    expect(steerFor(0.2, P)).toBeGreaterThan(0);
    expect(steerFor(-0.2, P)).toBeLessThan(0);
    expect(steerFor(3, P)).toBe(1);
    expect(steerFor(-3, P)).toBe(-1);
  });

  it('slows for turns, stops and things ahead', () => {
    expect(targetSpeed(3)).toBe(3);
    expect(targetSpeed(3, { error: 1.2 })).toBeLessThan(1.5);
    expect(targetSpeed(3, { toStop: 0 })).toBeLessThan(1);
    expect(targetSpeed(3, { clear: 2 })).toBeLessThan(1);
  });

  it('never gives it much throttle, and brakes when it runs away', () => {
    const slow = pedalsFor(0, 3, 100, P);
    expect(slow.throttle).toBeLessThanOrEqual(P.driveMaxThrottle);
    expect(slow.brake).toBe(0);
    const fast = pedalsFor(5, 3, 0, P);
    expect(fast.throttle).toBe(0);
    expect(fast.brake).toBeGreaterThan(0);
    expect(pedalsFor(1, 0, 0, P).brake).toBeGreaterThan(0);
  });

  it('plans a loop through where she is, out to the loop size and back', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const pts = planLoop({ x: 10, z: -4 }, 0.7, seededRandom(seed), P, open);
      expect(pts.length).toBeGreaterThanOrEqual(P.driveWaypointsMin);
      const far = Math.max(...pts.map((p) => Math.hypot(p.x - 10, p.z + 4)));
      expect(far).toBeLessThan(P.driveLoopRadiusMax * 2.5);
      expect(far).toBeGreaterThan(P.driveLoopRadiusMin);
      const last = pts[pts.length - 1];
      expect(Math.hypot(last.x - 10, last.z + 4)).toBeLessThan(P.driveLoopRadiusMax);
      // The first waypoint is roughly ahead of her, not behind.
      expect(Math.abs(angleDiff(0.7, headingTo({ x: 10, z: -4 }, pts[0])))).toBeLessThan(Math.PI / 2);
    }
  });

  it('bends the loop to the clear side, and gives up when there is no room', () => {
    // Everything with x > 0 is blocked: the loop has to go to x < 0.
    const leftOnly = (a, b) => b.x <= 0.5;
    const pts = planLoop({ x: 0, z: 0 }, 0, seededRandom(3), P, leftOnly);
    expect(pts.length).toBeGreaterThan(0);
    for (const p of pts) expect(p.x).toBeLessThanOrEqual(0.5);
    expect(planLoop({ x: 0, z: 0 }, 0, seededRandom(3), P, () => false)).toEqual([]);
  });
});

describe('her driving a quad', () => {
  it('drives slowly round a small loop for about a minute, then stops', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const quad = fakeQuad();
      const { d, events, maxSpeed, maxDist, t } = run(quad, { seed });
      expect(d.done).toBe(true);
      expect(['bored', 'scared']).toContain(d.result);
      expect(events).toContain('setOff');
      expect(maxSpeed).toBeLessThan(P.driveScareSpeed);
      expect(maxDist).toBeLessThan(40);
      expect(maxDist).toBeGreaterThan(5);
      expect(t).toBeGreaterThan(P.driveForMin);
      expect(t).toBeLessThan(P.driveForMax + 30);
      expect(Math.abs(quad.forwardSpeed)).toBeLessThan(0.3);
    }
  });

  it('starts it first if it is not running', () => {
    const quad = fakeQuad({ running: false });
    const { events } = run(quad, { seed: 4, seconds: 30 });
    expect(events).toContain('start:crank');
    expect(events).toContain('setOff');
  });

  it('pulls up for a friend who is getting on, and carries on once she is aboard', () => {
    const quad = fakeQuad();
    let friend = null;
    const d = new HerDrive(quad, { params: P, probe: () => Infinity, isClear: open, random: seededRandom(2), friend: () => friend });
    quad.driver = d;
    const step = (seconds) => {
      for (let t = 0; t < seconds; t += DT) {
        d.update(DT);
        quad.step(DT);
      }
    };
    step(15);
    friend = 'coming';
    expect(() => step(1)).not.toThrow(); // it once threw: a drive's `park` route hid the pull-up method of the same name
    expect(d.phase).toBe('parked');
    friend = null;
    step(1);
    expect(d.phase).not.toBe('parked');
  });

  it('stops when asked, and is done once it has stopped', () => {
    const quad = fakeQuad();
    const d = new HerDrive(quad, { params: P, probe: () => Infinity, isClear: open, random: seededRandom(2) });
    quad.driver = d;
    for (let t = 0; t < 15; t += DT) {
      d.update(DT);
      quad.step(DT);
    }
    expect(Math.abs(quad.forwardSpeed)).toBeGreaterThan(0.5);
    d.stop('asked');
    let t = 0;
    for (; t < 15 && !d.done; t += DT) {
      d.update(DT);
      quad.step(DT);
    }
    expect(d.done).toBe(true);
    expect(d.result).toBe('asked');
    expect(t).toBeLessThan(6);
  });

  it('brakes and backs off something in front of her', () => {
    // A wall across her path, 8 m ahead.
    const quad = fakeQuad({ yaw: Math.PI / 2 });
    const probe = (heading, distance) => {
      const dx = Math.sin(heading);
      if (dx <= 0.05) return Infinity;
      const hit = (8 - quad.position.x) / dx;
      return hit < distance ? hit : Infinity;
    };
    const isClear = (a, b) => b.x < 6;
    quad.step = ((step) =>
      function (dt) {
        step.call(this, dt);
        if (this.position.x > 7.4) throw new Error('drove into the wall');
      })(quad.step);
    const { d } = run(quad, { seed: 5, probe, isClear, seconds: 120 });
    expect(d.done).toBe(true);
  });

  it('brakes when it rolls back down a slope, then gives it more to get up', () => {
    // A slope that pulls it back harder than her usual throttle pushes.
    const quad = fakeQuad();
    quad.step = ((step) =>
      function (dt) {
        step.call(this, dt);
        this.forwardSpeed -= 2.4 * dt;
      })(quad.step);
    const { d, events } = run(quad, { seed: 7, seconds: 40 });
    expect(events).toContain('rollBack');
    // She learns to give it more pulling away, rather than sliding back every time.
    expect(events.filter((e) => e === 'rollBack').length).toBeLessThanOrEqual(2);
    expect(events.filter((e) => e === 'waypoint').length).toBeGreaterThan(3);
    expect(d.result).not.toBe('gaveUp');
  });

  it('gives up after stalling it too many times', () => {
    const quad = fakeQuad();
    const d = new HerDrive(quad, { params: { ...P, driveMaxStalls: 1 }, probe: () => Infinity, isClear: open, random: seededRandom(6) });
    quad.driver = d;
    const events = [];
    for (let t = 0; t < 120 && !d.done; t += DT) {
      // Every few seconds of driving, it dies on her.
      if (d.phase === 'drive' && d.time % 6 < DT) quad.engine.isRunning = false;
      events.push(...d.update(DT));
      quad.step(DT);
    }
    expect(events.filter((e) => e === 'stalled').length).toBe(2);
    expect(d.result).toBe('gaveUp');
  });
});

describe('driving quickly', () => {
  it('never gives it more bars than a gentle corner at speed', () => {
    for (const speed of [6, 9, 12, 14]) {
      const s = steerLimit(speed, 4);
      const lock = ((32 * Math.PI) / 180) / (1 + 0.06 * speed);
      const radius = 1.25 / Math.tan(s * lock);
      expect((speed * speed) / radius).toBeLessThan(4.5);
    }
    expect(steerLimit(2, 4)).toBe(1);
  });

  it('slows for a sharp turn and for something far ahead', () => {
    expect(cornerSpeed(0.05, 30, 4)).toBeGreaterThan(13);
    expect(cornerSpeed(1.2, 10, 4)).toBeLessThan(5);
    expect(targetSpeed(13, { clear: 40 })).toBeGreaterThan(12.5);
    expect(targetSpeed(13, { clear: 15 })).toBeLessThan(10);
    // Slow driving near things is as careful as ever.
    expect(targetSpeed(3, { clear: 3 })).toBeCloseTo(0.84, 2);
  });
});

describe('her driving you about on her own idea', () => {
  const make = (extra) => new HerDrive(fakeQuad(), { params: P, probe: () => Infinity, isClear: open, random: seededRandom(5), ...extra });

  it('keeps going while you ride when you asked for it, but tires of it when it was her idea', () => {
    expect(make({ passenger: () => true }).carrying).toBe(true);
    expect(make({ passenger: () => true, tires: true }).carrying).toBe(false);
  });

  it('stops after her usual length of drive with you aboard, and says she is bored or scared', () => {
    const quad = fakeQuad();
    const d = new HerDrive(quad, { params: { ...P, driveForMin: 20, driveForMax: 20 }, probe: () => Infinity, isClear: open, random: seededRandom(5), passenger: () => true, tires: true });
    quad.driver = d;
    let t = 0;
    for (; t < 120 && !d.done; t += DT) {
      d.update(DT);
      quad.step(DT);
    }
    expect(d.done).toBe(true);
    expect(['bored', 'scared']).toContain(d.result);
    expect(t).toBeLessThan(60);
  });

  it('gives up waiting for you if you never get on the back', () => {
    const quad = fakeQuad();
    const d = new HerDrive(quad, { params: P, probe: () => Infinity, isClear: open, random: seededRandom(5), tires: true, waitForPassenger: true });
    quad.driver = d;
    let t = 0;
    for (; t < 120 && !d.done; t += DT) {
      d.update(DT);
      quad.step(DT);
    }
    expect(d.result).toBe('bored');
    expect(t).toBeLessThan(P.offerRideGiveUp + 10);
  });
});

describe('backing off the same thing again and again', () => {
  // Just the bookkeeping, without a quad to drive.
  function boxedIn(race = null) {
    const d = Object.create(HerDrive.prototype);
    Object.assign(d, {
      p: { ...DEFAULT_COMPANION_PARAMS },
      quad: { position: { x: 0, z: 0 }, yaw: 0 },
      probe: () => Infinity,
      avoidSide: 1,
      events: [],
      clock: 0,
      waypoints: [{ x: 1, z: 1 }],
      race,
      follow: null,
      random: () => 0,
      timer: 0,
      stopped: null,
    });
    d.stop = (reason) => (d.stopped = reason);
    return d;
  }

  it('backs off the first time, plans a fresh way out the second, and gives up on the fifth', () => {
    const d = boxedIn();
    d.backOff('obstacle');
    expect(d.phase).toBe('reversing');
    expect(d.waypoints.length).toBe(1);
    d.clock += 5;
    d.backOff('obstacle');
    expect(d.waypoints).toEqual([]);
    for (let i = 0; i < 2; i++) {
      d.clock += 5;
      d.backOff('obstacle');
    }
    expect(d.stopped).toBeNull();
    d.clock += 5;
    d.backOff('stuck');
    expect(d.stopped).toBe('noRoom');
    expect(d.events).toContain('noRoom');
  });

  it('starts counting again once she has got somewhere else, or a while has passed', () => {
    const d = boxedIn();
    for (let i = 0; i < 4; i++) {
      d.clock += 5;
      d.backOff('obstacle');
    }
    d.quad.position.x = 30;
    d.backOff('obstacle');
    expect(d.backOffs).toBe(1);
    d.clock += 60;
    d.backOff('obstacle');
    expect(d.backOffs).toBe(1);
    expect(d.stopped).toBeNull();
  });

  it('keeps a race route, but still gives up in the end', () => {
    const d = boxedIn({ route: [] });
    for (let i = 0; i < 4; i++) {
      d.clock += 5;
      d.backOff('obstacle');
    }
    expect(d.waypoints.length).toBe(1);
    expect(d.stopped).toBeNull();
    d.clock += 5;
    d.backOff('obstacle');
    expect(d.stopped).toBe('noRoom');
  });
});

describe('backing off: which way to swing', () => {
  function boxed(blockedLeft, blockedRight) {
    const d = Object.create(HerDrive.prototype);
    Object.assign(d, {
      p: { ...DEFAULT_COMPANION_PARAMS },
      quad: { position: { x: 0, z: 0 }, yaw: 0 },
      avoidSide: 1,
      probe: (a) => ((a > 0 && blockedLeft) || (a < 0 && blockedRight) ? 1 : Infinity),
    });
    return d;
  }

  it('turns the bars so the nose swings towards the side with room (reversing swings it the other way)', () => {
    expect(boxed(true, false).chooseReverseSteer(false)).toBe(1); // hedge on the left, nose to the right: bars left
    expect(boxed(false, true).chooseReverseSteer(false)).toBe(-1);
  });

  it('goes the other way on a second try from the same spot when neither side is clearly worse', () => {
    const d = boxed(false, false);
    const first = d.chooseReverseSteer(false);
    expect(d.chooseReverseSteer(true)).toBe(-first);
  });

  it('reverses longer each time she backs off the same thing', () => {
    const d = boxed(false, false);
    Object.assign(d, { events: [], clock: 0, waypoints: [], race: null, follow: null, random: () => 0, between: (a, b) => a, setPhase: (ph, t) => (d.timer = t), stop() {} });
    d.backOff('obstacle');
    const first = d.timer;
    d.clock += 5;
    d.backOff('obstacle');
    expect(d.timer).toBeCloseTo(first * 1.5);
  });
});

describe('backing off in a race', () => {
  function reversing(race) {
    const d = Object.create(HerDrive.prototype);
    Object.assign(d, {
      p: { ...DEFAULT_COMPANION_PARAMS },
      quad: { forwardSpeed: 0, position: { x: 0, z: 0 }, yaw: 0, engine: { isRunning: true, temperature: 1 }, choke: 0 },
      race,
      events: [],
      controls: { throttle: 0, brake: 0, steer: 0, reverse: false },
      phase: 'reversing',
      timer: 0,
      probeTimer: 1,
      index: 0,
      waypoints: [{ x: 0, z: 0 }, { x: 0, z: 10 }, { x: 0, z: 20 }],
      origin: { x: 0, z: 0 },
      maxDistance: 0,
      clock: 0,
      noted: {},
      running: true,
      friend: () => null,
      friendAboard: false,
      forgetsChoke: true,
      random: () => 0,
      probe: () => Infinity,
      avoidSide: 1,
      reverseSteer: 1,
    });
    return d;
  }

  it('has another go at the same waypoint, so she never skips the start line', () => {
    const d = reversing({ route: [], gridIndex: 0, go: () => false, alive: () => true });
    d.update(0.1);
    expect(d.phase).toBe('pause');
    expect(d.index).toBe(0);
  });

  it('but on an ordinary drive she moves on to the next', () => {
    const d = reversing(null);
    d.update(0.1);
    expect(d.phase).toBe('pause');
    expect(d.index).toBe(1);
  });
});

describe('her driving: an outing', () => {
  const outing = (extra = {}) => ({
    p: { chance: 1, minDistance: 35, maxDistance: 230, speedScale: 1.3, stopMin: 3, stopMax: 4, extraSeconds: 25 },
    pick: () => ({ name: 'the muck heap', path: [{ x: 0, z: 40 }, { x: 10, z: 90 }] }),
    back: () => [{ x: 0, z: 40 }, { x: 0, z: 0 }],
    ...extra,
  });

  it('drives to the place, stops there for a moment and comes back', () => {
    const quad = fakeQuad();
    const d = new HerDrive(quad, { params: P, probe: () => Infinity, isClear: open, random: seededRandom(3), outing: outing() });
    quad.driver = d;
    const events = [];
    const stages = new Set();
    let far = 0;
    let stoppedThere = 0;
    for (let t = 0; t < 400 && !d.done; t += DT) {
      events.push(...d.update(DT));
      quad.step(DT);
      if (d.trip) stages.add(d.trip.stage);
      far = Math.max(far, quad.position.z);
      if (d.trip?.stage === 'there' && quad.position.z > 85 && d.phase === 'pause') stoppedThere += DT;
    }
    expect(events).toContain('outing');
    expect(far).toBeGreaterThan(80);
    expect(stoppedThere).toBeGreaterThan(1);
    expect([...stages]).toEqual(['there', 'back']);
    expect(d.trip).toBeNull(); // home and onto loops
  });

  it('keeps going long enough to get there and back before she tires of it', () => {
    const quad = fakeQuad();
    const d = new HerDrive(quad, { params: { ...P, driveForMin: 20, driveForMax: 20 }, probe: () => Infinity, isClear: open, random: seededRandom(5), outing: outing() });
    quad.driver = d;
    for (let t = 0; t < 400 && d.trip?.stage !== 'back' && !d.done; t += DT) {
      d.update(DT);
      quad.step(DT);
    }
    expect(d.driveFor).toBeGreaterThan(60);
    expect(d.done).toBe(false);
  });

  it('loops as before when there is nowhere to go or the dice say no', () => {
    const nowhere = fakeQuad();
    const a = new HerDrive(nowhere, { params: P, probe: () => Infinity, isClear: open, random: seededRandom(1), outing: outing({ pick: () => null }) });
    nowhere.driver = a;
    const dicey = fakeQuad();
    const b = new HerDrive(dicey, { params: P, probe: () => Infinity, isClear: open, random: seededRandom(1), outing: outing({ p: { ...outing().p, chance: 0 } }) });
    dicey.driver = b;
    for (let t = 0; t < 60; t += DT) {
      a.update(DT);
      nowhere.step(DT);
      b.update(DT);
      dicey.step(DT);
    }
    expect(a.trip).toBeNull();
    expect(b.trip).toBeNull();
    expect(Math.hypot(nowhere.position.x, nowhere.position.z)).toBeLessThan(30);
  });

  it('abandons the trip if her route is cleared on the way', () => {
    const quad = fakeQuad();
    const o = outing();
    const d = new HerDrive(quad, { params: P, probe: () => Infinity, isClear: open, random: seededRandom(3), outing: o });
    quad.driver = d;
    for (let t = 0; t < 30; t += DT) {
      d.update(DT);
      quad.step(DT);
    }
    expect(d.trip?.stage).toBe('there');
    o.p.chance = 0; // and she does not fancy another
    d.waypoints = []; // backed off twice, say
    d.update(DT);
    quad.step(DT);
    expect(d.trip).toBeNull();
  });
});
