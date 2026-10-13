import { describe, it, expect } from 'vitest';
import { GeneratorStart, DEFAULT_GENERATOR_START_PARAMS, GENERATOR_START_PARAM_RANGES } from '../src/npc/generatorStart.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';

const ctx = (over = {}) => ({
  set: { running: false, fuel: 2 },
  dark: 0.8,
  charging: false,
  at: { x: 0, z: 0 },
  girls: [
    { id: 'amy', free: true, x: 10, z: 0, weight: 1 },
    { id: 'jess', free: true, x: 20, z: 0, weight: 0.5 },
  ],
  ...over,
});

const ready = () => {
  const m = new GeneratorStart();
  m.update(m.p.startAfter + 1);
  return m;
};

describe('GeneratorStart', () => {
  it('has a range for every tunable and an offer kind', () => {
    expect(Object.keys(GENERATOR_START_PARAM_RANGES).sort()).toEqual(Object.keys(DEFAULT_GENERATOR_START_PARAMS).sort());
    expect(OFFER_KINDS.generatorStart).toBeTruthy();
  });

  it('offers nothing at the start of a game', () => {
    expect(new GeneratorStart().offers(ctx())).toEqual([]);
  });

  it('offers to both girls when the barn is dark and the set is off', () => {
    expect(ready().offers(ctx()).map((o) => o.girl)).toEqual(['amy', 'jess']);
  });

  it('wants it for the charger by day, but not for nothing', () => {
    expect(ready().offers(ctx({ dark: 0, charging: true }))).toHaveLength(2);
    expect(ready().offers(ctx({ dark: 0 }))).toEqual([]);
  });

  it('does not offer when it runs, is empty, or the girl is busy or far off or uninterested', () => {
    expect(ready().offers(ctx({ set: { running: true, fuel: 2 } }))).toEqual([]);
    expect(ready().offers(ctx({ set: { running: false, fuel: 0 } }))).toEqual([]);
    const c = ctx();
    c.girls[0].free = false;
    c.girls[1].weight = 0;
    expect(ready().offers(c)).toEqual([]);
    const far = ctx();
    far.girls[0].x = 500;
    expect(ready().offers(far).map((o) => o.girl)).toEqual(['jess']);
  });

  it('books a job, then rests after it', () => {
    const m = ready();
    const e = m.take(m.offers(ctx())[0]);
    expect(e).toEqual({ type: 'go', girl: 'amy' });
    expect(m.offers(ctx())).toEqual([]);
    m.finished();
    expect(m.offers(ctx())).toEqual([]);
    m.update(m.p.cooldown + 1);
    expect(m.offers(ctx()).length).toBeGreaterThan(0);
  });

  it('forgets a job that never got there', () => {
    const m = ready();
    m.take({ girl: 'amy' });
    m.update(m.p.jobTimeout + 1);
    expect(m.job).toBeNull();
  });

  it('can be forced for a free girl', () => {
    expect(new GeneratorStart().force(ctx(), 'jess')).toEqual({ type: 'go', girl: 'jess' });
    const c = ctx();
    c.girls[1].free = false;
    expect(new GeneratorStart().force(c, 'jess')).toBeNull();
  });
});
