import { describe, it, expect } from 'vitest';
import { ThrottleGrab, DEFAULT_GRAB_PARAMS as P } from '../src/npc/throttleGrab.js';
import { AMY_THROTTLE_LINES, JESS_THROTTLE_LINES } from '../src/npc/throttleLines.js';

const make = (params = {}, random = () => 0) => new ThrottleGrab({ ...P, firstAfter: 0, ...params }, random);
const ctx = (o = {}) => ({ riding: true, speed: 5, girls: [{ id: 'jess', onBack: true }], ...o });
const step = (g, c, seconds, dt = 0.05) => {
  const events = [];
  const throttle = [];
  for (let t = 0; t < seconds; t += dt) {
    events.push(...g.update(dt, c));
    throttle.push(g.throttle);
  }
  return { events, throttle };
};

describe('hand on the throttle', () => {
  it('Jess reaches round, opens the throttle for a moment, lets go and leaves it a while', () => {
    const g = make({ holdMin: 1, holdMax: 1 });
    const { events, throttle } = step(g, ctx(), 5);
    expect(events[0]).toEqual({ type: 'start', girl: 'jess' });
    expect(events.find((e) => e.type === 'end')).toEqual({ type: 'end', girl: 'jess', count: 1 });
    expect(Math.max(...throttle)).toBeCloseTo(P.throttle, 2);
    expect(g.throttle).toBe(0);
    expect(g.reach).toBe(0);
    // Not again until the gap is up.
    expect(step(g, ctx(), P.gap - 6).events).toEqual([]);
  });

  it('her hand gets to the grip before the throttle opens', () => {
    const g = make();
    g.update(0.05, ctx());
    g.update(0.05, ctx());
    expect(g.reach).toBeGreaterThan(0);
    expect(g.reach).toBeLessThan(1);
    expect(g.throttle).toBe(0);
  });

  it('only while you are riding along at a sensible speed with her on the back', () => {
    for (const c of [ctx({ riding: false }), ctx({ speed: 0.5 }), ctx({ speed: 20 }), ctx({ girls: [{ id: 'jess', onBack: false }] })]) {
      expect(step(make(), c, 5).events).toEqual([]);
    }
    const early = new ThrottleGrab({ ...P, firstAfter: 10 }, () => 0);
    expect(step(early, ctx(), 8).events).toEqual([]);
  });

  it('Amy does it once and then not again', () => {
    const g = make({ amyBoldness: 1, gap: 0 }, () => 0);
    const c = ctx({ girls: [{ id: 'amy', onBack: true }] });
    const first = step(g, c, 10).events;
    expect(first.filter((e) => e.type === 'start').length).toBe(1);
    expect(step(g, c, 30).events).toEqual([]);
  });

  it('lets go at once if she gets off or you stop riding', () => {
    const g = make();
    step(g, ctx(), 2);
    expect(g.grab).not.toBeNull();
    const events = g.update(0.05, ctx({ girls: [{ id: 'jess', onBack: false }] }));
    expect(events[0].type).toBe('end');
    expect(g.throttle).toBe(0);
  });

  it('has an apology and a cheer', () => {
    expect(AMY_THROTTLE_LINES.grabSorry.lines.length).toBeGreaterThan(0);
    expect(JESS_THROTTLE_LINES.grabGo.length).toBeGreaterThan(0);
  });
});

describe('forcing one from the debug panel', () => {
  it('the named girl does it at the first chance, ignoring the wait and the dice, but not when she is off the back', () => {
    const g = new ThrottleGrab({ ...P }, () => 0.99);
    g.forced = 'amy';
    expect(g.update(0.05, ctx())).toEqual([]); // only Jess is on the back
    expect(g.forced).toBe('amy');
    const events = g.update(0.05, ctx({ girls: [{ id: 'amy', onBack: true }] }));
    expect(events).toEqual([{ type: 'start', girl: 'amy' }]);
    expect(g.forced).toBeNull();
  });
});
