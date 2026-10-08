import { describe, it, expect } from 'vitest';
import { CrankHandle, DEFAULT_CRANK_PARAMS } from '../src/vehicle/crankHandle.js';
import { createRandom } from '../src/core/random.js';

describe('the starting handle', () => {
  it('starts held the natural, wrong way, with the thumb round the handle', () => {
    expect(new CrankHandle().grip).toBe('round');
  });

  it('kicks back now and then with the thumb round it, never with it alongside the fingers', () => {
    const swings = (grip) => {
      const c = new CrankHandle({ ...DEFAULT_CRANK_PARAMS }, createRandom(7));
      c.setGrip(grip);
      let kicks = 0;
      for (let i = 0; i < 400; i++) {
        if (c.swing() === 'kick') kicks++;
        c.update(10); // the hand has stopped hurting before the next go
      }
      return kicks;
    };
    const round = swings('round');
    expect(round).toBeGreaterThan(400 * DEFAULT_CRANK_PARAMS.kickChance * 0.7);
    expect(round).toBeLessThan(400 * DEFAULT_CRANK_PARAMS.kickChance * 1.3);
    expect(swings('along')).toBe(0);
  });

  it('leaves you nursing your hand for a few seconds after a kick-back', () => {
    const c = new CrankHandle({ ...DEFAULT_CRANK_PARAMS, kickChance: 1 });
    expect(c.swing()).toBe('kick');
    expect(c.ready).toBe(false);
    c.update(DEFAULT_CRANK_PARAMS.hurtSeconds - 0.5);
    expect(c.ready).toBe(false);
    c.update(1);
    expect(c.ready).toBe(true);
  });

  it('ignores a grip it does not know', () => {
    const c = new CrankHandle();
    c.setGrip('backwards');
    expect(c.grip).toBe('round');
  });

  it('a girl swinging it holds it her own way, whatever your own grip is', () => {
    const c = new CrankHandle({ ...DEFAULT_CRANK_PARAMS, kickChance: 1 }, createRandom(3));
    c.setGrip('along');
    expect(c.swing('round')).toBe('kick'); // Jess
    c.update(10);
    c.setGrip('round');
    expect(c.swing('along')).toBe('turn'); // Amy
  });
});
