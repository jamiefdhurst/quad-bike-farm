import { describe, it, expect } from 'vitest';
import { cleavageShade } from '../src/npc/cleavage.js';

const P = { strength: 0.5, width: 0.01, fade: 0.04 };

describe('drawn cleavage', () => {
  it('is darkest down her middle, below where it starts to fade', () => {
    expect(cleavageShade(0, 0.1, P)).toBeCloseTo(0.5, 6);
  });
  it('is gone beyond its width and above its fade', () => {
    expect(cleavageShade(0.011, 0.1, P)).toBe(1);
    expect(cleavageShade(0, -0.01, P)).toBe(1);
  });
  it('is lighter the further from her middle and the nearer the top', () => {
    expect(cleavageShade(0.005, 0.1, P)).toBeGreaterThan(cleavageShade(0, 0.1, P));
    expect(cleavageShade(0, 0.02, P)).toBeGreaterThan(cleavageShade(0, 0.1, P));
  });
});
