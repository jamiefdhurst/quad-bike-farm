import { describe, it, expect } from 'vitest';
import { BackNap, DEFAULT_NAP_PARAMS as P } from '../src/npc/backNap.js';
import { AMY_NAP_LINES, JESS_NAP_LINES } from '../src/npc/napLines.js';

const smooth = (o = {}) => ({ onBack: true, riding: true, speed: 7, accel: 0, jolt: 0.5, shake: 0.3, sleepy: 0, prone: 1, ...o });
const run = (n, c, seconds, dt = 0.1) => {
  const events = [];
  for (let t = 0; t < seconds; t += dt) events.push(...n.update(dt, c));
  return events;
};

describe('asleep on the back', () => {
  it('drops off on a long smooth ride, her head going down as she does', () => {
    const n = new BackNap({ ...P });
    run(n, smooth(), P.dropSeconds * 0.6);
    expect(n.asleep).toBe(false);
    expect(n.depth).toBeGreaterThan(0);
    const events = run(n, smooth(), P.dropSeconds);
    expect(events).toContainEqual({ type: 'asleep' });
    run(n, smooth(), 5);
    expect(n.depth).toBe(1);
  });

  it('a sleepy girl, or one prone to it, goes sooner', () => {
    const time = (c) => {
      const n = new BackNap({ ...P });
      for (let t = 0; t < 1000; t += 0.1) if (n.update(0.1, c).some((e) => e.type === 'asleep')) return t;
      return Infinity;
    };
    expect(time(smooth({ sleepy: 1 }))).toBeLessThan(time(smooth()));
    expect(time(smooth({ prone: 1.5 }))).toBeLessThan(time(smooth({ prone: 0.7 })));
    expect(time(smooth({ prone: 0 }))).toBe(Infinity);
  });

  it('does not nod off if the ride is not smooth, steady and moving', () => {
    for (const c of [smooth({ accel: 2 }), smooth({ jolt: 5 }), smooth({ shake: 1.5 }), smooth({ speed: 1 }), smooth({ speed: 20 }), smooth({ riding: false })]) {
      const n = new BackNap({ ...P });
      run(n, c, P.dropSeconds * 3);
      expect(n.asleep).toBe(false);
      expect(n.drowse).toBe(0);
    }
  });

  it('a rough patch sets her back', () => {
    const n = new BackNap({ ...P });
    run(n, smooth(), P.dropSeconds * 0.6);
    const before = n.drowse;
    run(n, smooth({ jolt: 5 }), 5);
    expect(n.drowse).toBeLessThan(before);
  });

  it.each([
    ['a hard brake', { accel: -P.wakeBrake - 1 }, 'brake'],
    ['a pothole', { jolt: P.wakeJolt + 1 }, 'jolt'],
    ['a rough engine', { shake: P.wakeShake + 0.5 }, 'rough'],
  ])('%s wakes her with a start', (_, c, how) => {
    const n = new BackNap({ ...P });
    run(n, smooth(), P.dropSeconds * 2);
    expect(n.asleep).toBe(true);
    expect(run(n, smooth(c), 0.1)).toEqual([{ type: 'wake', how }]);
    expect(n.asleep).toBe(false);
    run(n, smooth(), 3);
    expect(n.depth).toBe(0);
  });

  it('the quad stopping wakes her gently, and she does not drop off again for a while', () => {
    const n = new BackNap({ ...P });
    run(n, smooth(), P.dropSeconds * 2);
    const events = run(n, smooth({ speed: 0, riding: false }), P.stopWake + 1);
    expect(events).toEqual([{ type: 'wake', how: 'stop' }]);
    run(n, smooth(), P.gap - 5);
    expect(n.asleep).toBe(false);
    expect(n.drowse).toBe(0);
    run(n, smooth(), P.dropSeconds * 2 + 10);
    expect(n.asleep).toBe(true);
  });

  it('getting off ends it without a fuss', () => {
    const n = new BackNap({ ...P });
    run(n, smooth(), P.dropSeconds * 2);
    expect(run(n, smooth({ onBack: false }), 2)).toEqual([]);
    expect(n.asleep).toBe(false);
  });

  it('can be told to drop off (the debug panel)', () => {
    const n = new BackNap({ ...P });
    n.force();
    expect(run(n, smooth(), 0.1)).toEqual([{ type: 'asleep' }]);
  });

  it('has lines for both ways of waking', () => {
    for (const k of ['napStart', 'napGentle']) {
      expect(AMY_NAP_LINES[k].lines.length).toBeGreaterThan(0);
      expect(JESS_NAP_LINES[k].length).toBeGreaterThan(0);
    }
  });
});
