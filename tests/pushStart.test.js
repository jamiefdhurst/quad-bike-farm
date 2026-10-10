import { describe, it, expect } from 'vitest';
import { PushStart, pushAccel, DEFAULT_PUSH_PARAMS as P } from '../src/npc/pushStart.js';

/** A stand-in vehicle that speeds up by whatever she pushes with. */
function vehicle() {
  return { forwardSpeed: 0, engine: { isRunning: false, ignitionOn: false, setIgnition(on) { this.ignitionOn = on; } } };
}

function run(push, q, seconds, { drag = 0 } = {}) {
  const events = [];
  for (let t = 0; t < seconds && !push.done; t += 1 / 60) {
    events.push(...push.update(1 / 60));
    q.forwardSpeed = Math.max(0, q.forwardSpeed + (push.accel - drag) / 60);
  }
  return events;
}

describe('pushAccel', () => {
  it('is gentler on a heavy vehicle, within limits', () => {
    expect(pushAccel(500, 250)).toBeGreaterThan(pushAccel(500, 1700));
    expect(pushAccel(500, 1700)).toBeGreaterThanOrEqual(P.minAccel);
    expect(pushAccel(500, 10)).toBe(P.maxAccel);
  });
});

describe('PushStart', () => {
  it('leans in first, then gets it rolling and shouts at a pace', () => {
    const q = vehicle();
    const push = new PushStart(q, 'jess', 260);
    const ev = run(push, q, 5);
    expect(ev[0]).toBe('start');
    expect(ev).toContain('now');
    expect(q.forwardSpeed).toBeGreaterThanOrEqual(P.shoutSpeed);
    expect(q.forwardSpeed).toBeLessThanOrEqual(P.topSpeed + 0.1);
  });
  it('shouts again if you do not drop the clutch', () => {
    const q = vehicle();
    const push = new PushStart(q, 'jess', 260);
    run(push, q, 9);
    expect(push.shouted).toBeGreaterThanOrEqual(2);
  });
  it('turns the key on once she starts pushing', () => {
    const q = vehicle();
    const push = new PushStart(q, 'jess', 260);
    run(push, q, 0.3);
    expect(q.engine.ignitionOn).toBe(false);
    run(push, q, 1);
    expect(q.engine.ignitionOn).toBe(true);
  });
  it('does not push before the delay', () => {
    const push = new PushStart(vehicle(), 'amy', 260);
    push.update(0.1);
    expect(push.accel).toBe(0);
  });
  it('lets go once it is running, and says so', () => {
    const q = vehicle();
    const push = new PushStart(q, 'jess', 260);
    run(push, q, 3);
    q.engine.isRunning = true;
    const ev = run(push, q, 3);
    expect(ev).toContain('caught');
    expect(push.result).toBe('running');
  });
  it('tires: Amy sooner than Jess', () => {
    const a = vehicle();
    const amy = new PushStart(a, 'amy', 260);
    const evA = run(amy, a, 60, { drag: 5 });
    expect(evA).toContain('tired');
    const j = vehicle();
    const jess = new PushStart(j, 'jess', 260);
    run(jess, j, 60, { drag: 5 });
    expect(amy.time).toBeLessThan(jess.time);
  });
  it('gives up after pushing it a long way', () => {
    const q = vehicle();
    q.forwardSpeed = 3;
    const push = new PushStart(q, 'jess', 260, { params: { ...P, maxDistance: 5 } });
    const ev = run(push, q, 10);
    expect(ev).toContain('tired');
  });
  it('stops when abandoned', () => {
    const push = new PushStart(vehicle(), 'jess', 260);
    push.update(1);
    push.abandon();
    expect(push.done).toBe(true);
    expect(push.update(1)).toEqual([]);
    expect(push.accel).toBe(0);
  });
  it('Amy pushes less hard than Jess', () => {
    expect(new PushStart(vehicle(), 'amy', 600).thrust).toBeLessThan(new PushStart(vehicle(), 'jess', 600).thrust);
  });
});
