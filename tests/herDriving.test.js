import { describe, it, expect } from 'vitest';
import { angleDiff, headingTo, steerFor, targetSpeed, pedalsFor, planLoop, HerDrive } from '../src/npc/herDriving.js';
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
