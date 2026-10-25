import { describe, it, expect } from 'vitest';
import { ShadowFit } from '../src/world/shadowFit.js';

describe('ShadowFit', () => {
  it('puts the window ahead of you along the view', () => {
    const f = new ShadowFit();
    f.update(0, 0, 1); // looking along +z
    const c = f.centre({ x: 10, z: 20 }, 20, 0);
    expect(c.x).toBeCloseTo(10);
    expect(c.z).toBeCloseTo(40);
    f.update(0, 1, 0);
    const e = f.centre({ x: 0, z: 0 }, 20, 0);
    expect(e.x).toBeCloseTo(20);
    expect(e.z).toBeCloseTo(0);
  });

  it('snaps to whole texels, so a steady view does not shimmer', () => {
    const f = new ShadowFit();
    f.update(0, 0.3, 0.95);
    const c = f.centre({ x: 1.234, z: 5.678 }, 20, 0.05);
    expect(Math.abs(c.x / 0.05 - Math.round(c.x / 0.05))).toBeLessThan(1e-6);
    expect(Math.abs(c.z / 0.05 - Math.round(c.z / 0.05))).toBeLessThan(1e-6);
  });

  it('glides round the short way when you turn, and holds when you look straight up', () => {
    const f = new ShadowFit();
    f.update(0, 0, 1);
    f.update(1 / 60, 0, -1);
    expect(Math.abs(f.angle)).toBeGreaterThan(0.01);
    expect(Math.abs(f.angle)).toBeLessThan(0.5);
    for (let i = 0; i < 300; i++) f.update(1 / 60, 0, -1);
    expect(Math.abs(Math.abs(f.angle) - Math.PI)).toBeLessThan(0.01);
    const held = f.angle;
    f.update(1 / 60, 0.01, 0.0); // looking at the sky
    expect(f.angle).toBe(held);
  });

  it('snaps straight to the view when time is not passing (photo mode, a fresh game)', () => {
    const f = new ShadowFit();
    f.update(0, 1, 0);
    f.update(0, 0, -1);
    expect(f.angle).toBeCloseTo(Math.PI);
  });

  it('with no push ahead sits on you', () => {
    const f = new ShadowFit();
    f.update(0, 1, 1);
    expect(f.centre({ x: 3, z: 4 }, 0, 0)).toEqual({ x: 3, z: 4 });
  });
});
