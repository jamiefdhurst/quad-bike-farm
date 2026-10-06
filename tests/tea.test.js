import { describe, it, expect } from 'vitest';
import { Tea, DEFAULT_TEA_PARAMS as P } from '../src/npc/tea.js';
import { AMY_TEA_LINES, JESS_TEA_LINES } from '../src/npc/teaLines.js';

const girl = (id, o = {}) => ({ id, free: true, x: 0, z: 0, ...o });
const quad = (id, o = {}) => ({ id, x: 5, z: 0, speed: 0, rider: false, driver: null, tipped: false, hasRack: true, ...o });
const ctx = (o = {}) => ({ girls: [girl('amy')], quads: [quad('red')], ...o });
const make = (params = {}, random = () => 0) => new Tea({ ...P, startAfter: 0, chance: 1, ...params }, random);

describe('tea on the rack', () => {
  it('a free girl sends herself to a parked quad with a rack near her, once she has been there a while', () => {
    expect(make({ startAfter: 100 }).update(1, ctx())).toEqual([]);
    expect(make().update(1, ctx())).toEqual([{ type: 'place', girl: 'amy', spec: 'red' }]);
  });

  it('not to a quad with no rack, one that is far, ridden or moving, or when she is busy or the dice say no', () => {
    for (const q of [quad('red', { hasRack: false }), quad('red', { x: 100 }), quad('red', { rider: true }), quad('red', { driver: 'jess' }), quad('red', { speed: 2 })]) {
      expect(make().update(1, ctx({ quads: [q] }))).toEqual([]);
    }
    expect(make().update(1, ctx({ girls: [girl('amy', { free: false })] }))).toEqual([]);
    expect(make({ chance: 0.5 }, () => 0.99).update(1, ctx())).toEqual([]);
  });

  it('only one at a time each, and two girls do not use the same quad', () => {
    const t = make();
    const c = ctx({ girls: [girl('amy'), girl('jess')], quads: [quad('red')] });
    expect(t.update(1, c).length).toBe(1);
    expect(t.update(1, c)).toEqual([]); // amy is on her way; jess has no quad left
    t.placed('amy', 'red');
    expect(t.update(1, c)).toEqual([]);
  });

  it('the mug falls off when the quad moves off, tells who by, and its owner is not left with one', () => {
    const t = make();
    t.update(1, ctx());
    t.placed('amy', 'red');
    expect(t.update(1, ctx({ quads: [quad('red', { speed: 1 })] }))).toEqual([]); // creeping is fine
    expect(t.update(1, ctx({ quads: [quad('red', { speed: 4, rider: true })] }))).toEqual([{ type: 'fall', girl: 'amy', spec: 'red', by: 'you' }]);
    expect(t.mugOf('amy')).toBeNull();
    const u = make();
    u.update(1, ctx());
    u.placed('amy', 'red');
    expect(u.update(1, ctx({ quads: [quad('red', { speed: 4, driver: 'jess' })] }))[0]).toMatchObject({ type: 'fall', by: 'jess' });
    const v = make();
    v.update(1, ctx());
    v.placed('amy', 'red');
    expect(v.update(1, ctx({ quads: [quad('red', { tipped: true })] }))[0].type).toBe('fall');
  });

  it('left alone she comes back for it after a minute or two, then waits a while before the next', () => {
    const t = make({ leaveMin: 100, leaveMax: 100, cooldown: 50 });
    t.update(1, ctx());
    t.placed('amy', 'red');
    let events = [];
    for (let i = 0; i < 99; i++) events.push(...t.update(1, ctx()));
    expect(events).toEqual([]);
    expect(t.update(2, ctx())).toEqual([{ type: 'collect', girl: 'amy', spec: 'red' }]);
    t.collected('amy');
    expect(t.update(10, ctx())).toEqual([]); // cooldown
    expect(t.update(60, ctx())[0]?.type).toBe('place');
  });

  it('does not go for it while somebody is on the quad, and a job she never got to is forgotten', () => {
    const t = make({ leaveMin: 1, leaveMax: 1, placeTimeout: 10 });
    t.update(1, ctx());
    t.placed('amy', 'red');
    expect(t.update(5, ctx({ quads: [quad('red', { rider: true })] })).some((e) => e.type === 'collect')).toBe(false);
    const u = make({ placeTimeout: 10 });
    u.update(1, ctx());
    expect(u.update(20, ctx({ girls: [girl('amy', { free: false })] }))).toEqual([]);
    expect(u.pending.amy).toBeUndefined();
  });

  it('has lines for putting one down, collecting it and losing it', () => {
    for (const k of ['teaPlace', 'teaCollect', 'teaFell']) {
      expect(AMY_TEA_LINES[k].lines.length).toBeGreaterThan(0);
      expect(JESS_TEA_LINES[k].length).toBeGreaterThan(0);
    }
  });
});
