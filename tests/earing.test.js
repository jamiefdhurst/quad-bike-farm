import { describe, it, expect } from 'vitest';
import { Hearing, soundOf, DEFAULT_EAR_PARAMS as P } from '../src/npc/earing.js';
import { AMY_QUAD_LINES } from '../src/npc/quadLines.js';
import { quadKey } from '../src/npc/quadNames.js';

const quad = (o = {}) => ({ id: 'blue', x: 60, z: 0, running: true, driver: 'jess', speed: 3, throttle: 0.3, temperature: 0.8, wear: 0.1, ...o });
const ctx = (q = {}, g = {}) => ({ girls: [{ id: 'amy', x: 0, z: 0, free: true, ...g }], quads: [quad(q)] });
const run = (h, c, seconds) => {
  const out = [];
  for (let t = 0; t < seconds; t += 0.5) out.push(...h.update(0.5, c));
  return out;
};

describe('placing a quad by ear', () => {
  it('works out how it sounds from its engine and speed', () => {
    expect(soundOf(quad({ speed: 10 }), P)).toBe('hard');
    expect(soundOf(quad({ throttle: 0.95 }), P)).toBe('hard');
    expect(soundOf(quad(), P)).toBe('steady');
    expect(soundOf(quad({ temperature: 0.2 }), P)).toBe('rough');
    expect(soundOf(quad({ wear: 0.6, speed: 10 }), P)).toBe('rough');
  });

  it('a free girl places her friend on a running quad she cannot see, once it has been going a few seconds', () => {
    const h = new Hearing({ ...P, chance: 1 }, () => 0);
    expect(h.update(1, ctx())).toEqual([]);
    const events = run(h, ctx(), 10);
    expect(events[0]).toEqual({ girl: 'amy', spec: 'blue', driver: 'jess', sound: 'steady' });
  });

  it('not when she can see it, when it is too far, when it is you, or when she is busy', () => {
    const h = () => new Hearing({ ...P, chance: 1 }, () => 0);
    expect(run(h(), ctx({ x: 10 }), 10)).toEqual([]);
    expect(run(h(), ctx({ x: 400 }), 10)).toEqual([]);
    expect(run(h(), ctx({ driver: 'you' }), 10)).toEqual([]);
    expect(run(h(), ctx({}, { free: false }), 10)).toEqual([]);
    expect(run(h(), ctx({ running: false }), 10)).toEqual([]);
    expect(run(h(), ctx({ driver: 'amy' }), 10)).toEqual([]); // her own
  });

  it('keeps quiet for a while afterwards', () => {
    const h = new Hearing({ ...P, chance: 1 }, () => 0);
    expect(run(h, ctx(), 10).length).toBe(1);
    expect(run(h, ctx(), P.gap - 15)).toEqual([]);
  });

  it('every sound has a line for it', () => {
    for (const s of ['hard', 'rough', 'steady']) expect(AMY_QUAD_LINES[quadKey(`ear${s[0].toUpperCase()}${s.slice(1)}`, 'blue')]).toBeTruthy();
  });
});
