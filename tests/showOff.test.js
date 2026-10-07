import { describe, it, expect } from 'vitest';
import { ShowOffRun, youSaw, pickTrick, DEFAULT_SHOWOFF_PARAMS as P } from '../src/npc/showOff.js';
import { AMY_SHOWOFF_LINES, JESS_SHOWOFF_LINES, SHOWOFF_LINE_KEYS } from '../src/npc/showOffLines.js';
import { HerDrive } from '../src/npc/herDriving.js';
import { DEFAULT_COMPANION_PARAMS } from '../src/npc/companionParams.js';
import { pickBoredChoice } from '../src/npc/boredom.js';

const you = (o = {}) => ({ x: 0, z: 0, fx: 0, fz: 1, ...o }); // at the origin, looking along +z

describe('whether you saw', () => {
  it('only if you are facing her and close enough', () => {
    expect(youSaw(you(), { x: 0, z: 20 }, P)).toBe(true);
    expect(youSaw(you(), { x: 3, z: 20 }, P)).toBe(true);
    expect(youSaw(you(), { x: 20, z: 2 }, P)).toBe(false); // off to your side
    expect(youSaw(you(), { x: 0, z: -20 }, P)).toBe(false); // behind you
    expect(youSaw(you(), { x: 0, z: P.seeRange + 5 }, P)).toBe(false); // too far
  });
});

describe('which trick', () => {
  it('a wheelie only on a two-stroke, and then only if the dice say so', () => {
    expect(pickTrick(true, P, () => 0)).toBe('wheelie');
    expect(pickTrick(true, P, () => 0.99)).toBe('skid');
    expect(pickTrick(false, P, () => 0)).toBe('skid');
  });
});

describe('a run at you', () => {
  // A little kinematic quad: it turns at up to `turn` rad/s, speeds up at `accel` and brakes at `decel`.
  function ride(trick, { watching = () => true, seconds = 120, start = { x: 0, z: 40 } } = {}) {
    const run = new ShowOffRun(trick, { ...P }, () => 0.9);
    let { x, z } = start;
    let yaw = Math.PI; // facing you
    let speed = 0;
    const log = { events: [], wheelie: 0, closest: Infinity, stoppedAt: null };
    for (let t = 0; t < seconds; t += 0.05) {
      const me = you(watching(t) ? {} : { fz: -1 });
      const r = run.step(0.05, { pos: { x, z }, yaw, speed, you: me });
      log.events.push(...r.events);
      log.wheelie = Math.max(log.wheelie, r.wheelie);
      log.closest = Math.min(log.closest, Math.hypot(x - me.x, z - me.z));
      if (r.done) break;
      yaw += r.steer * 0.9 * 0.05;
      const throttle = r.targetSpeed === null ? r.throttle : Math.max(0, Math.min(1, (r.targetSpeed - speed) * 0.5));
      speed = Math.max(0, speed + (throttle * 5 - r.brake * 7 - 0.3) * 0.05);
      x += Math.sin(yaw) * speed * 0.05;
      z += Math.cos(yaw) * speed * 0.05;
      if (r.brake > 0.9 && speed < 0.1) log.stoppedAt = { x, z };
    }
    return { run, log };
  }

  it('a skid stops her beside you, not through you, and she looks over to see', () => {
    const { run, log } = ride('skid');
    expect(log.events[0]).toBe('showOffGo');
    expect(log.stoppedAt).not.toBeNull();
    expect(Math.hypot(log.stoppedAt.x, log.stoppedAt.z)).toBeGreaterThan(2);
    expect(Math.hypot(log.stoppedAt.x, log.stoppedAt.z)).toBeLessThan(8);
    expect(run.result).toBe('seen');
    expect(log.events).toContain('showOffSeen');
    expect(log.wheelie).toBe(0);
  });

  it('a wheelie lifts the nose for a few seconds as she passes, then she stops and looks', () => {
    const { run, log } = ride('wheelie');
    expect(log.wheelie).toBe(1);
    expect(log.events[0]).toBe('showOffGo');
    expect(run.result).toBe('seen');
  });

  it('if you were looking away she goes again, up to her limit, then gives up', () => {
    const { run, log } = ride('skid', { watching: () => false });
    expect(log.events.filter((e) => e === 'showOffGo')).toHaveLength(P.goesMax);
    expect(log.events.filter((e) => e === 'showOffAgain')).toHaveLength(P.goesMax - 1);
    expect(log.events.at(-1)).toBe('showOffMissed');
    expect(run.result).toBe('missed');
  });

  it('starts from close by too, by backing off to the run-up first', () => {
    const { log } = ride('skid', { start: { x: 3, z: 6 } });
    expect(log.events).toContain('showOffGo');
  });

  it('looks for a clear run, and gives up if there is none', () => {
    const closed = new ShowOffRun('skid', { ...P }, () => 0.9, () => false);
    const r = closed.step(0.1, { pos: { x: 3, z: 6 }, yaw: 0, speed: 0, you: you() });
    expect(r.done).toBe(true);
    expect(closed.result).toBe('noRoom');
    // Only the far side is clear: she goes round to it.
    const half = new ShowOffRun('skid', { ...P }, () => 0.9, (a, b) => a.z < 0 || b.z < 0);
    half.step(0.1, { pos: { x: 3, z: 6 }, yaw: 0, speed: 0, you: you() });
    expect(half.setupTarget.z).toBeLessThan(0);
  });

  it('brakes if something is in the way', () => {
    const d = Object.create(HerDrive.prototype);
    Object.assign(d, {
      p: { ...DEFAULT_COMPANION_PARAMS },
      quad: { position: { x: 0, z: 40 }, yaw: Math.PI, wheelie: 0 },
      showOff: { run: new ShowOffRun('skid', { ...P }, () => 0.9), you: () => you() },
      events: [],
      controls: { throttle: 0, brake: 0, steer: 0, reverse: false },
      probeTimer: 0,
      integral: 0,
      probe: () => 3,
    });
    d.stop = () => {};
    d.driveShowOff(0.1, 5);
    expect(d.controls.brake).toBe(1);
    expect(d.controls.throttle).toBe(0);
  });

  it('gives up if she never gets anywhere', () => {
    const run = new ShowOffRun('skid', { ...P }, () => 0.9);
    let r;
    for (let t = 0; t < P.runTimeout + 2; t += 0.1) r = run.step(0.1, { pos: { x: 0, z: -50 }, yaw: Math.PI, speed: 0, you: you() });
    expect(r.done).toBe(true);
    expect(run.result).toBe('gaveUp');
  });
});

describe('her drive mode', () => {
  it('passes the controls and the nose lift on, and stops when the run is over', () => {
    const d = Object.create(HerDrive.prototype);
    Object.assign(d, {
      p: { ...DEFAULT_COMPANION_PARAMS },
      quad: { position: { x: 0, z: 40 }, yaw: Math.PI, wheelie: 0 },
      showOff: { run: new ShowOffRun('skid', { ...P }, () => 0.9), you: () => you() },
      events: [],
      controls: { throttle: 0, brake: 0, steer: 0, reverse: false },
      stopped: null,
      probeTimer: 0,
      integral: 0,
      probe: () => Infinity,
    });
    d.stop = (r) => (d.stopped = r);
    d.driveShowOff(0.1, 0);
    expect(d.controls.throttle).toBeGreaterThan(0);
    expect(d.stopped).toBe(null);
    d.showOff.run.timer = P.runTimeout; // give her no time at all
    d.driveShowOff(0.1, 0);
    expect(d.stopped).toBe('bored');
  });
});

describe('deciding to', () => {
  it('only a girl with a chance for it picks it, and only when you are near enough', () => {
    const base = { boredMountChance: 0, boredStartChance: 0, boredDriveChance: 0, boredWhim: 0, boredShowOffChance: 1 };
    expect(pickBoredChoice(base, { can: { showOff: true } }, () => 0.5)).toBe('showOff');
    expect(pickBoredChoice(base, { can: { showOff: false } }, () => 0.5)).toBe('wander');
    expect(pickBoredChoice({ ...base, boredShowOffChance: 0 }, { can: { showOff: true } }, () => 0.5)).toBe('wander');
  });

  it('has lines for each moment, in neither em dashes nor "he", "she" or "they" about you', () => {
    for (const k of SHOWOFF_LINE_KEYS) {
      expect(AMY_SHOWOFF_LINES[k].lines.length, k).toBeGreaterThan(0);
      expect(JESS_SHOWOFF_LINES[k].length, k).toBeGreaterThan(0);
      for (const l of [...AMY_SHOWOFF_LINES[k].lines, ...JESS_SHOWOFF_LINES[k]]) expect(l, l).not.toMatch(/—|–|\b(he|she|they)\b/i);
    }
  });
});
