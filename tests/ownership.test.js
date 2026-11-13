import { describe, it, expect } from 'vitest';
import { Ownership, DEFAULT_OWNERSHIP_PARAMS as P } from '../src/npc/ownership.js';

const make = (params = {}, random = () => 0) => {
  const o = new Ownership({ ...P, ...params }, random);
  o.assign({ amy: ['farm300', 'bruin'], jess: ['farm300', 'bruin', 'rb300'] });
  return o;
};
const girls = (o = {}) => [{ id: 'amy', x: 0, z: 0, free: true, ...o.amy }, { id: 'jess', x: 3, z: 0, free: true, ...o.jess }];
const quads = (o = {}) => [
  { id: 'farm300', x: 2, z: 0, user: null, ...o.farm300 },
  { id: 'bruin', x: 4, z: 0, user: null, ...o.bruin },
  { id: 'rb300', x: 6, z: 0, user: null, ...o.rb300 },
];
const ctx = (o = {}) => ({ you: { x: 0, z: 0, onFoot: true }, girls: girls(o.girls), quads: quads(o.quads) });

describe('whose quad', () => {
  it('gives each girl one of her own, never the same one', () => {
    for (let i = 0; i < 20; i++) {
      let n = 0;
      const o = new Ownership({ ...P }, () => (n = (n + 0.37) % 1));
      o.assign({ amy: ['farm300', 'bruin'], jess: ['farm300', 'bruin'] });
      expect(o.claims.amy).not.toBe(o.claims.jess);
      expect(o.ownerOf(o.claims.amy)).toBe('amy');
    }
  });

  it('a girl says which is hers once, when you are on foot beside her and it, after a while', () => {
    const o = make();
    expect(o.update(1, ctx())).toEqual([]); // too early
    const events = o.update(P.claimAfter, ctx());
    expect(events).toEqual([{ type: 'claim', girl: 'amy', spec: 'farm300' }, { type: 'claim', girl: 'jess', spec: 'bruin' }]);
    expect(o.update(1, ctx())).toEqual([]); // once
  });

  it('she does not say it while you are riding, or too far off', () => {
    const o = make();
    expect(o.update(P.claimAfter + 1, { ...ctx(), you: { x: 0, z: 0, onFoot: false } })).toEqual([]);
    expect(o.update(1, { ...ctx(), you: { x: 100, z: 0, onFoot: true } })).toEqual([]);
  });

  const noClaims = { claimAfter: 1e9 };

  it('the owner objects when somebody else has been on her quad a moment, and not again for a while', () => {
    const o = make(noClaims);
    expect(o.update(0.5, ctx({ quads: { farm300: { user: 'you' } } }))).toEqual([]);
    const events = o.update(P.upsetDelay, ctx({ quads: { farm300: { user: 'you' } } }));
    expect(events).toEqual([{ type: 'upset', girl: 'amy', spec: 'farm300', by: 'you' }]);
    expect(o.update(5, ctx({ quads: { farm300: { user: 'you' } } }))).toEqual([]); // cooldown
    expect(o.update(P.upsetCooldown, ctx({ quads: { farm300: { user: 'you' } } })).length).toBe(1);
  });

  it('nobody objects to the owner on her own quad, or to a quad nobody owns, or from out of sight', () => {
    const o = make(noClaims);
    expect(o.update(10, ctx({ quads: { farm300: { user: 'amy' }, rb300: { user: 'you' } } }))).toEqual([]);
    expect(o.update(10, ctx({ girls: { amy: { x: 500 } }, quads: { farm300: { user: 'jess' } } }))).toEqual([]);
  });

  it('Jess borrows Amy\'s quad when it is free and the dice allow; Amy never borrows Jess\'s', () => {
    const o = make({}, () => 0);
    expect(o.borrowPick('jess', ['farm300', 'rb300'])).toBe('farm300');
    expect(o.borrowPick('jess', ['rb300'])).toBeNull(); // Amy's not on offer
    expect(o.borrowPick('amy', ['bruin'])).toBeNull();
    const never = make({ jessBorrowChance: 0 });
    expect(never.borrowPick('jess', ['farm300'])).toBeNull();
  });
});
