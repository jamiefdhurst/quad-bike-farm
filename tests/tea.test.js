import { describe, it, expect } from 'vitest';
import { Tea, DEFAULT_TEA_PARAMS as P } from '../src/npc/tea.js';
import { AMY_TEA_LINES, JESS_TEA_LINES } from '../src/npc/teaLines.js';

const girl = (id, o = {}) => ({ id, free: true, x: 0, z: 0, ...o });
const quad = (id, o = {}) => ({ id, x: 5, z: 0, speed: 0, rider: false, driver: null, tipped: false, hasRack: true, ...o });
const ctx = (o = {}) => ({ girls: [girl('amy')], quads: [quad('farm300')], ...o });
const make = (params = {}, random = () => 0) => new Tea({ ...P, startAfter: 0, ...params }, random);
/** She takes the first rack she's offered, as the chooser would. */
const put = (t, c = ctx()) => t.take(t.offers(c)[0]);

describe('tea on the rack', () => {
  it('offers a free girl a parked quad with a rack near her, once the game has been going a while; taking it sends her', () => {
    expect(make({ startAfter: 100 }).offers(ctx())).toEqual([]);
    const t = make();
    expect(t.offers(ctx())).toEqual([{ key: 'tea', girl: 'amy', spec: 'farm300', weight: P.weight }]);
    expect(put(t)).toEqual({ type: 'place', girl: 'amy', spec: 'farm300' });
  });

  it('never sends her on its own, except when the debug panel forces one', () => {
    expect(make().update(1, ctx())).toEqual([]);
    const t = make();
    t.forced = true;
    expect(t.update(1, ctx())).toEqual([{ type: 'place', girl: 'amy', spec: 'farm300' }]);
  });

  it('offers no quad with no rack, one that is far, ridden or moving, nor to a busy girl', () => {
    for (const q of [quad('farm300', { hasRack: false }), quad('farm300', { x: 100 }), quad('farm300', { rider: true }), quad('farm300', { driver: 'jess' }), quad('farm300', { speed: 2 })]) {
      expect(make().offers(ctx({ quads: [q] }))).toEqual([]);
    }
    expect(make().offers(ctx({ girls: [girl('amy', { free: false })] }))).toEqual([]);
  });

  it('only one at a time each, and two girls do not use the same quad', () => {
    const t = make();
    const c = ctx({ girls: [girl('amy'), girl('jess')], quads: [quad('farm300')] });
    put(t, c);
    expect(t.offers(c)).toEqual([]); // amy is on her way; jess has no quad left
    t.placed('amy', 'farm300');
    expect(t.offers(c)).toEqual([]);
  });

  it('the mug falls off when the quad moves off, tells who by, and its owner is not left with one', () => {
    const t = make();
    put(t);
    t.placed('amy', 'farm300');
    expect(t.update(1, ctx({ quads: [quad('farm300', { speed: 1 })] }))).toEqual([]); // creeping is fine
    expect(t.update(1, ctx({ quads: [quad('farm300', { speed: 4, rider: true })] }))).toEqual([{ type: 'fall', girl: 'amy', spec: 'farm300', by: 'you' }]);
    expect(t.mugOf('amy')).toBeNull();
    const u = make();
    put(u);
    u.placed('amy', 'farm300');
    expect(u.update(1, ctx({ quads: [quad('farm300', { speed: 4, driver: 'jess' })] }))[0]).toMatchObject({ type: 'fall', by: 'jess' });
    const v = make();
    put(v);
    v.placed('amy', 'farm300');
    expect(v.update(1, ctx({ quads: [quad('farm300', { tipped: true })] }))[0].type).toBe('fall');
  });

  it('left alone she comes back for it after a minute or two, then waits a while before the next', () => {
    const t = make({ leaveMin: 100, leaveMax: 100, cooldown: 50 });
    put(t);
    t.placed('amy', 'farm300');
    let events = [];
    for (let i = 0; i < 99; i++) events.push(...t.update(1, ctx()));
    expect(events).toEqual([]);
    expect(t.update(2, ctx())).toEqual([{ type: 'collect', girl: 'amy', spec: 'farm300' }]);
    t.collected('amy');
    t.update(10, ctx());
    expect(t.offers(ctx())).toEqual([]); // cooldown
    t.update(60, ctx());
    expect(t.offers(ctx())).toHaveLength(1);
  });

  it('does not go for it while somebody is on the quad, and a job she never got to is forgotten', () => {
    const t = make({ leaveMin: 1, leaveMax: 1, placeTimeout: 10 });
    put(t);
    t.placed('amy', 'farm300');
    expect(t.update(5, ctx({ quads: [quad('farm300', { rider: true })] })).some((e) => e.type === 'collect')).toBe(false);
    const u = make({ placeTimeout: 10 });
    put(u);
    expect(u.update(20, ctx({ girls: [girl('amy', { free: false })] }))).toEqual([]);
    expect(u.pending.amy).toBeUndefined();
  });

  it('a mug the shake walks off is lost like one driven off with, but nobody gets the blame', () => {
    const t = make();
    put(t);
    t.placed('amy', 'farm300');
    expect(t.shaken('amy')).toEqual({ type: 'fall', girl: 'amy', spec: 'farm300', by: null, shaken: true });
    expect(t.mugOf('amy')).toBeNull();
    expect(t.shaken('amy')).toBeNull();
    expect(t.offers(ctx())).toEqual([]); // her cooldown
  });

  it('has lines for putting one down, collecting it and losing it', () => {
    for (const k of ['teaPlace', 'teaCollect', 'teaFell', 'teaShaken']) {
      expect(AMY_TEA_LINES[k].lines.length).toBeGreaterThan(0);
      expect(JESS_TEA_LINES[k].length).toBeGreaterThan(0);
    }
  });
});

describe('how long the tea has stood', () => {
  it('counts the seconds from the mug going on the rack, and is null when she has none out', () => {
    const t = make();
    expect(t.ageOf('amy')).toBeNull();
    t.placed('amy', 'farm300');
    t.update(30, ctx());
    expect(t.ageOf('amy')).toBeCloseTo(30);
    t.collected('amy');
    expect(t.ageOf('amy')).toBeNull();
  });
});
