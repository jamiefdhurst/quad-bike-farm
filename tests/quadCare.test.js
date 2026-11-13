import { describe, it, expect } from 'vitest';
import { QuadCare, DEFAULT_CARE_PARAMS as P } from '../src/npc/quadCare.js';

const make = (params = {}) => new QuadCare(['amy', 'jess'], { ...P, ...params });
const ctx = (q = {}, girls = {}) => ({
  girls: [{ id: 'amy', x: 0, z: 0, ...girls.amy }],
  owners: { farm300: 'amy' },
  quads: [{ id: 'farm300', x: 3, z: 0, user: 'jess', running: true, throttle: 0.4, revs: 0.5, fuel: 0.5, ...q }],
});
const run = (c, seconds, x) => {
  const out = [];
  for (let i = 0; i < seconds * 2; i++) out.push(...c.update(0.5, x));
  return out;
};

describe('quad care', () => {
  it('says nothing about a quad being driven gently on a full tank', () => {
    expect(run(make(), 60, ctx())).toEqual([]);
  });

  it('complains once she sees her quad used on almost no fuel', () => {
    const c = make();
    const events = run(c, 10, ctx({ fuel: 0.02 }));
    expect(events).toEqual([{ type: 'dry', girl: 'amy', spec: 'farm300', by: 'jess' }]);
    expect(c.care.amy).toBeCloseTo(P.startCare - P.careLostDry);
  });

  it('complains about thrashing after a run of flat out, not a short burst', () => {
    expect(run(make(), 4, ctx({ throttle: 1 }))).toEqual([]);
    const events = run(make(), 10, ctx({ throttle: 1 }));
    expect(events.map((e) => e.type)).toEqual(['thrashed']);
  });

  it('lets easing off between bursts wear the count down', () => {
    const c = make();
    for (let i = 0; i < 5; i++) {
      expect(run(c, 4, ctx({ throttle: 1 }))).toEqual([]);
      run(c, 4, ctx({ throttle: 0.2 }));
    }
  });

  it('does not mind her own driving, a parked quad, distance, or a girl who does not care', () => {
    expect(run(make(), 20, ctx({ throttle: 1, user: 'amy' }))).toEqual([]);
    expect(run(make(), 20, ctx({ fuel: 0, running: false }))).toEqual([]);
    expect(run(make(), 20, ctx({ throttle: 1 }, { amy: { x: 500 } }))).toEqual([]);
    const c = make();
    c.care.amy = 0.05;
    expect(run(c, 20, ctx({ throttle: 1 }))).toEqual([]);
  });

  it('keeps to a cooldown between complaints', () => {
    const c = make();
    expect(run(c, 40, ctx({ throttle: 1 })).length).toBe(1);
    expect(run(c, 100, ctx({ throttle: 1 })).length).toBe(1);
  });

  it('is proud after a wash, then not again for a while, and cares more for it', () => {
    const c = make();
    let proud = 0;
    for (let i = 0; i < 20 * 4; i++) if (c.wash('amy', 0.25)) proud++;
    expect(proud).toBe(1);
    expect(c.care.amy).toBeGreaterThan(P.startCare);
  });

  it('turns care into favour: washing pays more and thrashing costs more the more she cares', () => {
    const c = make();
    c.care.amy = 1;
    c.care.jess = 0.2;
    expect(c.washFavour('amy', 1)).toBeGreaterThan(c.washFavour('jess', 1));
    expect(c.thrashFavour('amy')).toBeLessThan(c.thrashFavour('jess'));
    expect(c.thrashFavour('jess')).toBeLessThan(0);
  });

  it('is kept between days', () => {
    const a = make();
    a.care.amy = 0.9;
    const b = make();
    b.restore(a.capture());
    expect(b.care.amy).toBe(0.9);
    b.restore(undefined);
    expect(b.care.amy).toBe(0.9);
  });
});
