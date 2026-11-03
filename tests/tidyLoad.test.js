import { describe, it, expect } from 'vitest';
import { TidyLoad, DEFAULT_TIDY_LOAD_PARAMS, TIDY_LOAD_PARAM_RANGES } from '../src/npc/tidyLoad.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';
import { DEFAULT_COMPANION_PARAMS } from '../src/npc/companionParams.js';
import { AMY_TIDY_LOAD_LINES, JESS_TIDY_LOAD_LINES } from '../src/npc/tidyLoadLines.js';

const ctx = (over = {}) => ({
  vehicles: [{ id: 'defender', x: 0, z: 0, free: true, loose: 1, loaded: 0, room: 2 }],
  girls: [
    { id: 'amy', free: true, x: 10, z: 0, weight: 1 },
    { id: 'jess', free: true, x: 20, z: 0, weight: 0.5 },
  ],
  ...over,
});

const ready = () => {
  const m = new TidyLoad();
  m.update(m.p.startAfter + 1);
  return m;
};

describe('TidyLoad', () => {
  it('has a range for every tunable, an offer kind, a weight for each girl and a line for both ways', () => {
    expect(Object.keys(TIDY_LOAD_PARAM_RANGES).sort()).toEqual(Object.keys(DEFAULT_TIDY_LOAD_PARAMS).sort());
    expect(OFFER_KINDS.tidyLoad).toBeTruthy();
    expect('tidyLoadWeight' in DEFAULT_COMPANION_PARAMS).toBe(true);
    for (const lines of [AMY_TIDY_LOAD_LINES, JESS_TIDY_LOAD_LINES]) expect(Object.keys(lines).sort()).toEqual(['tidyLoadIn', 'tidyLoadOut']);
  });

  it('offers nothing at the start of a game, or while resting after a go', () => {
    expect(new TidyLoad().offers(ctx())).toEqual([]);
    const m = ready();
    m.take(m.offers(ctx())[0]);
    m.finished();
    expect(m.offers(ctx())).toEqual([]);
    m.update(m.p.cooldown + 1);
    expect(m.offers(ctx()).length).toBeGreaterThan(0);
  });

  it('offers loading when something is lying near and there is room, unloading when the back has something in it', () => {
    const m = ready();
    expect(m.offers(ctx()).map((o) => o.mode)).toEqual(['load', 'load']);
    const both = ctx({ vehicles: [{ id: 'landy', x: 0, z: 0, free: true, loose: 0, loaded: 2, room: 4 }] });
    expect(m.offers(both).map((o) => o.mode)).toEqual(['unload', 'unload']);
    const full = ctx({ vehicles: [{ id: 'landy', x: 0, z: 0, free: true, loose: 3, loaded: 2, room: 0 }] });
    expect(m.offers(full).map((o) => o.mode)).toEqual(['unload', 'unload']);
  });

  it('offers nothing for a vehicle somebody is in, a girl who is busy or has no taste for it, or one too far off', () => {
    const m = ready();
    expect(m.offers(ctx({ vehicles: [{ id: 'landy', x: 0, z: 0, free: false, loose: 1, loaded: 1, room: 1 }] }))).toEqual([]);
    const c = ctx();
    c.girls[0].free = false;
    c.girls[1].weight = 0;
    expect(m.offers(c)).toEqual([]);
    const far = ctx();
    far.girls[0].x = m.p.range + 5;
    expect(m.offers(far).map((o) => o.girl)).toEqual(['jess']);
  });

  it('weighs loading and unloading by her keenness and the shares', () => {
    const m = ready();
    const [o] = m.offers(ctx());
    expect(o.weight).toBeCloseTo(m.p.loadShare);
  });

  it('is forced by the panel at the nearest vehicle, in the mode asked or the one possible, and not when busy', () => {
    const m = new TidyLoad();
    const c = ctx({ vehicles: [{ id: 'far', x: 50, z: 0, free: true, loose: 0, loaded: 1, room: 3 }, { id: 'near', x: 0, z: 0, free: true, loose: 1, loaded: 1, room: 3 }] });
    expect(m.force(c, 'amy')).toMatchObject({ vehicle: 'near', mode: 'load' });
    expect(m.force(c, 'jess')).toBeNull(); // she is booked
    m.finished();
    expect(m.force(c, 'amy', 'near', 'unload')).toMatchObject({ vehicle: 'near', mode: 'unload' });
    m.finished();
    expect(m.force(ctx({ vehicles: [] }), 'amy')).toBeNull();
  });

  it('forgets a job that has run out of time', () => {
    const m = ready();
    m.take(m.offers(ctx())[0]);
    expect(m.job).toBeTruthy();
    m.update(m.p.jobTimeout + 1);
    expect(m.job).toBeNull();
    expect(m.describe()).toMatch(/resting/);
  });
});
