import { describe, it, expect } from 'vitest';
import { chainPull, DEFAULT_CHAIN_PARAMS as P } from '../src/items/chain.js';

describe('the tractor tow chain', () => {
  it('pulls nothing while slack and never pushes', () => {
    expect(chainPull(0)).toBe(0);
    expect(chainPull(-1)).toBe(0);
  });

  it('pulls harder the further it stretches, up to its limit', () => {
    expect(chainPull(0.1)).toBeCloseTo(0.1 * P.stiffness, 5);
    expect(chainPull(10)).toBe(P.maxPull);
  });
});
