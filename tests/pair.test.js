import { describe, it, expect } from 'vitest';
import { Pair, DEFAULT_PAIR_PARAMS as P, standBy, tagPoint, pairFacing, TAG_KINDS } from '../src/npc/pair.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';

const girl = (id, x, z, o = {}) => ({ id, x, z, heading: 0, free: true, settled: true, leaving: null, pairWeight: 1, tagWeight: 1, ...o });
const keys = (out) => out.map((o) => `${o.girl}:${o.key}`);

describe('The two as a pair', () => {
  it('offers each free girl going over to her friend stood about a little way off', () => {
    const pair = new Pair();
    const out = pair.offers({ fallenOut: false, girls: [girl('amy', 0, 0), girl('jess', 10, 0)] });
    expect(keys(out)).toEqual(['amy:pairUp', 'jess:pairUp']);
    for (const o of out) expect(OFFER_KINDS[o.key]).toBeTruthy();
  });

  it('does not offer it once they are together, too far apart, fallen out, or with her friend going somewhere', () => {
    const pair = new Pair();
    expect(pair.offers({ fallenOut: false, girls: [girl('amy', 0, 0), girl('jess', P.near - 0.5, 0)] })).toEqual([]);
    expect(pair.offers({ fallenOut: false, girls: [girl('amy', 0, 0), girl('jess', P.range + 5, 0)] })).toEqual([]);
    expect(pair.offers({ fallenOut: true, girls: [girl('amy', 0, 0), girl('jess', 10, 0)] })).toEqual([]);
    expect(keys(pair.offers({ fallenOut: false, girls: [girl('amy', 0, 0), girl('jess', 10, 0, { settled: false, free: false })] }))).toEqual([]);
  });

  it('never starts anything on its own: that is the chooser\'s', () => {
    const pair = new Pair();
    pair.update(100);
    expect(pair.update(1)).toBeUndefined();
  });

  it('waits a while after she went over before offering it again', () => {
    const pair = new Pair();
    const ctx = { fallenOut: false, girls: [girl('amy', 0, 0), girl('jess', 10, 0)] };
    const e = pair.take(pair.offers(ctx)[0]);
    expect(e).toMatchObject({ type: 'pairUp', girl: 'amy', friend: 'jess' });
    expect(keys(pair.offers(ctx))).toEqual(['jess:pairUp']);
    pair.update(P.cooldown + 1);
    expect(keys(pair.offers(ctx))).toEqual(['amy:pairUp', 'jess:pairUp']);
  });

  it('offers tagging along when her friend sets off nearby for a look round, a sit or a cup of tea, not for a drive', () => {
    const pair = new Pair();
    for (const kind of TAG_KINDS) {
      const out = pair.offers({ fallenOut: false, girls: [girl('amy', 0, 0), girl('jess', 3, 0, { free: false, settled: false, leaving: kind })] });
      expect(keys(out)).toEqual(['amy:tagAlong']);
    }
    expect(pair.offers({ fallenOut: false, girls: [girl('amy', 0, 0), girl('jess', 3, 0, { free: false, settled: false, leaving: 'drive' })] })).toEqual([]);
    expect(pair.offers({ fallenOut: false, girls: [girl('amy', 0, 0), girl('jess', P.tagNear + 2, 0, { free: false, settled: false, leaving: 'wander' })] })).toEqual([]);
  });

  it('weighs each by how keen that girl is', () => {
    const pair = new Pair();
    const out = pair.offers({ fallenOut: false, girls: [girl('amy', 0, 0, { pairWeight: 0.5 }), girl('jess', 10, 0, { pairWeight: 1.3 })] });
    expect(out.map((o) => o.weight)).toEqual([0.5, 1.3]);
  });

  it('stands her at talking distance from her friend, on her side, facing her', () => {
    const at = standBy({ x: 10, z: 0 }, { x: 0, z: 0 });
    expect(at.x).toBeCloseTo(P.talk);
    expect(at.z).toBeCloseTo(0);
    expect(at.facing).toBeCloseTo(-Math.PI / 2); // facing -x, back at her friend
  });

  it('tags her along a step behind her friend and to the side she was on', () => {
    const friend = { x: 0, z: 0, heading: 0 }; // walking towards +z; her left is +x
    const left = tagPoint(friend, 1);
    expect(left.z).toBeCloseTo(-P.tagBehind);
    expect(left.x).toBeCloseTo(P.tagSide);
    expect(new Pair().sideOf({ x: 2, z: -1 }, friend)).toBe(1);
    expect(new Pair().sideOf({ x: -2, z: -1 }, friend)).toBe(-1);
  });

  it('faces her friend, and turns a little towards you when you come up, never more than openMax', () => {
    const self = { x: 0, z: 0 };
    const friend = { x: 0, z: P.talk };
    expect(pairFacing(self, friend, null)).toBeCloseTo(0);
    expect(pairFacing(self, friend, { x: 30, z: 0 })).toBeCloseTo(0); // too far off to count
    const opened = pairFacing(self, friend, { x: 2, z: 0.7 });
    expect(opened).toBeGreaterThan(0.1);
    expect(opened).toBeLessThanOrEqual(P.openMax + 1e-9);
    // Her friend turns the other way, so the three face the middle.
    expect(pairFacing(friend, self, { x: 2, z: 0.7 })).toBeLessThan(Math.PI - 0.1);
  });
});
