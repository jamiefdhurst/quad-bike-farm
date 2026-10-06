import { describe, it, expect } from 'vitest';
import { HeadStart, DEFAULT_HEADSTART_PARAMS as P } from '../src/npc/headStart.js';
import { AMY_HEADSTART_LINES, JESS_HEADSTART_LINES } from '../src/npc/headStartLines.js';
import { VOICE_LINES } from '../src/npc/voiceLines.js';

const girl = (id, o = {}) => ({ id, x: 2, z: 0, free: true, mood: 'even', own: null, ...o });
const quad = (id, o = {}) => ({ id, x: 0, z: 0, startable: true, ...o });
const make = (params = {}) => {
  const h = new HeadStart({ ...P, startAfter: 0, ...params }, () => 0);
  h.ride('red', 100);
  return h;
};
/** Walks you at the quad from 20 m out, returning every event on the way. */
const approach = (h, ctx, { from = 20, speed = 2 } = {}) => {
  const out = [];
  for (let x = from; x > 6; x -= speed * 0.1) out.push(...h.update(0.1, { cold: true, you: { x, z: 0, onFoot: true }, girls: [], quads: [], ...ctx }));
  return out;
};

describe('a head start on your usual quad', () => {
  it('your usual quad is the one you ride most, once you have ridden it a while', () => {
    const h = new HeadStart({ ...P }, () => 0);
    expect(h.usual()).toBe(null);
    h.ride('red', 10);
    expect(h.usual()).toBe(null);
    h.ride('blue', 40);
    h.ride('red', 100);
    expect(h.usual()).toBe('red');
  });

  it('the favoured girl goes to start it when you walk at it on a cold day', () => {
    const events = approach(make(), { girls: [girl('amy', { mood: 'favoured' })], quads: [quad('red')] });
    expect(events).toEqual([{ type: 'warmFor', girl: 'amy', spec: 'red' }]);
  });

  it('once per approach, and again on a fresh one', () => {
    const h = make({ cooldown: 0 });
    const ctx = { girls: [girl('amy', { mood: 'favoured' })], quads: [quad('red')] };
    expect(approach(h, ctx)).toHaveLength(1);
    for (let i = 0; i < 40; i++) h.update(0.1, { cold: true, you: { x: 60, z: 0, onFoot: true }, girls: [], quads: [quad('red')] });
    expect(approach(h, ctx)).toHaveLength(1);
  });

  it('the neglected girl starts her own quad instead, and not yours', () => {
    const events = approach(make(), { girls: [girl('jess', { mood: 'neglected', own: 'blue', x: 1, z: 3 })], quads: [quad('red'), quad('blue', { x: 1, z: 4 })] });
    expect(events).toEqual([{ type: 'snub', girl: 'jess', spec: 'blue', yours: 'red' }]);
  });

  it('nothing when they are even with you, on a warm day, or before the start', () => {
    const ctx = { girls: [girl('amy')], quads: [quad('red')] };
    expect(approach(make(), ctx)).toEqual([]);
    const fav = { girls: [girl('amy', { mood: 'favoured' })], quads: [quad('red')] };
    expect(approach(make(), { ...fav, cold: false })).toEqual([]);
    expect(approach(make({ startAfter: 999 }), fav)).toEqual([]);
  });

  it('nothing if you are riding, not heading for it, already there, or it is running or taken', () => {
    const fav = { girls: [girl('amy', { mood: 'favoured' })], quads: [quad('red')] };
    expect(approach(make(), { ...fav, you: { x: 10, z: 0, onFoot: false } })).toEqual([]);
    expect(approach(make(), fav, { speed: 0.2 })).toEqual([]);
    expect(approach(make({ minRange: 9 }), fav, { from: 8 })).toEqual([]);
    expect(approach(make(), { ...fav, quads: [quad('red', { startable: false })] })).toEqual([]);
  });

  it('she must be free, close enough and able to beat you to it', () => {
    const q = [quad('red')];
    expect(approach(make(), { girls: [girl('amy', { mood: 'favoured', free: false })], quads: q })).toEqual([]);
    expect(approach(make(), { girls: [girl('amy', { mood: 'favoured', x: 80 })], quads: q })).toEqual([]);
    expect(approach(make({ girlRange: 200 }), { girls: [girl('amy', { mood: 'favoured', x: 30 })], quads: q })).toEqual([]);
  });

  it('a neglected girl whose own quad is your usual one, or is not free, does nothing', () => {
    expect(approach(make(), { girls: [girl('jess', { mood: 'neglected', own: 'red' })], quads: [quad('red')] })).toEqual([]);
    expect(approach(make(), { girls: [girl('jess', { mood: 'neglected', own: 'blue' })], quads: [quad('red'), quad('blue', { startable: false })] })).toEqual([]);
  });

  it('the same girl waits out her cooldown', () => {
    const h = make({ cooldown: 1000 });
    const ctx = { girls: [girl('amy', { mood: 'favoured' })], quads: [quad('red')] };
    expect(approach(h, ctx)).toHaveLength(1);
    for (let i = 0; i < 40; i++) h.update(0.1, { cold: true, you: { x: 60, z: 0, onFoot: true }, girls: [], quads: [quad('red')] });
    expect(approach(h, ctx)).toEqual([]);
  });

  it('both girls have lines for both situations, and they are in the main set', () => {
    for (const k of ['headStartGo', 'snubGo']) {
      expect(AMY_HEADSTART_LINES[k].lines.length, k).toBeGreaterThan(0);
      expect(JESS_HEADSTART_LINES[k].length, k).toBeGreaterThan(0);
      expect(VOICE_LINES[k], k).toBeDefined();
    }
  });
});
