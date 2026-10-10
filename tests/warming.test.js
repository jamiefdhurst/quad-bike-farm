import { describe, it, expect } from 'vitest';
import { Warming, isChilly, DEFAULT_WARMING_PARAMS as P } from '../src/npc/warming.js';
import { AMY_WARMING_LINES, JESS_WARMING_LINES } from '../src/npc/warmingLines.js';
import { VOICE_LINES } from '../src/npc/voiceLines.js';

const cold = { warmth: 0.2, rain: 0 };
const girl = (id, o = {}) => ({ id, x: 0, z: 0, free: true, warmSpec: null, ...o });
const quad = (o = {}) => ({ id: 'red', x: 5, z: 0, idling: true, ...o });
const make = (params = {}, random = () => 0) => new Warming({ ...P, startAfter: 0, ...params }, random);
const ctx = (o = {}) => ({ weather: cold, girls: [girl('amy')], quads: [quad()], ...o });

describe('warming their hands', () => {
  it('a cold day is a low warmth or rain, a warm one neither', () => {
    expect(isChilly({ warmth: 0.3, rain: 0 }, P)).toBe(true);
    expect(isChilly({ warmth: 0.9, rain: 0.5 }, P)).toBe(true);
    expect(isChilly({ warmth: 0.9, rain: 0 }, P)).toBe(false);
  });

  it('offers a free girl a quad idling near her on a cold day, and taking it sends her', () => {
    const w = make();
    expect(w.offers(ctx())).toEqual([{ key: 'warmHands', girl: 'amy', spec: 'red', join: false, weight: P.warmWeight }]);
    expect(w.take(w.offers(ctx())[0])).toEqual({ type: 'go', girl: 'amy', spec: 'red', join: false });
  });

  it('never starts her going on its own: that is the chooser\'s', () => {
    expect(make().update(0.1, ctx())).toEqual([]);
  });

  it('offers nothing on a warm day, for a quad that is off or too far, to a busy girl, or before the start', () => {
    expect(make().offers(ctx({ weather: { warmth: 0.9, rain: 0 } }))).toEqual([]);
    expect(make().offers(ctx({ quads: [quad({ idling: false })] }))).toEqual([]);
    expect(make().offers(ctx({ quads: [quad({ x: 100 })] }))).toEqual([]);
    expect(make().offers(ctx({ girls: [girl('amy', { free: false })] }))).toEqual([]);
    expect(new Warming({ ...P }, () => 0).offers(ctx())).toEqual([]);
  });

  it('offers joining her friend, weighted for it, and no more than maxAtQuad round one engine', () => {
    const w = make({ maxAtQuad: 2 });
    const c = ctx({ girls: [girl('amy', { warmSpec: 'red' }), girl('jess')] });
    expect(w.update(0.1, c)).toContainEqual({ type: 'warm', girl: 'amy', spec: 'red' });
    expect(w.offers(c)).toEqual([{ key: 'warmHandsJoin', girl: 'jess', spec: 'red', join: true, weight: P.joinWeight }]);
    const one = make({ maxAtQuad: 1 });
    expect(one.offers(c)).toEqual([]);
  });

  it('she stays a while, then leaves; switched off, she leaves and says so', () => {
    const w = make({ warmForMin: 10, warmForMax: 10 });
    const c = ctx({ girls: [girl('amy', { warmSpec: 'red' })] });
    w.update(0.1, c);
    expect(w.update(5, c)).toEqual([]);
    expect(w.update(6, c)).toEqual([{ type: 'leave', girl: 'amy', off: false }]);
    const w2 = make();
    w2.update(0.1, c);
    expect(w2.update(1, { ...c, quads: [quad({ idling: false })] })).toEqual([{ type: 'leave', girl: 'amy', off: true }]);
  });

  it('having left she does not go straight back', () => {
    const w = make({ warmForMin: 1, warmForMax: 1 });
    const warming = ctx({ girls: [girl('amy', { warmSpec: 'red' })] });
    w.update(0.1, warming);
    w.update(2, warming);
    w.update(0.1, ctx());
    expect(w.offers(ctx())).toEqual([]);
  });

  it('has lines for going, warming, joining and being switched off', () => {
    for (const k of ['warmGo', 'warmHands', 'warmJoin', 'warmOff']) {
      expect(AMY_WARMING_LINES[k].lines.length, k).toBeGreaterThan(0);
      expect(JESS_WARMING_LINES[k].length, k).toBeGreaterThan(0);
      expect(VOICE_LINES[k]).toBeTruthy();
    }
  });
});
